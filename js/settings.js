import * as store from './store.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import * as u from './utils.js';
import { RHYTHMS, REVIEW_COUNTS, reviewCount, rhythmLabel, applyReviewDuration, syncReviewCount } from './reviews.js';

export function renderSettings(main, rerender) {
  const state = store.getState();
  const s = state.settings;
  const count = reviewCount(s);

  main.innerHTML = `
    <section class="view view-settings">
      <div class="view-head">
        <div>
          <p class="eyebrow">Personnalisation</p>
          <h1>Réglages</h1>
          <p class="subtitle">Ton application, à ton rythme</p>
        </div>
      </div>

      <div class="section-title">Mode de fonctionnement</div>
      <div class="mode-grid">
        <button class="mode-card ${state.mode === 'basic' ? 'is-active' : ''}" type="button" data-mode="basic">
          <span class="mode-icon">${u.icon('hand')}</span>
          <strong>Mode Basique</strong>
          <span>Tu places toi-même chaque séance dans l’agenda : le jour, l’heure et le chapitre.</span>
          ${state.mode === 'basic' ? `<span class="mode-check">${u.icon('check', 'ic-sm')} Mode actuel</span>` : ''}
        </button>
        <button class="mode-card ${state.mode === 'advanced' ? 'is-active' : ''}" type="button" data-mode="advanced">
          <span class="mode-icon">${u.icon('wand-sparkles')}</span>
          <strong>Mode Avancé</strong>
          <span>En plus, un bouton « Générer » remplit ton agenda tout seul avec les chapitres qu’il te reste.</span>
          ${state.mode === 'advanced' ? `<span class="mode-check">${u.icon('check', 'ic-sm')} Mode actuel</span>` : ''}
        </button>
      </div>

      <div class="section-title">Révisions espacées</div>
      <div class="card settings-card">
        <label class="setting-row">
          <span><strong>Révisions automatiques</strong><small>Quand tu termines un chapitre, Studia te le fait revoir plusieurs fois les jours suivants pour que tu ne l’oublies pas.</small></span>
          <input type="checkbox" id="setAutoReviews" ${s.autoReviews !== false ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span><strong>Nombre de révisions par chapitre</strong><small>Combien de fois tu revois un chapitre déjà appris. Plus tu le revois, mieux tu le retiens.</small></span>
          <select id="setReviewCount">
            ${REVIEW_COUNTS.map((n) => `<option value="${n}" ${count === n ? 'selected' : ''}>${n} révisions</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Rythme des révisions</strong><small>Combien de jours après la fin du chapitre tombe chaque révision. « J+3 » veut dire 3 jours après.</small></span>
          <select id="setRhythm">
            ${Object.keys(RHYTHMS).map((key) => `<option value="${key}" ${(s.reviewRhythm || 'balanced') === key ? 'selected' : ''}>${rhythmLabel(key, count)}</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Durée d’une séance de révision</strong><small>Le temps prévu pour revoir un chapitre que tu as déjà appris. Les révisions déjà prévues sont ajustées aussi.</small></span>
          <select id="setReviewMin">
            ${[15, 20, 30, 45, 60, 75, 90, 120].map((n) => `<option value="${n}" ${Number(s.reviewMinutes || 45) === n ? 'selected' : ''}>${n} min</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="section-title">Organisation</div>
      <div class="card settings-card">
        <label class="setting-row">
          <span><strong>Report d’un cours pas fini</strong><small>Si tu n’as pas fini un cours, Studia te propose de le refaire ce nombre de jours plus tard.</small></span>
          <select id="setDelay">
            ${[1, 2, 3, 4, 7].map((n) => `<option value="${n}" ${Number(s.rescheduleDelay) === n ? 'selected' : ''}>${n} jour${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Durée d’une séance d’apprentissage</strong><small>Le temps prévu pour apprendre un nouveau chapitre quand tu cliques sur « Générer ».</small></span>
          <select id="setSession">
            ${[60, 90, 120, 180, 240].map((n) => `<option value="${n}" ${Number(s.sessionMinutes) === n ? 'selected' : ''}>${n} min</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Travail maximum par jour</strong><small>Studia ne te prévoit jamais plus que ça dans une journée, cours et révisions compris.</small></span>
          <select id="setMaxHours">
            ${[2, 4, 6, 8].map((n) => `<option value="${n}" ${Number(s.maxHoursPerDay) === n ? 'selected' : ''}>${n} h</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Journée de travail</strong><small>Studia place tes séances automatiques seulement entre ces deux heures.</small></span>
          <span class="time-pair">
            <input type="time" id="setWorkStart" value="${u.escapeHtml(s.workStart)}" />
            ${u.icon('arrow-right', 'ic-sm')}
            <input type="time" id="setWorkEnd" value="${u.escapeHtml(s.workEnd)}" />
          </span>
        </label>
        <label class="setting-row">
          <span><strong>Pause déjeuner</strong><small>Studia ne met aucune séance automatique entre 12h et 13h, pour que tu puisses manger.</small></span>
          <input type="checkbox" id="setLunch" ${s.lunchBreak !== false ? 'checked' : ''} />
        </label>
        <label class="setting-row">
          <span><strong>Pause entre deux séances</strong><small>Le temps de repos laissé entre deux séances automatiques.</small></span>
          <select id="setBreak">
            ${[0, 10, 15, 30].map((n) => `<option value="${n}" ${Number(s.breakMinutes) === n ? 'selected' : ''}>${n} min</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Dimanche libre</strong><small>Aucune séance automatique le dimanche : c’est ton jour de repos.</small></span>
          <input type="checkbox" id="setSkipSunday" ${s.skipSunday ? 'checked' : ''} />
        </label>
      </div>

      <div class="section-title">Mes données</div>
      <div class="card settings-card">
        <button class="setting-row setting-button" type="button" id="exportBtn">
          <span><strong>Exporter mes données</strong><small>Télécharge un fichier avec toutes tes UE et séances, pour les garder en sécurité.</small></span>${u.icon('download')}
        </button>
        <button class="setting-row setting-button" type="button" id="importBtn">
          <span><strong>Importer une sauvegarde</strong><small>Remplace tes données actuelles par celles d’un fichier exporté avant.</small></span>${u.icon('upload')}
        </button>
        <button class="setting-row setting-button" type="button" id="resetBtn">
          <span><strong>Tout effacer</strong><small>Supprime tout pour repartir de zéro. Pense à exporter avant !</small></span>${u.icon('rotate-ccw')}
        </button>
        <input type="file" id="importFile" accept="application/json,.json" hidden />
      </div>

      <p class="settings-foot">Studia fonctionne hors-ligne : tes données restent sur cet appareil.</p>
    </section>
  `;

  main.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      if (mode === state.mode) return;
      store.setMode(mode);
      toast(mode === 'advanced' ? 'Mode Avancé activé.' : 'Mode Basique activé.', 'success');
      rerender();
    });
  });

  const bindSelect = (id, key, parse = (v) => v) => {
    main.querySelector(id).addEventListener('change', (event) => {
      store.setSetting(key, parse(event.target.value));
      toast('Réglage enregistré.', 'success');
    });
  };
  bindSelect('#setDelay', 'rescheduleDelay', Number);
  bindSelect('#setSession', 'sessionMinutes', Number);
  bindSelect('#setMaxHours', 'maxHoursPerDay', Number);
  bindSelect('#setBreak', 'breakMinutes', Number);
  bindSelect('#setWorkStart', 'workStart');
  bindSelect('#setWorkEnd', 'workEnd');
  main.querySelector('#setRhythm').addEventListener('change', (event) => {
    store.setSetting('reviewRhythm', event.target.value);
    toast('Rythme enregistré : il s’appliquera aux prochains chapitres terminés.', 'success');
  });
  main.querySelector('#setReviewCount').addEventListener('change', (event) => {
    store.setSetting('reviewCount', Number(event.target.value));
    const { added, removed } = syncReviewCount();
    const parts = [];
    if (added) parts.push(`${added} révision${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}`);
    if (removed) parts.push(`${removed} retirée${removed > 1 ? 's' : ''}`);
    toast(`${event.target.value} révisions par chapitre${parts.length ? ` : ${parts.join(', ')}` : ''}.`, 'success');
    rerender();
  });
  main.querySelector('#setReviewMin').addEventListener('change', (event) => {
    store.setSetting('reviewMinutes', Number(event.target.value));
    const moved = applyReviewDuration();
    toast(moved ? `Durée enregistrée : ${moved} révision${moved > 1 ? 's' : ''} à venir ajustée${moved > 1 ? 's' : ''}.` : 'Durée de révision enregistrée.', 'success');
  });
  main.querySelector('#setLunch').addEventListener('change', (event) => {
    store.setSetting('lunchBreak', event.target.checked);
    toast('Réglage enregistré.', 'success');
  });
  main.querySelector('#setAutoReviews').addEventListener('change', (event) => {
    store.setSetting('autoReviews', event.target.checked);
    toast('Réglage enregistré.', 'success');
  });

  main.querySelector('#setSkipSunday').addEventListener('change', (event) => {
    store.setSetting('skipSunday', event.target.checked);
    toast('Réglage enregistré.', 'success');
  });

  main.querySelector('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([store.exportState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studia-sauvegarde-${u.todayISO()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Sauvegarde téléchargée.', 'success');
  });

  const fileInput = main.querySelector('#importFile');
  main.querySelector('#importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.ues) || !Array.isArray(parsed.sessions)) throw new Error('Format invalide');
        const ok = await confirmDialog({
          title: 'Importer cette sauvegarde ?',
          message: 'Vos données actuelles seront remplacées par celles du fichier.',
          confirmLabel: 'Importer',
          destructive: true
        });
        if (!ok) return;
        store.replaceState(parsed);
        toast('Sauvegarde importée.', 'success');
        rerender();
      } catch (error) {
        toast('Fichier invalide.', 'error');
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  main.querySelector('#resetBtn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Tout réinitialiser ?',
      message: 'Toutes vos UE, chapitres et créneaux seront définitivement effacés.',
      confirmLabel: 'Réinitialiser',
      destructive: true
    });
    if (!ok) return;
    store.resetState();
    showOnboarding(rerender);
  });
}

export function showOnboarding(rerender) {
  const root = document.getElementById('onboardingRoot');
  root.hidden = false;
  root.innerHTML = `
    <div class="onboarding">
      ${u.illustration('book-lover', '', 'onboarding-illu')}
      <h1>Bienvenue sur Studia</h1>
      <p class="onboarding-intro">Votre agenda de révisions, simple et sous contrôle. Choisissez comment vous voulez travailler :</p>
      <button class="onboarding-option" type="button" data-mode="basic">
        <span class="onboarding-emoji">${u.icon('hand')}</span>
        <span class="onboarding-copy">
          <strong>Mode Basique</strong>
          <small>Je organise moi-même chaque séance : jour, horaire, UE et chapitre. Je peux même réviser 3h ou 4h d’un coup.</small>
        </span>
        <span class="onboarding-arrow">${u.icon('chevron-right')}</span>
      </button>
      <button class="onboarding-option" type="button" data-mode="advanced">
        <span class="onboarding-emoji">${u.icon('wand-sparkles')}</span>
        <span class="onboarding-copy">
          <strong>Mode Avancé</strong>
          <small>L’application construit automatiquement un planning régulier à partir de mes UE et de mes chapitres.</small>
        </span>
        <span class="onboarding-arrow">${u.icon('chevron-right')}</span>
      </button>
      <p class="onboarding-note">Vous pourrez changer de mode à tout moment dans les réglages.</p>
    </div>
  `;
  root.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.setMode(btn.dataset.mode);
      root.hidden = true;
      root.innerHTML = '';
      toast('Bienvenue dans Studia !', 'success');
      rerender();
    });
  });
}

export function showHelp() {
  showModal({
    title: 'Comment utiliser Studia',
    bodyHtml: `
      ${u.illustration('learning', '', 'help-illu')}
      <div class="help-list">
        <p><strong>1. Mes UE</strong> — Créez vos modules, puis leurs chapitres. Cochez un chapitre quand il est terminé.</p>
        <p><strong>2. Agenda</strong> — Cliquez sur un jour de la semaine, puis sur une heure pour réserver. Choisissez l’UE et le chapitre dans les listes déroulantes. La durée est libre (3h, 4h…).</p>
        <p><strong>3. Réactions</strong> — Sur un créneau : « Terminé » si le cours est fini, « Pas fini » sinon. Dans ce cas, Studia te propose de replanifier le chapitre quelques jours plus tard.</p>
        <p><strong>4. Révisions espacées</strong> — Dès qu’un chapitre est terminé, Studia programme 3, 5 ou 7 révisions (au choix dans les Réglages ; par défaut J+3, J+7 et J+16) dans tes créneaux libres. « Bien retenu » : on passe à la suivante. « À revoir » : on la refait dès le lendemain et toute la suite est décalée. Quand toutes les révisions sont réussies, le chapitre est maîtrisé.</p>
        <p><strong>5. Mode Avancé</strong> — Le bouton « Générer » de l’agenda répartit les chapitres restants sur les jours à venir, étalés dans la journée.</p>
      </div>
    `,
    footerHtml: '<button class="btn btn-primary" id="helpClose" type="button">Compris</button>',
    onMount(root) {
      root.querySelector('#helpClose').addEventListener('click', closeModal);
    }
  });
}
