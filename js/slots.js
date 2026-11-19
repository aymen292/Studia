import * as u from './utils.js';

// Recherche de créneaux libres, partagée par le planning automatique et les révisions espacées.

const STEP = 15;
const LUNCH = [12 * 60, 13 * 60];

function ensureDay(map, date) {
  if (!map.has(date)) map.set(date, { intervals: [], load: 0 });
  return map.get(date);
}

export function buildBusyMap(sessions, breakMin = 0) {
  const map = new Map();
  sessions.forEach((session) => {
    const start = u.minutesFromHHMM(session.start);
    const end = u.minutesFromHHMM(session.end);
    const day = ensureDay(map, session.date);
    day.intervals.push([start, end + breakMin]);
    day.load += Math.max(0, end - start);
  });
  return map;
}

export function reserve(map, date, start, duration, breakMin = 0) {
  const day = ensureDay(map, date);
  day.intervals.push([start, start + duration + breakMin]);
  day.load += duration;
}

/** Réserve uniquement de la charge (sans horaire), ex. pour anticiper de futures révisions. */
export function reserveLoad(map, date, minutes) {
  ensureDay(map, date).load += minutes;
}

export function dayLoad(map, date) {
  return (map.get(date) || { load: 0 }).load;
}

export function isRestDay(iso, settings) {
  return !!settings.skipSunday && u.fromISODate(iso).getDay() === 0;
}

function nowMinutesRounded() {
  const now = new Date();
  return Math.ceil((now.getHours() * 60 + now.getMinutes()) / STEP) * STEP;
}

/** Plage de travail utilisable ce jour-là (aujourd'hui : à partir de maintenant). */
export function dayWindow(date, settings) {
  const start = u.minutesFromHHMM(settings.workStart);
  const end = u.minutesFromHHMM(settings.workEnd);
  const from = date === u.todayISO() ? Math.max(start, nowMinutesRounded()) : start;
  return { start: Math.ceil(from / STEP) * STEP, end };
}

function fits(day, start, duration, breakMin, settings) {
  for (const [busyStart, busyEnd] of day.intervals) {
    if (start < busyEnd && start + duration + breakMin > busyStart) return false;
  }
  if (settings.lunchBreak !== false && start < LUNCH[1] && start + duration > LUNCH[0]) return false;
  return true;
}

/**
 * Créneau libre le plus proche de l'heure `ideal` (en minutes) ce jour-là, ou null.
 * Respecte la plage de travail, la pause entre sessions, la pause déjeuner,
 * le jour de repos et la charge maximale par jour.
 */
export function findSlotNear(date, ideal, duration, settings, busyMap) {
  if (date < u.todayISO() || isRestDay(date, settings)) return null;
  const maxLoad = (Number(settings.maxHoursPerDay) || 6) * 60;
  const breakMin = Math.max(0, Number(settings.breakMinutes) || 0);
  const day = busyMap.get(date) || { intervals: [], load: 0 };
  if (day.load + duration > maxLoad) return null;

  const window = dayWindow(date, settings);
  let best = null;
  for (let start = window.start; start + duration <= window.end; start += STEP) {
    if (!fits(day, start, duration, breakMin, settings)) continue;
    const distance = Math.abs(start - ideal);
    if (!best || distance < best.distance) best = { start, distance };
  }
  return best ? { date, start: best.start } : null;
}

/** Premier créneau libre à partir de `fromDate` (jamais dans le passé). */
export function findSlot(fromDate, duration, settings, busyMap) {
  const today = u.todayISO();
  let date = fromDate < today ? today : fromDate;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const slot = findSlotNear(date, 0, duration, settings, busyMap);
    if (slot) return slot;
    date = u.addDays(date, 1);
  }
  return null;
}
