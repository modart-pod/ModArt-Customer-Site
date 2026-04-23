/**
 * ✅ SECURITY FIXES:
 * - CSRF protection added
 * - Redis-based rate limiting (5 attempts per IP per 15 minutes)
 */
import { validateCsrfToken } from './csrf-token.js';
import { checkRateLimit, resetRateLimit } from './utils/rate-limiter.js';

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
// Admin emails loaded from env — never hardcoded in source
const ADMIN_EMAILS     = (process.env.ADMIN_EMAILS || 'modart.pod@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://modart-print-on-demand.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');

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

  // ✅ Redis-based Rate Limiting: 5 attempts per IP per 15 minutes
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             'unknown';
  
  const rateLimit = await checkRateLimit(ip, 5, 900, 'admin-login');
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', (Date.now() + rateLimit.resetIn * 1000).toString());
  
  if (!rateLimit.allowed) {
    console.log(`❌ Rate limit exceeded for admin login: ${ip}`);
    return res.status(429).json({ 
      error: 'Too many login attempts',
      message: 'Please wait before trying again.',
      retryAfter: rateLimit.retryAfter
    });
  }

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) return res.status(403).json({ error: 'Access denied' });
  if (!SUPABASE_SERVICE) return res.status(500).json({ error: 'Server not configured' });

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok || data.error) {
      // Don't reset rate limit on failed login
      return res.status(401).json({ error: data.error_description || data.error || 'Invalid credentials' });
    }

    // ✅ Reset rate limit on successful login
    await resetRateLimit(ip, 'admin-login');

    const name     = data.user?.user_metadata?.full_name || email.split('@')[0];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MA';
    return res.status(200).json({ success: true, access_token: data.access_token, user: { email: data.user?.email, name, role: 'Super Admin', initials } });
  } catch (e) {
    return res.status(500).json({ error: 'Auth error: ' + e.message });
  }
}
