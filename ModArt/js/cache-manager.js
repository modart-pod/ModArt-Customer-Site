/**
 * ModArt Cache Manager
 * 
 * DATA INTEGRITY FIX: H-9 & H-10 - Stale data and cache invalidation
 * 
 * Provides smart caching with TTL, tags, and invalidation strategies.
 * Implements stale-while-revalidate pattern for better UX.
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {*} data - Cached data
 * @property {number} timestamp - When cached (ms)
 * @property {number} ttl - Time to live (ms)
 * @property {string[]} tags - Cache tags for bulk invalidation
 * @property {number} version - Cache version
 */

class CacheManager {
  constructor() {
    // Main cache storage
    this.cache = new Map();
    
    // Tag index: tag -> Set of keys
    this.tagIndex = new Map();
    
    // Global cache version (incremented on invalidateAll)
    this.version = 1;
    
    // Default TTL: 5 minutes
    this.defaultTTL = 5 * 60 * 1000;
    
    // Cleanup interval
    this.startCleanupInterval();
  }
  
  /**
   * Gets a value from cache.
   * Returns null if expired or not found.
   * 
   * @param {string} key - Cache key
   * @param {Object} options - Options
   * @param {boolean} options.allowStale - Return stale data if available
   * @returns {*} Cached value or null
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
        return entry.data;
      }
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Sets a value in cache.
   * 
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {Object} options - Options
   * @param {number} options.ttl - Time to live in ms (default: 5 minutes)
   * @param {string[]} options.tags - Tags for bulk invalidation
   */
  set(key, data, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    const tags = options.tags || [];
    
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      tags,
      version: this.version
    };
    
    this.cache.set(key, entry);
    
