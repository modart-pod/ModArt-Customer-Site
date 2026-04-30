// Support both VITE_ prefixed (client) and plain (server) env var names
const SUPABASE_URL     = process.env.SUPABASE_URL     || process.env.VITE_SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin emails — comma-separated list in env, fallback to known admin
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'modart.pod@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req, res) {
  // Allow requests from same origin (no CORS restriction needed for same-domain API)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) return res.status(403).json({ error: 'Access denied' });

  // If no service key, fall back to authenticating with the anon key
  // (Supabase password auth works with anon key too)
  const apiKey = SUPABASE_SERVICE || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured — set SUPABASE_SERVICE_KEY in Vercel env vars' });

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok || data.error) {
      return res.status(401).json({ error: data.error_description || data.error || 'Invalid credentials' });
    }

    const name     = data.user?.user_metadata?.full_name || email.split('@')[0];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MA';
    return res.status(200).json({
      success:      true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { email: data.user?.email, name, role: 'Super Admin', initials }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Auth error: ' + e.message });
  }
}
