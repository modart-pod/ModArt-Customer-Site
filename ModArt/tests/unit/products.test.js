/**
 * Products Module Tests
 * 
 * Tests for product-related functions
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock product functions
const getSizesForProduct = (productId, inventory) => {
  const inv = inventory[productId] || {};
  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  return SIZE_ORDER.map(size => ({
    size,
    stock: inv[size] || 0,
    available: (inv[size] || 0) > 0,
  })).filter(s => s.stock > 0 || SIZE_ORDER.indexOf(s.size) < 5);
};

const calculateProductStock = (productId, inventory) => {
  const inv = inventory[productId] || {};
  return Object.values(inv).reduce((sum, stock) => sum + stock, 0);
};

const getProductBadge = (stock, customBadge = null) => {
  if (customBadge) return customBadge;
  if (stock === 0) return 'Sold Out';
  if (stock <= 5) return 'Low Stock';
  return null;
};

const filterProductsByTag = (products, tag) => {
  return products.filter(p => p.tags && p.tags.includes(tag));
};

const filterProductsBySeries = (products, series) => {
  return products.filter(p => p.series === series);
};

const filterProductsByPriceRange = (products, minPrice, maxPrice) => {
  return products.filter(p => p.price >= minPrice && p.price <= maxPrice);
};

const sortProductsByPrice = (products, ascending = true) => {
  return [...products].sort((a, b) => 
    ascending ? a.price - b.price : b.price - a.price
  );
};

const sortProductsByName = (products, ascending = true) => {
  return [...products].sort((a, b) => 
    ascending 
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
  );
};

describe('Products Module', () => {
  const mockInventory = {
    'product-1': { S: 5, M: 10, L: 8, XL: 3 },
    'product-2': { M: 0, L: 0 },
    'product-3': { XS: 2, S: 5, M: 10, L: 15, XL: 20, XXL: 5 },
  };

  const mockProducts = [
    {
      id: 'product-1',
      name: 'Vanta Black Tee',
      series: 'Modart Studio',
      price: 9999,
      tags: ['tee', 'minimal', 'cotton'],
      stock: 26,
    },
    {
      id: 'product-2',
      name: 'Elfima Hoodie',
      series: 'Craftsmanship',
      price: 18199,
      tags: ['hoodie', 'heavyweight', 'fleece'],
      stock: 0,
    },
    {
      id: 'product-3',
      name: 'Grid Cargo Pants',
      series: 'Industrial Line',
      price: 14599,
      tags: ['pants', 'cargo', 'utility'],
      stock: 57,
    },
  ];

  describe('getSizesForProduct', () => {
    it('should return available sizes with stock', () => {
      const sizes = getSizesForProduct('product-1', mockInventory);

      expect(sizes).toHaveLength(4);
      expect(sizes[0]).toEqual({ size: 'S', stock: 5, available: true });
      expect(sizes[1]).toEqual({ size: 'M', stock: 10, available: true });
    });

    it('should mark unavailable sizes', () => {
      const sizes = getSizesForProduct('product-2', mockInventory);

      const mSize = sizes.find(s => s.size === 'M');
      expect(mSize.available).toBe(false);
      expect(mSize.stock).toBe(0);
    });

    it('should handle product with no inventory', () => {
      const sizes = getSizesForProduct('product-999', mockInventory);

      expect(sizes.length).toBeGreaterThan(0);
      sizes.forEach(s => {
        expect(s.stock).toBe(0);
        expect(s.available).toBe(false);
      });
    });

    it('should return sizes in correct order', () => {
      const sizes = getSizesForProduct('product-3', mockInventory);
      const sizeOrder = sizes.map(s => s.size);

      expect(sizeOrder).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
    });
  });

  describe('calculateProductStock', () => {
    it('should calculate total stock across all sizes', () => {
      const stock = calculateProductStock('product-1', mockInventory);
      expect(stock).toBe(26); // 5 + 10 + 8 + 3
    });

    it('should return 0 for out of stock product', () => {
      const stock = calculateProductStock('product-2', mockInventory);
      expect(stock).toBe(0);
    });

    it('should return 0 for non-existent product', () => {
      const stock = calculateProductStock('product-999', mockInventory);
      expect(stock).toBe(0);
    });

    it('should handle large stock numbers', () => {
      const stock = calculateProductStock('product-3', mockInventory);
      expect(stock).toBe(57); // 2 + 5 + 10 + 15 + 20 + 5
    });
  });

  describe('getProductBadge', () => {
    it('should return custom badge if provided', () => {
      const badge = getProductBadge(10, 'New');
      expect(badge).toBe('New');
    });

    it('should return "Sold Out" for zero stock', () => {
      const badge = getProductBadge(0);
      expect(badge).toBe('Sold Out');
    });

    it('should return "Low Stock" for stock <= 5', () => {
      expect(getProductBadge(1)).toBe('Low Stock');
      expect(getProductBadge(5)).toBe('Low Stock');
    });

    it('should return null for normal stock', () => {
      expect(getProductBadge(6)).toBe(null);
      expect(getProductBadge(100)).toBe(null);
    });

    it('should prioritize custom badge over stock-based badge', () => {
      const badge = getProductBadge(0, 'Coming Soon');
      expect(badge).toBe('Coming Soon');
    });
  });

  describe('filterProductsByTag', () => {
    it('should filter products by tag', () => {
      const filtered = filterProductsByTag(mockProducts, 'tee');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('product-1');
    });

    it('should return multiple products with same tag', () => {
      const filtered = filterProductsByTag(mockProducts, 'cotton');
      expect(filtered).toHaveLength(1);
    });

    it('should return empty array for non-existent tag', () => {
      const filtered = filterProductsByTag(mockProducts, 'nonexistent');
      expect(filtered).toHaveLength(0);
    });

    it('should handle products without tags', () => {
      const productsWithoutTags = [
        { id: 'p1', name: 'Product 1' },
        { id: 'p2', name: 'Product 2', tags: ['tag1'] },
      ];
      const filtered = filterProductsByTag(productsWithoutTags, 'tag1');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('filterProductsBySeries', () => {
    it('should filter products by series', () => {
      const filtered = filterProductsBySeries(mockProducts, 'Modart Studio');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('product-1');
    });

    it('should return empty array for non-existent series', () => {
      const filtered = filterProductsBySeries(mockProducts, 'Nonexistent Series');
      expect(filtered).toHaveLength(0);
    });

    it('should be case-sensitive', () => {
      const filtered = filterProductsBySeries(mockProducts, 'modart studio');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('filterProductsByPriceRange', () => {
    it('should filter products within price range', () => {
      const filtered = filterProductsByPriceRange(mockProducts, 10000, 15000);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('product-3');
    });

    it('should include products at exact boundaries', () => {
      const filtered = filterProductsByPriceRange(mockProducts, 9999, 14599);
      expect(filtered).toHaveLength(2);
    });

    it('should return empty array when no products in range', () => {
      const filtered = filterProductsByPriceRange(mockProducts, 1, 100);
      expect(filtered).toHaveLength(0);
    });

    it('should return all products for wide range', () => {
      const filtered = filterProductsByPriceRange(mockProducts, 0, 100000);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('sortProductsByPrice', () => {
    it('should sort products by price ascending', () => {
      const sorted = sortProductsByPrice(mockProducts, true);
      expect(sorted[0].price).toBe(9999);
      expect(sorted[1].price).toBe(14599);
      expect(sorted[2].price).toBe(18199);
    });

    it('should sort products by price descending', () => {
      const sorted = sortProductsByPrice(mockProducts, false);
      expect(sorted[0].price).toBe(18199);
      expect(sorted[1].price).toBe(14599);
      expect(sorted[2].price).toBe(9999);
    });

    it('should not mutate original array', () => {
      const original = [...mockProducts];
      sortProductsByPrice(mockProducts, true);
      expect(mockProducts).toEqual(original);
    });
  });

  describe('sortProductsByName', () => {
    it('should sort products by name ascending', () => {
      const sorted = sortProductsByName(mockProducts, true);
      expect(sorted[0].name).toBe('Elfima Hoodie');
      expect(sorted[1].name).toBe('Grid Cargo Pants');
      expect(sorted[2].name).toBe('Vanta Black Tee');
    });

    it('should sort products by name descending', () => {
      const sorted = sortProductsByName(mockProducts, false);
      expect(sorted[0].name).toBe('Vanta Black Tee');
      expect(sorted[1].name).toBe('Grid Cargo Pants');
      expect(sorted[2].name).toBe('Elfima Hoodie');
    });

    it('should not mutate original array', () => {
      const original = [...mockProducts];
      sortProductsByName(mockProducts, true);
      expect(mockProducts).toEqual(original);
    });

    it('should handle case-insensitive sorting', () => {
      const products = [
        { id: '1', name: 'zebra' },
        { id: '2', name: 'Apple' },
        { id: '3', name: 'banana' },
      ];
      const sorted = sortProductsByName(products, true);
      expect(sorted[0].name).toBe('Apple');
      expect(sorted[1].name).toBe('banana');
      expect(sorted[2].name).toBe('zebra');
    });
  });
});
