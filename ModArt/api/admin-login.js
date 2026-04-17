const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAILS     = ['modart.pod@gmail.com'];

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://modart-print-on-demand.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    if (!r.ok || data.error) return res.status(401).json({ error: data.error_description || data.error || 'Invalid credentials' });

    const name     = data.user?.user_metadata?.full_name || email.split('@')[0];
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MA';
    return res.status(200).json({ success: true, access_token: data.access_token, user: { email: data.user?.email, name, role: 'Super Admin', initials } });
  } catch (e) {
    return res.status(500).json({ error: 'Auth error: ' + e.message });
  }
}
