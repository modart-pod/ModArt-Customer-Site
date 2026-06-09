# ModArt Security Notes

## JWT Storage

Supabase stores the user's JWT in `localStorage` by default. This means
an XSS attack could read the token. Mitigations in place:

1. **Content-Security-Policy** header (via `vercel.json`) restricts script
   execution to `'self'` and known CDN sources. This blocks injected scripts
   from executing in the first place.
2. **Supabase JWT auto-refresh** — tokens expire every hour. Even if stolen,
   the window is limited.
3. All sensitive operations (order creation, status updates, coupon redemption)
   are protected by Supabase **Row Level Security** policies that check
   `auth.uid()` server-side — a stolen anon key alone cannot escalate privilege.

To move to `HttpOnly` cookie-based sessions, a server-side auth proxy (e.g.
a Vercel Edge Function that sets `Set-Cookie: Secure; HttpOnly; SameSite=Strict`)
would be needed. This is a future enhancement.

## Admin Role Promotion

New accounts default to `role = 'customer'` in the `profiles` table.
To promote your admin account, run this **once** in Supabase SQL Editor
**after your admin account has signed in for the first time**:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'modart.pod@gmail.com'
  LIMIT 1
);
```

## Upstash Redis (Rate Limiting)

The rate limiter uses an in-memory Map as fallback. For production:

1. Create a free Redis database at https://upstash.com
2. Add these to Vercel env vars:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Required Vercel Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key (safe to expose) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only, never expose) |
| `RESEND_API_KEY` | Resend.com API key for transactional emails |
| `FROM_EMAIL` | Sender email (e.g. orders@modart.store) |
| `STORE_EMAIL` | Your inbox for contact form submissions |
| `ALLOWED_ORIGIN` | Your production domain (e.g. https://modart.vercel.app) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (optional, enables persistent rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token (optional) |
| `NODE_ENV` | Set to `production` in Vercel |

## Supabase Dashboard Checklist

- [ ] Set minimum password length to 8+ in Authentication → Policies
- [ ] Enable "Leaked password protection" in Authentication → Policies
- [ ] Verify Realtime RLS is enabled for the `orders` table channel
- [ ] Promote admin account: run UPDATE profiles SET role='admin' WHERE...
- [ ] Disable email confirmations bypass if currently on (Auth → Settings)
