/**
 * /api/config
 *
 * Safely exposes only the PUBLIC Supabase credentials to the client.
 * The anon key is safe to expose — it is protected by RLS policies.
 * The service role key is NEVER returned here.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl     = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Fail loudly if credentials are missing — never fall back to stale hardcoded keys
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('CRITICAL: SUPABASE_URL or SUPABASE_ANON_KEY env vars not set');
    return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
  }

  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
