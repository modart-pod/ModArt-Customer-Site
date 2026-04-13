/**
 * Netlify Function: validate-coupon
 * Validates a discount code server-side.
 * Checks against Supabase coupons table (falls back to hardcoded if table missing).
 */

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY; // service role key — set in Netlify env
const ALLOWED_ORIGIN   = process.env.ALLOWED_ORIGIN   || 'https://modart-site.netlify.app';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const code = (body.code || '').trim().toUpperCase();
  if (!code) return respond(400, { error: 'No code provided' });

  // Try Supabase coupons table first
  if (SUPABASE_SERVICE) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?code=eq.${encodeURIComponent(code)}&is_active=eq.true&select=*`, {
        headers: {
          'apikey':        SUPABASE_SERVICE,
          'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const coupon = data[0];
        // Check expiry
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
          return respond(200, { valid: false, message: 'This code has expired.' });
        }
        // Check usage limit
        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
          return respond(200, { valid: false, message: 'This code has reached its usage limit.' });
        }
        return respond(200, { valid: true, discount: coupon.discount_percent || 10, message: `${coupon.discount_percent || 10}% off applied!` });
      }
      return respond(200, { valid: false, message: 'Invalid discount code.' });
    } catch (e) {
      console.error('Coupon DB check failed:', e.message);
    }
  }

  // Fallback: hardcoded codes (remove once coupons table is set up)
  const FALLBACK_CODES = { 'MODART10': 10 };
  if (FALLBACK_CODES[code] !== undefined) {
    return respond(200, { valid: true, discount: FALLBACK_CODES[code], message: `${FALLBACK_CODES[code]}% off applied!` });
  }
  return respond(200, { valid: false, message: 'Invalid discount code.' });
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  };
}
