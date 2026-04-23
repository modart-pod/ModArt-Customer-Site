/**
 * Redis-Based Rate Limiter
 * 
 * ✅ SECURITY FIX: Persistent rate limiting with Redis
 * 
 * Replaces in-memory rate limiting that resets on cold starts.
 * Uses Upstash Redis for serverless-friendly persistent storage.
 * 
 * Setup:
 * 1. Create Redis database at upstash.com
 * 2. Add REDIS_URL and REDIS_TOKEN to environment variables
 * 3. Use checkRateLimit() in API endpoints
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
let redis = null;

function getRedisClient() {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;
  
  if (!redisUrl || !redisToken) {
    console.warn('⚠️ Redis not configured. Falling back to in-memory rate limiting.');
    return null;
  }
  
  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken
    });
    console.log('✅ Redis client initialized');
    return redis;
  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    return null;
  }
}

// Fallback in-memory storage when Redis is not available
const memoryStore = new Map();

/**
 * Check rate limit for a given identifier
 * 
 * @param {string} identifier - Unique identifier (IP, user ID, email, etc.)
 * @param {number} maxAttempts - Maximum attempts allowed (default: 5)
 * @param {number} windowSeconds - Time window in seconds (default: 900 = 15 minutes)
 * @param {string} namespace - Optional namespace for different rate limit types
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
 */
export async function checkRateLimit(
  identifier, 
  maxAttempts = 5, 
  windowSeconds = 900,
  namespace = 'default'
) {
  const key = `rate_limit:${namespace}:${identifier}`;
  const client = getRedisClient();
  
  // Use Redis if available
  if (client) {
    try {
      // Get current count
      const current = await client.get(key);
      const count = current ? parseInt(current) : 0;
      
      // Check if limit exceeded
      if (count >= maxAttempts) {
        const ttl = await client.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          resetIn: ttl > 0 ? ttl : windowSeconds,
          retryAfter: ttl > 0 ? ttl : windowSeconds
        };
      }
      
      // Increment counter
      const newCount = await client.incr(key);
      
      // Set expiry on first attempt
      if (newCount === 1) {
        await client.expire(key, windowSeconds);
      }
      
      return {
        allowed: true,
        remaining: Math.max(0, maxAttempts - newCount),
        resetIn: windowSeconds,
        retryAfter: 0
      };
      
    } catch (error) {
      console.error('❌ Redis rate limit check failed:', error);
      // Fall through to memory store
    }
  }
  
  // Fallback to in-memory storage
  return checkRateLimitMemory(key, maxAttempts, windowSeconds);
}

/**
 * Fallback in-memory rate limiting
 */
function checkRateLimitMemory(key, maxAttempts, windowSeconds) {
  const now = Date.now();
  const record = memoryStore.get(key) || { count: 0, resetAt: now + windowSeconds * 1000 };
  
  // Reset if window expired
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowSeconds * 1000;
  }
  
  // Check if limit exceeded
  if (record.count >= maxAttempts) {
    const resetIn = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      retryAfter: resetIn
    };
  }
  
  // Increment counter
  record.count++;
  memoryStore.set(key, record);
  
  const resetIn = Math.ceil((record.resetAt - now) / 1000);
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetIn,
    retryAfter: 0
  };
}

/**
 * Reset rate limit for a given identifier
 * Useful for clearing limits after successful authentication
 * 
 * @param {string} identifier - Unique identifier
 * @param {string} namespace - Optional namespace
 */
export async function resetRateLimit(identifier, namespace = 'default') {
  const key = `rate_limit:${namespace}:${identifier}`;
  const client = getRedisClient();
  
  if (client) {
    try {
      await client.del(key);
      console.log(`✅ Rate limit reset for ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Redis rate limit reset failed:', error);
    }
  }
  
  // Fallback to memory store
  memoryStore.delete(key);
  return true;
}

/**
 * Get current rate limit status without incrementing
 * 
 * @param {string} identifier - Unique identifier
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {string} namespace - Optional namespace
 * @returns {Promise<{count: number, remaining: number, resetIn: number}>}
 */
export async function getRateLimitStatus(identifier, maxAttempts = 5, namespace = 'default') {
  const key = `rate_limit:${namespace}:${identifier}`;
  const client = getRedisClient();
  
  if (client) {
    try {
      const current = await client.get(key);
      const count = current ? parseInt(current) : 0;
      const ttl = await client.ttl(key);
      
      return {
        count,
        remaining: Math.max(0, maxAttempts - count),
        resetIn: ttl > 0 ? ttl : 0
      };
    } catch (error) {
      console.error('❌ Redis status check failed:', error);
    }
  }
  
  // Fallback to memory store
  const record = memoryStore.get(key);
  if (!record) {
    return { count: 0, remaining: maxAttempts, resetIn: 0 };
  }
  
  const now = Date.now();
  const resetIn = Math.ceil((record.resetAt - now) / 1000);
  
  return {
    count: record.count,
    remaining: Math.max(0, maxAttempts - record.count),
    resetIn: Math.max(0, resetIn)
  };
}

/**
 * Clean up expired entries from memory store
 * Call this periodically if using memory fallback
 */
export function cleanupMemoryStore() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetAt) {
      memoryStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired rate limit entries`);
  }
}

// Clean up memory store every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMemoryStore, 5 * 60 * 1000);
}

export default {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  cleanupMemoryStore
};
