import * as store from './store.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import * as u from './utils.js';

const HOUR_HEIGHT = 64;
let viewDate = u.todayISO();
let selectedDate = u.todayISO();

export function goToToday() {
  viewDate = u.todayISO();
  selectedDate = viewDate;
}

export function renderAgenda(main, rerender) {
  const state = store.getState();
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
  const hours = [];
  for (let h = minHour; h < maxHour; h += 1) hours.push(h);

  const ueMap = new Map(state.ues.map((ue) => [ue.id, ue]));

  const dayButtons = dates.map((date) => {
    const count = state.sessions.filter((s) => s.date === date).length;
    const isToday = date === u.todayISO();
    const isSelected = date === selectedDate;
    return `
      <button class="day-chip ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}" type="button" data-date="${date}" aria-pressed="${isSelected}">
        <span class="day-chip-label">${u.escapeHtml(u.formatDayLabel(date))}</span>
        <span class="day-chip-num">${u.fromISODate(date).getDate()}</span>
        <span class="day-chip-dot ${count ? 'has-sessions' : ''}"></span>
      </button>`;
  }).join('');

  const axisRows = hours.map((h) => `
    <div class="hour-label" style="top:${(h - minHour) * HOUR_HEIGHT}px">${u.formatTime(h * 60)}</div>
    <div class="hour-line" style="top:${(h - minHour) * HOUR_HEIGHT}px"></div>
  `).join('');

  const gridRows = hours.map((h) => `
    <div class="hour-line" style="top:${(h - minHour) * HOUR_HEIGHT}px"></div>
    <button class="slot-hit" type="button" data-start="${u.hhmmFromMinutes(h * 60)}" style="top:${(h - minHour) * HOUR_HEIGHT}px;height:${HOUR_HEIGHT}px" aria-label="Réserver à ${u.formatTime(h * 60)}"></button>
  `).join('');

  const sessionBlocks = sessions.map((session) => {
    const ue = ueMap.get(session.ueId);
    const chapter = ue && ue.chapters.find((c) => c.id === session.chapterId);
    const startMin = u.minutesFromHHMM(session.start);
    const endMin = u.minutesFromHHMM(session.end);
    const top = ((startMin / 60) - minHour) * HOUR_HEIGHT;
    const height = Math.max(30, ((endMin - startMin) / 60) * HOUR_HEIGHT - 3);
    const color = ue ? ue.color : '#64748b';
    const statusIcon = session.status === 'done' ? '✅' : session.status === 'incomplete' ? '❌' : '';
    const kindLabel = session.kind === 'review' ? 'Révision · ' : session.kind === 'retry' ? 'Reprise · ' : '';
    return `
      <button class="session-block status-${u.escapeHtml(session.status)}" type="button" data-session="${session.id}"
        style="top:${top}px;height:${height}px;--ue-color:${u.escapeHtml(color)}">
        <span class="session-time">${u.escapeHtml(session.start)} – ${u.escapeHtml(session.end)} · ${u.escapeHtml(u.durationLabel(session.start, session.end))}</span>
        <span class="session-title">${kindLabel}${u.escapeHtml(ue ? ue.name : 'UE supprimée')}</span>
        <span class="session-chapter">${u.escapeHtml(chapter ? chapter.name : 'Chapitre supprimé')} ${statusIcon}</span>
      </button>`;
  }).join('');

  main.innerHTML = `
    <section class="view view-agenda">
      <div class="view-head">
        <div>
          <p class="eyebrow">Mon planning</p>
          <h1>Agenda</h1>
          <p class="subtitle">${u.escapeHtml(u.formatDateLong(selectedDate))}</p>
        </div>
        <button class="btn btn-primary" id="addSlotBtn" type="button">+ Nouveau créneau</button>
      </div>

      <div class="week-bar card">
        <button class="icon-btn" id="prevWeek" type="button" aria-label="Semaine précédente">‹</button>
        <div class="week-title">
          <strong>Semaine du ${u.escapeHtml(u.formatWeekRange(viewDate))}</strong>
          <button class="link-btn" id="todayBtn" type="button">Aujourd'hui</button>
        </div>
        <button class="icon-btn" id="nextWeek" type="button" aria-label="Semaine suivante">›</button>
      </div>

      <div class="day-strip" role="tablist" aria-label="Choisir un jour">${dayButtons}</div>

      <div class="timeline-card card">
        <div class="timeline-head">
          <span>Créneaux libres · ${u.escapeHtml(u.formatDateShort(selectedDate))}</span>
          <span class="timeline-hint">Cliquez sur une heure pour réserver</span>
        </div>
        <div class="timeline" style="height:${(maxHour - minHour) * HOUR_HEIGHT}px">
          <div class="time-axis">${axisRows}</div>
          <div class="time-grid">
            ${gridRows}
            ${sessionBlocks}
          </div>
        </div>
      </div>

      ${state.mode === 'advanced' ? `
        <div class="auto-card card">
          <div>
            <h3>Planning automatique</h3>
            <p>L'application répartit vos chapitres restants en sessions régulières et espacées.</p>
          </div>
          <button class="btn btn-secondary" id="generatePlanBtn" type="button">Générer mon planning</button>
        </div>` : ''}
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
    selectedDate = viewDate;
    rerender();
  });
  main.querySelector('#nextWeek').addEventListener('click', () => {
    viewDate = u.addDays(viewDate, 7);
    selectedDate = viewDate;
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
  const ue = state.ues.find((u) => u.id === session.ueId);
  const chapter = ue && ue.chapters.find((c) => c.id === session.chapterId);
  const statusLabel = session.status === 'done' ? 'Terminé' : session.status === 'incomplete' ? 'Non terminé' : 'À faire';
  const statusClass = session.status === 'done' ? 'done' : session.status === 'incomplete' ? 'incomplete' : 'planned';

  showModal({
    title: 'Détail du créneau',
    bodyHtml: `
      <div class="detail-card" style="--ue-color:${u.escapeHtml(ue ? ue.color : '#64748b')}">
        <div class="detail-top">
          <span class="detail-ue">${u.escapeHtml(ue ? ue.name : 'UE supprimée')}</span>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </div>
        <h3>${u.escapeHtml(chapter ? chapter.name : 'Chapitre supprimé')}</h3>
        <p>${u.escapeHtml(u.formatDateLong(session.date))} · ${u.escapeHtml(session.start)} – ${u.escapeHtml(session.end)} (${u.escapeHtml(u.durationLabel(session.start, session.end))})</p>
        ${session.kind === 'retry' ? '<p class="form-note">Créneau de reprise automatique.</p>' : ''}
        ${session.kind === 'review' ? '<p class="form-note">Session de révision espacée.</p>' : ''}
      </div>
      <p class="reaction-label">Comment s’est passé ce cours ?</p>
      <div class="reaction-row">
        <button class="reaction reaction-green" id="markDone" type="button"><span>✅</span> Terminé</button>
        <button class="reaction reaction-red" id="markIncomplete" type="button"><span>❌</span> Pas fini</button>
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
        store.updateSession(session.id, { status: 'done' });
        if (ue && chapter) store.setChapterDone(ue.id, chapter.id, true);
        closeModal();
        toast('Bravo ! Chapitre marqué comme terminé.', 'success');
        rerender();
      });

      root.querySelector('#markIncomplete').addEventListener('click', async () => {
        const delay = Number(store.getState().settings.rescheduleDelay) || 2;
        const newDate = u.addDays(session.date, delay);
        const ok = await confirmDialog({
          title: 'Replanifier ce chapitre ?',
          message: `J’ai vu que tu n’as pas fini le chapitre « <strong>${u.escapeHtml(chapter ? chapter.name : 'ce chapitre')}</strong> » de l’UE « <strong>${u.escapeHtml(ue ? ue.name : 'cette UE')}</strong> » le ${u.escapeHtml(u.formatDateShort(session.date))}.<br><br>Je te le réajoute le <strong>${u.escapeHtml(u.formatDateLong(newDate))}</strong> de ${u.escapeHtml(session.start)} à ${u.escapeHtml(session.end)} pour que tu puisses terminer. Acceptes-tu ?`,
          confirmLabel: 'Oui, replanifier',
          cancelLabel: 'Non merci'
        });

        store.updateSession(session.id, { status: 'incomplete' });
        if (ok) {
          store.addSession({
            date: newDate,
            start: session.start,
            end: session.end,
            ueId: session.ueId,
            chapterId: session.chapterId,
            status: 'planned',
            kind: 'retry',
            rescheduledFrom: session.id
          });
          toast(`Repris ajouté le ${u.formatDateShort(newDate)}.`, 'success');
        } else {
          toast('Pas de replanification automatique : à toi de prévoir un créneau.', 'info');
        }
        rerender();
      });
    }
  });
}
