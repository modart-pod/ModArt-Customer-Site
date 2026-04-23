/**
 * ✅ SECURITY FIXES:
 * - CSRF protection added
 * - Redis-based rate limiting (persistent across cold starts)
 */
import { validateCsrfToken } from './csrf-token.js';
import { checkRateLimit, resetRateLimit } from './utils/rate-limiter.js';

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_ORIGIN   = process.env.ALLOWED_ORIGIN || 'https://modart-print-on-demand.vercel.app';
const FALLBACK_CODES   = { 'MODART10': 10 };

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

  // ✅ Redis-based Rate Limiting: 10 attempts per IP per hour
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             'unknown';
  
  const rateLimit = await checkRateLimit(ip, 10, 3600, 'coupon');
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', (Date.now() + rateLimit.resetIn * 1000).toString());
  
  if (!rateLimit.allowed) {
    console.log(`❌ Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ 
      error: 'Too many attempts',
      message: 'Please wait before trying again.',
      retryAfter: rateLimit.retryAfter
    });
  }

  const code = ((req.body || {}).code || '').trim().toUpperCase();
  const userId = ((req.body || {}).userId || null); // Optional: pass user ID from frontend
  const userEmail = ((req.body || {}).userEmail || '').trim().toLowerCase(); // Optional: pass user email from frontend
  if (!code) return res.status(400).json({ error: 'No code provided' });

  if (SUPABASE_SERVICE) {
    try {
      // Use atomic RPC to check coupon availability
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/check_coupon_availability`,
        { 
          method: 'POST',
          headers: { 
            'apikey': SUPABASE_SERVICE, 
            'Authorization': `Bearer ${SUPABASE_SERVICE}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_code: code,
            p_user_id: userId,
            p_guest_email: userEmail || null
          })
        }
      );
      
      const data = await r.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const result = data[0];
        
        if (result.available) {
          // Coupon is valid and available
          return res.status(200).json({ 
            valid: true, 
            discount: result.discount_percent || 10,
            message: result.reason
          });
        } else {
          // Coupon is not available (expired, used, etc.)
          return res.status(200).json({ 
            valid: false, 
            message: result.reason || 'Invalid code.'
          });
        }
      }
      
      return res.status(200).json({ valid: false, message: 'Invalid code.' });
    } catch (err) {
      console.error('Coupon validation error:', err.message);
      // Fall through to fallback codes
    }
  }

  if (FALLBACK_CODES[code] !== undefined)
    return res.status(200).json({ valid: true, discount: FALLBACK_CODES[code] });
  return res.status(200).json({ valid: false, message: 'Invalid code.' });
}
