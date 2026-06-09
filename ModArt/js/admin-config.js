/**
 * ModArt Admin Configuration
 *
 * Credentials are injected at runtime by /api/config.
 * No keys are hardcoded here — they must come from Vercel env vars.
 * If window globals are absent the app will show a configuration error.
 */

export const SUPABASE_URL      = window.__SUPABASE_URL__;
export const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

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

// Admin email is server-side only — never expose in client JS.
// The admin check is handled by the profiles.role column via is_admin() RPC.
// export const ADMIN_EMAIL = '...'; // REMOVED — use Supabase profiles.role

export const API_ENDPOINTS = {
  ADMIN_LOGIN:      '/api/admin-login',
  SEND_EMAIL:       '/api/send-order-email',
  VALIDATE_COUPON:  '/api/validate-coupon',
  CONFIG:           '/api/config',
};

if (typeof window !== 'undefined') {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
}
