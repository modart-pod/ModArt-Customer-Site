/**
 * ModArt Toast Notification System
 * 
 * UX FIX: H-13 - Toast notifications for user feedback
 * 
 * Provides instant feedback for all user actions.
 * Supports success, error, warning, and info types.
 * Auto-dismisses with configurable timeout.
 * Stacks multiple toasts with queue management.
 */

/**
 * Toast configuration
 */
const TOAST_CONFIG = {
  duration: {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000
  },
  maxToasts: 5,
  position: 'top-right' // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
};

/**
 * Toast queue
 */
let toastQueue = [];
let toastContainer = null;

/**
 * Initializes the toast system
 */
function initToastSystem() {
  if (toastContainer) return;

  // Create toast container
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.className = `toast-container toast-${TOAST_CONFIG.position}`;
  document.body.appendChild(toastContainer);

  console.log('✅ Toast system initialized');
}

/**
 * Shows a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {Object} options - Additional options
 * @returns {string} Toast ID
 */
export function showToast(message, type = 'info', options = {}) {
  if (!toastContainer) initToastSystem();

  const toast = {
    id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    message,
    type,
    duration: options.duration || TOAST_CONFIG.duration[type] || 3000,
    action: options.action || null,
    dismissible: options.dismissible !== false,
    icon: options.icon || getDefaultIcon(type),
    createdAt: Date.now()
  };

  // Add to queue
  toastQueue.push(toast);

  // Remove oldest if exceeds max
  if (toastQueue.length > TOAST_CONFIG.maxToasts) {
    const oldest = toastQueue.shift();
    removeToast(oldest.id);
  }

  // Render toast
  renderToast(toast);

  // Auto-dismiss
  if (toast.duration > 0) {
    setTimeout(() => {
      dismissToast(toast.id);
    }, toast.duration);
  }

  return toast.id;
}

/**
 * Gets default icon for toast type
 * @param {string} type - Toast type
 * @returns {string} Icon name
 */
function getDefaultIcon(type) {
  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };
  return icons[type] || 'info';
}

/**
 * Renders a toast element
 * @param {Object} toast - Toast object
 */
function renderToast(toast) {
  const toastEl = document.createElement('div');
  toastEl.id = toast.id;
  toastEl.className = `toast toast-${toast.type} toast-enter`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'polite');

  // Toast content
  let html = `
    <div class="toast-content">
      <span class="material-symbols-outlined toast-icon">${toast.icon}</span>
      <span class="toast-message">${escapeHtml(toast.message)}</span>
    </div>
  `;

  // Add action button if provided
  if (toast.action) {
    html += `
      <button class="toast-action" onclick="window.toastAction_${toast.id}()">
        ${escapeHtml(toast.action.label)}
      </button>
    `;
    // Store action callback
    window[`toastAction_${toast.id}`] = () => {
      toast.action.callback();
      dismissToast(toast.id);
    };
  }

  // Add dismiss button if dismissible
  if (toast.dismissible) {
    html += `
      <button class="toast-dismiss" onclick="window.dismissToast('${toast.id}')" aria-label="Dismiss">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;
  }

  toastEl.innerHTML = html;
  toastContainer.appendChild(toastEl);

  // Trigger enter animation
  setTimeout(() => {
    toastEl.classList.remove('toast-enter');
  }, 10);
}

/**
 * Dismisses a toast
 * @param {string} toastId - Toast ID
 */
export function dismissToast(toastId) {
  const toastEl = document.getElementById(toastId);
  if (!toastEl) return;

  // Add exit animation
  toastEl.classList.add('toast-exit');

  // Remove after animation
  setTimeout(() => {
    removeToast(toastId);
  }, 300);
}

/**
 * Removes a toast from DOM and queue
 * @param {string} toastId - Toast ID
 */
function removeToast(toastId) {
  const toastEl = document.getElementById(toastId);
  if (toastEl) {
    toastEl.remove();
  }

  // Remove from queue
  toastQueue = toastQueue.filter(t => t.id !== toastId);

  // Clean up action callback
  if (window[`toastAction_${toastId}`]) {
    delete window[`toastAction_${toastId}`];
  }
}

/**
 * Clears all toasts
 */
export function clearAllToasts() {
  toastQueue.forEach(toast => {
    removeToast(toast.id);
  });
  toastQueue = [];
}

/**
 * Helper functions for common toast types
 */

export function showSuccess(message, options = {}) {
  return showToast(message, 'success', options);
}

export function showError(message, options = {}) {
  return showToast(message, 'error', options);
}

export function showWarning(message, options = {}) {
  return showToast(message, 'warning', options);
}

export function showInfo(message, options = {}) {
  return showToast(message, 'info', options);
}

/**
 * Shows a loading toast that can be updated
 * @param {string} message - Loading message
 * @returns {Object} Toast controller
 */
export function showLoading(message) {
  const toastId = showToast(message, 'info', {
    duration: 0, // Don't auto-dismiss
    dismissible: false,
    icon: 'progress_activity'
  });

  return {
    id: toastId,
    update: (newMessage) => {
      const toastEl = document.getElementById(toastId);
      if (toastEl) {
        const messageEl = toastEl.querySelector('.toast-message');
        if (messageEl) messageEl.textContent = newMessage;
      }
    },
    success: (message) => {
      dismissToast(toastId);
      showSuccess(message);
    },
    error: (message) => {
      dismissToast(toastId);
      showError(message);
    },
    dismiss: () => {
      dismissToast(toastId);
    }
  };
}

/**
 * Shows a toast with undo action
 * @param {string} message - Toast message
 * @param {Function} undoCallback - Undo callback
 * @param {number} duration - Duration before action is committed
 */
export function showUndo(message, undoCallback, duration = 5000) {
  let undone = false;

  const toastId = showToast(message, 'info', {
    duration,
    action: {
      label: 'Undo',
      callback: () => {
        undone = true;
        undoCallback();
        showSuccess('Action undone');
      }
    }
  });

  // Commit action after duration if not undone
  setTimeout(() => {
    if (!undone) {
      console.log('Action committed (not undone)');
    }
  }, duration);

  return toastId;
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Export for window access
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.dismissToast = dismissToast;
  window.clearAllToasts = clearAllToasts;
  window.showSuccess = showSuccess;
  window.showError = showError;
  window.showWarning = showWarning;
  window.showInfo = showInfo;
  window.showLoading = showLoading;
  window.showUndo = showUndo;
}

// Auto-initialize on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToastSystem);
  } else {
    initToastSystem();
  }
}
