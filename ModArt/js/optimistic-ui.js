/**
 * ModArt Optimistic UI
 * 
 * UX FIX: H-8 - Optimistic UI updates
 * 
 * Provides instant UI feedback with rollback on failure.
 * Makes the app feel fast and responsive.
 */

import { showSuccess, showError, showUndo } from './toast.js';

/**
 * Optimistic update wrapper
 * @param {Function} optimisticFn - Function to update UI optimistically
 * @param {Function} serverFn - Function to sync with server
 * @param {Function} rollbackFn - Function to rollback on failure
 * @param {Object} options - Options
 * @returns {Promise}
 */
export async function optimisticUpdate(optimisticFn, serverFn, rollbackFn, options = {}) {
  // Apply optimistic update immediately
  const rollbackData = optimisticFn();

  try {
    // Sync with server
    const result = await serverFn();

    // Show success message if configured
    if (options.successMessage) {
      showSuccess(options.successMessage);
    }

    return result;
  } catch (error) {
    // Rollback on failure
    if (rollbackFn) {
      rollbackFn(rollbackData);
    }

    // Show error message
    const errorMessage = options.errorMessage || error.message || 'Operation failed';
    showError(errorMessage, {
      action: options.retry ? {
        label: 'Retry',
        callback: () => optimisticUpdate(optimisticFn, serverFn, rollbackFn, options)
      } : null
    });

    throw error;
  }
}

/**
 * Optimistic cart add
 * @param {string} productId - Product ID
 * @param {string} size - Size
 * @param {number} printAddon - Print addon price
 */
export async function optimisticAddToCart(productId, size, printAddon = 0) {
  const product = window._PRODUCTS?.find(p => p.id === productId);
  if (!product) {
    showError('Product not found');
    return;
  }

  return optimisticUpdate(
    // Optimistic update
    () => {
      if (window.cart) {
        window.cart.add(productId, size, printAddon);
      }
      return { productId, size, printAddon };
    },
    // Server sync
    async () => {
      if (window.syncCartToSupabase) {
        await window.syncCartToSupabase();
      }
    },
    // Rollback
    (data) => {
      if (window.cart) {
        window.cart.remove(data.productId, data.size);
      }
    },
    {
      successMessage: `${product.name} added to cart`,
      errorMessage: 'Failed to add to cart',
      retry: true
    }
  );
}

/**
 * Optimistic cart remove
 * @param {string} productId - Product ID
 * @param {string} size - Size
 */
export async function optimisticRemoveFromCart(productId, size) {
  const product = window._PRODUCTS?.find(p => p.id === productId);
  const productName = product?.name || 'Item';

  return optimisticUpdate(
    // Optimistic update
    () => {
      const item = window.cart?.items.find(i => i.productId === productId && i.size === size);
      if (window.cart) {
        window.cart.remove(productId, size);
      }
      return { item };
    },
    // Server sync
    async () => {
      if (window.syncCartToSupabase) {
        await window.syncCartToSupabase();
      }
    },
    // Rollback
    (data) => {
      if (data.item && window.cart) {
        window.cart.add(data.item.productId, data.item.size, data.item.printAddon);
      }
    },
    {
      successMessage: null, // Don't show success for remove
      errorMessage: 'Failed to remove from cart',
      retry: true
    }
  );
}

/**
 * Optimistic cart quantity update
 * @param {string} productId - Product ID
 * @param {number} delta - Quantity change (+1 or -1)
 * @param {string} size - Size
 */
