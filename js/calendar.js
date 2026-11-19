import * as store from './store.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import * as u from './utils.js';
import * as reviews from './reviews.js';
import { buildBusyMap, findSlotNear } from './slots.js';

let viewDate = u.todayISO();
let selectedDate = u.todayISO();

export function goToToday() {
  viewDate = u.todayISO();
  selectedDate = viewDate;
}

function kindLabel(session) {
  if (session.kind === 'review') {
    const total = reviews.reviewCount(store.getState().settings);
    const base = session.reviewStep ? `Révision ${session.reviewStep}/${total}` : 'Révision';
    return session.redo ? `${base} à refaire` : base;
  }
  if (session.kind === 'retry') return 'Reprise';
  return 'Cours';
}

// Code couleur par type de séance : cours = violet, reprise = jaune, révision = rose.
export const KIND_COLORS = { study: '#7468e8', retry: '#e5a52a', review: '#e0608f' };
function kindColor(session) {
  return KIND_COLORS[session.kind] || KIND_COLORS.study;
}

function ueDot(ue) {
  return `<i class="ue-dot" style="background:${u.escapeHtml(ue ? ue.color : '#c9a3b5')}"></i>`;
}

// Reprise d'un cours pas fini : même durée, à l'heure libre la plus proche de l'horaire d'origine,
// le jour prévu ou les suivants, sans jamais chevaucher un autre créneau.
function findRetrySlot(session, fromDate) {
  const state = store.getState();
  const duration = u.minutesFromHHMM(session.end) - u.minutesFromHHMM(session.start);
  const breakMin = Math.max(0, Number(state.settings.breakMinutes) || 0);
  const ideal = u.minutesFromHHMM(session.start);
  const today = u.todayISO();
  const attempts = [state.settings, { ...state.settings, maxHoursPerDay: 24, lunchBreak: false }];
  for (const settings of attempts) {
    const busy = buildBusyMap(state.sessions, breakMin);
    let date = fromDate < today ? today : fromDate;
    for (let i = 0; i < 60; i += 1, date = u.addDays(date, 1)) {
      const slot = findSlotNear(date, ideal, duration, settings, busy);
      if (slot) return { date: slot.date, start: u.hhmmFromMinutes(slot.start), end: u.hhmmFromMinutes(slot.start + duration) };
    }
  }
  return null;
}

