/**
 * Cache Manager Tests
 * 
 * Tests for cache management functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock CacheManager class
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.version = '1.0.0';
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  get(key, options = {}) {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (entry.version !== this.version) {
      this.cache.delete(key);
      return null;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    if (age > entry.ttl) {
      if (options.allowStale) {
        entry.stale = true;
        return entry.data;
      }
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key, data, options = {}) {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.defaultTTL,
      tags: options.tags || [],
      version: this.version,
      stale: false,
    };
    
    this.cache.set(key, entry);
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
  }

  invalidateTag(tag) {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  invalidateTags(tags) {
    tags.forEach(tag => this.invalidateTag(tag));
  }

  clear() {
    this.cache.clear();
  }

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
    
    return { total: this.cache.size, valid, stale, expired };
  }

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
    
    return cleaned;
  }

  async wrap(key, fn, options = {}) {
    const cached = this.get(key, { allowStale: true });
    
    if (cached !== null) {
      const entry = this.cache.get(key);
      
      if (entry && entry.stale) {
        fn().then(data => {
          this.set(key, data, options);
        }).catch(() => {});
      }
      
      return cached;
    }
    
    const data = await fn();
    this.set(key, data, options);
    return data;
  }
}

describe('Cache Manager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      cacheManager.set('key1', 'value1');
      const value = cacheManager.get('key1');
      
      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      const value = cacheManager.get('nonexistent');
      expect(value).toBe(null);
    });

    it('should store complex objects', () => {
      const data = { id: 1, name: 'Test', nested: { value: 42 } };
      cacheManager.set('key1', data);
      const retrieved = cacheManager.get('key1');
      
      expect(retrieved).toEqual(data);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect default TTL', () => {
      cacheManager.set('key1', 'value1');
      
      // Before TTL expires
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(cacheManager.get('key1')).toBe('value1');
      
      // After TTL expires
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 more minutes (total 6)
      expect(cacheManager.get('key1')).toBe(null);
    });

    it('should respect custom TTL', () => {
      cacheManager.set('key1', 'value1', { ttl: 1000 }); // 1 second
      
      vi.advanceTimersByTime(500);
      expect(cacheManager.get('key1')).toBe('value1');
      
      vi.advanceTimersByTime(600);
      expect(cacheManager.get('key1')).toBe(null);
    });

    it('should return stale data when allowStale is true', () => {
      cacheManager.set('key1', 'value1', { ttl: 1000 });
      
      vi.advanceTimersByTime(1500);
      const value = cacheManager.get('key1', { allowStale: true });
      
      expect(value).toBe('value1');
    });
  });

  describe('tags', () => {
    beforeEach(() => {
      cacheManager.set('product:1', { id: 1 }, { tags: ['products', 'product:1'] });
      cacheManager.set('product:2', { id: 2 }, { tags: ['products', 'product:2'] });
      cacheManager.set('order:1', { id: 1 }, { tags: ['orders'] });
    });

    it('should invalidate entries by tag', () => {
      const count = cacheManager.invalidateTag('products');
      
      expect(count).toBe(2);
      expect(cacheManager.get('product:1')).toBe(null);
      expect(cacheManager.get('product:2')).toBe(null);
      expect(cacheManager.get('order:1')).not.toBe(null);
    });

    it('should invalidate multiple tags', () => {
      cacheManager.invalidateTags(['products', 'orders']);
      
      expect(cacheManager.get('product:1')).toBe(null);
      expect(cacheManager.get('product:2')).toBe(null);
      expect(cacheManager.get('order:1')).toBe(null);
    });

    it('should handle non-existent tags', () => {
      const count = cacheManager.invalidateTag('nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing valid entry', () => {
      cacheManager.set('key1', 'value1');
      expect(cacheManager.has('key1')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(cacheManager.has('nonexistent')).toBe(false);
    });

    it('should return false for expired entry', () => {
      cacheManager.set('key1', 'value1', { ttl: 1000 });
      vi.advanceTimersByTime(1500);
      
      expect(cacheManager.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete entry', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.delete('key1');
      
      expect(cacheManager.get('key1')).toBe(null);
    });

    it('should handle deleting non-existent entry', () => {
      expect(() => cacheManager.delete('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      cacheManager.set('key3', 'value3');
      
      cacheManager.clear();
      
      expect(cacheManager.get('key1')).toBe(null);
      expect(cacheManager.get('key2')).toBe(null);
      expect(cacheManager.get('key3')).toBe(null);
      expect(cacheManager.cache.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2', { ttl: 1000 });
      cacheManager.set('key3', 'value3');
      
      vi.advanceTimersByTime(1500);
      
      const stats = cacheManager.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(1);
    });

    it('should return zero stats for empty cache', () => {
      const stats = cacheManager.getStats();
      
      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.stale).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      cacheManager.set('key1', 'value1', { ttl: 1000 });
      cacheManager.set('key2', 'value2', { ttl: 5000 });
      cacheManager.set('key3', 'value3', { ttl: 1000 });
      
      vi.advanceTimersByTime(1500);
      
      const cleaned = cacheManager.cleanup();
      
      expect(cleaned).toBe(2);
      expect(cacheManager.get('key1')).toBe(null);
      expect(cacheManager.get('key2')).not.toBe(null);
      expect(cacheManager.get('key3')).toBe(null);
    });

    it('should return 0 when no expired entries', () => {
      cacheManager.set('key1', 'value1');
      const cleaned = cacheManager.cleanup();
      
      expect(cleaned).toBe(0);
    });
  });

  describe('wrap', () => {
    it('should cache function result', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      
      const result1 = await cacheManager.wrap('key1', fn);
      const result2 = await cacheManager.wrap('key1', fn);
      
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should revalidate stale data in background', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce('old-result')
        .mockResolvedValueOnce('new-result');
      
      await cacheManager.wrap('key1', fn, { ttl: 1000 });
      
      vi.advanceTimersByTime(1500);
      
      const result = await cacheManager.wrap('key1', fn, { ttl: 1000 });
      
      expect(result).toBe('old-result'); // Returns stale immediately
      expect(fn).toHaveBeenCalledTimes(2); // But triggers revalidation
    });

    it('should handle function errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));
      
      await expect(cacheManager.wrap('key1', fn)).rejects.toThrow('Failed');
    });
  });

  describe('version management', () => {
    it('should invalidate cache on version change', () => {
      cacheManager.set('key1', 'value1');
      
      cacheManager.version = '2.0.0';
      
      expect(cacheManager.get('key1')).toBe(null);
    });

    it('should not return data from old version', () => {
      cacheManager.version = '1.0.0';
      cacheManager.set('key1', 'value1');
      
      cacheManager.version = '2.0.0';
      cacheManager.set('key2', 'value2');
      
      expect(cacheManager.get('key1')).toBe(null);
      expect(cacheManager.get('key2')).toBe('value2');
    });
  });
});
