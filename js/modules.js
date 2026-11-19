import * as store from './store.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import * as u from './utils.js';
import * as reviews from './reviews.js';

export function renderModules(main, rerender) {
  const state = store.getState();

  const ueCards = state.ues.map((ue) => {
    const chapters = ue.chapters.map((chapter) => {
      const progress = chapter.done ? reviews.reviewProgress(state, ue.id, chapter.id) : null;
      const track = progress ? `
        <span class="review-track review-track-mini" title="${progress.mastered ? 'Maîtrisé' : `Révisions : ${progress.done}/${progress.total}${progress.next ? ` · prochaine le ${u.formatDateShort(progress.next.date)}` : ''}`}">
          ${Array.from({ length: progress.total }, (_, i) => `<span class="review-dot ${i < progress.done ? 'is-done' : ''}"></span>`).join('')}
          ${progress.mastered ? `<span class="mastered-badge">${u.icon('award', 'ic-sm')} maîtrisé</span>` : progress.next ? `<small>${u.escapeHtml(u.formatDateShort(progress.next.date).slice(0, 5))}</small>` : ''}
        </span>` : '';
      return `
      <li class="chapter-item ${chapter.done ? 'is-done' : ''} ${progress && progress.mastered ? 'is-mastered' : ''}" data-chapter="${chapter.id}">
        <button class="chapter-check" type="button" data-toggle="${chapter.id}" aria-label="${chapter.done ? 'Marquer comme à faire' : 'Marquer comme terminé'}">${chapter.done ? u.icon('check') : ''}</button>
        <span class="chapter-name">${u.escapeHtml(chapter.name)}</span>
        ${track}
        <button class="icon-btn chapter-delete" type="button" data-delete-chapter="${chapter.id}" aria-label="Supprimer le chapitre">${u.icon('x')}</button>
      </li>`;
    }).join('');

    const doneCount = ue.chapters.filter((c) => c.done).length;

    return `
      <article class="ue-card card" style="--ue-color:${u.escapeHtml(ue.color)}">
        <div class="ue-head">
          <span class="ue-swatch"></span>
          <div class="ue-head-text">
            <h3>${u.escapeHtml(ue.name)}</h3>
            <p>${ue.chapters.length} chapitre${ue.chapters.length > 1 ? 's' : ''} · ${doneCount} terminé${doneCount > 1 ? 's' : ''}</p>
          </div>
          <button class="icon-btn" type="button" data-edit-ue="${ue.id}" aria-label="Modifier l'UE">${u.icon('pencil')}</button>
          <button class="icon-btn" type="button" data-delete-ue="${ue.id}" aria-label="Supprimer l'UE">${u.icon('trash-2')}</button>
        </div>
        <ul class="chapter-list">${chapters || '<li class="chapter-empty">Aucun chapitre pour le moment.</li>'}</ul>
        <form class="chapter-add" data-add-chapter="${ue.id}">
          <input type="text" name="chapterName" placeholder="Ajouter un chapitre…" aria-label="Nom du chapitre" />
          <button class="btn btn-mini" type="submit">Ajouter</button>
        </form>
      </article>
    `;
  }).join('');

  main.innerHTML = `
    <section class="view view-modules">
      <div class="view-head">
        <div>
          <p class="eyebrow">Ton programme</p>
          <h1>Mes UE</h1>
          <p class="subtitle">Modules et chapitres à réviser</p>
        </div>
        <button class="btn btn-primary" id="addUeBtn" type="button">${u.icon('plus')} Nouvelle UE</button>
      </div>

      ${state.ues.length ? `<div class="ue-list">${ueCards}</div>` : `
        <div class="empty-state card">
          ${u.illustration('books', '', 'empty-illu')}
          <h2>Aucune UE pour l’instant</h2>
          <p>Créez vos modules, puis ajoutez les chapitres à réviser. Vous pourrez ensuite les placer dans l’agenda.</p>
          <button class="btn btn-primary" id="emptyAddUe" type="button">Créer ma première UE</button>
        </div>`}
    </section>
  `;

  const openAdd = () => openUeModal(null, rerender);
  main.querySelector('#addUeBtn')?.addEventListener('click', openAdd);
  main.querySelector('#emptyAddUe')?.addEventListener('click', openAdd);

  main.querySelectorAll('[data-edit-ue]').forEach((btn) => {
    btn.addEventListener('click', () => openUeModal(store.getState().ues.find((u) => u.id === btn.dataset.editUe), rerender));
  });

  main.querySelectorAll('[data-delete-ue]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ue = store.getState().ues.find((u) => u.id === btn.dataset.deleteUe);
      if (!ue) return;
      const ok = await confirmDialog({
        title: 'Supprimer cette UE ?',
        message: `L’UE « <strong>${u.escapeHtml(ue.name)}</strong> », ses chapitres et tous ses créneaux associés seront supprimés.`,
        confirmLabel: 'Supprimer',
        destructive: true
      });
      if (!ok) return;
      store.deleteUE(ue.id);
      toast('UE supprimée.');
      rerender();
    });
  });

  main.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.ue-card');
      const ueId = card.querySelector('[data-edit-ue]').dataset.editUe;
      const chapterId = btn.dataset.toggle;
      const stateNow = store.getState();
      const chapter = stateNow.ues.find((u) => u.id === ueId)?.chapters.find((c) => c.id === chapterId);
      if (chapter) {
        const nowDone = !chapter.done;
        store.setChapterDone(ueId, chapterId, nowDone);
        if (nowDone) {
          const created = reviews.scheduleReviews(ueId, chapterId, u.todayISO());
          if (created.length) toast(`Chapitre terminé ! Révisions programmées : ${reviews.describeCreated(created)}`, 'success');
        } else {
          const removed = reviews.cancelPlannedReviews(ueId, chapterId);
          if (removed) toast(`${removed} révision${removed > 1 ? 's' : ''} à venir annulée${removed > 1 ? 's' : ''}.`);
        }
      }
      rerender();
    });
  });

  main.querySelectorAll('[data-delete-chapter]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.ue-card');
      const ueId = card.querySelector('[data-edit-ue]').dataset.editUe;
      const chapterId = btn.dataset.deleteChapter;
      const chapter = store.getState().ues.find((u) => u.id === ueId)?.chapters.find((c) => c.id === chapterId);
      const ok = await confirmDialog({
        title: 'Supprimer le chapitre ?',
        message: `« <strong>${u.escapeHtml(chapter ? chapter.name : '')}</strong> » sera retiré de cette UE et des créneaux associés.`,
        confirmLabel: 'Supprimer',
        destructive: true
      });
      if (!ok) return;
      store.deleteChapter(ueId, chapterId);
      toast('Chapitre supprimé.');
      rerender();
    });
  });

  main.querySelectorAll('[data-add-chapter]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input[name="chapterName"]');
      const chapter = store.addChapter(form.dataset.addChapter, input.value);
      if (!chapter) { toast('Saisissez un nom de chapitre.', 'error'); return; }
      toast('Chapitre ajouté.', 'success');
      rerender();
    });
  });
}

