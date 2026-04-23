/**
 * ModArt Real-Time Sync Module
 *
 * Manages all Supabase Realtime subscriptions for the customer site.
 * Emits custom DOM events so any module can react to live changes.
 *
 * Events dispatched on window:
 *   - modart:product_updated   { detail: { record, eventType } }
 *   - modart:inventory_updated { detail: { record, eventType } }
 *   - modart:order_updated     { detail: { record, eventType } }
 *   - modart:new_order         { detail: { record } }
 *   - modart:drop_live         { detail: { record } }
 *   - modart:drop_updated      { detail: { record, eventType } }
 */

import { getSupabase } from './auth.js';

let _channel      = null;
let _orderChannel = null;
let _dropChannel  = null;
let _reconnectTimer = null;
const RECONNECT_DELAY_MS = 5000;

/**
 * Initialise all real-time subscriptions.
 * Safe to call multiple times — will not create duplicate channels.
 */
export function initRealtime() {
  const client = getSupabase();
  if (!client) {
    // Retry after a short delay if Supabase isn't ready yet
    if (!_reconnectTimer) {
      _reconnectTimer = setTimeout(() => { _reconnectTimer = null; initRealtime(); }, RECONNECT_DELAY_MS);
    }
    return;
  }
  _subscribeProductsAndInventory(client);
  _subscribeOrders(client);
  _subscribeDrops(client);
}

/**
 * Subscribe to products + inventory changes.
 * When admin adds/edits/deletes a product or updates stock,
 * the customer site re-fetches and re-renders automatically.
 */
function _subscribeProductsAndInventory(client) {
  if (_channel) return; // already subscribed

  _channel = client
    .channel('modart-customer-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload) => {
        window.dispatchEvent(new CustomEvent('modart:product_updated', {
          detail: { record: payload.new || payload.old, eventType: payload.eventType }
        }));

        // Re-fetch and re-render products
        if (window.fetchProducts && window.fetchInventory) {
          await window.fetchProducts();
          await window.fetchInventory();
          window._PRODUCTS = window.LIVE_PRODUCTS || [];
          _rerenderProducts();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory' },
      async (payload) => {
        window.dispatchEvent(new CustomEvent('modart:inventory_updated', {
          detail: { record: payload.new || payload.old, eventType: payload.eventType }
        }));

        if (window.fetchInventory) {
          await window.fetchInventory();
          window.LIVE_INVENTORY = window.LIVE_INVENTORY || {};
          _rerenderProducts();

          // Re-render size options if product detail page is open
          const page = window.getCurrentPage ? window.getCurrentPage() : '';
          if (page === 'product' && window._currentProductId) {
            window.renderSizeOptions && window.renderSizeOptions(window._currentProductId);
          }
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[ModArt RT] Product/inventory channel active');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[ModArt RT] Product/inventory channel error — reconnecting in', RECONNECT_DELAY_MS, 'ms', err);
        _channel = null;
        setTimeout(() => {
          const c = getSupabase();
          if (c) _subscribeProductsAndInventory(c);
        }, RECONNECT_DELAY_MS);
      }
    });
}

/**
 * Subscribe to order changes.
 * Customers see their order status update in real-time.
 */
function _subscribeOrders(client) {
  if (_orderChannel) return;

  _orderChannel = client
    .channel('modart-order-sync')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        window.dispatchEvent(new CustomEvent('modart:new_order', {
          detail: { record: payload.new }
        }));
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        window.dispatchEvent(new CustomEvent('modart:order_updated', {
          detail: { record: payload.new, eventType: 'UPDATE' }
        }));

        // If orders page is open, refresh it
        const page = window.getCurrentPage ? window.getCurrentPage() : '';
        if (page === 'orders') {
          window.renderOrdersPage && window.renderOrdersPage();
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[ModArt RT] Order channel active');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[ModArt RT] Order channel error — reconnecting', err);
        _orderChannel = null;
        setTimeout(() => {
          const c = getSupabase();
          if (c) _subscribeOrders(c);
        }, RECONNECT_DELAY_MS);
      }
    });
}

/**
 * Subscribe to drops changes.
 * When admin goes live with a drop, customers see it instantly.
 * Dispatches modart:drop_live when a drop status changes to 'live'.
 */
function _subscribeDrops(client) {
  if (_dropChannel) return;

  _dropChannel = client
    .channel('modart-drops-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'drops' },
      (payload) => {
        const record = payload.new || payload.old;

        // Emit generic update event
        window.dispatchEvent(new CustomEvent('modart:drop_updated', {
          detail: { record, eventType: payload.eventType }
        }));

        // Emit specific live event when a drop goes live
        if (payload.eventType === 'UPDATE' && payload.new?.status === 'live') {
          window.dispatchEvent(new CustomEvent('modart:drop_live', {
            detail: { record: payload.new }
          }));
          // Show a live drop notification banner if on home page
          _showDropLiveBanner(payload.new);
        }

        // Re-render drops section on home page
        if (window.renderDropsSection) {
          window.renderDropsSection();
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[ModArt RT] Drops channel active');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[ModArt RT] Drops channel error — reconnecting', err);
        _dropChannel = null;
        setTimeout(() => {
          const c = getSupabase();
          if (c) _subscribeDrops(c);
        }, RECONNECT_DELAY_MS);
      }
    });
}

/**
 * Shows a non-intrusive banner when a drop goes live.
 */
function _showDropLiveBanner(drop) {
  // Remove any existing banner
  const existing = document.getElementById('modart-drop-live-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'modart-drop-live-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#D72638', 'color:#fff', 'padding:14px 24px',
    'border-radius:9999px', 'font-family:var(--font,sans-serif)',
    'font-size:12px', 'font-weight:700', 'letter-spacing:.1em',
    'text-transform:uppercase', 'z-index:99999',
    'box-shadow:0 8px 32px rgba(215,38,56,.45)',
    'display:flex', 'align-items:center', 'gap:10px',
    'animation:fadeUp .3s ease', 'cursor:pointer',
  ].join(';');
  banner.innerHTML = `
    <span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:blink 1s ease infinite;flex-shrink:0"></span>
    DROP LIVE: ${drop.name || 'New Drop'} — Shop Now
    <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:14px;line-height:1;padding:0;margin-left:4px">×</button>
  `;
  banner.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    banner.remove();
    if (window.goTo) window.goTo('shop');
  });
  document.body.appendChild(banner);
  // Auto-dismiss after 12 seconds
  setTimeout(() => banner.remove(), 12000);
}

/**
 * Re-render product grids on home and shop pages.
 */
function _rerenderProducts() {
  window.renderProducts && window.renderProducts('home');
  window.renderProducts && window.renderProducts('shop');
}

/**
 * Tear down all subscriptions (call on logout or page unload).
 */
export function destroyRealtime() {
  const client = getSupabase();
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (!client) return;
  if (_channel)      { client.removeChannel(_channel);      _channel      = null; }
  if (_orderChannel) { client.removeChannel(_orderChannel); _orderChannel = null; }
  if (_dropChannel)  { client.removeChannel(_dropChannel);  _dropChannel  = null; }
}

// Expose globally for non-module contexts
if (typeof window !== 'undefined') {
  window.initRealtime    = initRealtime;
  window.destroyRealtime = destroyRealtime;
}
