import { uid, todayISO, UE_COLORS } from './utils.js';

const STORAGE_KEY = 'studia.state.v1';

function defaultState() {
  return {
    version: 1,
    mode: null,
    onboarded: false,
    settings: {
      rescheduleDelay: 2,
      workStart: '08:00',
      workEnd: '22:00',
      maxHoursPerDay: 6,
      sessionMinutes: 90,
      breakMinutes: 15,
      skipSunday: true
    },
    ues: [],
    sessions: []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      ues: Array.isArray(parsed.ues) ? parsed.ues : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch (error) {
    console.warn('Studia: état illisible, réinitialisation.', error);
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Studia: sauvegarde impossible.', error);
  }
}

function commit() {
  persist();
  listeners.forEach((listener) => listener(state));
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function update(mutator) {
  const result = mutator(state);
  commit();
  return result;
}

export function setMode(mode) {
  if (mode !== 'basic' && mode !== 'advanced') return;
  update((s) => {
    s.mode = mode;
    s.onboarded = true;
  });
}

export function setSetting(key, value) {
  update((s) => {
    s.settings[key] = value;
  });
}

export function addUE(name, color) {
  const ue = {
    id: uid('ue'),
    name: String(name || '').trim() || 'UE sans nom',
    color: color || UE_COLORS[0],
    chapters: [],
    createdAt: new Date().toISOString()
  };
  update((s) => s.ues.push(ue));
  return ue;
}

export function updateUE(id, patch) {
  update((s) => {
    const ue = s.ues.find((u) => u.id === id);
    if (!ue) return;
    if (patch.name != null) ue.name = String(patch.name).trim() || ue.name;
    if (patch.color != null) ue.color = patch.color;
  });
}

export function deleteUE(id) {
  update((s) => {
    s.ues = s.ues.filter((u) => u.id !== id);
    s.sessions = s.sessions.filter((session) => session.ueId !== id);
  });
}

export function addChapter(ueId, name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const chapter = { id: uid('ch'), name: clean, done: false };
  update((s) => {
    const ue = s.ues.find((u) => u.id === ueId);
    if (ue) ue.chapters.push(chapter);
  });
  return chapter;
}

export function deleteChapter(ueId, chapterId) {
  update((s) => {
    const ue = s.ues.find((u) => u.id === ueId);
    if (ue) ue.chapters = ue.chapters.filter((c) => c.id !== chapterId);
    s.sessions = s.sessions.filter((session) => !(session.ueId === ueId && session.chapterId === chapterId));
  });
}

export function setChapterDone(ueId, chapterId, done) {
  update((s) => {
    const ue = s.ues.find((u) => u.id === ueId);
    const chapter = ue && ue.chapters.find((c) => c.id === chapterId);
    if (chapter) chapter.done = !!done;
  });
}

export function addSession(session) {
  const record = {
    id: uid('s'),
    date: session.date || todayISO(),
    start: session.start,
    end: session.end,
    ueId: session.ueId,
    chapterId: session.chapterId,
    status: session.status || 'planned',
    kind: session.kind || 'study',
    auto: !!session.auto,
    rescheduledFrom: session.rescheduledFrom || null,
    createdAt: new Date().toISOString()
  };
  update((s) => s.sessions.push(record));
  return record;
}

export function updateSession(id, patch) {
  update((s) => {
    const session = s.sessions.find((item) => item.id === id);
    if (!session) return;
    Object.assign(session, patch);
  });
}

export function deleteSession(id) {
  update((s) => {
    s.sessions = s.sessions.filter((item) => item.id !== id);
  });
}

export function deleteAutoSessions() {
  update((s) => {
    s.sessions = s.sessions.filter((item) => !item.auto);
  });
}

export function replaceState(next) {
  const base = defaultState();
  update((s) => {
    s.mode = next.mode === 'advanced' ? 'advanced' : next.mode === 'basic' ? 'basic' : s.mode;
    s.onboarded = next.onboarded !== false;
    s.settings = { ...base.settings, ...(next.settings || {}) };
    s.ues = Array.isArray(next.ues) ? next.ues : [];
    s.sessions = Array.isArray(next.sessions) ? next.sessions : [];
  });
}

export function resetState() {
  state = defaultState();
  commit();
}

export function exportState() {
  return JSON.stringify(state, null, 2);
}
