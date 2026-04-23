/**
 * Sentry Error Tracking
 * 
 * MONITORING FIX: M-12 - Error tracking for production visibility
 * 
 * Captures and reports errors to Sentry for monitoring and debugging.
 * Includes source maps support and custom error context.
 */

/**
 * Initializes Sentry error tracking
 * @param {Object} options - Configuration options
 */
export function initSentry(options = {}) {
  // Check if Sentry is available
  if (typeof window.Sentry === 'undefined') {
    console.warn('⚠️ Sentry SDK not loaded. Error tracking disabled.');
    return;
  }

  const {
    dsn = process.env.SENTRY_DSN || '',
    environment = process.env.NODE_ENV || 'production',
    release = process.env.SENTRY_RELEASE || 'modart@1.0.0',
    tracesSampleRate = 0.1, // 10% of transactions
    replaysSessionSampleRate = 0.1, // 10% of sessions
    replaysOnErrorSampleRate = 1.0, // 100% of sessions with errors
  } = options;

  if (!dsn) {
    console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  try {
    window.Sentry.init({
      dsn,
      environment,
      release,
      
      // Performance monitoring
      integrations: [
        new window.Sentry.BrowserTracing(),
        new window.Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Performance Monitoring
      tracesSampleRate,
      
      // Session Replay
      replaysSessionSampleRate,
      replaysOnErrorSampleRate,
      
      // Error filtering
      beforeSend(event, hint) {
        // Filter out known non-critical errors
        const error = hint.originalException;
        
        // Ignore network errors from ad blockers
        if (error && error.message && error.message.includes('adsbygoogle')) {
          return null;
        }
        
        // Ignore ResizeObserver errors (browser quirk)
        if (error && error.message && error.message.includes('ResizeObserver')) {
          return null;
        }
        
        return event;
      },
      
      // Add user context
      initialScope: {
        tags: {
          'app.version': release,
        },
      },
    });

    console.log('✅ Sentry error tracking initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error);
  }
}

/**
 * Sets user context for error tracking
 * @param {Object} user - User information
 */
export function setSentryUser(user) {
  if (typeof window.Sentry === 'undefined') return;
  
  try {
    window.Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username || user.email,
    });
    console.log('✅ Sentry user context set');
  } catch (error) {
    console.error('❌ Failed to set Sentry user:', error);
  }
}

/**
 * Clears user context (on logout)
 */
export function clearSentryUser() {
  if (typeof window.Sentry === 'undefined') return;
  
  try {
    window.Sentry.setUser(null);
    console.log('✅ Sentry user context cleared');
  } catch (error) {
    console.error('❌ Failed to clear Sentry user:', error);
  }
}

/**
 * Captures an exception manually
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  if (typeof window.Sentry === 'undefined') {
    console.error('Error (Sentry not available):', error, context);
    return;
  }
  
  try {
    window.Sentry.captureException(error, {
      extra: context,
    });
  } catch (err) {
    console.error('❌ Failed to capture exception:', err);
  }
}

/**
 * Captures a message manually
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (typeof window.Sentry === 'undefined') {
    console.log(`Message (Sentry not available) [${level}]:`, message, context);
    return;
  }
  
  try {
    window.Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  } catch (error) {
    console.error('❌ Failed to capture message:', error);
  }
}

/**
 * Adds breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
  if (typeof window.Sentry === 'undefined') return;
  
  try {
    window.Sentry.addBreadcrumb(breadcrumb);
  } catch (error) {
    console.error('❌ Failed to add breadcrumb:', error);
  }
}

/**
 * Sets custom context
 * @param {string} key - Context key
 * @param {Object} value - Context value
 */
export function setContext(key, value) {
  if (typeof window.Sentry === 'undefined') return;
  
  try {
    window.Sentry.setContext(key, value);
  } catch (error) {
    console.error('❌ Failed to set context:', error);
  }
}

/**
 * Wraps a function to capture errors
 * @param {Function} fn - Function to wrap
 * @returns {Function} Wrapped function
 */
export function wrapWithErrorTracking(fn) {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      captureException(error, {
        function: fn.name,
        arguments: args,
      });
      throw error;
    }
  };
}

// Export for window access
if (typeof window !== 'undefined') {
  window.initSentry = initSentry;
  window.setSentryUser = setSentryUser;
  window.clearSentryUser = clearSentryUser;
  window.captureException = captureException;
  window.captureMessage = captureMessage;
  window.addBreadcrumb = addBreadcrumb;
  window.setContext = setContext;
}

// Auto-initialize if DSN is available
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize after a short delay to ensure Sentry SDK is loaded
      setTimeout(() => initSentry(), 100);
    });
  } else {
    setTimeout(() => initSentry(), 100);
  }
}
