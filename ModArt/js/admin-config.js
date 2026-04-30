/**
 * ModArt Admin Configuration
 *
 * Static site — no build step, so import.meta.env is NOT available.
 * Supabase credentials are injected by the Supabase JS CDN client
 * directly in index.html / admin.html via window globals set in a
 * <script> block that reads from Vercel environment variables at
 * request time (via a tiny /api/config endpoint).
 *
 * For local dev: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * in .env and they are read by the /api/config serverless function.
 */

// Read from window globals injected by /api/config at runtime
export const SUPABASE_URL     = window.__SUPABASE_URL__     || '';
export const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials not injected. Check /api/config endpoint.');
}

export const ADMIN_CONFIG = {
  SESSION_TIMEOUT:           30 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS:        5,
  LOGIN_LOCKOUT_DURATION:    15 * 60 * 1000,
  DASHBOARD_REFRESH_INTERVAL:30 * 1000,
  ORDERS_REFRESH_INTERVAL:   10 * 1000,
  DEFAULT_PAGE_SIZE:         25,
  MAX_PAGE_SIZE:             100,
  MAX_IMAGE_SIZE:            5 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES:       ['image/jpeg', 'image/png', 'image/webp'],
};

export const ADMIN_EMAIL = window.__ADMIN_EMAIL__ || '';

export const API_ENDPOINTS = {
  ADMIN_LOGIN:      '/api/admin-login',
  SEND_EMAIL:       '/api/send-order-email',
  VALIDATE_COUPON:  '/api/validate-coupon',
  CONFIG:           '/api/config',
};

if (typeof window !== 'undefined') {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
}
