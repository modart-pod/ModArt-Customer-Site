/**
 * ModArt Auth Module
 * Handles Supabase authentication: login, register, logout, session.
 * 
 * ✅ SECURITY FIX: JWT token expiry validation and auto-refresh
 */

// Import credentials from config (now using environment variables)
import { getCredentials } from './admin-config.js';

/**
 * Creates the Supabase client.
 * Called lazily so the CDN has time to load before this module executes.
 */
let _supabaseClient = null;

export function getSupabase() {
  // Only return cached client if it was successfully created
  if (_supabaseClient) return _supabaseClient;
  
  // Read credentials lazily — at call time the config fetch has resolved
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getCredentials();

  // Validate credentials — silently return null, don't log on every call
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Only log once to avoid console spam
    if (!getSupabase._warnedOnce) {
      console.warn('[ModArt] Supabase credentials not ready yet — will retry on next call');
      getSupabase._warnedOnce = true;
    }
    return null;
  }
  
  // Credentials available — reset the warn flag for future debug sessions
  getSupabase._warnedOnce = false;

  if (window.supabase?.createClient) {
    try {
      _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 10 } },
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      console.log('[ModArt] Supabase client created ✅');
      return _supabaseClient;
    } catch (e) {
      console.warn('Supabase createClient failed:', e.message);
      return null;
    }
  }
  console.warn('Supabase CDN not loaded yet. Auth features will be unavailable.');
  return null;
}

// Export a lazy reference — returns the live client on each call.
// Do NOT cache this at module init time because credentials aren't ready yet.
export const supabase = null; // deprecated; use getSupabase() directly

export let currentUser = null;

// ✅ NEW: Token refresh tracking
let refreshInterval = null;
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // Refresh 5 minutes before expiry

/**
 * ✅ NEW: Validates JWT token expiry and refreshes if needed
 * @returns {Promise<boolean>} True if token is valid, false if expired/invalid
 */
