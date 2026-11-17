import * as store from './store.js';
import { toast, confirmDialog } from './ui.js';
import * as u from './utils.js';

function buildBusyMap(sessions) {
  const map = new Map();
  sessions.forEach((session) => {
    if (!map.has(session.date)) map.set(session.date, []);
    map.get(session.date).push([u.minutesFromHHMM(session.start), u.minutesFromHHMM(session.end)]);
  });
  return map;
}

function isSunday(iso) {
  return u.fromISODate(iso).getDay() === 0;
}

function nextAllowedDate(iso, skipSunday) {
  let date = iso;
  let guard = 0;
  while (skipSunday && isSunday(date) && guard < 10) {
    date = u.addDays(date, 1);
    guard += 1;
  }
  return date;
}

function findSlot(fromDate, duration, settings, busyMap) {
  let date = nextAllowedDate(fromDate, settings.skipSunday);
  const dayStart = u.minutesFromHHMM(settings.workStart);
  const hardEnd = u.minutesFromHHMM(settings.workEnd);
  const dayLimit = dayStart + (Number(settings.maxHoursPerDay) || 6) * 60;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    date = nextAllowedDate(date, settings.skipSunday);
    const limit = Math.min(hardEnd, dayLimit);
    const busy = (busyMap.get(date) || []).slice().sort((a, b) => a[0] - b[0]);
    let cursor = dayStart;

    for (const [busyStart, busyEnd] of busy) {
      if (busyEnd <= cursor) continue;
      if (busyStart - cursor >= duration) return { date, start: cursor };
      cursor = Math.max(cursor, busyEnd);
    }
    if (limit - cursor >= duration) return { date, start: cursor };

    date = u.addDays(date, 1);
  }
  return null;
}

function reserve(busyMap, date, startMin, duration) {
  if (!busyMap.has(date)) busyMap.set(date, []);
  busyMap.get(date).push([startMin, startMin + duration]);
}

export function generateAutoPlan(rerender) {
  const state = store.getState();
  const pending = [];
  state.ues.forEach((ue) => {
    ue.chapters.forEach((chapter) => {
      if (!chapter.done) pending.push({ ueId: ue.id, chapterId: chapter.id, name: chapter.name });
    });
  });

  if (!pending.length) {
    toast('Tous vos chapitres sont déjà terminés. Bravo !', 'info');
    return;
  }

  const hasAuto = state.sessions.some((s) => s.auto);
  const proceed = hasAuto
    ? confirmDialog({
        title: 'Régénérer le planning ?',
        message: 'Les créneaux générés automatiquement seront remplacés. Vos créneaux ajoutés à la main seront conservés.',
        confirmLabel: 'Régénérer',
        cancelLabel: 'Annuler'
      })
    : confirmDialog({
        title: 'Générer mon planning',
        message: `${pending.length} chapitre${pending.length > 1 ? 's' : ''} restant${pending.length > 1 ? 's' : ''} vont être répartis en sessions régulières, avec des révisions espacées et sans dépasser ${state.settings.maxHoursPerDay}h par jour.`,
        confirmLabel: 'Générer',
        cancelLabel: 'Annuler'
      });

  Promise.resolve(proceed).then((ok) => {
    if (!ok) return;
    const current = store.getState();
    const settings = { ...current.settings };
    const manualSessions = current.sessions.filter((s) => !s.auto);
    store.deleteAutoSessions();

    const fresh = store.getState();
    const busy = buildBusyMap(manualSessions);
    const startDate = u.todayISO();
    const duration = Math.max(30, Number(settings.sessionMinutes) || 90);
    const breakMin = Math.max(0, Number(settings.breakMinutes) || 15);
    const created = [];

    pending.forEach((chapter) => {
      const slot = findSlot(startDate, duration, settings, busy);
      if (!slot) return;
      const session = store.addSession({
        date: slot.date,
        start: u.hhmmFromMinutes(slot.start),
        end: u.hhmmFromMinutes(slot.start + duration),
        ueId: chapter.ueId,
        chapterId: chapter.chapterId,
        status: 'planned',
        kind: 'study',
        auto: true
      });
      reserve(busy, slot.date, slot.start, duration + breakMin);
      created.push({ session, chapter });
    });

    const reviewDuration = Math.max(30, Math.min(45, duration));
    created.forEach(({ session, chapter }, index) => {
      if ((index + 1) % 3 !== 0) return;
      const reviewDate = u.addDays(session.date, 2);
      const slot = findSlot(reviewDate, reviewDuration, settings, busy);
      if (!slot) return;
      store.addSession({
        date: slot.date,
        start: u.hhmmFromMinutes(slot.start),
        end: u.hhmmFromMinutes(slot.start + reviewDuration),
        ueId: chapter.ueId,
        chapterId: chapter.chapterId,
        status: 'planned',
        kind: 'review',
        auto: true
      });
      reserve(busy, slot.date, slot.start, reviewDuration + breakMin);
    });

    const total = created.length + Math.floor(created.length / 3);
    toast(`Planning généré : ${total} créneau${total > 1 ? 'x' : ''}.`, 'success');
    rerender();
  });
}