function renderSide(state, ueMap) {
  const today = u.todayISO();
  const late = reviews.overdueReviews(state);
  const nowHHMM = u.hhmmFromMinutes(new Date().getHours() * 60 + new Date().getMinutes());
  // Toutes les séances d'aujourd'hui jusqu'au dimanche de la semaine en cours : cours, reprises et révisions.
  const weekEnd = u.addDays(u.startOfWeek(today), 6);
  const upcoming = state.sessions
    .filter((s) => s.status === 'planned' && s.date <= weekEnd && (s.date > today || (s.date === today && s.end > nowHHMM)))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 30);
  const reviewTotal = reviews.reviewCount(state.settings);
  const kindTag = (s) => {
    if (s.kind === 'review') return `<span class="kind-tag kind-tag-review">Révision ${s.reviewStep || '?'}/${reviewTotal}</span>${s.redo ? ' <span class="redo-tag">à refaire</span>' : ''}`;
    if (s.kind === 'retry') return '<span class="kind-tag kind-tag-retry">Reprise</span>';
    return '<span class="kind-tag kind-tag-study">Cours</span>';
  };

  const lateBlock = late.length ? `
    <div class="side-alert">
      <p>${u.icon('alarm-clock', 'ic-sm')} <strong>${late.length} révision${late.length > 1 ? 's' : ''} en retard</strong><br>On les replace dès aujourd'hui ?</p>
      <button class="btn btn-mini" type="button" data-fix-overdue>Les replacer</button>
    </div>` : '';

  const upcomingList = upcoming.length ? upcoming.map((s) => {
    const ue = ueMap.get(s.ueId);
    const chapter = ue && ue.chapters.find((c) => c.id === s.chapterId);
    const when = s.date === today ? "Aujourd'hui" : s.date === u.addDays(today, 1) ? 'Demain' : u.formatDayLabel(s.date) + ' ' + u.fromISODate(s.date).getDate();
    return `
      <li class="side-review kind-${u.escapeHtml(s.kind || 'study')}" style="--ue-color:${kindColor(s)}">
        <button type="button" data-goto="${s.date}">
          <span class="side-review-when">${u.escapeHtml(when)} · ${u.escapeHtml(s.start)}</span>
          <span class="side-review-name">${u.escapeHtml(chapter ? chapter.name : 'Chapitre')}</span>
          <span class="side-review-meta">${kindTag(s)} ${ueDot(ue)}${u.escapeHtml(ue ? ue.name : '')} · ${u.escapeHtml(u.durationLabel(s.start, s.end))}</span>
        </button>
      </li>`;
  }).join('') : '<li class="side-empty">Rien de prévu d’ici dimanche. Ajoute un créneau ou génère ton planning.' + u.illustration('focused', '', 'side-illu') + '</li>';

  const progress = state.ues.length ? state.ues.map((ue) => {
    const total = ue.chapters.length;
    const done = ue.chapters.filter((c) => c.done).length;
    const mastered = ue.chapters.filter((c) => c.done && reviews.reviewProgress(state, ue.id, c.id).mastered).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const pctM = total ? Math.round((mastered / total) * 100) : 0;
    return `
      <li class="side-ue" style="--ue-color:${u.escapeHtml(ue.color)}">
        <div class="side-ue-top"><span>${u.escapeHtml(ue.name)}</span><small>${done}/${total}</small></div>
        <div class="progress"><span class="progress-done" style="width:${pct}%"></span><span class="progress-mastered" style="width:${pctM}%"></span></div>
      </li>`;
  }).join('') : '<li class="side-empty">Crée ta première UE dans « Mes UE ».</li>';

  return `
    <aside class="agenda-side">
      ${lateBlock}
      <div class="card side-card side-card-grow">
        <h3>Prochaines révisions <small class="side-count">${upcoming.length}</small></h3>
        <p class="side-sub">Jusqu’à dimanche ${u.fromISODate(weekEnd).getDate()} ${new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(u.fromISODate(weekEnd))}</p>
        <ul class="side-list">${upcomingList}</ul>
      </div>
      <div class="card side-card">
        <h3>Mon avancée</h3>
        <ul class="side-list">${progress}</ul>
        <p class="side-legend"><span class="dot dot-done"></span> terminé <span class="dot dot-mastered"></span> maîtrisé (${reviews.reviewCount(state.settings)} révisions réussies)</p>
      </div>
    </aside>`;
}

