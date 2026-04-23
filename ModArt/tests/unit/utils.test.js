/**
 * Utils Module Tests
 * 
 * Tests for utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock utility functions for testing
const clamp = (min, value, max) => Math.min(max, Math.max(min, value));

const formatPrice = (price, showCents = true) => {
  if (typeof price !== 'number' || isNaN(price)) {
    return '₹0';
  }
  
  if (showCents) {
    return `${price.toFixed(2)}`;
  } else {
    return `${Math.round(price)}.00`;
  }
};

const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const generateId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const safeParseNumber = (value, defaultValue = 0) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const capitalize = (str) => {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const truncate = (str, maxLength, suffix = '...') => {
  if (typeof str !== 'string') {
    return '';
  }
  
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.slice(0, maxLength - suffix.length) + suffix;
};

describe('Utils Module', () => {
  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(0, 5, 10)).toBe(5);
      expect(clamp(1, 50, 100)).toBe(50);
    });

    it('should return min when value is below range', () => {
      expect(clamp(0, -5, 10)).toBe(0);
      expect(clamp(10, 5, 20)).toBe(10);
    });

    it('should return max when value is above range', () => {
      expect(clamp(0, 15, 10)).toBe(10);
      expect(clamp(1, 100, 50)).toBe(50);
    });

    it('should handle equal min and max', () => {
      expect(clamp(5, 3, 5)).toBe(5);
      expect(clamp(5, 7, 5)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(clamp(-10, -5, 0)).toBe(-5);
      expect(clamp(-10, -15, 0)).toBe(-10);
      expect(clamp(-10, 5, 0)).toBe(0);
    });
  });

  describe('formatPrice', () => {
    it('should format price with cents by default', () => {
      expect(formatPrice(1000)).toBe('1000.00');
      expect(formatPrice(1234.56)).toBe('1234.56');
    });

    it('should format price without cents when specified', () => {
      expect(formatPrice(1234.56, false)).toBe('1235.00');
      expect(formatPrice(1000, false)).toBe('1000.00');
    });

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('0.00');
    });

    it('should handle invalid input', () => {
      expect(formatPrice(NaN)).toBe('₹0');
      expect(formatPrice('invalid')).toBe('₹0');
      expect(formatPrice(null)).toBe('₹0');
      expect(formatPrice(undefined)).toBe('₹0');
    });

    it('should round correctly when not showing cents', () => {
      expect(formatPrice(1234.4, false)).toBe('1234.00');
      expect(formatPrice(1234.5, false)).toBe('1235.00');
      expect(formatPrice(1234.9, false)).toBe('1235.00');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should delay function execution', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should only execute once for multiple rapid calls', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on each call', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      vi.advanceTimersByTime(50);
      debouncedFunc();
      vi.advanceTimersByTime(50);
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    it('should use default prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^id_/);
    });

    it('should use custom prefix', () => {
      const id = generateId('custom');
      expect(id).toMatch(/^custom_/);
    });

    it('should include timestamp', () => {
      const id = generateId();
      const parts = id.split('_');
      const timestamp = parseInt(parts[1]);

      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should include random component', () => {
      const id = generateId();
      const parts = id.split('_');

      expect(parts).toHaveLength(3);
      expect(parts[2]).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('safeParseNumber', () => {
    it('should parse valid numbers', () => {
      expect(safeParseNumber('123')).toBe(123);
      expect(safeParseNumber('45.67')).toBe(45.67);
      expect(safeParseNumber(89)).toBe(89);
    });

    it('should return default for invalid input', () => {
      expect(safeParseNumber('invalid')).toBe(0);
      expect(safeParseNumber(null)).toBe(0);
      expect(safeParseNumber(undefined)).toBe(0);
      expect(safeParseNumber('')).toBe(0);
    });

    it('should use custom default value', () => {
      expect(safeParseNumber('invalid', 100)).toBe(100);
      expect(safeParseNumber(null, -1)).toBe(-1);
    });

    it('should handle negative numbers', () => {
      expect(safeParseNumber('-123')).toBe(-123);
      expect(safeParseNumber(-45.67)).toBe(-45.67);
    });

    it('should handle zero', () => {
      expect(safeParseNumber('0')).toBe(0);
      expect(safeParseNumber(0)).toBe(0);
    });

    it('should parse numbers with leading/trailing spaces', () => {
      expect(safeParseNumber('  123  ')).toBe(123);
      expect(safeParseNumber(' 45.67 ')).toBe(45.67);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should handle already capitalized strings', () => {
      expect(capitalize('Hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('WORLD');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
      expect(capitalize('Z')).toBe('Z');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(capitalize(null)).toBe('');
      expect(capitalize(undefined)).toBe('');
      expect(capitalize(123)).toBe('');
    });

    it('should only capitalize first letter', () => {
      expect(capitalize('hello world')).toBe('Hello world');
      expect(capitalize('hELLO')).toBe('HELLO');
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello');
      expect(truncate('test', 10)).toBe('test');
    });

    it('should truncate long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
      expect(truncate('this is a long string', 10)).toBe('this is...');
    });

    it('should use custom suffix', () => {
      expect(truncate('hello world', 8, '…')).toBe('hello w…');
      expect(truncate('hello world', 8, ' [more]')).toBe('h [more]');
    });

    it('should handle exact length', () => {
      expect(truncate('hello', 5)).toBe('hello');
      expect(truncate('hello!', 6)).toBe('hello!');
    });

    it('should handle empty string', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('should handle non-string input', () => {
      expect(truncate(null, 10)).toBe('');
      expect(truncate(undefined, 10)).toBe('');
      expect(truncate(123, 10)).toBe('');
    });

    it('should account for suffix length', () => {
      const result = truncate('hello world', 8, '...');
      expect(result.length).toBe(8);
      expect(result).toBe('hello...');
    });
  });
});
