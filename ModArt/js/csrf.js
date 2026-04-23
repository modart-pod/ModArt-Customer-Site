/**
 * CSRF Token Client Module
 * 
 * ✅ SECURITY FIX: Client-side CSRF token management
 * 
 * Automatically fetches and includes CSRF tokens in all mutation requests.
 * Tokens are cached and refreshed automatically before expiry.
 */

let csrfToken = null;
let tokenExpiresAt = null;

/**
 * Get CSRF token (fetches new one if needed)
 * @returns {Promise<string>} CSRF token
 */
export async function getCsrfToken() {
  // Return cached token if still valid
  if (csrfToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
    return csrfToken;
  }
  
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include' // Include cookies
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    const data = await response.json();
    csrfToken = data.csrfToken;
    tokenExpiresAt = Date.now() + (data.expiresIn * 1000);
    
    console.log('✅ CSRF token fetched');
    return csrfToken;
    
  } catch (error) {
    console.error('❌ CSRF token fetch failed:', error);
    throw error;
  }
}

/**
 * Fetch wrapper that automatically includes CSRF token
 * Use this instead of fetch() for all POST/PUT/DELETE requests
 * 
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithCsrf(url, options = {}) {
  // Only add CSRF token for mutation methods
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  
  if (needsCsrf) {
    // Get CSRF token
    const token = await getCsrfToken();
    
    // Add token to headers
    options.headers = {
      ...options.headers,
      'X-CSRF-Token': token
    };
  }
  
  // Include credentials for cookies
  options.credentials = options.credentials || 'include';
  
  return fetch(url, options);
}

/**
 * Refresh CSRF token manually
 * Call this if you get a 403 CSRF error
 */
export async function refreshCsrfToken() {
  csrfToken = null;
  tokenExpiresAt = null;
  return getCsrfToken();
}

/**
 * Auto-refresh token every 10 minutes
 */
let refreshInterval = null;

export function startCsrfRefreshInterval() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(async () => {
    try {
      await refreshCsrfToken();
      console.log('✅ CSRF token auto-refreshed');
    } catch (error) {
      console.error('❌ CSRF token auto-refresh failed:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes
}

export function stopCsrfRefreshInterval() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Start auto-refresh on module load
if (typeof window !== 'undefined') {
  // Fetch initial token
  getCsrfToken().catch(e => console.warn('Initial CSRF token fetch failed:', e));
  
  // Start auto-refresh
  startCsrfRefreshInterval();
  
  // Export to window for inline onclick handlers
  window.fetchWithCsrf = fetchWithCsrf;
  window.getCsrfToken = getCsrfToken;
}

export default {
  getCsrfToken,
  fetchWithCsrf,
  refreshCsrfToken,
  startCsrfRefreshInterval,
  stopCsrfRefreshInterval
};
