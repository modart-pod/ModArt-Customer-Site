/**
 * Web Vitals Performance Monitoring
 * 
 * MONITORING FIX: M-13 - Performance monitoring for Core Web Vitals
 * 
 * Tracks and reports Core Web Vitals metrics:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 * - INP (Interaction to Next Paint)
 */

/**
 * Sends metric to analytics
 * @param {Object} metric - Web Vitals metric
 */
function sendToAnalytics(metric) {
  const { name, value, rating, delta, id } = metric;
  
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📊 ${name}:`, {
      value: Math.round(value),
      rating,
      delta: Math.round(delta),
      id,
    });
  }
  
  // Send to Google Analytics if available
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, {
      event_category: 'Web Vitals',
      event_label: id,
      value: Math.round(value),
      metric_rating: rating,
      non_interaction: true,
    });
  }
  
  // Send to Sentry if available
  if (typeof window.Sentry !== 'undefined') {
    window.Sentry.captureMessage(`Web Vital: ${name}`, {
      level: rating === 'good' ? 'info' : rating === 'needs-improvement' ? 'warning' : 'error',
      extra: {
        metric: name,
        value: Math.round(value),
        rating,
        delta: Math.round(delta),
        id,
      },
    });
  }
  
  // Send to custom analytics endpoint if configured
  const analyticsEndpoint = process.env.ANALYTICS_ENDPOINT;
  if (analyticsEndpoint) {
    fetch(analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: name,
        value: Math.round(value),
        rating,
        delta: Math.round(delta),
        id,
        url: window.location.href,
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(err => {
      console.error('Failed to send metric to analytics:', err);
    });
  }
  
  // Store in localStorage for debugging
  try {
    const metrics = JSON.parse(localStorage.getItem('web-vitals') || '[]');
    metrics.push({
      name,
      value: Math.round(value),
      rating,
      timestamp: Date.now(),
      url: window.location.pathname,
    });
    // Keep only last 50 metrics
    if (metrics.length > 50) metrics.shift();
    localStorage.setItem('web-vitals', JSON.stringify(metrics));
  } catch (error) {
    // Ignore localStorage errors
  }
}

/**
 * Gets rating for a metric value
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @returns {string} Rating (good, needs-improvement, poor)
 */
function getRating(name, value) {
  const thresholds = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    INP: [200, 500],
  };
  
  const [good, poor] = thresholds[name] || [0, Infinity];
  
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Initializes Web Vitals monitoring
 */
export function initWebVitals() {
  // Check if web-vitals library is available
  if (typeof window.webVitals === 'undefined') {
    console.warn('⚠️ web-vitals library not loaded. Performance monitoring disabled.');
    return;
  }
  
  try {
    const { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } = window.webVitals;
    
    // Track Core Web Vitals
    onCLS(sendToAnalytics);
    onFID(sendToAnalytics);
    onLCP(sendToAnalytics);
    
    // Track additional metrics
    onFCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    
    // Track INP if available (newer metric)
    if (onINP) {
      onINP(sendToAnalytics);
    }
    
    console.log('✅ Web Vitals monitoring initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Web Vitals:', error);
  }
}

/**
 * Gets stored Web Vitals metrics
 * @returns {Array} Array of metrics
 */
export function getStoredMetrics() {
  try {
    return JSON.parse(localStorage.getItem('web-vitals') || '[]');
  } catch (error) {
    return [];
  }
}

/**
 * Clears stored Web Vitals metrics
 */
export function clearStoredMetrics() {
  try {
    localStorage.removeItem('web-vitals');
    console.log('✅ Web Vitals metrics cleared');
  } catch (error) {
    console.error('❌ Failed to clear metrics:', error);
  }
}

/**
 * Gets performance summary
 * @returns {Object} Performance summary
 */
export function getPerformanceSummary() {
  const metrics = getStoredMetrics();
  
  if (metrics.length === 0) {
    return {
      message: 'No metrics available yet',
      metrics: [],
    };
  }
  
  // Group by metric name
  const grouped = metrics.reduce((acc, metric) => {
    if (!acc[metric.name]) {
      acc[metric.name] = [];
    }
    acc[metric.name].push(metric.value);
    return acc;
  }, {});
  
  // Calculate averages
  const summary = Object.entries(grouped).map(([name, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const rating = getRating(name, avg);
    
    return {
      name,
      average: Math.round(avg),
      count: values.length,
      rating,
      latest: values[values.length - 1],
    };
  });
  
  return {
    message: 'Performance summary',
    metrics: summary,
    totalSamples: metrics.length,
  };
}

/**
 * Logs performance summary to console
 */
export function logPerformanceSummary() {
  const summary = getPerformanceSummary();
  
  console.group('📊 Performance Summary');
  console.log(summary.message);
  
  if (summary.metrics && summary.metrics.length > 0) {
    summary.metrics.forEach(metric => {
      const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
      console.log(`${emoji} ${metric.name}: ${metric.average}ms (${metric.rating}) - ${metric.count} samples`);
    });
    console.log(`Total samples: ${summary.totalSamples}`);
  }
  
  console.groupEnd();
}

// Export for window access
if (typeof window !== 'undefined') {
  window.initWebVitals = initWebVitals;
  window.getStoredMetrics = getStoredMetrics;
  window.clearStoredMetrics = clearStoredMetrics;
  window.getPerformanceSummary = getPerformanceSummary;
  window.logPerformanceSummary = logPerformanceSummary;
}

// Auto-initialize
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize after a short delay to ensure web-vitals library is loaded
      setTimeout(() => initWebVitals(), 100);
    });
  } else {
    setTimeout(() => initWebVitals(), 100);
  }
}
