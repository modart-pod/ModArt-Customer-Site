/**
 * Utility Functions Module
 * 
 * Reusable helper functions for common operations throughout the ModArt application.
 * Extracted from the original modart_v4.html file to promote code reusability and maintainability.
 */

/**
 * Constrains a value between a minimum and maximum range
 * @param {number} min - Minimum allowed value
 * @param {number} value - Value to constrain
 * @param {number} max - Maximum allowed value
 * @returns {number} Constrained value between min and max
 */
export function clamp(min, value, max) {
  return Math.min(max, Math.max(min, value));
}

/**
/**
 * Formats a price value — falls back to INR if currency module not loaded.
 * @param {number} price - Price in INR
 * @returns {string} Formatted price string
 */
export function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price)) return '?0';
  return '?' + price.toLocaleString('en-IN');
}
