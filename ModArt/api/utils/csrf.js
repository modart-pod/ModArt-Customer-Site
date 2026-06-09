/**
 * CSRF / Origin Validation Utility
 *
 * Validates that inbound POST requests originate from an allowed domain.
 * Called at the top of every mutating API handler.
 *
 * For a same-site SPA deployed on Vercel, the browser always sends an
 * Origin header on cross-origin requests. Verifying it blocks requests
 * submitted by third-party sites or bots that forge Content-Type headers.
 *
 * Usage:
 *   import { validateOrigin } from './utils/csrf.js';
 *   const originError = validateOrigin(req);
 *   if (originError) return res.status(403).json(originError);
 */

const ALLOWED_ORIGINS = (() => {
  const env = process.env.ALLOWED_ORIGIN || '';
  // Support comma-separated list for staging + production
  const base = env
    ? env.split(',').map(s => s.trim()).filter(Boolean)
    : ['https://modart-modart-pods-projects.vercel.app'];

  // Always allow localhost during development
  if (process.env.NODE_ENV !== 'production') {
    base.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500');
  }
  return new Set(base);
})();

/**
 * Returns null if the request origin is allowed, or an error object to send.
 * @param {import('http').IncomingMessage} req
 * @returns {null | { error: string, code: string }}
 */
export function validateOrigin(req) {
  // Only apply to state-mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return null;

  const origin = req.headers['origin'] || req.headers['referer'] || '';

  // Allow if no origin header (server-to-server calls, e.g. Vercel cron)
  if (!origin) return null;

  // Normalise to just the scheme+host
  let originHost = origin;
  try {
    originHost = new URL(origin).origin;
  } catch {
    // If we can't parse it, fail closed
    return { error: 'Forbidden: invalid origin', code: 'INVALID_ORIGIN' };
  }

  if (!ALLOWED_ORIGINS.has(originHost)) {
    console.warn(`[csrf] Blocked request from disallowed origin: ${originHost}`);
    return { error: 'Forbidden: origin not allowed', code: 'ORIGIN_NOT_ALLOWED' };
  }

  return null;
}
