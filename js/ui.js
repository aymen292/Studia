const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');

let activeCleanup = null;

export function closeModal() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  modalRoot.hidden = true;
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

export function showModal({ title = '', bodyHtml = '', footerHtml = '', onMount, wide = false, dismissible = true }) {
  closeModal();
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
      <div class="modal-head">
        <h2>${title}</h2>
        ${dismissible ? '<button class="icon-btn modal-close" type="button" data-close aria-label="Fermer"><span class="ic" style="-webkit-mask-image:url(icons/ui/x.svg);mask-image:url(icons/ui/x.svg)" aria-hidden="true"></span></button>' : ''}
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ''}
    </div>
  `;
  modalRoot.hidden = false;
  document.body.classList.add('modal-open');

  const onKey = (event) => {
    if (event.key === 'Escape' && dismissible) closeModal();
  };
  const onBackdrop = (event) => {
    if (event.target.hasAttribute('data-close') && dismissible) closeModal();
  };
  document.addEventListener('keydown', onKey);
  modalRoot.addEventListener('click', onBackdrop);

  activeCleanup = () => {
    document.removeEventListener('keydown', onKey);
    modalRoot.removeEventListener('click', onBackdrop);
  };

  if (typeof onMount === 'function') onMount(modalRoot);
  const focusable = modalRoot.querySelector('input, select, textarea, button:not(.modal-close)');
  if (focusable) setTimeout(() => focusable.focus(), 30);
  return closeModal;
}

export function confirmDialog({ title = 'Confirmation', message = '', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', destructive = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };

    showModal({
      title,
      bodyHtml: `<p class="confirm-message">${message}</p>`,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-decision="cancel">${escapeHtml(cancelLabel)}</button>
        <button class="btn ${destructive ? 'btn-danger' : 'btn-primary'}" type="button" data-decision="confirm">${escapeHtml(confirmLabel)}</button>
      `,
      onMount(root) {
        root.querySelectorAll('[data-decision]').forEach((button) => {
          button.addEventListener('click', () => finish(button.dataset.decision === 'confirm'));
        });
      }
    });
  });
}

export function toast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.textContent = message;
  toastRoot.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 260);
  }, 3600);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