export function renderAgenda(main, rerender) {
  const state = store.getState();
  const today = u.todayISO();
  const dates = u.weekDates(viewDate);
  const sessions = state.sessions.filter((s) => s.date === selectedDate);
  const settings = state.settings;

  const sessionHours = sessions.flatMap((s) => [
    u.minutesFromHHMM(s.start) / 60,
    u.minutesFromHHMM(s.end) / 60
  ]);
  const workStartHour = Math.floor(u.minutesFromHHMM(settings.workStart) / 60);
  const workEndHour = Math.ceil(u.minutesFromHHMM(settings.workEnd) / 60);
  const minHour = Math.max(0, Math.min(workStartHour, sessionHours.length ? Math.floor(Math.min(...sessionHours)) : workStartHour));
  const maxHour = Math.min(24, Math.max(workEndHour, sessionHours.length ? Math.ceil(Math.max(...sessionHours)) : workEndHour));
  const span = Math.max(60, (maxHour - minHour) * 60);
  const pct = (minutes) => (((minutes - minHour * 60) / span) * 100).toFixed(3);
  const hours = [];
  for (let h = minHour; h < maxHour; h += 1) hours.push(h);

  const ueMap = new Map(state.ues.map((ue) => [ue.id, ue]));
  const lateCount = reviews.overdueReviews(state).length;

  const dayButtons = dates.map((date) => {
    const daySessions = state.sessions.filter((s) => s.date === date);
    const hasReview = daySessions.some((s) => s.kind === 'review');
    const isToday = date === today;
    const isSelected = date === selectedDate;
    return `
      <button class="day-chip ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}" type="button" data-date="${date}" aria-pressed="${isSelected}">
        <span class="day-chip-label">${u.escapeHtml(u.formatDayLabel(date))}</span>
        <span class="day-chip-num">${u.fromISODate(date).getDate()}</span>
        <span class="day-chip-dot ${daySessions.length ? 'has-sessions' : ''} ${hasReview ? 'has-review' : ''}"></span>
      </button>`;
  }).join('');

  const axisRows = [...hours, maxHour].map((h) => `
    <div class="hour-label" style="top:${pct(h * 60)}%">${u.formatTime(h * 60)}</div>
  `).join('');

  const gridRows = hours.map((h) => `
    <div class="hour-line" style="top:${pct(h * 60)}%"></div>
    <button class="slot-hit" type="button" data-start="${u.hhmmFromMinutes(h * 60)}" style="top:${pct(h * 60)}%;height:${((60 / span) * 100).toFixed(3)}%" aria-label="Réserver à ${u.formatTime(h * 60)}"></button>
  `).join('');

  const sessionBlocks = sessions.map((session) => {
    const ue = ueMap.get(session.ueId);
    const chapter = ue && ue.chapters.find((c) => c.id === session.chapterId);
    const startMin = u.minutesFromHHMM(session.start);
    const endMin = u.minutesFromHHMM(session.end);
    const statusIcon = session.status === 'done' ? ' ' + u.icon('check', 'ic-sm') : session.status === 'incomplete' ? ' ' + u.icon('x', 'ic-sm') : '';
    const label = kindLabel(session);
    return `
      <button class="session-block status-${u.escapeHtml(session.status)} kind-${u.escapeHtml(session.kind || 'study')}" type="button" data-session="${session.id}"
        style="top:calc(${pct(startMin)}% + 1px);height:calc(${pct(endMin)}% - ${pct(startMin)}% - 2px);--ue-color:${kindColor(session)}">
        <span class="session-line">
          <span class="session-time">${u.escapeHtml(session.start)} – ${u.escapeHtml(session.end)}</span>
          <span class="session-title">${label ? `<em>${label}</em> · ` : ''}${ueDot(ue)}${u.escapeHtml(ue ? ue.name : 'UE supprimée')}<span class="session-chapter-inline"> · <strong>${u.escapeHtml(chapter ? chapter.name : 'Chapitre supprimé')}</strong>${statusIcon}</span></span>
        </span>
        <span class="session-chapter">${u.escapeHtml(chapter ? chapter.name : 'Chapitre supprimé')}${statusIcon}</span>
      </button>`;
  }).join('');

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nowLine = selectedDate === today && nowMin >= minHour * 60 && nowMin <= maxHour * 60
    ? `<div class="now-line" style="top:${pct(nowMin)}%"></div>` : '';

  main.innerHTML = `
    <section class="view view-agenda">
      <div class="agenda-main">
        <div class="agenda-toolbar card">
          <button class="icon-btn icon-btn-soft" id="prevWeek" type="button" aria-label="Semaine précédente">${u.icon('chevron-left')}</button>
          <div class="week-title">
            <strong>${u.escapeHtml(u.formatWeekRange(viewDate))}</strong>
            <button class="link-btn" id="todayBtn" type="button">Aujourd'hui</button>
          </div>
          <button class="icon-btn icon-btn-soft" id="nextWeek" type="button" aria-label="Semaine suivante">${u.icon('chevron-right')}</button>
          <div class="toolbar-actions">
            ${state.mode === 'advanced' ? `<button class="btn btn-secondary" id="generatePlanBtn" type="button" title="Générer mon planning">${u.icon('sparkles')} <span class="btn-text">Générer</span></button>` : ''}
            <button class="btn btn-primary" id="addSlotBtn" type="button">${u.icon('plus')} <span class="btn-text">Créneau</span></button>
          </div>
        </div>

        <div class="day-strip" role="tablist" aria-label="Choisir un jour">${dayButtons}</div>

        <div class="timeline-card card">
          <div class="timeline-head">
            <span class="timeline-date">${u.escapeHtml(u.formatDateLong(selectedDate))}</span>
            ${lateCount ? `<button class="late-chip" type="button" data-fix-overdue>${u.icon('alarm-clock', 'ic-sm')} ${lateCount} révision${lateCount > 1 ? 's' : ''} en retard · replacer</button>` : '<span class="timeline-hint">Touche une heure pour réserver</span>'}
          </div>
          <div class="timeline">
            <div class="time-axis">${axisRows}</div>
            <div class="time-grid">
              ${gridRows}
              ${sessionBlocks}
              ${nowLine}
              ${sessions.length ? '' : `<div class="day-empty">${u.illustration('mindfulness', '')}<p>Journée libre. Touche une heure pour ajouter un créneau.</p></div>`}
            </div>
          </div>
        </div>
      </div>
      ${renderSide(state, ueMap)}
    </section>
  `;

  main.querySelectorAll('.day-chip').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDate = button.dataset.date;
      rerender();
    });
  });

  main.querySelector('#prevWeek').addEventListener('click', () => {
    viewDate = u.addDays(viewDate, -7);
    selectedDate = u.startOfWeek(viewDate);
    rerender();
  });
  main.querySelector('#nextWeek').addEventListener('click', () => {
    viewDate = u.addDays(viewDate, 7);
    selectedDate = u.startOfWeek(viewDate);
    rerender();
  });
  main.querySelector('#todayBtn').addEventListener('click', () => {
    goToToday();
    rerender();
  });
  main.querySelector('#addSlotBtn').addEventListener('click', () => {
    const next = suggestStart(state, selectedDate);
    openSessionEditor({ date: selectedDate, start: next, end: u.hhmmFromMinutes(u.minutesFromHHMM(next) + 60), rerender });
  });
  main.querySelectorAll('.slot-hit').forEach((button) => {
    button.addEventListener('click', () => {
      const start = button.dataset.start;
      openSessionEditor({ date: selectedDate, start, end: u.hhmmFromMinutes(u.minutesFromHHMM(start) + 60), rerender });
    });
  });
  main.querySelectorAll('.session-block').forEach((button) => {
    button.addEventListener('click', () => {
      const session = store.getState().sessions.find((item) => item.id === button.dataset.session);
      if (session) openSessionDetail(session, rerender);
    });
  });
  main.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDate = button.dataset.goto;
      viewDate = selectedDate;
      rerender();
    });
  });
  main.querySelectorAll('[data-fix-overdue]').forEach((button) => {
    button.addEventListener('click', () => {
      const moved = reviews.rescheduleOverdue();
      toast(moved ? `${moved} révision${moved > 1 ? 's' : ''} replacée${moved > 1 ? 's' : ''}.` : 'Aucun créneau libre trouvé.', moved ? 'success' : 'error');
      rerender();
    });
  });
  const generateBtn = main.querySelector('#generatePlanBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const { generateAutoPlan } = await import('./scheduler.js');
      generateAutoPlan(rerender);
    });
  }
}

