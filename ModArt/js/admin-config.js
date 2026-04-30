/**
 * ModArt Admin Configuration
 *
 * Static site — no build step.
 * The anon key is safe to include here — it is public by design and
 * protected by Supabase Row Level Security policies.
 * The service role key is NEVER placed here (server-side only).
 */

// Use window globals if injected by /api/config, otherwise fall back to
// the hardcoded public anon key (safe — protected by RLS).
export const SUPABASE_URL      = window.__SUPABASE_URL__      || 'https://ddodctzzsrlgyhtclabz.supabase.co';
export const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2RjdHp6c3JsZ3lodGNsYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY5MzEsImV4cCI6MjA4OTA4MjkzMX0.Wfrlocx56uR_8-5EZoBajIzHt09GX_JcrBCSeZuVqMY';

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

// Admin email — used for ADMIN_ALLOWED_EMAILS check in admin.html
export const ADMIN_EMAIL = window.__ADMIN_EMAIL__ || 'modart.pod@gmail.com';

export const API_ENDPOINTS = {
  ADMIN_LOGIN:      '/api/admin-login',
  SEND_EMAIL:       '/api/send-order-email',
  VALIDATE_COUPON:  '/api/validate-coupon',
  CONFIG:           '/api/config',
};

if (typeof window !== 'undefined') {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
}