function openUeModal(ue, rerender) {
  const isEdit = !!ue;
  showModal({
    title: isEdit ? 'Modifier l’UE' : 'Nouvelle UE',
    bodyHtml: `
      <div class="form-grid">
        <label class="field field-full">
          <span>Nom de l’UE</span>
          <input type="text" id="ueName" value="${u.escapeHtml(ue ? ue.name : '')}" placeholder="Ex. Algorithmique et structures" />
        </label>
        <div class="field field-full">
          <span>Couleur</span>
          <div class="swatches" id="ueColors"></div>
        </div>
        ${isEdit ? '' : `
          <label class="field field-full">
            <span>Chapitres <small>(un par ligne, facultatif)</small></span>
            <textarea id="ueChapters" rows="4" placeholder="Introduction\nChapitre 1\nChapitre 2"></textarea>
          </label>`}
      </div>
    `,
    footerHtml: '<button class="btn btn-ghost" id="ueCancel" type="button">Annuler</button><button class="btn btn-primary" id="ueSave" type="button">Enregistrer</button>',
    onMount(root) {
      const swatches = root.querySelector('#ueColors');
      let color = ue ? ue.color : u.UE_COLORS[0];
      swatches.innerHTML = u.UE_COLORS.map((c) => `<button type="button" class="swatch ${c === color ? 'is-selected' : ''}" data-color="${c}" style="--swatch:${c}" aria-label="Couleur"></button>`).join('');
      swatches.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
        swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
        color = b.dataset.color;
      }));

      root.querySelector('#ueCancel').addEventListener('click', closeModal);
      root.querySelector('#ueSave').addEventListener('click', () => {
        const name = root.querySelector('#ueName').value.trim();
        if (!name) { toast('Donnez un nom à l’UE.', 'error'); return; }
        if (isEdit) {
          store.updateUE(ue.id, { name, color });
          toast('UE mise à jour.', 'success');
        } else {
          const created = store.addUE(name, color);
          const lines = root.querySelector('#ueChapters').value.split('\n');
          lines.forEach((line) => store.addChapter(created.id, line.trim()));
          toast('UE créée.', 'success');
        }
        closeModal();
        rerender();
      });
    }
  });
}
