/**
 * ModArt Cache Manager
 * 
 * DATA INTEGRITY FIX: H-9, H-10 - Stale data and cache invalidation
 * 
 * Provides smart caching with TTL, tags, and invalidation strategies.
 * Implements stale-while-revalidate pattern for better UX.
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {any} data - Cached data
 * @property {number} timestamp - When cached
 * @property {number} ttl - Time to live in milliseconds
 * @property {Array<string>} tags - Cache tags for invalidation
 * @property {string} version - Cache version
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.version = '1.0.0';
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Gets a value from cache
   * @param {string} key - Cache key
   * @param {Object} options - Options
   * @param {boolean} options.allowStale - Return stale data if available
   * @returns {any|null}
   */
  get(key, options = {}) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check version
    if (entry.version !== this.version) {
      this.cache.delete(key);
      return null;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Check if expired
    if (age > entry.ttl) {
      if (options.allowStale) {
        // Return stale data but mark for revalidation
        entry.stale = true;
        return entry.data;
      }
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Sets a value in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {Object} options - Options
   * @param {number} options.ttl - Time to live in milliseconds
   * @param {Array<string>} options.tags - Cache tags
   */
  set(key, data, options = {}) {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.defaultTTL,
      tags: options.tags || [],
      version: this.version,
      stale: false
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Checks if a key exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Deletes a key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidates all cache entries with a specific tag
   * @param {string} tag - Tag to invalidate
   */
  invalidateTag(tag) {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    console.log(`✅ Invalidated ${count} cache entries with tag: ${tag}`);
  }

  /**
   * Invalidates multiple tags
   * @param {Array<string>} tags - Tags to invalidate
   */
  invalidateTags(tags) {
    tags.forEach(tag => this.invalidateTag(tag));
  }

  /**
   * Clears all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`✅ Cleared ${size} cache entries`);
  }

  /**
   * Gets cache statistics
   * @returns {Object}
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let stale = 0;
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        expired++;
      } else if (entry.stale) {
        stale++;
      } else {
        valid++;
      }
    }
    
    return {
      total: this.cache.size,
      valid,
      stale,
      expired
    };
  }

  /**
   * Cleans up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Wraps a function with caching
   * @param {string} key - Cache key
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Cache options
   * @returns {Promise<any>}
   */
  async wrap(key, fn, options = {}) {
    // Check cache first
    const cached = this.get(key, { allowStale: true });
    
    if (cached !== null) {
      const entry = this.cache.get(key);
      
      // If stale, revalidate in background
      if (entry && entry.stale) {
        console.log(`⚠️ Returning stale data for ${key}, revalidating...`);
        // Revalidate in background
        fn().then(data => {
          this.set(key, data, options);
        }).catch(err => {
          console.error(`Failed to revalidate ${key}:`, err);
        });
      }
      
      return cached;
    }
    
    // Fetch fresh data
    try {
      const data = await fn();
      this.set(key, data, options);
      return data;
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cacheManager.cleanup(), 5 * 60 * 1000);
}

/**
 * Product cache helpers
 */
export async function getCachedProducts() {
  return cacheManager.wrap(
    'products:all',
    async () => {
      if (window.fetchProducts) {
        return await window.fetchProducts();
      }
      return window._PRODUCTS || [];
    },
    {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['products']
    }
  );
}

export async function getCachedProduct(productId) {
  return cacheManager.wrap(
    `product:${productId}`,
    async () => {
      const products = await getCachedProducts();
      return products.find(p => p.id === productId) || null;
    },
    {
      ttl: 5 * 60 * 1000,
      tags: ['products', `product:${productId}`]
    }
  );
}

export function invalidateProductCache(productId = null) {
  if (productId) {
    cacheManager.invalidateTag(`product:${productId}`);
  } else {
    cacheManager.invalidateTag('products');
  }
}

/**
 * Inventory cache helpers
 */
export async function getCachedInventory() {
  return cacheManager.wrap(
    'inventory:all',
    async () => {
      if (window.fetchInventory) {
        return await window.fetchInventory();
      }
      return window.LIVE_INVENTORY || {};
    },
    {
      ttl: 2 * 60 * 1000, // 2 minutes (shorter TTL for inventory)
      tags: ['inventory']
    }
  );
}

export function invalidateInventoryCache() {
  cacheManager.invalidateTag('inventory');
}

/**
 * Order cache helpers
 */
export async function getCachedOrders() {
  return cacheManager.wrap(
    'orders:user',
    async () => {
      if (window.fetchUserOrders) {
        const result = await window.fetchUserOrders();
        return result.orders || result || [];
      }
      return [];
    },
    {
      ttl: 1 * 60 * 1000, // 1 minute (short TTL for orders)
      tags: ['orders']
    }
  );
}

export function invalidateOrderCache() {
  cacheManager.invalidateTag('orders');
}

/**
 * Invalidates all caches after mutations
 */
export function invalidateAllCaches() {
  cacheManager.clear();
  
  // Also clear DataLoader caches if available
  if (window.clearAllCaches) {
    window.clearAllCaches();
  }
  
  console.log('✅ All caches invalidated');
}

// Export singleton
export default cacheManager;

// Export for window access
if (typeof window !== 'undefined') {
  window.cacheManager = cacheManager;
  window.getCachedProducts = getCachedProducts;
  window.getCachedProduct = getCachedProduct;
  window.getCachedInventory = getCachedInventory;
  window.getCachedOrders = getCachedOrders;
  window.invalidateProductCache = invalidateProductCache;
  window.invalidateInventoryCache = invalidateInventoryCache;
  window.invalidateOrderCache = invalidateOrderCache;
  window.invalidateAllCaches = invalidateAllCaches;
}
