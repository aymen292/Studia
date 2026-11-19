import * as store from './store.js';
import * as u from './utils.js';
import { buildBusyMap, findSlot, findSlotNear, reserve } from './slots.js';

// Révisions espacées : chaque chapitre terminé est revu 3, 5 ou 7 fois, à intervalles croissants.

export const REVIEW_COUNTS = [3, 5, 7];

// Jours après la fin du chapitre pour chaque révision (on garde les N premières).
export const RHYTHMS = {
  intense: { label: 'Intensif', days: [1, 4, 10, 18, 30, 45, 60] },
  balanced: { label: 'Équilibré', days: [3, 7, 16, 30, 50, 75, 110] },
  relaxed: { label: 'Long terme', days: [4, 12, 30, 50, 80, 120, 180] }
};

export function reviewCount(settings) {
  const n = Number(settings.reviewCount);
  return REVIEW_COUNTS.includes(n) ? n : 3;
}

export function intervalsFor(settings) {
  return (RHYTHMS[settings.reviewRhythm] || RHYTHMS.balanced).days.slice(0, reviewCount(settings));
}

export function rhythmLabel(key, count = 3) {
  const rhythm = RHYTHMS[key] || RHYTHMS.balanced;
  return `${rhythm.label} (J+${rhythm.days.slice(0, count).join(', J+')})`;
}

const byDateTime = (a, b) => (a.date + a.start).localeCompare(b.date + b.start);

function reviewsOf(state, ueId, chapterId) {
  return state.sessions.filter((s) => s.kind === 'review' && s.ueId === ueId && s.chapterId === chapterId);
}

export function reviewProgress(state, ueId, chapterId) {
  const total = reviewCount(state.settings);
  const list = reviewsOf(state, ueId, chapterId);
  const doneSteps = new Set(list.filter((s) => s.status === 'done' && s.reviewStep <= total).map((s) => s.reviewStep));
  const next = list.filter((s) => s.status === 'planned').sort(byDateTime)[0] || null;
  return { done: doneSteps.size, total, mastered: doneSteps.size >= total, next };
}

export function upcomingReviews(state, limit = 6) {
  const today = u.todayISO();
  return state.sessions
    .filter((s) => s.kind === 'review' && s.status === 'planned' && s.date >= today)
    .sort(byDateTime)
    .slice(0, limit);
}

export function overdueReviews(state) {
  const today = u.todayISO();
  return state.sessions
    .filter((s) => s.kind === 'review' && s.status === 'planned' && s.date < today)
    .sort(byDateTime);
}

// Place une liste d'étapes {step, target} dans l'agenda, chacune au moins un jour après la précédente.
function placeSteps(ueId, chapterId, items) {
  if (!items.length) return [];
  const state = store.getState();
  const settings = state.settings;
  const duration = Math.max(15, Number(settings.reviewMinutes) || 45);
  const breakMin = Math.max(0, Number(settings.breakMinutes) || 0);
  const busy = buildBusyMap(state.sessions, breakMin);
  const records = [];
  let floor = null;

  items.slice().sort((a, b) => a.step - b.step).forEach(({ step, target, preferStart, redo }) => {
    const from = floor && target <= floor ? u.addDays(floor, 1) : target;
    const near = preferStart != null && from === target ? findSlotNear(from, preferStart, duration, settings, busy) : null;
    const slot = near || findSlot(from, duration, settings, busy);
    if (!slot) return;
    reserve(busy, slot.date, slot.start, duration, breakMin);
    floor = slot.date;
    records.push({
      date: slot.date,
      start: u.hhmmFromMinutes(slot.start),
      end: u.hhmmFromMinutes(slot.start + duration),
      ueId,
      chapterId,
      kind: 'review',
      reviewStep: step,
      redo: !!redo,
      status: 'planned'
    });
  });
  return store.addSessions(records);
}

/** Chapitre terminé : programme les révisions manquantes à partir de la date d'apprentissage. */
export function scheduleReviews(ueId, chapterId, anchorDate = u.todayISO()) {
  const state = store.getState();
  if (state.settings.autoReviews === false) return [];
  const anchor = anchorDate > u.todayISO() ? u.todayISO() : anchorDate;
  const existing = reviewsOf(state, ueId, chapterId).filter((s) => s.status === 'done' || s.status === 'planned');
  const taken = new Set(existing.map((s) => s.reviewStep));
  const items = intervalsFor(state.settings)
    .map((days, index) => ({ step: index + 1, target: u.addDays(anchor, days) }))
    .filter((item) => !taken.has(item.step));
  return placeSteps(ueId, chapterId, items);
}

