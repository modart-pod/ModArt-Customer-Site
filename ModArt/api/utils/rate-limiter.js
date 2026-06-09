/**
 * Rate Limiter — Redis-first, in-memory fallback
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set in Vercel env vars. Falls back to an in-memory Map otherwise.
 *
 * The in-memory fallback resets on every cold start (serverless limitation).
 * For production traffic, set the Upstash env vars in Vercel Dashboard:
 *   UPSTASH_REDIS_REST_URL   = https://...upstash.io
 *   UPSTASH_REDIS_REST_TOKEN = AX...
 *
 * Upstash free tier: 10,000 requests/day — more than enough for this traffic.
 * Sign up at https://upstash.com, create a Redis database, copy the REST URL + token.
 */

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const useRedis = !!(REDIS_URL && REDIS_TOKEN);

// ── In-memory fallback ────────────────────────────────────────────────────────
const memStore = new Map();

// Privacy: IP addresses are personal data under GDPR.
// Entries are hashed before storage to minimise PII exposure in memory.
// Retention: entries expire after their rate-limit window (max 1 hour).
function hashIp(ip) {
  // Simple deterministic hash — not cryptographic, just avoids storing raw IPs
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (Math.imul(31, h) + ip.charCodeAt(i)) | 0;
  }
  return 'h' + Math.abs(h).toString(36);
}

async function checkRateLimitMemory(identifier, max, windowSecs, prefix) {
  const key = `${prefix}:${hashIp(identifier)}`;  // hash before storing
  const now = Date.now();
  const windowMs = windowSecs * 1000;

  let entry = memStore.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { count: 0, start: now };
  }
  entry.count++;
  memStore.set(key, entry);

  const resetIn   = Math.ceil((entry.start + windowMs - now) / 1000);
  const remaining = Math.max(0, max - entry.count);
  const allowed   = entry.count <= max;

  return { allowed, remaining, resetIn, retryAfter: allowed ? 0 : resetIn };
}

// Cleanup expired entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore.entries()) {
    if (now - entry.start > 3600 * 1000) memStore.delete(key);
  }
}, 10 * 60 * 1000);

// ── Redis (Upstash) implementation ───────────────────────────────────────────
async function checkRateLimitRedis(identifier, max, windowSecs, prefix) {
  const key = `rl:${prefix}:${hashIp(identifier)}`; // hash before storing in Redis

  try {
    // INCR atomically increments the counter and returns the new value
    const incrRes = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!incrRes.ok) throw new Error(`Redis INCR failed: ${incrRes.status}`);
    const { result: count } = await incrRes.json();

    // On first increment, set the TTL window
    if (count === 1) {
      await fetch(`${REDIS_URL}/expire/${encodeURIComponent(key)}/${windowSecs}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      });
    }

    // Get TTL for accurate Retry-After
    const ttlRes = await fetch(`${REDIS_URL}/ttl/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const { result: ttl } = ttlRes.ok ? await ttlRes.json() : { result: windowSecs };
    const resetIn   = Math.max(0, ttl);
    const remaining = Math.max(0, max - count);
    const allowed   = count <= max;

    return { allowed, remaining, resetIn, retryAfter: allowed ? 0 : resetIn };
  } catch (err) {
    // If Redis fails, fail open (allow the request) and log — don't block users
    console.warn('[rate-limiter] Redis error, failing open:', err.message);
    return { allowed: true, remaining: max, resetIn: windowSecs, retryAfter: 0 };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Check rate limit for a given identifier.
 *
 * @param {string} identifier  - IP address or user ID
 * @param {number} max         - Max requests allowed in the window
 * @param {number} windowSecs  - Window duration in seconds
 * @param {string} prefix      - Namespace (e.g. 'order_email', 'contact_email')
 * @returns {{ allowed: boolean, remaining: number, resetIn: number, retryAfter: number }}
 */
export async function checkRateLimit(identifier, max = 10, windowSecs = 3600, prefix = 'rl') {
  if (useRedis) {
    return checkRateLimitRedis(identifier, max, windowSecs, prefix);
  }
  return checkRateLimitMemory(identifier, max, windowSecs, prefix);
}
