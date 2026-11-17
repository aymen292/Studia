import * as store from './store.js';
import { showModal, closeModal, toast, confirmDialog } from './ui.js';
import * as u from './utils.js';

export function renderSettings(main, rerender) {
  const state = store.getState();
  const s = state.settings;

  main.innerHTML = `
    <section class="view view-settings">
      <div class="view-head">
        <div>
          <p class="eyebrow">Personnalisation</p>
          <h1>Réglages</h1>
          <p class="subtitle">Votre application, à votre rythme</p>
        </div>
      </div>

      <div class="section-title">Mode de fonctionnement</div>
      <div class="mode-grid">
        <button class="mode-card ${state.mode === 'basic' ? 'is-active' : ''}" type="button" data-mode="basic">
          <span class="mode-icon">✋</span>
          <strong>Mode Basique</strong>
          <span>Vous choisissez chaque jour, chaque horaire et chaque chapitre. Liberté totale.</span>
          ${state.mode === 'basic' ? '<span class="mode-check">✓ Mode actuel</span>' : ''}
        </button>
        <button class="mode-card ${state.mode === 'advanced' ? 'is-active' : ''}" type="button" data-mode="advanced">
          <span class="mode-icon">✨</span>
          <strong>Mode Avancé</strong>
          <span>L’application génère automatiquement un planning sérieux et régulier à partir de vos UE.</span>
          ${state.mode === 'advanced' ? '<span class="mode-check">✓ Mode actuel</span>' : ''}
        </button>
      </div>

      <div class="section-title">Révisions</div>
      <div class="card settings-card">
        <label class="setting-row">
          <span><strong>Rapport après un cours non terminé</strong><small>Réajout automatique après ce délai</small></span>
          <select id="setDelay">
            ${[1, 2, 3, 4, 7].map((n) => `<option value="${n}" ${Number(s.rescheduleDelay) === n ? 'selected' : ''}>${n} jour${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Durée d’une session auto</strong><small>Pour le mode Avancé</small></span>
          <select id="setSession">
            ${[60, 90, 120, 180, 240].map((n) => `<option value="${n}" ${Number(s.sessionMinutes) === n ? 'selected' : ''}>${n} min</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Travail maximum par jour</strong><small>Pour le mode Avancé</small></span>
          <select id="setMaxHours">
            ${[2, 4, 6, 8].map((n) => `<option value="${n}" ${Number(s.maxHoursPerDay) === n ? 'selected' : ''}>${n} h</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Journée de travail</strong><small>Plage utilisée par le planning auto</small></span>
          <span class="time-pair">
            <input type="time" id="setWorkStart" value="${u.escapeHtml(s.workStart)}" />
            <span>→</span>
            <input type="time" id="setWorkEnd" value="${u.escapeHtml(s.workEnd)}" />
          </span>
        </label>
        <label class="setting-row">
          <span><strong>Pause entre deux sessions</strong><small>Respectée par le planning auto</small></span>
          <select id="setBreak">
            ${[0, 10, 15, 30].map((n) => `<option value="${n}" ${Number(s.breakMinutes) === n ? 'selected' : ''}>${n} min</option>`).join('')}
          </select>
        </label>
        <label class="setting-row">
          <span><strong>Éviter le dimanche</strong><small>Jour de repos dans le planning auto</small></span>
          <input type="checkbox" id="setSkipSunday" ${s.skipSunday ? 'checked' : ''} />
        </label>
      </div>

      <div class="section-title">Mes données</div>
      <div class="card settings-card">
        <button class="setting-row setting-button" type="button" id="exportBtn">
          <span><strong>Exporter mes données</strong><small>Télécharger une sauvegarde JSON</small></span><span>⬇</span>
        </button>
        <button class="setting-row setting-button" type="button" id="importBtn">
          <span><strong>Importer une sauvegarde</strong><small>Restaurer depuis un fichier JSON</small></span><span>⬆</span>
        </button>
        <button class="setting-row setting-button" type="button" id="resetBtn">
          <span><strong>Réinitialiser l’application</strong><small>Effacer UE, chapitres et créneaux</small></span><span>↺</span>
        </button>
        <input type="file" id="importFile" accept="application/json,.json" hidden />
      </div>

      <p class="settings-foot">Studia fonctionne hors-ligne : vos données restent sur cet appareil.</p>
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
      <div class="onboarding-logo">S</div>
      <h1>Bienvenue sur Studia</h1>
      <p class="onboarding-intro">Votre agenda de révisions, simple et sous contrôle. Choisissez comment vous voulez travailler :</p>
      <button class="onboarding-option" type="button" data-mode="basic">
        <span class="onboarding-emoji">✋</span>
        <span class="onboarding-copy">
          <strong>Mode Basique</strong>
          <small>Je organise moi-même chaque séance : jour, horaire, UE et chapitre. Je peux même réviser 3h ou 4h d’un coup.</small>
        </span>
        <span class="onboarding-arrow">›</span>
      </button>
      <button class="onboarding-option" type="button" data-mode="advanced">
        <span class="onboarding-emoji">✨</span>
        <span class="onboarding-copy">
          <strong>Mode Avancé</strong>
          <small>L’application construit automatiquement un planning régulier à partir de mes UE et de mes chapitres.</small>
        </span>
        <span class="onboarding-arrow">›</span>
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
      <div class="help-list">
        <p><strong>1. Mes UE</strong> — Créez vos modules, puis leurs chapitres. Cochez un chapitre quand il est terminé.</p>
        <p><strong>2. Agenda</strong> — Cliquez sur un jour de la semaine, puis sur une heure pour réserver. Choisissez l’UE et le chapitre dans les listes déroulantes. La durée est libre (3h, 4h…).</p>
        <p><strong>3. Réactions</strong> — Sur un créneau : ✅ si le cours est terminé, ❌ si vous n’avez pas fini. Dans ce cas, Studia vous propose de replanifier le chapitre 2 jours plus tard.</p>
        <p><strong>4. Mode Avancé</strong> — Depuis l’onglet Agenda ou les Réglages, lancez « Générer mon planning » : Studia répartit les chapitres restants en sessions régulières avec des révisions espacées.</p>
      </div>
    `,
    footerHtml: '<button class="btn btn-primary" id="helpClose" type="button">Compris</button>',
    onMount(root) {
      root.querySelector('#helpClose').addEventListener('click', closeModal);
    }
  });
}
