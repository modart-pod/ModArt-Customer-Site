/**
 * ModArt Keyboard Navigation
 * 
 * Accessibility FIX: H-17 - Keyboard navigation
 * 
 * Provides comprehensive keyboard navigation support
 */

let isKeyboardUser = false;
let focusTrapStack = [];

/**
 * Detects if user is navigating with keyboard
 */
function detectKeyboardUser() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      isKeyboardUser = true;
      document.body.classList.add('keyboard-nav');
    }
  });

  document.addEventListener('mousedown', () => {
    isKeyboardUser = false;
    document.body.classList.remove('keyboard-nav');
  });
}

/**
 * Gets all focusable elements within a container
 */
function getFocusableElements(container = document) {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  return Array.from(container.querySelectorAll(selector))
    .filter(el => el.offsetParent !== null && !el.hasAttribute('aria-hidden'));
}

/**
 * Creates a focus trap within a container
 */
export function trapFocus(container) {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const previousFocus = document.activeElement;

  if (firstElement) firstElement.focus();

  function handleTab(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }

  container.addEventListener('keydown', handleTab);

  return () => {
    container.removeEventListener('keydown', handleTab);
    previousFocus?.focus();
  };
}

/**
 * Handles modal keyboard navigation
 */
export function initModalKeyboardNav(modal) {
  if (!modal) return;

  let releaseTrap = null;

  const openModal = () => {
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    releaseTrap = trapFocus(modal);
  };

  const closeModal = () => {
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (releaseTrap) {
      releaseTrap();
      releaseTrap = null;
    }
  };

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      if (window.closeModal) window.closeModal();
    }
  });

  modal._keyboardNav = { open: openModal, close: closeModal };
}

/**
 * Initialize keyboard navigation
 */
export function initKeyboardNav() {
  detectKeyboardUser();

  // Initialize modal keyboard nav
  const modal = document.getElementById('modal');
  if (modal) {
    initModalKeyboardNav(modal);
  }

  // Initialize search overlay
  const searchOverlay = document.getElementById('search-overlay');
  if (searchOverlay) {
    initModalKeyboardNav(searchOverlay);
  }

  console.log('✅ Keyboard navigation initialized');
}

// Export for window access
if (typeof window !== 'undefined') {
  window.trapFocus = trapFocus;
  window.initModalKeyboardNav = initModalKeyboardNav;
  window.initKeyboardNav = initKeyboardNav;
}

// Auto-initialize
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKeyboardNav);
  } else {
    initKeyboardNav();
  }
}
