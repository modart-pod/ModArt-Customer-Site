/**
 * ModArt DataLoader - Batching Utility
 * 
 * DATA INTEGRITY FIX: H-2 - N+1 Query Problem
 * 
 * Prevents N+1 queries by batching multiple requests into single operations.
 * Caches results within a request to avoid duplicate fetches.
 * 
 * Usage:
 * const productLoader = new DataLoader(async (ids) => {
 *   return await fetchProductsByIds(ids);
 * });
 * 
 * const product = await productLoader.load('vanta-tee');
 */

/**
 * DataLoader class for batching and caching data fetches.
 * 
 * @template K - Key type (usually string or number)
 * @template V - Value type (the data being loaded)
 */
export class DataLoader {
  /**
   * Creates a new DataLoader instance.
   * 
   * @param {Function} batchLoadFn - Function that takes array of keys and returns array of values
   * @param {Object} options - Configuration options
   * @param {number} options.maxBatchSize - Maximum batch size (default: 100)
   * @param {number} options.batchDelay - Delay before executing batch in ms (default: 10)
   * @param {boolean} options.cache - Enable caching (default: true)
   */
  constructor(batchLoadFn, options = {}) {
    this.batchLoadFn = batchLoadFn;
    this.maxBatchSize = options.maxBatchSize || 100;
    this.batchDelay = options.batchDelay || 10;
    this.cacheEnabled = options.cache !== false;
    
    // Cache: key -> Promise<value>
    this.cache = new Map();
    
    // Current batch queue
    this.queue = [];
    
    // Batch timer
    this.batchTimer = null;
  }
  
  /**
   * Loads a single value by key.
   * Batches multiple load() calls together.
   * 
   * @param {K} key - Key to load
   * @returns {Promise<V>} Loaded value
   */
  load(key) {
    // Check cache first
    if (this.cacheEnabled && this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Create promise for this key
    const promise = new Promise((resolve, reject) => {
      // Add to queue
      this.queue.push({ key, resolve, reject });
      
      // Schedule batch execution
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.executeBatch();
        }, this.batchDelay);
      }
      
      // Execute immediately if batch is full
      if (this.queue.length >= this.maxBatchSize) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
        this.executeBatch();
      }
    });
    
    // Cache the promise
    if (this.cacheEnabled) {
      this.cache.set(key, promise);
    }
    
    return promise;
  }
  
  /**
   * Loads multiple values by keys.
   * More efficient than calling load() multiple times.
   * 
   * @param {K[]} keys - Array of keys to load
   * @returns {Promise<V[]>} Array of loaded values
   */
  loadMany(keys) {
    return Promise.all(keys.map(key => this.load(key)));
  }
  
  /**
   * Executes the current batch.
   * @private
   */
  async executeBatch() {
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.batchTimer = null;
    
    if (batch.length === 0) return;
    
    try {
      // Extract unique keys
      const keys = [...new Set(batch.map(item => item.key))];
      
      // Execute batch load function
      const values = await this.batchLoadFn(keys);
      
      // Create key -> value map
      const valueMap = new Map();
      keys.forEach((key, index) => {
        valueMap.set(key, values[index]);
      });
      
      // Resolve all promises
      batch.forEach(item => {
        const value = valueMap.get(item.key);
        if (value !== undefined) {
          item.resolve(value);
        } else {
          item.reject(new Error(`No value found for key: ${item.key}`));
        }
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach(item => item.reject(error));
    }
  }
  
  /**
   * Clears the cache.
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Primes the cache with a key-value pair.
   * Useful for preloading data.
   * 
   * @param {K} key - Key to prime
   * @param {V} value - Value to cache
   */
  prime(key, value) {
    if (this.cacheEnabled) {
      this.cache.set(key, Promise.resolve(value));
    }
  }
  
  /**
   * Clears a specific key from the cache.
   * 
   * @param {K} key - Key to clear
   */
  clear(key) {
    this.cache.delete(key);
  }
}

/**
 * Creates a product loader for batching product fetches.
 * 
 * @returns {DataLoader} Product data loader
 */
export function createProductLoader() {
  return new DataLoader(async (productIds) => {
    const productSource = (window._PRODUCTS && window._PRODUCTS.length > 0) 
      ? window._PRODUCTS 
      : window.PRODUCTS || [];
    
    // Batch fetch: return products in same order as requested IDs
    return productIds.map(id => 
      productSource.find(p => p.id === id) || null
    );
  }, {
    maxBatchSize: 50,
    batchDelay: 5,
    cache: true
  });
}

/**
 * Creates an inventory loader for batching inventory fetches.
 * 
 * @returns {DataLoader} Inventory data loader
 */
export function createInventoryLoader() {
  return new DataLoader(async (productIds) => {
    const inventory = window.LIVE_INVENTORY || {};
    
    // Batch fetch: return inventory in same order as requested IDs
    return productIds.map(id => inventory[id] || {});
  }, {
    maxBatchSize: 50,
    batchDelay: 5,
    cache: true
  });
}

/**
 * Singleton product loader instance.
 * Reused across the application to maximize batching.
 */
let productLoaderInstance = null;

/**
 * Gets or creates the global product loader instance.
 * 
 * @returns {DataLoader} Product loader
 */
export function getProductLoader() {
  if (!productLoaderInstance) {
    productLoaderInstance = createProductLoader();
  }
  return productLoaderInstance;
}

/**
 * Resets the global product loader (useful after product updates).
 */
export function resetProductLoader() {
  if (productLoaderInstance) {
    productLoaderInstance.clearCache();
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.DataLoader = DataLoader;
  window.createProductLoader = createProductLoader;
  window.createInventoryLoader = createInventoryLoader;
  window.getProductLoader = getProductLoader;
  window.resetProductLoader = resetProductLoader;
}

/**
 * Example usage:
 * 
 * // Create loader
 * const productLoader = getProductLoader();
 * 
 * // Load single product (batched automatically)
 * const product = await productLoader.load('vanta-tee');
 * 
 * // Load multiple products (single batch)
 * const products = await productLoader.loadMany(['vanta-tee', 'elfima-hoodie']);
 * 
 * // Prime cache (preload data)
 * productLoader.prime('vanta-tee', { id: 'vanta-tee', name: 'Vanta Black Tee', ... });
 * 
 * // Clear cache after product update
 * productLoader.clearCache();
 */