    // Update tag index
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag).add(key);
    });
  }
  
  /**
   * Deletes a specific key from cache.
   * 
   * @param {string} key - Cache key
   */
  delete(key) {
    const entry = this.cache.get(key);
    
    if (entry) {
      // Remove from tag index
      entry.tags.forEach(tag => {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      });
    }
    
    this.cache.delete(key);
  }
  
  /**
   * Invalidates all cache entries with a specific tag.
   * 
   * @param {string} tag - Tag to invalidate
   */
  invalidateTag(tag) {
    const keys = this.tagIndex.get(tag);
    
    if (keys) {
      keys.forEach(key => this.delete(key));
      this.tagIndex.delete(tag);
    }
    
    console.log(`✅ Invalidated cache tag: ${tag}`);
  }
  
  /**
   * Invalidates multiple tags at once.
   * 
   * @param {string[]} tags - Tags to invalidate
   */
  invalidateTags(tags) {
    tags.forEach(tag => this.invalidateTag(tag));
  }
  
  /**
   * Invalidates all cache entries.
   * Uses version increment for efficient invalidation.
   */
  invalidateAll() {
    this.version++;
    this.cache.clear();
    this.tagIndex.clear();
    console.log(`✅ Invalidated all cache (version: ${this.version})`);
  }
  
  /**
   * Gets or sets a value with a factory function.
   * Implements stale-while-revalidate pattern.
   * 
   * @param {string} key - Cache key
   * @param {Function} factory - Async function to generate value
   * @param {Object} options - Options
   * @param {number} options.ttl - Time to live in ms
   * @param {string[]} options.tags - Tags for bulk invalidation
   * @param {boolean} options.staleWhileRevalidate - Return stale data while revalidating
   * @returns {Promise<*>} Cached or fresh value
   */
  async getOrSet(key, factory, options = {}) {
    const cached = this.get(key, { allowStale: options.staleWhileRevalidate });
    
    if (cached !== null) {
      // If stale-while-revalidate, trigger background refresh
      if (options.staleWhileRevalidate) {
        const entry = this.cache.get(key);
        const age = Date.now() - entry.timestamp;
        
        if (age > entry.ttl) {
          // Stale - revalidate in background
          this.revalidate(key, factory, options).catch(err => {
            console.error('Background revalidation failed:', err);
          });
        }
      }
      
      return cached;
    }
    
    // Not in cache - fetch fresh data
    const data = await factory();
    this.set(key, data, options);
    return data;
  }
  
  /**
   * Revalidates a cache entry in the background.
   * @private
   */
  async revalidate(key, factory, options) {
    try {
      const data = await factory();
      this.set(key, data, options);
      console.log(`✅ Revalidated cache: ${key}`);
    } catch (error) {
      console.error(`❌ Revalidation failed for ${key}:`, error);
    }
  }
  
  /**
   * Gets cache statistics.
   * 
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let fresh = 0;
    let stale = 0;
    
    this.cache.forEach(entry => {
      const age = now - entry.timestamp;
      if (age <= entry.ttl) {
        fresh++;
      } else {
        stale++;
      }
    });
    
    return {
      size: this.cache.size,
      fresh,
      stale,
      tags: this.tagIndex.size,
      version: this.version
    };
  }
  
  /**
   * Cleans up expired entries.
   * Called automatically every 5 minutes.
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    this.cache.forEach((entry, key) => {
      const age = now - entry.timestamp;
      if (age > entry.ttl || entry.version !== this.version) {
        this.delete(key);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }
  
  /**
   * Starts automatic cleanup interval.
   * @private
   */
  startCleanupInterval() {
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager();

/**
 * Gets the global cache manager instance.
 * 
 * @returns {CacheManager} Cache manager
 */
export function getCacheManager() {
  return cacheManager;
}

/**
 * Convenience functions for common cache operations
 */

/**
 * Caches product data with 5-minute TTL.
 * 
 * @param {string} productId - Product ID
 * @param {Object} product - Product data
 */
export function cacheProduct(productId, product) {
  cacheManager.set(`product:${productId}`, product, {
    ttl: 5 * 60 * 1000, // 5 minutes
    tags: ['products', `product:${productId}`]
  });
}

/**
 * Gets cached product data.
 * 
 * @param {string} productId - Product ID
 * @returns {Object|null} Product data or null
 */
export function getCachedProduct(productId) {
  return cacheManager.get(`product:${productId}`);
}

/**
 * Invalidates product cache.
 * 
 * @param {string} productId - Product ID (optional, invalidates all if not provided)
 */
export function invalidateProducts(productId = null) {
  if (productId) {
    cacheManager.invalidateTag(`product:${productId}`);
  } else {
    cacheManager.invalidateTag('products');
  }
}

/**
 * Caches inventory data with 2-minute TTL.
 * 
 * @param {string} productId - Product ID
 * @param {Object} inventory - Inventory data
 */
export function cacheInventory(productId, inventory) {
  cacheManager.set(`inventory:${productId}`, inventory, {
    ttl: 2 * 60 * 1000, // 2 minutes (shorter TTL for stock data)
    tags: ['inventory', `inventory:${productId}`]
  });
}

/**
 * Gets cached inventory data.
 * 
 * @param {string} productId - Product ID
 * @returns {Object|null} Inventory data or null
 */
export function getCachedInventory(productId) {
  return cacheManager.get(`inventory:${productId}`);
}

/**
 * Invalidates inventory cache.
 * 
 * @param {string} productId - Product ID (optional, invalidates all if not provided)
 */
export function invalidateInventory(productId = null) {
  if (productId) {
    cacheManager.invalidateTag(`inventory:${productId}`);
  } else {
    cacheManager.invalidateTag('inventory');
  }
}

/**
 * Caches order data with 10-minute TTL.
 * 
 * @param {string} orderId - Order ID
 * @param {Object} order - Order data
 */
export function cacheOrder(orderId, order) {
  cacheManager.set(`order:${orderId}`, order, {
    ttl: 10 * 60 * 1000, // 10 minutes
    tags: ['orders', `order:${orderId}`]
  });
}

/**
 * Invalidates order cache.
 * 
 * @param {string} orderId - Order ID (optional, invalidates all if not provided)
 */
export function invalidateOrders(orderId = null) {
  if (orderId) {
    cacheManager.invalidateTag(`order:${orderId}`);
  } else {
    cacheManager.invalidateTag('orders');
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.getCacheManager = getCacheManager;
  window.cacheProduct = cacheProduct;
  window.getCachedProduct = getCachedProduct;
  window.invalidateProducts = invalidateProducts;
  window.cacheInventory = cacheInventory;
  window.getCachedInventory = getCachedInventory;
  window.invalidateInventory = invalidateInventory;
  window.cacheOrder = cacheOrder;
  window.invalidateOrders = invalidateOrders;
}

export default cacheManager;

/**
 * Example usage:
 * 
 * // Cache product data
 * cacheProduct('vanta-tee', { id: 'vanta-tee', name: 'Vanta Black Tee', ... });
 * 
 * // Get cached product
 * const product = getCachedProduct('vanta-tee');
 * 
 * // Invalidate specific product
 * invalidateProducts('vanta-tee');
 * 
 * // Invalidate all products
 * invalidateProducts();
 * 
 * // Stale-while-revalidate pattern
 * const product = await cacheManager.getOrSet(
 *   'product:vanta-tee',
 *   async () => await fetchProduct('vanta-tee'),
 *   { ttl: 5 * 60 * 1000, tags: ['products'], staleWhileRevalidate: true }
 * );
 */
