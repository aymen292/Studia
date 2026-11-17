import * as store from './store.js';
import { renderAgenda, goToToday } from './calendar.js';
import { renderModules } from './modules.js';
import { renderSettings, showOnboarding, showHelp } from './settings.js';
import { toast } from './ui.js';

const main = document.getElementById('main');
const modeBadge = document.getElementById('modeBadge');
let currentView = 'agenda';

function rerender() {
  render();
}

function render() {
  const state = store.getState();
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === currentView);
  });
  modeBadge.textContent = state.mode === 'advanced' ? 'Avancé' : state.mode === 'basic' ? 'Basique' : '—';

  if (!state.onboarded || !state.mode) {
    main.innerHTML = '<section class="view view-placeholder"></section>';
    showOnboarding(rerender);
    return;
  }

  if (currentView === 'modules') renderModules(main, rerender);
  else if (currentView === 'settings') renderSettings(main, rerender);
  else renderAgenda(main, rerender);
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    currentView = item.dataset.view;
    if (currentView === 'agenda') goToToday();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

document.getElementById('helpBtn').addEventListener('click', showHelp);

store.subscribe(() => {
  const state = store.getState();
  if (state.onboarded && state.mode) render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Studia: service worker indisponible.', error);
    });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  toast('Installez Studia depuis le menu de votre navigateur pour l’avoir sur l’écran d’accueil.', 'info');
});

render();
