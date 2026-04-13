/**
 * ModArt Auth Handlers
 * Form submission handlers for login, register, password reset.
 */
import {
  login, register, sendPasswordReset,
  showAuthError, clearAuthError
} from './auth.js';

/** Basic email format check */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handleLogin() {
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const btn      = document.getElementById('login-submit-btn');
  clearAuthError('login-error');

  if (!email || !isValidEmail(email)) {
    showAuthError('login-error', 'Please enter a valid email address.');
    return;
  }
  if (!password) {
    showAuthError('login-error', 'Please enter your password.');
    return;
  }

  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  const { user, error } = await login(email, password);
  if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }

  if (error) {
    showAuthError('login-error', error.message || 'Sign in failed. Please try again.');
    return;
  }
  if (user && window.goTo) window.goTo('account');
}

export async function handleRegister() {
  const name     = document.getElementById('register-name')?.value?.trim();
  const email    = document.getElementById('register-email')?.value?.trim();
  const password = document.getElementById('register-password')?.value;
  const terms    = document.getElementById('register-terms')?.checked;
  const btn      = document.getElementById('register-submit-btn');
  clearAuthError('register-error');

  if (!name || name.length < 2) {
    showAuthError('register-error', 'Please enter your full name.');
    return;
  }
  if (!email || !isValidEmail(email)) {
    showAuthError('register-error', 'Please enter a valid email address.');
    return;
  }
  if (!password || password.length < 8) {
    showAuthError('register-error', 'Password must be at least 8 characters.');
    return;
  }
  if (!/[A-Z]/.test(password)) {
    showAuthError('register-error', 'Password must contain at least one uppercase letter.');
    return;
  }
  if (!/[0-9]/.test(password)) {
    showAuthError('register-error', 'Password must contain at least one number.');
    return;
  }
  if (!terms) {
    showAuthError('register-error', 'Please accept the Terms and Privacy Policy.');
    return;
  }

  if (btn) { btn.textContent = 'Creating account…'; btn.disabled = true; }
  const { user, error } = await register(email, password, name);
  if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }

  if (error) {
    showAuthError('register-error', error.message || 'Registration failed. Please try again.');
    return;
  }
  const successEl = document.getElementById('register-success');
  if (successEl) {
    successEl.textContent = 'Account created! Check your email to confirm your address.';
    successEl.style.display = 'block';
  }
}

export async function handlePasswordReset() {
  const email = document.getElementById('reset-email')?.value?.trim();
  clearAuthError('reset-error');

  if (!email || !isValidEmail(email)) {
    showAuthError('reset-error', 'Please enter a valid email address.');
    return;
  }

  const { error } = await sendPasswordReset(email);
  if (error) {
    showAuthError('reset-error', error.message || 'Could not send reset email.');
    return;
  }
  const successEl = document.getElementById('reset-success');
  if (successEl) {
    successEl.textContent = 'Reset link sent! Check your inbox.';
    successEl.style.display = 'block';
  }
}

export function checkPasswordStrength(password) {
  const bar = document.getElementById('pw-strength-bar');
  const lbl = document.getElementById('pw-strength-lbl');
  if (!bar || !lbl) return;

  let score = 0;
  if (password.length >= 8)          score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { w: '0%',   bg: 'transparent', t: '' },
    { w: '25%',  bg: '#EF4444',     t: 'Weak' },
    { w: '50%',  bg: '#F59E0B',     t: 'Fair' },
    { w: '75%',  bg: '#3B82F6',     t: 'Good' },
    { w: '100%', bg: '#22C55E',     t: 'Strong' },
  ];
  const level = levels[score] || levels[0];
  bar.style.width      = level.w;
  bar.style.background = level.bg;
  lbl.textContent      = level.t;
}

if (typeof window !== 'undefined') {
  window.handleLogin           = handleLogin;
  window.handleRegister        = handleRegister;
  window.handlePasswordReset   = handlePasswordReset;
  window.checkPasswordStrength = checkPasswordStrength;
}