function suggestStart(state, date) {
  const busy = state.sessions.filter((s) => s.date === date)
    .map((s) => u.minutesFromHHMM(s.end));
  const workStart = u.minutesFromHHMM(state.settings.workStart);
  const candidate = busy.length ? Math.max(...busy) + 15 : workStart;
  return u.hhmmFromMinutes(Math.min(candidate, 23 * 60));
}

function ueOptions(state, selectedId) {
  if (!state.ues.length) return '<option value="">Aucune UE — créez-en une d’abord</option>';
  return state.ues.map((ue) => `<option value="${ue.id}" ${ue.id === selectedId ? 'selected' : ''}>${u.escapeHtml(ue.name)}</option>`).join('');
}

function chapterOptions(state, ueId, selectedId) {
  const ue = state.ues.find((item) => item.id === ueId);
  if (!ue || !ue.chapters.length) return '<option value="">Aucun chapitre — ajoutez-en un dans « Mes UE »</option>';
  return ue.chapters.map((chapter) => `
    <option value="${chapter.id}" ${chapter.id === selectedId ? 'selected' : ''}>${u.escapeHtml(chapter.name)}${chapter.done ? ' (terminé)' : ''}</option>
  `).join('');
}

export function openSessionEditor({ date, start, end, session = null, rerender }) {
  const state = store.getState();
  const defaults = {
    date: date || session?.date || u.todayISO(),
    start: start || session?.start || '09:00',
    end: end || session?.end || '10:00',
    ueId: session?.ueId || state.ues[0]?.id || '',
    chapterId: session?.chapterId || state.ues[0]?.chapters[0]?.id || ''
  };

  const mount = (values) => {
    showModal({
      title: session ? 'Modifier le créneau' : 'Réserver un créneau',
      bodyHtml: `
        <div class="form-grid">
          <label class="field field-full">
            <span>Date</span>
            <input type="date" id="fDate" value="${u.escapeHtml(values.date)}" />
          </label>
          <label class="field">
            <span>Début</span>
            <input type="time" id="fStart" value="${u.escapeHtml(values.start)}" />
          </label>
          <label class="field">
            <span>Fin</span>
            <input type="time" id="fEnd" value="${u.escapeHtml(values.end)}" />
          </label>
          <div class="field field-full duration-line" id="durationLine"></div>
          <label class="field field-full">
            <span>UE (module)</span>
            <div class="select-row">
              <select id="fUe">${ueOptions(store.getState(), values.ueId)}</select>
              <button class="btn btn-mini" id="quickUeBtn" type="button" title="Créer une UE">+ UE</button>
            </div>
          </label>
          <label class="field field-full">
            <span>Chapitre</span>
            <div class="select-row">
              <select id="fChapter">${chapterOptions(store.getState(), values.ueId, values.chapterId)}</select>
              <button class="btn btn-mini" id="quickChapterBtn" type="button" title="Créer un chapitre">+ Chapitre</button>
            </div>
          </label>
        </div>
        <p class="form-note">Astuce : choisissez librement la durée, même 3h ou 4h.</p>
      `,
      footerHtml: `
        ${session ? '<button class="btn btn-danger-ghost" id="deleteSlotBtn" type="button">Supprimer</button>' : ''}
        <button class="btn btn-ghost" id="cancelSlotBtn" type="button">Annuler</button>
        <button class="btn btn-primary" id="saveSlotBtn" type="button">Enregistrer</button>
      `,
      onMount(root) {
        const fDate = root.querySelector('#fDate');
        const fStart = root.querySelector('#fStart');
        const fEnd = root.querySelector('#fEnd');
        const fUe = root.querySelector('#fUe');
        const fChapter = root.querySelector('#fChapter');
        const durationLine = root.querySelector('#durationLine');

        const current = () => ({
          date: fDate.value || values.date,
          start: fStart.value || values.start,
          end: fEnd.value || values.end,
          ueId: fUe.value,
          chapterId: fChapter.value
        });

        const refreshDuration = () => {
          const a = u.minutesFromHHMM(fStart.value);
          const b = u.minutesFromHHMM(fEnd.value);
          if (b > a) {
            durationLine.textContent = `Durée : ${u.durationLabel(fStart.value, fEnd.value)}`;
            durationLine.classList.remove('is-error');
          } else {
            durationLine.textContent = 'L’heure de fin doit être après l’heure de début.';
            durationLine.classList.add('is-error');
          }
        };

        fUe.addEventListener('change', () => {
          fChapter.innerHTML = chapterOptions(store.getState(), fUe.value, '');
        });
        fStart.addEventListener('change', refreshDuration);
        fEnd.addEventListener('change', refreshDuration);
        refreshDuration();

        root.querySelector('#cancelSlotBtn').addEventListener('click', closeModal);

        root.querySelector('#quickUeBtn').addEventListener('click', () => {
          openQuickUE((created) => mount({ ...current(), ueId: created.id, chapterId: '' }));
        });

        root.querySelector('#quickChapterBtn').addEventListener('click', () => {
          const ueId = fUe.value;
          if (!ueId) { toast('Créez d’abord une UE.', 'error'); return; }
          openQuickChapter(ueId, (created) => mount({ ...current(), ueId, chapterId: created.id }));
        });

        const deleteBtn = root.querySelector('#deleteSlotBtn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            const ok = await confirmDialog({
              title: 'Supprimer ce créneau ?',
              message: 'Le créneau sera retiré de votre agenda.',
              confirmLabel: 'Supprimer',
              destructive: true
            });
            if (!ok) return;
            store.deleteSession(session.id);
            closeModal();
            toast('Créneau supprimé.');
            rerender();
          });
        }

        root.querySelector('#saveSlotBtn').addEventListener('click', () => {
          const valuesNow = current();
          if (!valuesNow.date || !valuesNow.start || !valuesNow.end) {
            toast('Renseignez la date et les horaires.', 'error');
            return;
          }
          if (u.minutesFromHHMM(valuesNow.end) <= u.minutesFromHHMM(valuesNow.start)) {
            toast('Vérifiez l’heure de fin.', 'error');
            return;
          }
          if (!valuesNow.ueId || !valuesNow.chapterId) {
            toast('Choisissez une UE et un chapitre.', 'error');
            return;
          }
          const conflict = store.getState().sessions.find((item) => (
            item.id !== session?.id && item.date === valuesNow.date &&
            u.minutesFromHHMM(item.start) < u.minutesFromHHMM(valuesNow.end) &&
            u.minutesFromHHMM(item.end) > u.minutesFromHHMM(valuesNow.start)
          ));
          if (conflict) {
            toast('Ce créneau chevauche un cours déjà prévu.', 'error');
            return;
          }

          const payload = {
            date: valuesNow.date,
            start: valuesNow.start,
            end: valuesNow.end,
            ueId: valuesNow.ueId,
            chapterId: valuesNow.chapterId,
            status: session ? session.status : 'planned'
          };
          if (session) store.updateSession(session.id, payload);
          else store.addSession(payload);
          closeModal();
          toast(session ? 'Créneau mis à jour.' : 'Créneau ajouté à l’agenda.', 'success');
          rerender();
        });
      }
    });
  };

  mount(defaults);
}