export async function optimisticUpdateQuantity(productId, delta, size) {
  return optimisticUpdate(
    // Optimistic update
    () => {
      const item = window.cart?.items.find(i => i.productId === productId && i.size === size);
      const oldQty = item?.qty || 0;
      
      if (window.cart) {
        window.cart.updateQty(productId, delta, size);
      }
      
      return { productId, size, oldQty };
    },
    // Server sync
    async () => {
      if (window.syncCartToSupabase) {
        await window.syncCartToSupabase();
      }
    },
    // Rollback
    (data) => {
      const item = window.cart?.items.find(i => i.productId === data.productId && i.size === data.size);
      if (item && window.cart) {
        item.qty = data.oldQty;
        window.cart.sync();
      }
    },
    {
      successMessage: null, // Don't show success for quantity change
      errorMessage: 'Failed to update quantity',
      retry: true
    }
  );
}

/**
 * Optimistic wishlist toggle
 * @param {string} productId - Product ID
 */
export async function optimisticToggleWishlist(productId) {
  const product = window._PRODUCTS?.find(p => p.id === productId);
  const productName = product?.name || 'Item';
  const isWished = window.wishlist?.has(productId);

  return optimisticUpdate(
    // Optimistic update
    () => {
      const wasWished = window.wishlist?.has(productId);
      if (window.toggleWishlistItem) {
        window.toggleWishlistItem(productId);
      }
      return { wasWished };
    },
    // Server sync
    async () => {
      // Sync wishlist to server if function exists
      if (window.syncWishlistToSupabase) {
        await window.syncWishlistToSupabase();
      }
    },
    // Rollback
    (data) => {
      if (window.toggleWishlistItem) {
        window.toggleWishlistItem(productId);
      }
    },
    {
      successMessage: isWished ? null : `${productName} added to wishlist`,
      errorMessage: 'Failed to update wishlist',
      retry: true
    }
  );
}

/**
 * Optimistic order creation with undo
 * @param {Object} orderData - Order data
 * @param {Function} createFn - Create order function
 */
export async function optimisticCreateOrder(orderData, createFn) {
  // Show loading toast
  const loadingToast = window.showLoading?.('Creating order...');

  try {
    const result = await createFn(orderData);

    if (result.error) {
      throw new Error(result.error);
    }

    // Success
    loadingToast?.success('Order placed successfully!');
    
    return result;
  } catch (error) {
    // Error
    loadingToast?.error(error.message || 'Failed to create order');
    throw error;
  }
}

/**
 * Wraps a function with optimistic UI pattern
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Options
 * @returns {Function} Wrapped function
 */
export function withOptimisticUI(fn, options = {}) {
  return async function(...args) {
    const {
      optimisticUpdate: optimisticFn,
      rollback: rollbackFn,
      successMessage,
      errorMessage,
      showLoading = false
    } = options;

    let rollbackData = null;
    let loadingToast = null;

    try {
      // Show loading if configured
      if (showLoading && window.showLoading) {
        loadingToast = window.showLoading(showLoading);
      }

      // Apply optimistic update
      if (optimisticFn) {
        rollbackData = optimisticFn(...args);
      }

      // Execute function
      const result = await fn.apply(this, args);

      // Success
      if (loadingToast) {
        loadingToast.success(successMessage || 'Success');
      } else if (successMessage && window.showSuccess) {
        window.showSuccess(successMessage);
      }

      return result;
    } catch (error) {
      // Rollback
      if (rollbackFn && rollbackData !== null) {
        rollbackFn(rollbackData);
      }

      // Error
      const message = errorMessage || error.message || 'Operation failed';
      if (loadingToast) {
        loadingToast.error(message);
      } else if (window.showError) {
        window.showError(message);
      }

      throw error;
    }
  };
}

// Export for window access
if (typeof window !== 'undefined') {
  window.optimisticUpdate = optimisticUpdate;
  window.optimisticAddToCart = optimisticAddToCart;
  window.optimisticRemoveFromCart = optimisticRemoveFromCart;
  window.optimisticUpdateQuantity = optimisticUpdateQuantity;
  window.optimisticToggleWishlist = optimisticToggleWishlist;
  window.optimisticCreateOrder = optimisticCreateOrder;
  window.withOptimisticUI = withOptimisticUI;
}
