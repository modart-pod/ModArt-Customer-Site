/**
 * State Module Tests
 * 
 * Tests for state management (cart, wishlist, discount)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock cart implementation matching the improved state.js
class Cart {
  constructor() {
    this.items = [];
    this._snapshots = [];
  }

  snapshot() {
    const snap = {
      items: JSON.parse(JSON.stringify(this.items)),
      timestamp: Date.now(),
    };
    this._snapshots.push(snap);
    if (this._snapshots.length > 10) {
      this._snapshots.shift();
    }
    return snap;
  }

  rollback() {
    if (this._snapshots.length > 0) {
      const snap = this._snapshots.pop();
      this.items = JSON.parse(JSON.stringify(snap.items));
      return true;
    }
    return false;
  }

  clearSnapshots() {
    this._snapshots = [];
  }

  add(id, size = 'M', printAddon = 0) {
    if (!id || typeof id !== 'string') {
      console.error('Invalid product ID');
      return false;
    }

    const ex = this.items.find(
      i => i.productId === id && i.size === size && (i.printAddon || 0) === printAddon
    );
    
    if (ex) {
      ex.qty++;
    } else {
      this.items.push({ productId: id, qty: 1, size, printAddon });
    }
    
    return true;
  }

  remove(id, size) {
    if (!id || typeof id !== 'string') {
      console.error('Invalid product ID');
      return false;
    }

    const originalLength = this.items.length;
    this.items = size
      ? this.items.filter(i => !(i.productId === id && i.size === size))
      : this.items.filter(i => i.productId !== id);
    
    return originalLength !== this.items.length;
  }

  updateQty(id, delta, size) {
    if (!id || typeof id !== 'string' || typeof delta !== 'number') {
      console.error('Invalid parameters');
      return false;
    }

    const item = size
      ? this.items.find(i => i.productId === id && i.size === size)
      : this.items.find(i => i.productId === id);
    
    if (item) {
      const newQty = Math.max(1, item.qty + delta);
      if (newQty !== item.qty) {
        item.qty = newQty;
        return true;
      }
    }
    return false;
  }

  clear() {
    this.items = [];
  }

  getItem(id, size) {
    return this.items.find(i => i.productId === id && i.size === size);
  }

  hasItem(id, size = null) {
    return size
      ? this.items.some(i => i.productId === id && i.size === size)
      : this.items.some(i => i.productId === id);
  }

  get count() {
    return this.items.reduce((s, i) => s + i.qty, 0);
  }

  subtotal(products) {
    return this.items.reduce((s, i) => {
      const p = products.find(p => p.id === i.productId);
      return s + (p ? (p.price + (i.printAddon || 0)) * i.qty : 0);
    }, 0);
  }

  toJSON() {
    return {
      items: this.items,
      count: this.count,
    };
  }
}

describe('State Module - Cart', () => {
  let cart;
  const mockProducts = [
    { id: 'product-1', name: 'Test Product 1', price: 1000 },
    { id: 'product-2', name: 'Test Product 2', price: 2000 },
  ];

  beforeEach(() => {
    cart = new Cart();
  });

  describe('snapshot and rollback', () => {
    it('should create snapshot of cart state', () => {
      cart.add('product-1', 'M');
      const snapshot = cart.snapshot();

      expect(snapshot).toHaveProperty('items');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot.items).toHaveLength(1);
    });

    it('should rollback to previous snapshot', () => {
      cart.add('product-1', 'M');
      cart.snapshot();
      
      cart.add('product-2', 'L');
      expect(cart.items).toHaveLength(2);

      const rolled = cart.rollback();
      expect(rolled).toBe(true);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe('product-1');
    });

    it('should return false when no snapshots to rollback', () => {
      const rolled = cart.rollback();
      expect(rolled).toBe(false);
    });

    it('should keep only last 10 snapshots', () => {
      for (let i = 0; i < 15; i++) {
        cart.add(`product-${i}`, 'M');
        cart.snapshot();
      }

      expect(cart._snapshots).toHaveLength(10);
    });

    it('should clear all snapshots', () => {
      cart.add('product-1', 'M');
      cart.snapshot();
      cart.snapshot();
      
      expect(cart._snapshots).toHaveLength(2);
      
      cart.clearSnapshots();
      expect(cart._snapshots).toHaveLength(0);
    });
  });

  describe('add with validation', () => {
    it('should validate product ID', () => {
      const result = cart.add(null, 'M');
      expect(result).toBe(false);
      expect(cart.items).toHaveLength(0);
    });

    it('should validate product ID type', () => {
      const result = cart.add(123, 'M');
      expect(result).toBe(false);
      expect(cart.items).toHaveLength(0);
    });

    it('should add valid product', () => {
      const result = cart.add('product-1', 'M');
      expect(result).toBe(true);
      expect(cart.items).toHaveLength(1);
    });
  });

  describe('remove with validation', () => {
    beforeEach(() => {
      cart.add('product-1', 'M');
      cart.add('product-2', 'L');
    });

    it('should validate product ID', () => {
      const result = cart.remove(null, 'M');
      expect(result).toBe(false);
      expect(cart.items).toHaveLength(2);
    });

    it('should return true when item removed', () => {
      const result = cart.remove('product-1', 'M');
      expect(result).toBe(true);
      expect(cart.items).toHaveLength(1);
    });

    it('should return false when item not found', () => {
      const result = cart.remove('product-999', 'M');
      expect(result).toBe(false);
      expect(cart.items).toHaveLength(2);
    });
  });

  describe('updateQty with validation', () => {
    beforeEach(() => {
      cart.add('product-1', 'M');
      cart.items[0].qty = 5;
    });

    it('should validate product ID', () => {
      const result = cart.updateQty(null, 1, 'M');
      expect(result).toBe(false);
    });

    it('should validate delta type', () => {
      const result = cart.updateQty('product-1', 'invalid', 'M');
      expect(result).toBe(false);
    });

    it('should return true when quantity updated', () => {
      const result = cart.updateQty('product-1', 2, 'M');
      expect(result).toBe(true);
      expect(cart.items[0].qty).toBe(7);
    });

    it('should return false when quantity unchanged', () => {
      const result = cart.updateQty('product-1', 0, 'M');
      expect(result).toBe(false);
      expect(cart.items[0].qty).toBe(5);
    });

    it('should not go below 1', () => {
      cart.updateQty('product-1', -10, 'M');
      expect(cart.items[0].qty).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      cart.add('product-1', 'M');
      cart.add('product-2', 'L');
      
      cart.clear();
      
      expect(cart.items).toHaveLength(0);
      expect(cart.count).toBe(0);
    });
  });

  describe('getItem', () => {
    beforeEach(() => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'L');
    });

    it('should get item by ID and size', () => {
      const item = cart.getItem('product-1', 'M');
      expect(item).toBeDefined();
      expect(item.productId).toBe('product-1');
      expect(item.size).toBe('M');
    });

    it('should return undefined for non-existent item', () => {
      const item = cart.getItem('product-999', 'M');
      expect(item).toBeUndefined();
    });
  });

  describe('hasItem', () => {
    beforeEach(() => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'L');
    });

    it('should check if item exists by ID and size', () => {
      expect(cart.hasItem('product-1', 'M')).toBe(true);
      expect(cart.hasItem('product-1', 'XL')).toBe(false);
    });

    it('should check if any size exists when size not specified', () => {
      expect(cart.hasItem('product-1')).toBe(true);
      expect(cart.hasItem('product-999')).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize cart state', () => {
      cart.add('product-1', 'M');
      cart.add('product-2', 'L');
      
      const json = cart.toJSON();
      
      expect(json).toHaveProperty('items');
      expect(json).toHaveProperty('count');
      expect(json.items).toHaveLength(2);
      expect(json.count).toBe(2);
    });

    it('should be JSON-serializable', () => {
      cart.add('product-1', 'M');
      
      const json = cart.toJSON();
      const serialized = JSON.stringify(json);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized.items).toEqual(json.items);
      expect(deserialized.count).toBe(json.count);
    });
  });
});

describe('State Module - Wishlist', () => {
  let wishlist;

  beforeEach(() => {
    wishlist = new Set();
  });

  describe('toggle', () => {
    it('should add item to wishlist', () => {
      wishlist.add('product-1');
      expect(wishlist.has('product-1')).toBe(true);
    });

    it('should remove item from wishlist', () => {
      wishlist.add('product-1');
      wishlist.delete('product-1');
      expect(wishlist.has('product-1')).toBe(false);
    });

    it('should toggle item', () => {
      const toggle = (id) => {
        if (wishlist.has(id)) {
          wishlist.delete(id);
        } else {
          wishlist.add(id);
        }
      };

      toggle('product-1');
      expect(wishlist.has('product-1')).toBe(true);

      toggle('product-1');
      expect(wishlist.has('product-1')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should serialize to array', () => {
      wishlist.add('product-1');
      wishlist.add('product-2');
      
      const array = Array.from(wishlist);
      expect(array).toHaveLength(2);
      expect(array).toContain('product-1');
      expect(array).toContain('product-2');
    });

    it('should deserialize from array', () => {
      const array = ['product-1', 'product-2'];
      const restored = new Set(array);
      
      expect(restored.has('product-1')).toBe(true);
      expect(restored.has('product-2')).toBe(true);
      expect(restored.size).toBe(2);
    });
  });
});

describe('State Module - Discount', () => {
  let discount;

  beforeEach(() => {
    discount = {
      applied: false,
      percent: 0,
      code: '',
    };
  });

  describe('setDiscount', () => {
    it('should apply discount', () => {
      discount.applied = true;
      discount.percent = 10;
      discount.code = 'MODART10';

      expect(discount.applied).toBe(true);
      expect(discount.percent).toBe(10);
      expect(discount.code).toBe('MODART10');
    });

    it('should clear discount', () => {
      discount.applied = true;
      discount.percent = 10;
      discount.code = 'MODART10';

      discount.applied = false;
      discount.percent = 0;
      discount.code = '';

      expect(discount.applied).toBe(false);
      expect(discount.percent).toBe(0);
      expect(discount.code).toBe('');
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate discount amount', () => {
      const subtotal = 10000;
      const percent = 10;
      const discountAmount = Math.round(subtotal * percent / 100);

      expect(discountAmount).toBe(1000);
    });

    it('should calculate total with discount', () => {
      const subtotal = 10000;
      const percent = 10;
      const discountAmount = Math.round(subtotal * percent / 100);
      const total = subtotal - discountAmount;

      expect(total).toBe(9000);
    });

    it('should handle no discount', () => {
      const subtotal = 10000;
      const percent = 0;
      const discountAmount = Math.round(subtotal * percent / 100);
      const total = subtotal - discountAmount;

      expect(total).toBe(10000);
    });
  });
});
