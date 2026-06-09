import { validateOrigin } from './utils/csrf.js';
import { checkRateLimit } from './utils/rate-limiter.js';

const SUPABASE_URL     = process.env.SUPABASE_URL     || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGIN   = process.env.ALLOWED_ORIGIN || 'https://modart-modart-pods-projects.vercel.app';
const FALLBACK_CODES   = { 'MODART10': 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // CSRF: reject requests from disallowed origins
  const originError = validateOrigin(req);
  if (originError) return res.status(403).json(originError);

  // Rate limit via shared utility (Redis-first, in-memory fallback)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const rateLimit = await checkRateLimit(ip, 10, 3600, 'coupon');
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetIn.toString());
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter.toString());
    return res.status(429).json({ error: 'Too many attempts. Please wait.' });
  }

  const code = ((req.body || {}).code || '').trim().toUpperCase();
  const userEmail = ((req.body || {}).userEmail || '').trim().toLowerCase(); // Optional: pass user email from frontend
  if (!code) return res.status(400).json({ error: 'No code provided' });

  if (SUPABASE_SERVICE) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/coupons?code=eq.${encodeURIComponent(code)}&is_active=eq.true&select=*`,
        { headers: { 'apikey': SUPABASE_SERVICE, 'Authorization': `Bearer ${SUPABASE_SERVICE}` } }
      );
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const c = data[0];
        if (c.expires_at && new Date(c.expires_at) < new Date())
          return res.status(200).json({ valid: false, message: 'Code expired.' });
        if (c.max_uses && c.used_count >= c.max_uses)
          return res.status(200).json({ valid: false, message: 'Code usage limit reached.' });
        
        // Check per-user usage if email provided
        if (userEmail) {
          try {
            const usageRes = await fetch(
              `${SUPABASE_URL}/rest/v1/coupon_uses?coupon_id=eq.${c.id}&guest_email=eq.${encodeURIComponent(userEmail)}&select=id`,
              { headers: { 'apikey': SUPABASE_SERVICE, 'Authorization': `Bearer ${SUPABASE_SERVICE}` } }
            );
            const usageData = await usageRes.json();
            if (Array.isArray(usageData) && usageData.length > 0) {
              return res.status(200).json({ valid: false, message: 'You have already used this code.' });
            }
          } catch (usageErr) {
            console.warn('Per-user coupon check failed:', usageErr.message);
            // Continue anyway — don't block if usage check fails
          }
        }
        
        // NOTE: usage count is incremented only when the order is confirmed, not here
        return res.status(200).json({ valid: true, discount: c.discount_percent || 10, couponId: c.id });
      }
      return res.status(200).json({ valid: false, message: 'Invalid code.' });
    } catch {}
  }

  if (FALLBACK_CODES[code] !== undefined)
    return res.status(200).json({ valid: true, discount: FALLBACK_CODES[code] });
  return res.status(200).json({ valid: false, message: 'Invalid code.' });
}
