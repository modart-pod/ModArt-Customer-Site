/**
 * Cart Module Tests
 * 
 * Tests for shopping cart functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock cart implementation for testing
class Cart {
  constructor() {
    this.items = [];
  }

  add(id, size = 'M', printAddon = 0) {
    const existing = this.items.find(
      i => i.productId === id && i.size === size && (i.printAddon || 0) === printAddon
    );
    
    if (existing) {
      existing.qty++;
    } else {
      this.items.push({ productId: id, qty: 1, size, printAddon });
    }
  }

  remove(id, size) {
    if (size) {
      this.items = this.items.filter(i => !(i.productId === id && i.size === size));
    } else {
      this.items = this.items.filter(i => i.productId !== id);
    }
  }

  updateQty(id, delta, size) {
    const item = size
      ? this.items.find(i => i.productId === id && i.size === size)
      : this.items.find(i => i.productId === id);
    
    if (item) {
      item.qty = Math.max(1, item.qty + delta);
    }
  }

  get count() {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  }

  subtotal(products) {
    return this.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + (product ? (product.price + (item.printAddon || 0)) * item.qty : 0);
    }, 0);
  }

  clear() {
    this.items = [];
  }
}

describe('Cart Module', () => {
  let cart;
  const mockProducts = [
    { id: 'product-1', name: 'Test Product 1', price: 1000 },
    { id: 'product-2', name: 'Test Product 2', price: 2000 },
    { id: 'product-3', name: 'Test Product 3', price: 3000 },
  ];

  beforeEach(() => {
    cart = new Cart();
  });

  describe('add', () => {
    it('should add a new item to cart', () => {
      cart.add('product-1', 'M');
      
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]).toEqual({
        productId: 'product-1',
        qty: 1,
        size: 'M',
        printAddon: 0,
      });
    });

    it('should increment quantity for existing item', () => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'M');
      
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].qty).toBe(2);
    });

    it('should add separate items for different sizes', () => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'L');
      
      expect(cart.items).toHaveLength(2);
      expect(cart.items[0].size).toBe('M');
      expect(cart.items[1].size).toBe('L');
    });

    it('should handle print addon', () => {
      cart.add('product-1', 'M', 500);
      
      expect(cart.items[0].printAddon).toBe(500);
    });

    it('should default to size M if not specified', () => {
      cart.add('product-1');
      
      expect(cart.items[0].size).toBe('M');
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'L');
      cart.add('product-2', 'M');
    });

    it('should remove item by id and size', () => {
      cart.remove('product-1', 'M');
      
      expect(cart.items).toHaveLength(2);
      expect(cart.items.find(i => i.productId === 'product-1' && i.size === 'M')).toBeUndefined();
    });

    it('should remove all sizes if size not specified', () => {
      cart.remove('product-1');
      
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].productId).toBe('product-2');
    });

    it('should handle removing non-existent item', () => {
      cart.remove('product-999', 'M');
      
      expect(cart.items).toHaveLength(3);
    });
  });

  describe('updateQty', () => {
    beforeEach(() => {
      cart.add('product-1', 'M');
      cart.items[0].qty = 5;
    });

    it('should increase quantity', () => {
      cart.updateQty('product-1', 2, 'M');
      
      expect(cart.items[0].qty).toBe(7);
    });

    it('should decrease quantity', () => {
      cart.updateQty('product-1', -2, 'M');
      
      expect(cart.items[0].qty).toBe(3);
    });

    it('should not go below 1', () => {
      cart.updateQty('product-1', -10, 'M');
      
      expect(cart.items[0].qty).toBe(1);
    });

    it('should handle non-existent item', () => {
      cart.updateQty('product-999', 1, 'M');
      
      expect(cart.items[0].qty).toBe(5); // Unchanged
    });
  });

  describe('count', () => {
    it('should return 0 for empty cart', () => {
      expect(cart.count).toBe(0);
    });

    it('should return total quantity of all items', () => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'M');
      cart.add('product-2', 'L');
      
      expect(cart.count).toBe(3);
    });

    it('should update when items are added or removed', () => {
      cart.add('product-1', 'M');
      cart.add('product-2', 'M');
      expect(cart.count).toBe(2);
      
      cart.remove('product-1', 'M');
      expect(cart.count).toBe(1);
    });
  });

  describe('subtotal', () => {
    it('should return 0 for empty cart', () => {
      expect(cart.subtotal(mockProducts)).toBe(0);
    });

    it('should calculate subtotal correctly', () => {
      cart.add('product-1', 'M'); // 1000
      cart.add('product-2', 'M'); // 2000
      
      expect(cart.subtotal(mockProducts)).toBe(3000);
    });

    it('should include quantity in calculation', () => {
      cart.add('product-1', 'M');
      cart.add('product-1', 'M');
      cart.add('product-1', 'M'); // 3 × 1000 = 3000
      
      expect(cart.subtotal(mockProducts)).toBe(3000);
    });

    it('should include print addon in calculation', () => {
      cart.add('product-1', 'M', 500); // (1000 + 500) × 1 = 1500
      
      expect(cart.subtotal(mockProducts)).toBe(1500);
    });

    it('should handle missing products', () => {
      cart.add('product-999', 'M');
      
      expect(cart.subtotal(mockProducts)).toBe(0);
    });

    it('should calculate complex cart correctly', () => {
      cart.add('product-1', 'M'); // 1000
      cart.add('product-1', 'M'); // 1000
      cart.add('product-2', 'L', 300); // 2300
      cart.add('product-3', 'XL'); // 3000
      
      // Total: 2000 + 2300 + 3000 = 7300
      expect(cart.subtotal(mockProducts)).toBe(7300);
    });
  });

  describe('clear', () => {
    it('should remove all items from cart', () => {
      cart.add('product-1', 'M');
      cart.add('product-2', 'L');
      cart.add('product-3', 'XL');
      
      cart.clear();
      
      expect(cart.items).toHaveLength(0);
      expect(cart.count).toBe(0);
    });
  });
});
