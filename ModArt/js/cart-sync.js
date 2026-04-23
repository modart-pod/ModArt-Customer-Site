/**
 * ModArt Cross-Tab Cart Synchronization
 * 
 * DATA INTEGRITY FIX: H-12 - Concurrent cart corruption
 * 
 * Prevents cart data loss when multiple tabs are open.
 * Uses BroadcastChannel API for real-time sync across tabs.
 * Falls back to storage events for older browsers.
 */

import { cart } from './state.js';
import { saveCartLocal } from './cart-persist.js';

// BroadcastChannel for modern browsers
let cartChannel = null;

// Track last update timestamp to prevent loops
let lastUpdateTimestamp = Date.now();

// Debounce timer for sync
let syncDebounceTimer = null;

/**
 * Initializes cross-tab cart synchronization.
 * Uses BroadcastChannel if available, falls back to storage events.
 */
export function initCartSync() {
  // Try to create BroadcastChannel (not supported in all browsers)
  try {
    cartChannel = new BroadcastChannel('modart_cart_sync');
    
    // Listen for cart updates from other tabs
    cartChannel.onmessage = (event) => {
      handleCartUpdate(event.data);
    };
    
    console.log('✅ Cross-tab cart sync initialized (BroadcastChannel)');
  } catch (e) {
    console.log('⚠️ BroadcastChannel not supported, using storage events');
    
    // Fallback: listen for storage events
    window.addEventListener('storage', (event) => {
      if (event.key === 'modart_cart' && event.newValue) {
        try {
          const items = JSON.parse(event.newValue);
          handleCartUpdate({ items, timestamp: Date.now(), source: 'storage' });
        } catch (err) {
          console.error('Failed to parse cart from storage event:', err);
        }
      }
    });
  }
  
  // Listen for cart changes in current tab
  observeCartChanges();
}

/**
 * Handles cart updates from other tabs.
 * Merges changes using last-write-wins strategy.
 * 
 * @param {Object} data - Cart update data {items, timestamp, source}
 */
function handleCartUpdate(data) {
  const { items, timestamp, source } = data;
  
  // Ignore our own updates (prevent loops)
  if (timestamp <= lastUpdateTimestamp) {
    return;
  }
  
  // Ignore if no items
  if (!Array.isArray(items)) {
    return;
  }
  
  console.log(`📦 Cart updated from ${source || 'another tab'}:`, items.length, 'items');
  
  // Merge strategy: last-write-wins with conflict resolution
  const merged = mergeCartItems(cart.items, items, timestamp);
  
  // Update local cart
  cart.items = merged;
  lastUpdateTimestamp = timestamp;
  
  // Update UI
  if (window.updateBadges) window.updateBadges();
  if (window.renderCart) window.renderCart();
  
  // Show notification
  showSyncNotification(items.length);
}

/**
 * Merges cart items from two sources.
 * Uses last-write-wins strategy with quantity conflict resolution.
 * 
 * @param {Array} localItems - Current cart items
 * @param {Array} remoteItems - Items from other tab
 * @param {number} remoteTimestamp - Timestamp of remote update
 * @returns {Array} Merged cart items
 */
function mergeCartItems(localItems, remoteItems, remoteTimestamp) {
  const merged = [];
  const processedKeys = new Set();
  
  // Process remote items (they win in conflicts)
  remoteItems.forEach(remoteItem => {
    const key = `${remoteItem.productId}_${remoteItem.size}`;
    processedKeys.add(key);
    merged.push({ ...remoteItem });
  });
  
  // Add local items that don't exist in remote
  localItems.forEach(localItem => {
    const key = `${localItem.productId}_${localItem.size}`;
    if (!processedKeys.has(key)) {
      merged.push({ ...localItem });
    }
  });
  
  return merged;
}

/**
 * Broadcasts cart changes to other tabs.
 * Debounced to prevent excessive messages.
 */
function broadcastCartUpdate() {
  // Clear existing timer
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  
  // Debounce: wait 100ms before broadcasting
  syncDebounceTimer = setTimeout(() => {
    const timestamp = Date.now();
    lastUpdateTimestamp = timestamp;
    
    const message = {
      items: cart.items,
      timestamp,
      source: 'current_tab'
    };
    
    // Broadcast via BroadcastChannel
    if (cartChannel) {
      try {
        cartChannel.postMessage(message);
      } catch (e) {
        console.error('Failed to broadcast cart update:', e);
      }
    }
    
    // Also update localStorage (for storage event fallback)
    saveCartLocal();
  }, 100);
}

/**
 * Observes cart changes and broadcasts to other tabs.
 * Uses Proxy to intercept cart.items modifications.
 */
function observeCartChanges() {
  // Wrap cart.items array with Proxy
  const originalItems = cart.items;
  
  // Create proxy handler
  const handler = {
    set(target, property, value) {
      // Set the value
      target[property] = value;
      
      // Broadcast change
      broadcastCartUpdate();
      
      return true;
    }
  };
  
  // Replace cart.items with proxied array
  cart.items = new Proxy(originalItems, handler);
  
  // Also intercept cart.sync() method
  const originalSync = cart.sync;
  cart.sync = function() {
    originalSync.call(cart);
    broadcastCartUpdate();
  };
}

/**
 * Shows a notification when cart is updated from another tab.
 * 
 * @param {number} itemCount - Number of items in updated cart
 */
function showSyncNotification(itemCount) {
  // Check if notification already shown recently
  const lastNotification = sessionStorage.getItem('modart_last_cart_sync_notification');
  const now = Date.now();
  
  if (lastNotification && (now - parseInt(lastNotification)) < 5000) {
    return; // Don't spam notifications
  }
  
  sessionStorage.setItem('modart_last_cart_sync_notification', now.toString());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: var(--black);
    color: #fff;
    padding: 12px 20px;
    border-radius: var(--r-md);
    font-size: 13px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: var(--shadow-lg);
    animation: slideInRight 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  notification.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 18px;">sync</span>
    <span>Cart synced (${itemCount} item${itemCount !== 1 ? 's' : ''})</span>
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Manually triggers cart sync across tabs.
 * Useful for testing or forcing sync.
 */
export function forceSyncCart() {
  broadcastCartUpdate();
  console.log('✅ Cart sync forced');
}

/**
 * Closes the BroadcastChannel (cleanup).
 * Call this on page unload if needed.
 */
export function closeCartSync() {
  if (cartChannel) {
    cartChannel.close();
    cartChannel = null;
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.initCartSync = initCartSync;
  window.forceSyncCart = forceSyncCart;
  window.closeCartSync = closeCartSync;
}

// Auto-initialize on load
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCartSync);
} else if (typeof window !== 'undefined') {
  initCartSync();
}

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
