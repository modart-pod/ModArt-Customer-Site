/**
 * Netlify Function: admin-login
 * Server-side admin authentication using Supabase service role key.
 * This bypasses client-side Supabase auth issues entirely.
 */

const SUPABASE_URL     = process.env.SUPABASE_URL     || 'https://ddodctzzsrlgyhtclabz.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_ORIGIN   = process.env.ALLOWED_ORIGIN   || 'https://modart-site.netlify.app';
const ADMIN_EMAILS     = ['modart.pod@gmail.com'];

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  // No strict origin check — function is same-site only

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { email, password } = body;
  if (!email || !password) return respond(400, { error: 'Email and password required' });
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
    return respond(403, { error: 'Access denied' });
  }
  if (!SUPABASE_SERVICE) {
    return respond(500, { error: 'Server not configured' });
  }

  try {
    // Sign in via Supabase Auth REST API using service role
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return respond(401, { error: data.error_description || data.error || 'Invalid credentials' });
    }

    return respond(200, {
      success:      true,
      access_token: data.access_token,
      user: {
        email:    data.user?.email,
        name:     data.user?.user_metadata?.full_name || email.split('@')[0],
        role:     'Super Admin',
        initials: (data.user?.user_metadata?.full_name || email.split('@')[0])
                    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'MA',
      },
    });
  } catch (e) {
    return respond(500, { error: 'Auth service error: ' + e.message });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
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