function openQuickUE(onCreated) {
  showModal({
    title: 'Créer une UE',
    bodyHtml: `
      <div class="form-grid">
        <label class="field field-full"><span>Nom de l’UE</span><input type="text" id="qUeName" placeholder="Ex. Mathématiques appliquées" /></label>
        <div class="field field-full"><span>Couleur</span><div class="swatches" id="qUeColors"></div></div>
      </div>
    `,
    footerHtml: '<button class="btn btn-ghost" id="qUeCancel" type="button">Annuler</button><button class="btn btn-primary" id="qUeSave" type="button">Créer</button>',
    onMount(root) {
      const swatches = root.querySelector('#qUeColors');
      let color = u.UE_COLORS[0];
      swatches.innerHTML = u.UE_COLORS.map((c, i) => `<button type="button" class="swatch ${i === 0 ? 'is-selected' : ''}" data-color="${c}" style="--swatch:${c}" aria-label="Couleur ${i + 1}"></button>`).join('');
      swatches.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
        swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
        color = b.dataset.color;
      }));
      root.querySelector('#qUeCancel').addEventListener('click', closeModal);
      root.querySelector('#qUeSave').addEventListener('click', () => {
        const name = root.querySelector('#qUeName').value.trim();
        if (!name) { toast('Donnez un nom à l’UE.', 'error'); return; }
        const ue = store.addUE(name, color);
        closeModal();
        toast('UE créée.', 'success');
        onCreated(ue);
      });
    }
  });
}

