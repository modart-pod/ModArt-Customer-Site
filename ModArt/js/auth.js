/**
 * ModArt Auth Module
 * Handles Supabase authentication: login, register, logout, session.
 */
const SUPABASE_URL = 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2RjdHp6c3JsZ3lodGNsYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY5MzEsImV4cCI6MjA4OTA4MjkzMX0.Wfrlocx56uR_8-5EZoBajIzHt09GX_JcrBCSeZuVqMY';

// Wait for Supabase CDN — don't throw, just warn so the rest of the app still loads
function getSupabaseClient() {
  if (window.supabase?.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  console.warn('Supabase CDN not loaded yet. Auth features will be unavailable.');
  return null;
}

export const supabase = getSupabaseClient();

export let currentUser = null;

/**
 * Initialises auth state. Call once on app load.
 */
export async function initAuth() {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user ?? null;
    updateAuthUI();
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user ?? null;
      window.currentUser = currentUser;
      updateAuthUI();
    });
  } catch (e) {
    console.warn('Auth init failed:', e.message);
  }
}

/** Register with email + password. Returns { user, error } */
export async function register(email, password, fullName) {
  if (!supabase) return { user: null, error: { message: 'Auth service unavailable' } };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  return { user: data?.user, error };
}

/** Login with email + password. Returns { user, error } */
export async function login(email, password) {
  if (!supabase) return { user: null, error: { message: 'Auth service unavailable' } };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

/** Login with Google OAuth. */
export async function loginWithGoogle() {
  if (!supabase) { showAuthError('google-error', 'Auth service unavailable'); return; }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://modart-print-on-demand.vercel.app' }
  });
  if (error) showAuthError('google-error', error.message);
}

/** Send password reset email. */
export async function sendPasswordReset(email) {
  if (!supabase) return { error: { message: 'Auth service unavailable' } };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '?reset=true'
  });
  return { error };
}

/** Logout current user. */
export async function logout() {
  if (supabase) await supabase.auth.signOut();
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
}

export { updateAuthUI };
