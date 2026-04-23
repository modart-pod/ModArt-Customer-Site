/**
 * ModArt DataLoader - Batch Loading Utility
 * 
 * DATA INTEGRITY FIX: H-2 - N+1 Query Problem
 * 
 * Prevents N+1 queries by batching multiple requests into a single query.
 * Caches results within the same request to avoid duplicate fetches.
 * 
 * Based on Facebook's DataLoader pattern:
 * https://github.com/graphql/dataloader
 */

import { supabase, getSupabase } from './auth.js';

// Helper: get live Supabase client
function sb() { return getSupabase() || supabase; }

/**
 * Generic DataLoader class for batching and caching
 */
class DataLoader {
  constructor(batchLoadFn, options = {}) {
    this.batchLoadFn = batchLoadFn;
    this.cache = new Map();
    this.queue = [];
    this.batchScheduled = false;
    this.maxBatchSize = options.maxBatchSize || 100;
    this.cacheEnabled = options.cache !== false;
  }

  /**
   * Loads a single item by key
   * @param {string} key - Unique identifier
   * @returns {Promise<any>}
   */
  async load(key) {
    // Check cache first
    if (this.cacheEnabled && this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Add to queue
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      
      // Schedule batch if not already scheduled
      if (!this.batchScheduled) {
        this.batchScheduled = true;
        // Use microtask to batch all synchronous loads
        Promise.resolve().then(() => this.dispatchBatch());
      }
    });
  }

  /**
   * Loads multiple items by keys
   * @param {Array<string>} keys - Array of unique identifiers
   * @returns {Promise<Array<any>>}
   */
  async loadMany(keys) {
    return Promise.all(keys.map(key => this.load(key)));
  }

  /**
   * Dispatches the current batch
   */
  async dispatchBatch() {
    this.batchScheduled = false;
    const batch = this.queue.splice(0, this.maxBatchSize);
    
    if (batch.length === 0) return;

    const keys = batch.map(item => item.key);
    
    try {
      // Call batch load function
      const results = await this.batchLoadFn(keys);
      
      // Resolve promises and cache results
      batch.forEach((item, index) => {
        const result = results[index];
        
        // Cache result
        if (this.cacheEnabled) {
          this.cache.set(item.key, result);
        }
        
        // Resolve promise
        item.resolve(result);
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach(item => item.reject(error));
    }
  }

  /**
   * Clears the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clears a specific key from cache
   * @param {string} key - Key to clear
   */
  clearKey(key) {
    this.cache.delete(key);
  }

  /**
   * Primes the cache with a value
   * @param {string} key - Key to prime
   * @param {any} value - Value to cache
   */
  prime(key, value) {
    if (this.cacheEnabled) {
      this.cache.set(key, value);
    }
  }
}

/**
 * Product DataLoader - Batches product fetches by ID
 */
let productLoader = null;

export function getProductLoader() {
  if (!productLoader) {
    productLoader = new DataLoader(async (productIds) => {
      try {
        const client = sb();
        if (!client) {
          // Fallback to window._PRODUCTS
          const products = window._PRODUCTS || [];
          return productIds.map(id => products.find(p => p.id === id) || null);
        }

        // Batch fetch from Supabase
        const { data, error } = await client
          .from('products')
          .select('*')
          .in('id', productIds);

        if (error) throw error;

        // Map results back to original order
        const productMap = new Map(data.map(p => [p.id, p]));
        return productIds.map(id => productMap.get(id) || null);
      } catch (error) {
        console.error('Product batch load failed:', error);
        // Fallback to window._PRODUCTS
        const products = window._PRODUCTS || [];
        return productIds.map(id => products.find(p => p.id === id) || null);
      }
    }, { cache: true });
  }
  
  return productLoader;
}

/**
 * Inventory DataLoader - Batches inventory fetches by product ID
 */
let inventoryLoader = null;

export function getInventoryLoader() {
  if (!inventoryLoader) {
    inventoryLoader = new DataLoader(async (productIds) => {
      try {
        const client = sb();
        if (!client) {
          return productIds.map(() => ({}));
        }

        // Batch fetch from Supabase
        const { data, error } = await client
          .from('inventory')
          .select('product_id, size, stock')
          .in('product_id', productIds);

        if (error) throw error;

        // Group by product_id
        const inventoryMap = new Map();
        data.forEach(row => {
          if (!inventoryMap.has(row.product_id)) {
            inventoryMap.set(row.product_id, {});
          }
          inventoryMap.get(row.product_id)[row.size] = row.stock;
        });

        // Map results back to original order
        return productIds.map(id => inventoryMap.get(id) || {});
      } catch (error) {
        console.error('Inventory batch load failed:', error);
        return productIds.map(() => ({}));
      }
    }, { cache: true });
  }
  
  return inventoryLoader;
}

/**
 * Order DataLoader - Batches order fetches by ID
 */
let orderLoader = null;

export function getOrderLoader() {
  if (!orderLoader) {
    orderLoader = new DataLoader(async (orderIds) => {
      try {
        const client = sb();
        if (!client) {
          return orderIds.map(() => null);
        }

        // Batch fetch from Supabase
        const { data, error } = await client
          .from('orders')
          .select('*')
          .in('id', orderIds);

        if (error) throw error;

        // Map results back to original order
        const orderMap = new Map(data.map(o => [o.id, o]));
        return orderIds.map(id => orderMap.get(id) || null);
      } catch (error) {
        console.error('Order batch load failed:', error);
        return orderIds.map(() => null);
      }
    }, { cache: true });
  }
  
  return orderLoader;
}

/**
 * Clears all DataLoader caches
 * Call this when data is mutated to ensure fresh data
 */
export function clearAllCaches() {
  if (productLoader) productLoader.clearCache();
  if (inventoryLoader) inventoryLoader.clearCache();
  if (orderLoader) orderLoader.clearCache();
  console.log('✅ All DataLoader caches cleared');
}

/**
 * Clears specific product from cache
 * @param {string} productId - Product ID to clear
 */
export function clearProductCache(productId) {
  if (productLoader) productLoader.clearKey(productId);
  if (inventoryLoader) inventoryLoader.clearKey(productId);
}

/**
 * Primes the product cache with data
 * Useful after fetching products to avoid duplicate queries
 * @param {Array} products - Array of product objects
 */
export function primeProductCache(products) {
  if (!productLoader) getProductLoader();
  products.forEach(product => {
    productLoader.prime(product.id, product);
  });
}

// Export for window access
if (typeof window !== 'undefined') {
  window.getProductLoader = getProductLoader;
  window.getInventoryLoader = getInventoryLoader;
  window.getOrderLoader = getOrderLoader;
  window.clearAllCaches = clearAllCaches;
  window.clearProductCache = clearProductCache;
  window.primeProductCache = primeProductCache;
}

export default DataLoader;
