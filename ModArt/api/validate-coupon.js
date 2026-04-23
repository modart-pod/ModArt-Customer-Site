/**
 * ✅ SECURITY FIX: Added CSRF protection
 */
import { validateCsrfToken } from './csrf-token.js';

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_ORIGIN   = process.env.ALLOWED_ORIGIN || 'https://modart-print-on-demand.vercel.app';
const FALLBACK_CODES   = { 'MODART10': 10 };

// Rate limit: 10 coupon attempts per IP per hour
const rateLimitMap = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ✅ CSRF Protection
  const csrfCheck = await validateCsrfToken(req);
  if (!csrfCheck.valid) {
    console.log('❌ CSRF validation failed:', csrfCheck.error);
    return res.status(403).json({ 
      error: 'CSRF validation failed',
      message: csrfCheck.error
    });
  }

  // Rate limit: 10 attempts per IP per hour
  const ip  = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const rec = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - rec.start > 3600000) { rec.count = 0; rec.start = now; }
  rec.count++;
  rateLimitMap.set(ip, rec);
  if (rec.count > 10) return res.status(429).json({ error: 'Too many attempts. Please wait.' });

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
