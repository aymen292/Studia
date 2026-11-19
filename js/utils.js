export const DAY_MS = 86400000;

// Icônes SVG locales (Lucide, ISC) colorées via CSS mask : elles prennent la couleur du texte.
export function icon(name, cls = '') {
  const url = `icons/ui/${name}.svg`;
  return `<span class="ic ${cls}" style="-webkit-mask-image:url(${url});mask-image:url(${url})" aria-hidden="true"></span>`;
}

export function illustration(name, alt = '', cls = '') {
  return `<img class="illu ${cls}" src="images/${name}.svg" alt="${alt}" loading="lazy" />`;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, days) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function startOfWeek(iso) {
  const d = fromISODate(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

export function weekDates(iso) {
  const start = fromISODate(startOfWeek(iso));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
}

export function todayISO() {
  return toISODate(new Date());
}

export function minutesFromHHMM(value) {
  const [h, m] = String(value || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function hhmmFromMinutes(total) {
  const t = Math.max(0, Math.round(total));
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function formatTime(value) {
  const minutes = typeof value === 'number' ? value : minutesFromHHMM(value);
  return hhmmFromMinutes(minutes);
}

export function formatDateLong(iso) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fromISODate(iso));
}

export function formatDateShort(iso) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(fromISODate(iso));
}

export function formatDayLabel(iso) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(fromISODate(iso)).replace('.', '');
}

export function formatWeekRange(iso) {
  const dates = weekDates(iso);
  const a = fromISODate(dates[0]);
  const b = fromISODate(dates[6]);
  const monthA = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(a);
  const monthB = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(b);
  if (monthA === monthB) return `${a.getDate()} – ${b.getDate()} ${monthB} ${b.getFullYear()}`;
  return `${a.getDate()} ${monthA} – ${b.getDate()} ${monthB} ${b.getFullYear()}`;
}

export function durationLabel(start, end) {
  const mins = minutesFromHHMM(end) - minutesFromHHMM(start);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h${pad(m)}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const UE_COLORS = [
  '#e0608f', '#f29bb8', '#c77dff', '#9b8cf5',
  '#6ec3f0', '#5cc9b5', '#8fd18a', '#f2c14e',
  '#f59e6c', '#b48fa3'
];
