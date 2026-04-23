/**
 * ModArt Global Error Handler
 * 
 * UX FIX: H-14 - Error surfacing for background failures
 * 
 * Catches and surfaces all errors with user-friendly messages.
 * Provides retry options and logs errors for debugging.
 */

import { showError, showWarning } from './toast.js';

/**
 * Error types
 */
const ERROR_TYPES = {
  NETWORK: 'network',
  AUTH: 'auth',
  VALIDATION: 'validation',
  SERVER: 'server',
  UNKNOWN: 'unknown'
};

/**
 * Error messages
 */
const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: 'Network error. Please check your connection.',
  [ERROR_TYPES.AUTH]: 'Authentication failed. Please log in again.',
  [ERROR_TYPES.VALIDATION]: 'Invalid data. Please check your input.',
  [ERROR_TYPES.SERVER]: 'Server error. Please try again later.',
  [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred.'
};

/**
 * Determines error type from error object
 * @param {Error} error - Error object
 * @returns {string} Error type
 */
function getErrorType(error) {
  if (!error) return ERROR_TYPES.UNKNOWN;

  const message = error.message?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return ERROR_TYPES.NETWORK;
  }

  if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
    return ERROR_TYPES.AUTH;
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_TYPES.VALIDATION;
  }

  if (error.status >= 500 || message.includes('server')) {
    return ERROR_TYPES.SERVER;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Gets user-friendly error message
 * @param {Error} error - Error object
 * @returns {string} User-friendly message
 */
function getUserFriendlyMessage(error) {
  if (!error) return ERROR_MESSAGES[ERROR_TYPES.UNKNOWN];

  const type = getErrorType(error);
  return ERROR_MESSAGES[type] || error.message || ERROR_MESSAGES[ERROR_TYPES.UNKNOWN];
}

/**
 * Handles an error with user feedback
 * @param {Error} error - Error object
 * @param {Object} options - Options
 */
export function handleError(error, options = {}) {
  const {
    context = 'Operation',
    retry = null,
    silent = false,
    log = true
  } = options;

  // Log error
  if (log) {
    console.error(`[${context}] Error:`, error);
  }

  // Don't show toast if silent
  if (silent) return;

  const message = getUserFriendlyMessage(error);
  const type = getErrorType(error);

  // Show error toast with retry option
  if (retry) {
    showError(message, {
      action: {
        label: 'Retry',
        callback: retry
      },
      duration: 5000
    });
  } else {
    showError(message, {
      duration: 5000
    });
  }

  // Track error for analytics (if available)
  if (window.trackError) {
    window.trackError({
      type,
      message: error.message,
      context,
      stack: error.stack
    });
  }
}

/**
 * Wraps an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, options = {}) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      handleError(error, options);
      throw error;
    }
  };
}

/**
 * Handles network errors specifically
 * @param {Error} error - Network error
 * @param {Function} retryFn - Retry function
 */
export function handleNetworkError(error, retryFn = null) {
  if (!navigator.onLine) {
    showWarning('You are offline. Changes will sync when you reconnect.', {
      duration: 5000
    });
  } else {
    handleError(error, {
      context: 'Network',
      retry: retryFn
    });
  }
}

/**
 * Handles authentication errors
 * @param {Error} error - Auth error
 */
export function handleAuthError(error) {
  handleError(error, {
    context: 'Authentication',
    retry: () => {
      // Redirect to login
      if (window.goTo) {
        window.goTo('login');
      }
    }
  });
}

/**
 * Handles validation errors
 * @param {Error} error - Validation error
 * @param {Object} fieldErrors - Field-specific errors
 */
export function handleValidationError(error, fieldErrors = {}) {
  // Show general error
  handleError(error, {
    context: 'Validation',
    silent: Object.keys(fieldErrors).length > 0 // Silent if showing field errors
  });

  // Show field-specific errors
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const input = document.querySelector(`[name="${field}"]`);
    if (input) {
      input.style.borderColor = 'var(--red)';
      
      // Add error message
      let errorEl = input.parentNode.querySelector('.field-error');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.style.cssText = 'font-size:11px;color:var(--red);font-weight:600;margin-top:4px';
        input.parentNode.appendChild(errorEl);
      }
      errorEl.textContent = message;
    }
  });
}

/**
 * Clears field errors
 * @param {HTMLElement} form - Form element
 */
export function clearFieldErrors(form) {
  if (!form) return;

  form.querySelectorAll('.field-error').forEach(el => el.remove());
  form.querySelectorAll('input, textarea, select').forEach(el => {
    el.style.borderColor = '';
  });
}

/**
 * Global error handler for unhandled errors
 */
function setupGlobalErrorHandler() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Don't show toast for every unhandled rejection (can be noisy)
    // Only log to console
    if (event.reason instanceof Error) {
      const type = getErrorType(event.reason);
      
      // Only show toast for critical errors
      if (type === ERROR_TYPES.NETWORK || type === ERROR_TYPES.SERVER) {
        handleError(event.reason, {
          context: 'Background operation',
          silent: false
        });
      }
    }
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Don't show toast for script errors (can be noisy)
    // Only log to console
  });

  console.log('✅ Global error handler initialized');
}

/**
 * Handles API errors with specific status codes
 * @param {Response} response - Fetch response
 * @param {Object} options - Options
 */
export async function handleApiError(response, options = {}) {
  const { retry = null } = options;

  let errorMessage = 'An error occurred';
  
  try {
    const data = await response.json();
    errorMessage = data.error || data.message || errorMessage;
  } catch (e) {
    errorMessage = response.statusText || errorMessage;
  }

  const error = new Error(errorMessage);
  error.status = response.status;

  // Handle specific status codes
  switch (response.status) {
    case 401:
      handleAuthError(error);
      break;
    case 403:
      showError('You do not have permission to perform this action.');
      break;
    case 404:
      showError('Resource not found.');
      break;
    case 429:
      showError('Too many requests. Please wait and try again.');
      break;
    case 500:
    case 502:
    case 503:
      handleError(error, {
        context: 'Server',
        retry
      });
      break;
    default:
      handleError(error, {
        context: 'API',
        retry
      });
  }

  throw error;
}

/**
 * Safe async wrapper that catches and handles errors
 * @param {Function} fn - Async function
 * @param {Object} options - Options
 * @returns {Promise}
 */
export async function safeAsync(fn, options = {}) {
  try {
    return await fn();
  } catch (error) {
    handleError(error, options);
    return null;
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.handleError = handleError;
  window.withErrorHandling = withErrorHandling;
  window.handleNetworkError = handleNetworkError;
  window.handleAuthError = handleAuthError;
  window.handleValidationError = handleValidationError;
  window.clearFieldErrors = clearFieldErrors;
  window.handleApiError = handleApiError;
  window.safeAsync = safeAsync;
}

// Auto-initialize
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalErrorHandler);
  } else {
    setupGlobalErrorHandler();
  }
}
