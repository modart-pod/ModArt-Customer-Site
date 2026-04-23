/**
 * ModArt Loading Manager
 * 
 * UX FIX: H-6 - Loading states for async operations
 * 
 * Provides consistent loading indicators across the app.
 * Supports button spinners, overlays, and skeleton loaders.
 */

/**
 * Shows loading spinner on a button
 * @param {HTMLElement} button - Button element
 * @param {string} loadingText - Optional loading text
 * @returns {Function} Cleanup function
 */
export function showButtonLoading(button, loadingText = null) {
  if (!button) return () => {};

  // Store original state
  const originalText = button.innerHTML;
  const originalDisabled = button.disabled;

  // Disable button
  button.disabled = true;
  button.classList.add('btn-loading');

  // Add spinner
  const spinner = '<span class="btn-spinner"></span>';
  const text = loadingText || 'Loading...';
  button.innerHTML = `${spinner} ${text}`;

  // Return cleanup function
  return () => {
    button.innerHTML = originalText;
    button.disabled = originalDisabled;
    button.classList.remove('btn-loading');
  };
}

/**
 * Shows loading overlay on an element
 * @param {HTMLElement|string} target - Target element or selector
 * @param {string} message - Optional loading message
 * @returns {Function} Cleanup function
 */
export function showLoadingOverlay(target, message = 'Loading...') {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return () => {};

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-overlay-content">
      <div class="loading-spinner"></div>
      <div class="loading-message">${escapeHtml(message)}</div>
    </div>
  `;

  // Add to element
  element.style.position = 'relative';
  element.appendChild(overlay);

  // Trigger animation
  setTimeout(() => overlay.classList.add('loading-overlay-visible'), 10);

  // Return cleanup function
  return () => {
    overlay.classList.remove('loading-overlay-visible');
    setTimeout(() => overlay.remove(), 300);
  };
}

/**
 * Shows full-page loading overlay
 * @param {string} message - Optional loading message
 * @returns {Function} Cleanup function
 */
export function showPageLoading(message = 'Loading...') {
  // Check if already exists
  let overlay = document.getElementById('page-loading-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'page-loading-overlay';
    overlay.className = 'page-loading-overlay';
    overlay.innerHTML = `
      <div class="page-loading-content">
        <div class="page-loading-spinner"></div>
        <div class="page-loading-message">${escapeHtml(message)}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // Show overlay
  setTimeout(() => overlay.classList.add('page-loading-visible'), 10);

  // Return cleanup function
  return () => {
    overlay.classList.remove('page-loading-visible');
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    }, 300);
  };
}

/**
 * Shows skeleton loader in an element
 * @param {HTMLElement|string} target - Target element or selector
 * @param {string} type - Skeleton type (card, list, table, text)
 * @param {number} count - Number of skeleton items
 */
export function showSkeleton(target, type = 'card', count = 3) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;

  const skeletons = {
    card: `
      <div class="skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-text skeleton-text-lg"></div>
        <div class="skeleton-text skeleton-text-md"></div>
        <div class="skeleton-text skeleton-text-sm"></div>
      </div>
    `,
    list: `
      <div class="skeleton-list-item">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-list-content">
          <div class="skeleton-text skeleton-text-md"></div>
          <div class="skeleton-text skeleton-text-sm"></div>
        </div>
      </div>
    `,
    table: `
      <div class="skeleton-table-row">
        <div class="skeleton-text skeleton-text-sm"></div>
        <div class="skeleton-text skeleton-text-sm"></div>
        <div class="skeleton-text skeleton-text-sm"></div>
        <div class="skeleton-text skeleton-text-sm"></div>
      </div>
    `,
    text: `
      <div class="skeleton-text skeleton-text-md"></div>
    `
  };

  const skeleton = skeletons[type] || skeletons.card;
  element.innerHTML = skeleton.repeat(count);
  element.classList.add('skeleton-container');
}

/**
 * Hides skeleton loader
 * @param {HTMLElement|string} target - Target element or selector
 */
export function hideSkeleton(target) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;

  element.classList.remove('skeleton-container');
}

/**
 * Wraps an async function with loading state
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Loading options
 * @returns {Function} Wrapped function
 */
export function withLoading(fn, options = {}) {
  return async function(...args) {
    let cleanup = () => {};

    try {
      // Show loading based on type
      if (options.button) {
        cleanup = showButtonLoading(options.button, options.loadingText);
      } else if (options.overlay) {
        cleanup = showLoadingOverlay(options.overlay, options.message);
      } else if (options.page) {
        cleanup = showPageLoading(options.message);
      }

      // Execute function
      const result = await fn.apply(this, args);

      // Show success toast if configured
      if (options.successMessage) {
        if (window.showSuccess) {
          window.showSuccess(options.successMessage);
        }
      }

      return result;
    } catch (error) {
      // Show error toast if configured
      if (options.errorMessage) {
        if (window.showError) {
          window.showError(options.errorMessage);
        }
      } else if (window.showError) {
        window.showError(error.message || 'An error occurred');
      }

      throw error;
    } finally {
      // Clean up loading state
      cleanup();
    }
  };
}

/**
 * Shows loading state during navigation
 */
export function showNavigationLoading() {
  const cleanup = showPageLoading('Loading page...');
  
  // Auto-hide after 5 seconds (fallback)
  setTimeout(cleanup, 5000);
  
  return cleanup;
}

/**
 * Tracks loading state for multiple operations
 */
class LoadingTracker {
  constructor() {
    this.operations = new Set();
    this.cleanup = null;
  }

  start(operationId, message = 'Loading...') {
    this.operations.add(operationId);
    
    if (this.operations.size === 1) {
      // First operation - show loading
      this.cleanup = showPageLoading(message);
    }
  }

  end(operationId) {
    this.operations.delete(operationId);
    
    if (this.operations.size === 0 && this.cleanup) {
      // Last operation - hide loading
      this.cleanup();
      this.cleanup = null;
    }
  }

  isLoading() {
    return this.operations.size > 0;
  }

  clear() {
    this.operations.clear();
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
}

// Create global loading tracker
const globalLoadingTracker = new LoadingTracker();

/**
 * Starts a tracked loading operation
 * @param {string} operationId - Unique operation ID
 * @param {string} message - Loading message
 */
export function startLoading(operationId, message) {
  globalLoadingTracker.start(operationId, message);
}

/**
 * Ends a tracked loading operation
 * @param {string} operationId - Unique operation ID
 */
export function endLoading(operationId) {
  globalLoadingTracker.end(operationId);
}

/**
 * Checks if any operation is loading
 * @returns {boolean}
 */
export function isLoading() {
  return globalLoadingTracker.isLoading();
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
  window.showButtonLoading = showButtonLoading;
  window.showLoadingOverlay = showLoadingOverlay;
  window.showPageLoading = showPageLoading;
  window.showSkeleton = showSkeleton;
  window.hideSkeleton = hideSkeleton;
  window.withLoading = withLoading;
  window.showNavigationLoading = showNavigationLoading;
  window.startLoading = startLoading;
  window.endLoading = endLoading;
  window.isLoading = isLoading;
}
