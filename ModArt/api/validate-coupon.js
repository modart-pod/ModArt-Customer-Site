const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const FALLBACK_CODES   = { 'MODART10': 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const code = ((req.body || {}).code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'No code provided' });

  if (SUPABASE_SERVICE) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/coupons?code=eq.${encodeURIComponent(code)}&is_active=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_SERVICE, 'Authorization': `Bearer ${SUPABASE_SERVICE}` },
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const c = data[0];
        if (c.expires_at && new Date(c.expires_at) < new Date()) return res.status(200).json({ valid: false, message: 'Code expired.' });
        if (c.max_uses && c.used_count >= c.max_uses) return res.status(200).json({ valid: false, message: 'Code usage limit reached.' });
        // Increment usage count
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_coupon_usage`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_SERVICE, 'Authorization': `Bearer ${SUPABASE_SERVICE}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_code: code }),
        }).catch(() => {});
        return res.status(200).json({ valid: true, discount: c.discount_percent || 10 });
      }
      return res.status(200).json({ valid: false, message: 'Invalid code.' });
    } catch {}
  }

  if (FALLBACK_CODES[code] !== undefined) return res.status(200).json({ valid: true, discount: FALLBACK_CODES[code] });
  return res.status(200).json({ valid: false, message: 'Invalid code.' });
}
