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

  // Fall back to hardcoded public anon key if env vars not set
  // The anon key is safe to expose — protected by Supabase RLS policies
  const supabaseUrl     = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || 'https://ddodctzzsrlgyhtclabz.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2RjdHp6c3JsZ3lodGNsYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY5MzEsImV4cCI6MjA4OTA4MjkzMX0.Wfrlocx56uR_8-5EZoBajIzHt09GX_JcrBCSeZuVqMY';

  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
