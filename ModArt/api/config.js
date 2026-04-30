/**
 * /api/config
 *
 * Safely exposes only the PUBLIC Supabase credentials to the client.
 * The anon key is safe to expose — it is protected by RLS policies.
 * The service role key is NEVER returned here.
 *
 * Called once on page load via a <script> tag in index.html / admin.html:
 *   <script>
 *     fetch('/api/config').then(r=>r.json()).then(c=>{
 *       window.__SUPABASE_URL__      = c.supabaseUrl;
 *       window.__SUPABASE_ANON_KEY__ = c.supabaseAnonKey;
 *     });
 *   </script>
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl     = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    // Never include service role key here
  });
}
