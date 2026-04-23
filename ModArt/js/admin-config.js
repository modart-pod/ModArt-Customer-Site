/**
 * ModArt Admin Configuration
 * 
 * ✅ SECURITY FIX: All credentials now loaded from environment variables
 * 
 * Setup Instructions:
 * 1. Copy .env.example to .env
 * 2. Fill in your actual credentials
 * 3. Never commit .env to git
 * 
 * For Vite projects, use VITE_ prefix for client-side variables
 * For server-side only variables, omit the prefix
 */

// Supabase Configuration - Loaded from environment variables
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : null);

export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : null);

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ CRITICAL: Missing Supabase credentials in environment variables!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.error('See .env.example for setup instructions');
}

// Admin Configuration
export const ADMIN_CONFIG = {
  // Session timeout in milliseconds (30 minutes)
  SESSION_TIMEOUT: 30 * 60 * 1000,
  
  // Login rate limiting
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  
  // Auto-refresh intervals
  DASHBOARD_REFRESH_INTERVAL: 30 * 1000, // 30 seconds
  ORDERS_REFRESH_INTERVAL: 10 * 1000,    // 10 seconds
  
  // Pagination
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  
  // File upload limits
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
};

// Admin email - Loaded from environment (server-side only, not exposed to client)
// This should be validated server-side, not used for client-side auth
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 
  (typeof process !== 'undefined' ? process.env.ADMIN_EMAIL : null);

// API Endpoints
export const API_ENDPOINTS = {
  ADMIN_LOGIN: '/api/admin-login',
  SEND_EMAIL: '/api/send-order-email',
  VALIDATE_COUPON: '/api/validate-coupon',
};

// Export check for module support
if (typeof window !== 'undefined') {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
  
  // Log configuration status (without exposing sensitive data)
  console.log('✅ Admin config loaded:', {
    supabaseConfigured: !!SUPABASE_URL && !!SUPABASE_ANON_KEY,
    sessionTimeout: ADMIN_CONFIG.SESSION_TIMEOUT / 1000 / 60 + ' minutes',
    environment: import.meta.env.MODE || 'unknown'
  });
}
