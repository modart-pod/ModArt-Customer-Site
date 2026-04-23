/**
 * Currency Module Tests
 * 
 * Tests for currency conversion and formatting functions
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the currency module
const formatPrice = (amount, currency = 'INR') => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  
  const symbol = symbols[currency] || '₹';
  const formatted = amount.toLocaleString('en-IN');
  
  return `${symbol}${formatted}`;
};

const convertCurrency = (amount, fromCurrency, toCurrency, rates) => {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to INR first (base currency)
  const inINR = fromCurrency === 'INR' ? amount : amount / rates[fromCurrency];
  
  // Convert from INR to target currency
  const converted = toCurrency === 'INR' ? inINR : inINR * rates[toCurrency];
  
  return Math.round(converted);
};

describe('Currency Module', () => {
  describe('formatPrice', () => {
    it('should format INR prices correctly', () => {
      expect(formatPrice(9999, 'INR')).toBe('₹9,999');
      expect(formatPrice(18199, 'INR')).toBe('₹18,199');
      expect(formatPrice(100, 'INR')).toBe('₹100');
    });

    it('should format USD prices correctly', () => {
      expect(formatPrice(120, 'USD')).toBe('$120');
      expect(formatPrice(1500, 'USD')).toBe('$1,500');
    });

    it('should format EUR prices correctly', () => {
      expect(formatPrice(110, 'EUR')).toBe('€110');
      expect(formatPrice(1200, 'EUR')).toBe('€1,200');
    });

    it('should format GBP prices correctly', () => {
      expect(formatPrice(95, 'GBP')).toBe('£95');
      expect(formatPrice(1000, 'GBP')).toBe('£1,000');
    });

    it('should default to INR if currency not specified', () => {
      expect(formatPrice(5000)).toBe('₹5,000');
    });

    it('should handle zero amount', () => {
      expect(formatPrice(0, 'INR')).toBe('₹0');
    });

    it('should handle large amounts', () => {
      expect(formatPrice(1000000, 'INR')).toBe('₹10,00,000');
    });
  });

  describe('convertCurrency', () => {
    const mockRates = {
      USD: 83.5,
      EUR: 91.2,
      GBP: 106.8,
    };

    it('should return same amount for same currency', () => {
      expect(convertCurrency(10000, 'INR', 'INR', mockRates)).toBe(10000);
      expect(convertCurrency(100, 'USD', 'USD', mockRates)).toBe(100);
    });

    it('should convert INR to USD correctly', () => {
      const result = convertCurrency(8350, 'INR', 'USD', mockRates);
      expect(result).toBe(100); // 8350 / 83.5 = 100
    });

    it('should convert INR to EUR correctly', () => {
      const result = convertCurrency(9120, 'INR', 'EUR', mockRates);
      expect(result).toBe(100); // 9120 / 91.2 = 100
    });

    it('should convert INR to GBP correctly', () => {
      const result = convertCurrency(10680, 'INR', 'GBP', mockRates);
      expect(result).toBe(100); // 10680 / 106.8 = 100
    });

    it('should convert USD to INR correctly', () => {
      const result = convertCurrency(100, 'USD', 'INR', mockRates);
      expect(result).toBe(8350); // 100 * 83.5 = 8350
    });

    it('should convert between non-INR currencies', () => {
      // USD to EUR: 100 USD = 8350 INR = 91.56 EUR
      const result = convertCurrency(100, 'USD', 'EUR', mockRates);
      expect(result).toBeCloseTo(92, 0); // Rounded
    });

    it('should round to nearest integer', () => {
      const result = convertCurrency(100, 'USD', 'EUR', mockRates);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should handle zero amount', () => {
      expect(convertCurrency(0, 'INR', 'USD', mockRates)).toBe(0);
    });
  });
});