// Supprime les révisions planifiées d'étape > baseStep et les replace en gardant l'écart du rythme.
function replanFrom(session, baseDate, baseStep, includeSameStep, redo = false) {
  const state = store.getState();
  const intervals = intervalsFor(state.settings);
  const gap = (step) => (intervals[step - 1] ?? intervals[intervals.length - 1]) - (intervals[baseStep - 1] ?? 0);
  const later = reviewsOf(state, session.ueId, session.chapterId)
    .filter((s) => s.status === 'planned' && s.id !== session.id && s.reviewStep > baseStep);
  const items = later.map((s) => ({ step: s.reviewStep, target: u.addDays(baseDate, Math.max(1, gap(s.reviewStep))) }));
  // Réussite : on ne déplace que si l'écart avec la révision précédente est devenu trop court.
  // Échec : on recale toute la suite à partir de la nouvelle date.
  const toMove = later.filter((s, i) => includeSameStep || s.date < items[i].target);
  if (!toMove.length && !includeSameStep) return [];
  const moveIds = new Set(toMove.map((s) => s.id));
  store.deleteSessions([...moveIds]);
  const keep = items.filter((item, i) => moveIds.has(later[i].id));
  const head = includeSameStep ? [{ step: baseStep, target: baseDate, redo }] : [];
  return placeSteps(session.ueId, session.chapterId, [...head, ...keep]);
}

// Révision faite en avance : on la range à aujourd'hui pour que l'agenda reflète la réalité.
function doneToday(session) {
  return session.date > u.todayISO() ? { date: u.todayISO() } : {};
}

/** Révision réussie (même faite en avance) : la suite est calculée à partir d'aujourd'hui. */
export function completeReview(sessionId) {
  const session = store.getState().sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  store.updateSession(session.id, { status: 'done', ...doneToday(session) });
  replanFrom(session, u.todayISO(), session.reviewStep || 1, false);
  return reviewProgress(store.getState(), session.ueId, session.chapterId);
}

/** Révision ratée : on refait la même étape dès le lendemain, et on décale toute la suite. */
export function forgetReview(sessionId) {
  const session = store.getState().sessions.find((s) => s.id === sessionId);
  if (!session) return [];
  store.updateSession(session.id, { status: 'incomplete', ...doneToday(session) });
  const tomorrow = u.addDays(u.todayISO(), 1);
  return replanFrom(session, tomorrow, session.reviewStep || 1, true, true);
}

/** Replace toutes les révisions en retard à partir d'aujourd'hui. */
export function rescheduleOverdue() {
  const state = store.getState();
  const late = overdueReviews(state);
  const chapters = new Map();
  late.forEach((s) => {
    const key = `${s.ueId}|${s.chapterId}`;
    if (!chapters.has(key) || chapters.get(key).reviewStep > s.reviewStep) chapters.set(key, s);
  });
  let moved = 0;
  chapters.forEach((first) => {
    store.deleteSessions([first.id]);
    moved += replanFrom(first, u.todayISO(), first.reviewStep || 1, true).length;
  });
  return moved;
}

/**
 * Nombre de révisions modifié : on ajoute les révisions manquantes aux chapitres terminés
 * (dans la continuité de la dernière), ou on retire celles en trop encore à venir.
 */
export function syncReviewCount() {
  const state = store.getState();
  if (state.settings.autoReviews === false) return { added: 0, removed: 0 };
  const count = reviewCount(state.settings);
  const intervals = intervalsFor(state.settings);
  const extra = state.sessions.filter((s) => s.kind === 'review' && s.status === 'planned' && s.reviewStep > count);
  store.deleteSessions(extra.map((s) => s.id));

  let added = 0;
  state.ues.forEach((ue) => ue.chapters.forEach((chapter) => {
    if (!chapter.done) return;
    const list = reviewsOf(store.getState(), ue.id, chapter.id).filter((s) => s.status === 'done' || s.status === 'planned');
    if (!list.length) return;
    const last = list.reduce((a, b) => (b.reviewStep > a.reviewStep || (b.reviewStep === a.reviewStep && b.date > a.date) ? b : a));
    const taken = new Set(list.map((s) => s.reviewStep));
    const items = [];
    for (let step = last.reviewStep + 1; step <= count; step += 1) {
      if (taken.has(step)) continue;
      items.push({ step, target: u.addDays(last.date, intervals[step - 1] - intervals[last.reviewStep - 1]) });
    }
    added += placeSteps(ue.id, chapter.id, items).length;
  }));
  return { added, removed: extra.length };
}

/** Nouvelle durée de révision : on réajuste toutes les révisions à venir (même jour, heure la plus proche). */
export function applyReviewDuration() {
  const state = store.getState();
  const today = u.todayISO();
  const planned = state.sessions.filter((s) => s.kind === 'review' && s.status === 'planned' && s.date >= today);
  const groups = new Map();
  planned.forEach((s) => {
    const key = `${s.ueId}|${s.chapterId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });
  store.deleteSessions(planned.map((s) => s.id));
  let count = 0;
  groups.forEach((list) => {
    count += placeSteps(list[0].ueId, list[0].chapterId, list.map((s) => ({
      step: s.reviewStep || 1,
      target: s.date,
      preferStart: u.minutesFromHHMM(s.start),
      redo: s.redo
    }))).length;
  });
  return count;
}

/** Chapitre décoché : on annule les révisions encore à venir. */
export function cancelPlannedReviews(ueId, chapterId) {
  const ids = reviewsOf(store.getState(), ueId, chapterId).filter((s) => s.status === 'planned').map((s) => s.id);
  store.deleteSessions(ids);
  return ids.length;
}

export function describeCreated(created) {
  if (!created.length) return '';
  return created.map((s) => u.formatDateShort(s.date).slice(0, 5)).join(', ');
}