export async function validateAndRefreshToken() {
  const client = getSupabase();
  if (!client) return false;
  
  try {
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error || !session) {
      console.warn('No valid session found');
      return false;
    }
    
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    
    // Check if token is expired
    if (now >= expiresAt) {
      console.warn('Token expired, attempting refresh...');
      const { data, error: refreshError } = await client.auth.refreshSession();
      
      if (refreshError || !data.session) {
        console.error('Token refresh failed:', refreshError?.message);
        await handleExpiredSession();
        return false;
      }
      
      console.log('✅ Token refreshed successfully');
      return true;
    }
    
    // Check if token expires soon (within 5 minutes)
    if (expiresAt - now < TOKEN_REFRESH_MARGIN) {
      console.log('Token expires soon, refreshing proactively...');
      const { data, error: refreshError } = await client.auth.refreshSession();
      
      if (refreshError) {
        console.warn('Proactive refresh failed:', refreshError.message);
        // Don't fail here, token is still valid
      } else {
        console.log('✅ Token refreshed proactively');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * ✅ NEW: Handles expired session - logs out and redirects
 */
async function handleExpiredSession() {
  console.log('Session expired, logging out...');
  
  const client = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
  
  currentUser = null;
  window.currentUser = null;
  updateAuthUI();
  
  // Redirect to login with reason
  const currentPath = window.location.pathname;
  const isAdminPage = currentPath.includes('admin');
  
  if (isAdminPage) {
    window.location.href = '/login.html?redirect=/admin&reason=session_expired';
  } else if (currentPath !== '/' && currentPath !== '/index.html') {
    window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}&reason=session_expired`;
  }
}

/**
 * ✅ NEW: Starts automatic token refresh interval
 */
function startTokenRefreshInterval() {
  // Clear existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Check token every minute
  refreshInterval = setInterval(async () => {
    await validateAndRefreshToken();
  }, 60 * 1000);
  
  console.log('✅ Token refresh interval started');
}

/**
 * ✅ NEW: Stops automatic token refresh interval
 */
function stopTokenRefreshInterval() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('Token refresh interval stopped');
  }
}

/**
 * Initialises auth state. Call once on app load.
 */
export async function initAuth() {
  const client = getSupabase();
  if (!client) return;
  
  try {
    // Check for OAuth error first (e.g. Database error saving new user)
    const oauthError = sessionStorage.getItem('modart_oauth_error');
    if (oauthError) {
      sessionStorage.removeItem('modart_oauth_error');
      // Show error on login page if visible, otherwise show as alert
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = 'Sign in failed: ' + oauthError + '. Please try again.';
        errEl.style.display = 'block';
      }
      if (window.goTo) window.goTo('login');
    }

    // Restore OAuth hash if it was captured before module loaded
    const storedHash = sessionStorage.getItem('modart_oauth_hash');
    if (storedHash && storedHash.includes('access_token')) {
      sessionStorage.removeItem('modart_oauth_hash');
      // Temporarily restore hash so Supabase can parse it
      if (!window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname + storedHash);
      }
    }

    // getSession() triggers Supabase to parse the URL hash token
    const { data: { session: initialSession } } = await client.auth.getSession();
    
    // Clean the URL hash immediately after Supabase reads it
    if (window.location.hash && window.location.hash.includes('access_token')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (initialSession) {
      currentUser = initialSession.user ?? null;
      window.currentUser = currentUser;
      updateAuthUI();
      startTokenRefreshInterval();
    } else {
      currentUser = null;
      updateAuthUI();
    }
    
    // Listen for auth state changes (login, logout, token refresh, OAuth callback)
    client.auth.onAuthStateChange((event, session) => {
      const wasLoggedIn = !!currentUser;
      currentUser = session?.user ?? null;
      window.currentUser = currentUser;
      updateAuthUI();

      if (event === 'SIGNED_IN') {
        startTokenRefreshInterval();
        // Only navigate to account on a genuine new sign-in (user was not already logged in)
        // TOKEN_REFRESHED also fires SIGNED_IN — ignore those silent refreshes
        if (!wasLoggedIn && window.goTo) {
          const checkoutRedirect = sessionStorage.getItem('modart_checkout_redirect');
          if (checkoutRedirect) {
            sessionStorage.removeItem('modart_checkout_redirect');
            window.goTo('checkout');
          } else {
            const currentPage = window.getCurrentPage ? window.getCurrentPage() : 'home';
            if (currentPage === 'login' || currentPage === 'register') {
              window.goTo('account');
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        stopTokenRefreshInterval();
      }
    });
    
  } catch (e) {
    console.warn('Auth init failed:', e.message);
  }
}

/** Register with email + password. Returns { user, error } */
export async function register(email, password, fullName) {
  let client = getSupabase();
  if (!client) {
    // Wait briefly for config fetch to complete on slow connections
    await new Promise(r => setTimeout(r, 1500));
    if (!_supabaseClient && window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) {
      const { resolveSupabaseCredentials } = await import('./admin-config.js');
      resolveSupabaseCredentials();
    }
    client = getSupabase();
  }
  if (!client) return { user: null, error: { message: 'Sign-up is temporarily unavailable. Please refresh and try again.' } };
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  return { user: data?.user, error };
}

/** Login with email + password. Returns { user, error } */
export async function login(email, password) {
  let client = getSupabase();
  if (!client) {
    await new Promise(r => setTimeout(r, 1500));
    if (!_supabaseClient && window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) {
      const { resolveSupabaseCredentials } = await import('./admin-config.js');
      resolveSupabaseCredentials();
    }
    client = getSupabase();
  }
  if (!client) return { user: null, error: { message: 'Sign-in is temporarily unavailable. Please refresh and try again.' } };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

/** Login with Google OAuth. */
export async function loginWithGoogle() {
  // Try to resolve credentials one more time in case the user clicked
  // before the config fetch completed
  if (!window.__SUPABASE_URL__ || !window.__SUPABASE_ANON_KEY__) {
    // Wait up to 3 seconds for config to load
    await new Promise(resolve => {
      const deadline = Date.now() + 3000;
      const check = () => {
        if ((window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) || Date.now() > deadline) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
    // Re-resolve credentials now that config may have loaded
    if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) {
      const { resolveSupabaseCredentials } = await import('./admin-config.js');
      resolveSupabaseCredentials();
      // Reset cached null client so getSupabase() retries
      _supabaseClient = null;
    }
  }

  const client = getSupabase();
  if (!client) {
    // Check if it's a config issue vs a transient error
    const hasUrl  = !!(window.__SUPABASE_URL__);
    const hasKey  = !!(window.__SUPABASE_ANON_KEY__);
    if (!hasUrl || !hasKey) {
      showAuthError('google-error',
        'Sign-in is temporarily unavailable. Please try again in a moment or use email/password.'
      );
    } else {
      showAuthError('google-error', 'Could not connect to auth service. Please refresh and try again.');
    }
    return;
  }

  // Use explicit site URL — never rely on window.location.origin
  // which can be the Vercel preview URL or localhost
  const siteUrl = 'https://modart-modart-pods-projects.vercel.app';
  const redirectTo = siteUrl + '/';

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
  if (error) showAuthError('google-error', error.message);
}

/** Send password reset email. */
export async function sendPasswordReset(email) {
  const client = getSupabase();
  if (!client) return { error: { message: 'Auth service unavailable' } };
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '?reset=true'
  });
  return { error };
}

/** Logout current user. ✅ UPDATED: Stops token refresh interval */
export async function logout() {
  const client = getSupabase();
  if (client) await client.auth.signOut();
  
  stopTokenRefreshInterval();
  
  currentUser = null;
  window.currentUser = null;
  updateAuthUI();
  
  if (window.goTo) window.goTo('home');
}

/** Updates nav UI based on auth state. */
function updateAuthUI() {
  const loginBtns   = document.querySelectorAll('[data-show-when="logged-out"]');
  const accountBtns = document.querySelectorAll('[data-show-when="logged-in"]');
  const userNameEls = document.querySelectorAll('[data-user-name]');

  loginBtns.forEach(el  => el.style.display = currentUser ? 'none' : '');
  accountBtns.forEach(el => el.style.display = currentUser ? '' : 'none');

  const displayName = currentUser?.user_metadata?.full_name
    || currentUser?.email?.split('@')[0]
    || 'Account';
  userNameEls.forEach(el => { el.textContent = displayName; });

  const avatarEl = document.getElementById('nav-avatar');
  if (avatarEl && currentUser) {
    const name = currentUser?.user_metadata?.full_name || displayName;
    const parts = name.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name[0].toUpperCase();
    avatarEl.textContent = initials;
    const btn = avatarEl.closest('button');
    if (btn) btn.setAttribute('aria-label', `${displayName}'s account`);
  }
}

export function showAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

export function clearAuthError(elementId) {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

if (typeof window !== 'undefined') {
  window.login             = login;
  window.register          = register;
  window.logout            = logout;
  window.loginWithGoogle   = loginWithGoogle;
  window.sendPasswordReset = sendPasswordReset;
  window.currentUser       = currentUser;
  window.validateAndRefreshToken = validateAndRefreshToken; // ✅ NEW
}

export { updateAuthUI, startTokenRefreshInterval, stopTokenRefreshInterval };
