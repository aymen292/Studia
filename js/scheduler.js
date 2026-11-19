import * as store from './store.js';
import { toast, confirmDialog } from './ui.js';
import * as u from './utils.js';
import { buildBusyMap, findSlotNear, reserve, reserveLoad, dayLoad, dayWindow, isRestDay } from './slots.js';
import { intervalsFor } from './reviews.js';

// Alterne les UE (chapitre 1 de A, chapitre 1 de B, chapitre 2 de A…) en gardant l'ordre des chapitres.
function interleaveByUE(ues) {
  const queues = ues
    .map((ue) => ue.chapters.filter((c) => !c.done).map((c) => ({ ueId: ue.id, chapterId: c.id, name: c.name })))
    .filter((queue) => queue.length);
  const ordered = [];
  while (queues.some((q) => q.length)) {
    queues.forEach((queue) => { if (queue.length) ordered.push(queue.shift()); });
  }
  return ordered;
}

/**
 * Place les chapitres :
 *  - autant de séances par jour que la charge max le permet (rythme soutenu),
 *  - réparties équitablement entre les jours nécessaires (ex. 5 chapitres, 4/jour max → 3 + 2),
 *  - étalées sur la journée (matin / après-midi / soir) au lieu d'être collées,
 *  - en gardant de la place pour les 3 révisions espacées que chaque chapitre déclenchera.
 */
export function buildPlan(state) {
  const settings = state.settings;
  const duration = Math.max(30, Number(settings.sessionMinutes) || 90);
  const breakMin = Math.max(0, Number(settings.breakMinutes) || 0);
  const maxLoad = (Number(settings.maxHoursPerDay) || 6) * 60;
  const reviewMinutes = Math.max(15, Number(settings.reviewMinutes) || 45);
  const reviewDays = settings.autoReviews === false ? [] : intervalsFor(settings);
  const capPerDay = Math.max(1, Math.floor(maxLoad / duration));

  const ordered = interleaveByUE(state.ues);
  const busy = buildBusyMap(state.sessions, breakMin);
  const records = [];
  let index = 0;
  let date = u.todayISO();

  for (let guard = 0; index < ordered.length && guard < 365; guard += 1, date = u.addDays(date, 1)) {
    if (isRestDay(date, settings)) continue;
    const remaining = ordered.length - index;
    const daysNeeded = Math.ceil(remaining / capPerDay);
    const fair = Math.ceil(remaining / daysNeeded);
    const room = Math.floor((maxLoad - dayLoad(busy, date)) / duration);
    const count = Math.min(fair, room);
    if (count <= 0) continue;

    const window = dayWindow(date, settings);
    const span = window.end - window.start;
    if (span < duration) continue;

    for (let j = 0; j < count && index < ordered.length; j += 1) {
      const center = window.start + ((j + 0.5) * span) / count;
      const ideal = Math.round((center - duration / 2) / 15) * 15;
      const slot = findSlotNear(date, ideal, duration, settings, busy);
      if (!slot) break;
      const chapter = ordered[index];
      reserve(busy, date, slot.start, duration, breakMin);
      reviewDays.forEach((days) => reserveLoad(busy, u.addDays(date, days), reviewMinutes));
      records.push({
        date,
        start: u.hhmmFromMinutes(slot.start),
        end: u.hhmmFromMinutes(slot.start + duration),
        ueId: chapter.ueId,
        chapterId: chapter.chapterId,
        status: 'planned',
        kind: 'study',
        auto: true
      });
      index += 1;
    }
  }
  return { records: records.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), total: ordered.length };
}

export function generateAutoPlan(rerender) {
  const state = store.getState();
  const pendingCount = state.ues.reduce((n, ue) => n + ue.chapters.filter((c) => !c.done).length, 0);

  if (!pendingCount) {
    toast('Tous tes chapitres sont déjà terminés. Bravo !', 'info');
    return;
  }

  const hasAuto = state.sessions.some((s) => s.auto);
  const proceed = confirmDialog({
    title: hasAuto ? 'Régénérer le planning ?' : 'Générer mon planning',
    message: `${pendingCount} chapitre${pendingCount > 1 ? 's' : ''} à apprendre vont être répartis sur les prochains jours, jusqu’à ${state.settings.maxHoursPerDay}h de travail par jour, en alternant les UE et en étalant les séances dans la journée. De la place est gardée pour les 3 révisions de chaque chapitre.${hasAuto ? '<br><br>Les créneaux générés automatiquement seront remplacés ; tes créneaux manuels et tes révisions sont conservés.' : ''}`,
    confirmLabel: hasAuto ? 'Régénérer' : 'Générer',
    cancelLabel: 'Annuler'
  });

  Promise.resolve(proceed).then((ok) => {
    if (!ok) return;
    store.deleteAutoSessions();
    const { records, total } = buildPlan(store.getState());
    store.addSessions(records);
    const days = new Set(records.map((r) => r.date)).size;
    const missing = total - records.length;
    toast(`Planning généré : ${records.length} séance${records.length > 1 ? 's' : ''} sur ${days} jour${days > 1 ? 's' : ''}${missing ? ` (${missing} sans créneau libre)` : ''}.`, missing ? 'info' : 'success');
    rerender();
  });
}
