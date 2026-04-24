/**
 * ModArt Auth Module
 * Handles Supabase authentication: login, register, logout, session.
 * 
 * ✅ SECURITY FIX: JWT token expiry validation and auto-refresh
 */

// Import credentials from config (now using environment variables)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './admin-config.js';

/**
 * Creates the Supabase client.
 * Called lazily so the CDN has time to load before this module executes.
 */
let _supabaseClient = null;

export function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  
  // Validate credentials
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ CRITICAL: Supabase credentials not configured');
    return null;
  }
  
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
      return _supabaseClient;
    } catch (e) {
      console.warn('Supabase createClient failed:', e.message);
      return null;
    }
  }
  console.warn('Supabase CDN not loaded yet. Auth features will be unavailable.');
  return null;
}

// Export a stable reference
export const supabase = (() => {
  return getSupabase();
})();

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
 * ✅ UPDATED: Now includes token validation and auto-refresh
 */
export async function initAuth() {
  const client = getSupabase();
  if (!client) return;
  
  try {
    // Validate token on init
    const isValid = await validateAndRefreshToken();
    
    if (!isValid) {
      console.log('No valid session on init');
      currentUser = null;
      updateAuthUI();
      return;
    }
    
    const { data: { session } } = await client.auth.getSession();
    currentUser = session?.user ?? null;
    window.currentUser = currentUser;
    updateAuthUI();
    
    // Start token refresh interval if logged in
    if (currentUser) {
      startTokenRefreshInterval();
    }
    
    // Listen for auth state changes
    client.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      currentUser = session?.user ?? null;
      window.currentUser = currentUser;
      updateAuthUI();
      
      // Manage refresh interval based on auth state
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        startTokenRefreshInterval();
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
  const client = getSupabase();
  if (!client) return { user: null, error: { message: 'Auth service unavailable' } };
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  return { user: data?.user, error };
}

/** Login with email + password. Returns { user, error } */
export async function login(email, password) {
  const client = getSupabase();
  if (!client) return { user: null, error: { message: 'Auth service unavailable' } };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

/** Login with Google OAuth. */
export async function loginWithGoogle() {
  const client = getSupabase();
  if (!client) { showAuthError('google-error', 'Auth service unavailable'); return; }
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
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