function openQuickChapter(ueId, onCreated) {
  showModal({
    title: 'Ajouter un chapitre',
    bodyHtml: `
      <div class="form-grid">
        <label class="field field-full"><span>Nom du chapitre</span><input type="text" id="qChName" placeholder="Ex. Dérivées et applications" /></label>
      </div>
    `,
    footerHtml: '<button class="btn btn-ghost" id="qChCancel" type="button">Annuler</button><button class="btn btn-primary" id="qChSave" type="button">Ajouter</button>',
    onMount(root) {
      const input = root.querySelector('#qChName');
      root.querySelector('#qChCancel').addEventListener('click', closeModal);
      const save = () => {
        const chapter = store.addChapter(ueId, input.value);
        if (!chapter) { toast('Donnez un nom au chapitre.', 'error'); return; }
        closeModal();
        toast('Chapitre ajouté.', 'success');
        onCreated(chapter);
      };
      root.querySelector('#qChSave').addEventListener('click', save);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    }
  });
}

function openSessionDetail(session, rerender) {
  const state = store.getState();
  const ue = state.ues.find((item) => item.id === session.ueId);
  const chapter = ue && ue.chapters.find((c) => c.id === session.chapterId);
  const isReview = session.kind === 'review';
  const statusLabel = session.status === 'done' ? (isReview ? 'Retenu' : 'Terminé') : session.status === 'incomplete' ? (isReview ? 'À revoir' : 'Non terminé') : 'À faire';
  const statusClass = session.status === 'done' ? 'done' : session.status === 'incomplete' ? 'incomplete' : 'planned';
  const progress = ue && chapter ? reviews.reviewProgress(state, ue.id, chapter.id) : null;
  const dots = progress && chapter.done ? `
    <div class="review-track">
      ${Array.from({ length: progress.total }, (_, i) => `<span class="review-dot ${i < progress.done ? 'is-done' : ''}"></span>`).join('')}
      <span>${progress.mastered ? `${u.icon('award', 'ic-sm')} Chapitre maîtrisé` : `${progress.done}/${progress.total} révisions faites`}</span>
    </div>` : '';

  showModal({
    title: isReview ? 'Séance de révision' : 'Détail du créneau',
    bodyHtml: `
      <div class="detail-card" style="--ue-color:${kindColor(session)}">
        <div class="detail-top">
          <span class="detail-ue">${u.escapeHtml(ue ? ue.name : 'UE supprimée')}</span>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
        <h3>${u.escapeHtml(chapter ? chapter.name : 'Chapitre supprimé')}</h3>
        <p>${u.escapeHtml(u.formatDateLong(session.date))} · ${u.escapeHtml(session.start)} – ${u.escapeHtml(session.end)} (${u.escapeHtml(u.durationLabel(session.start, session.end))})</p>
        ${session.kind === 'retry' ? '<p class="form-note">Créneau de reprise automatique.</p>' : ''}
        ${isReview ? `<p class="form-note">${kindLabel(session)} — relis tes notes, refais un exercice, teste-toi sans regarder.</p>` : ''}
        ${dots}
      </div>
      <p class="reaction-label">${isReview ? 'As-tu bien retenu ce chapitre ?' : 'Comment s’est passé ce cours ?'}</p>
      <div class="reaction-row">
        <button class="reaction reaction-green" id="markDone" type="button">${u.icon(isReview ? 'heart' : 'circle-check', 'ic-xl')} ${isReview ? 'Bien retenu' : 'Terminé'}</button>
        <button class="reaction reaction-red" id="markIncomplete" type="button">${u.icon(isReview ? 'repeat' : 'circle-x', 'ic-xl')} ${isReview ? 'À revoir' : 'Pas fini'}</button>
      </div>
    `,
    footerHtml: `
      <button class="btn btn-ghost" id="editSlot" type="button">Modifier</button>
      <button class="btn btn-primary" id="detailClose" type="button">Fermer</button>
    `,
    onMount(root) {
      root.querySelector('#detailClose').addEventListener('click', closeModal);
      root.querySelector('#editSlot').addEventListener('click', () => openSessionEditor({ session, rerender }));

      root.querySelector('#markDone').addEventListener('click', () => {
        if (isReview) {
          const result = reviews.completeReview(session.id);
          closeModal();
          toast(result && result.mastered ? 'Chapitre maîtrisé ! 3 révisions sur 3.' : 'Super, révision validée.', 'success');
          rerender();
          return;
        }
        store.updateSession(session.id, { status: 'done' });
        let created = [];
        if (ue && chapter) {
          store.setChapterDone(ue.id, chapter.id, true);
          created = reviews.scheduleReviews(ue.id, chapter.id, session.date);
        }
        closeModal();
        toast(created.length
          ? `Bravo ! ${created.length} révision${created.length > 1 ? 's' : ''} programmée${created.length > 1 ? 's' : ''} : ${reviews.describeCreated(created)}`
          : 'Bravo ! Chapitre marqué comme terminé.', 'success');
        rerender();
      });

      root.querySelector('#markIncomplete').addEventListener('click', async () => {
        if (isReview) {
          const created = reviews.forgetReview(session.id);
          closeModal();
          toast(created.length
            ? `Pas de souci : on la refait le ${u.formatDateShort(created[0].date).slice(0, 5)}${created.length > 1 ? `, puis les suivantes le ${reviews.describeCreated(created.slice(1))}` : ''}.`
            : 'Aucun créneau libre trouvé pour la refaire.', created.length ? 'info' : 'error');
          rerender();
          return;
        }
        const delay = Number(store.getState().settings.rescheduleDelay) || 2;
        const slot = findRetrySlot(session, u.addDays(session.date, delay));
        if (!slot) {
          store.updateSession(session.id, { status: 'incomplete' });
          closeModal();
          toast('Aucun créneau libre trouvé pour la reprise : ajoute-la à la main.', 'error');
          rerender();
          return;
        }
        const ok = await confirmDialog({
          title: 'Replanifier ce chapitre ?',
          message: `J’ai vu que tu n’as pas fini le chapitre « <strong>${u.escapeHtml(chapter ? chapter.name : 'ce chapitre')}</strong> » de l’UE « <strong>${u.escapeHtml(ue ? ue.name : 'cette UE')}</strong> » le ${u.escapeHtml(u.formatDateShort(session.date))}.<br><br>Je te le réajoute le <strong>${u.escapeHtml(u.formatDateLong(slot.date))}</strong> de ${u.escapeHtml(slot.start)} à ${u.escapeHtml(slot.end)}, sur un créneau libre, pour que tu puisses terminer. Acceptes-tu ?`,
          confirmLabel: 'Oui, replanifier',
          cancelLabel: 'Non merci'
        });

        store.updateSession(session.id, { status: 'incomplete' });
        if (ok) {
          store.addSession({
            date: slot.date,
            start: slot.start,
            end: slot.end,
            ueId: session.ueId,
            chapterId: session.chapterId,
            status: 'planned',
            kind: 'retry',
            rescheduledFrom: session.id
          });
          toast(`Reprise ajoutée le ${u.formatDateShort(slot.date)} de ${slot.start} à ${slot.end}.`, 'success');
        } else {
          toast('Pas de replanification automatique : à toi de prévoir un créneau.', 'info');
        }
        rerender();
      });
    }
  });
}
