/**
 * ModArt Customer Toast Notification System
 * Lightweight, accessible toast for the customer site.
 */

let _toastContainer = null;

function getToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.createElement('div');
  _toastContainer.id = 'customer-toast-container';
  _toastContainer.style.cssText = [
    'position:fixed',
    'bottom:calc(72px + env(safe-area-inset-bottom, 0px))', // above mobile nav
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9998',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:8px',
    'pointer-events:none',
    'width:min(360px, calc(100vw - 32px))',
  ].join(';');
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'cart'} type
 * @param {number} duration ms
 */
export function showCustomerToast(message, type = 'success', duration = 3000) {
  const container = getToastContainer();

  const colors = {
    success: { bg: '#111', color: '#fff', icon: 'check_circle' },
    error:   { bg: '#D72638', color: '#fff', icon: 'error' },
    info:    { bg: '#111', color: '#fff', icon: 'info' },
    cart:    { bg: '#111', color: '#fff', icon: 'shopping_bag' },
  };
  const c = colors[type] || colors.success;

  const toast = document.createElement('div');
  toast.style.cssText = [
    `background:${c.bg}`,
    `color:${c.color}`,
    'padding:12px 18px',
    'border-radius:9999px',
    'font-family:var(--font,sans-serif)',
    'font-size:12px',
    'font-weight:700',
    'letter-spacing:.04em',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'box-shadow:0 4px 24px rgba(0,0,0,.25)',
    'pointer-events:auto',
    'opacity:0',
    'transform:translateY(12px)',
    'transition:opacity .22s ease, transform .22s ease',
    'white-space:nowrap',
    'max-width:100%',
  ].join(';');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;flex-shrink:0">${c.icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Expose globally
if (typeof window !== 'undefined') {
  window.showCustomerToast = showCustomerToast;
}
