/**
 * In-memory rate limiter
 *
 * Simple Map-based limiter. Resets on cold start — acceptable for
 * low-traffic use. Replace with Redis (Upstash) when traffic grows.
 *
 * Usage:
 *   const result = await checkRateLimit(ip, 10, 3600, 'coupon');
 *   if (!result.allowed) return res.status(429).json({ error: 'Too many requests' });
 */

const store = new Map();

/**
 * @param {string}  identifier  - IP address or user ID
 * @param {number}  max         - Max requests allowed in window
 * @param {number}  windowSecs  - Window size in seconds
 * @param {string}  [prefix]    - Optional namespace prefix
 * @returns {{ allowed: boolean, remaining: number, resetIn: number, retryAfter: number }}
 */
export async function checkRateLimit(identifier, max = 10, windowSecs = 3600, prefix = 'rl') {
  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSecs * 1000;

  let entry = store.get(key);

  // Reset if window has expired
  if (!entry || now - entry.start > windowMs) {
    entry = { count: 0, start: now };
  }

  entry.count++;
  store.set(key, entry);

  const resetIn    = Math.ceil((entry.start + windowMs - now) / 1000);
  const remaining  = Math.max(0, max - entry.count);
  const allowed    = entry.count <= max;
  const retryAfter = allowed ? 0 : resetIn;

  return { allowed, remaining, resetIn, retryAfter };
}

// Clean up expired entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Default window: 1 hour
    if (now - entry.start > 3600 * 1000) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);
