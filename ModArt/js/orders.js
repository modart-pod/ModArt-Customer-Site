/**
 * ModArt Orders Module
 * Creates, fetches, and updates orders in Supabase.
 */

import { supabase, currentUser, getSupabase } from './auth.js';
import { cart }                  from './state.js';
import { decrementStock, rollbackStock, validateCartStock } from './products.js';

// Helper: get live Supabase client
function sb() { return getSupabase() || supabase; }

const EMAIL_FN_URL = '/api/send-order-email';

/** Sanitize a string for safe innerHTML insertion */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Rolls back stock for an entire order using the Supabase RPC.
 * Used when order confirmation fails.
 */
async function rollbackOrderStock(orderId, reason = 'Order failed') {
  try {
    const client = sb();
    if (!client) return { success: false };
    
    const { data, error } = await client.rpc('rollback_order_stock', {
      p_order_id: orderId,
      p_reason:   reason,
    });
    
    if (error) throw error;
    return { success: data !== false };
  } catch (e) {
    console.error('Order stock rollback failed:', e.message);
    return { success: false };
  }
}

/**
 * Sends an order-related email via the Netlify serverless function.
 * Never throws — failures are silent so they don't break the order flow.
 */
export async function sendOrderEmail(payload) {
  try {
    const res = await fetch(EMAIL_FN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resends order confirmation email
 * @param {string} orderNumber - Order number to resend email for
 */
export async function resendOrderEmail(orderNumber) {
  const btn = document.getElementById('resend-email-btn');
  if (btn) {
    btn.textContent = 'Sending...';
    btn.disabled = true;
  }
  
  try {
    // Get order details from sessionStorage
    const stored = sessionStorage.getItem('modart_last_order');
    if (!stored) {
      if (window.showError) {
        window.showError('Order details not found. Please check your email for the original confirmation.');
      }
      return;
    }
    
    const { orderNumber: storedOrderNum, total, items } = JSON.parse(stored);
    
    // Get shipping address from last checkout
    const checkoutEmail = document.querySelector('#page-checkout input[type="email"]')?.value?.trim();
    
    if (!checkoutEmail) {
      if (window.showError) {
        window.showError('Email address not found. Please contact support.');
      }
      return;
    }
    
    // Send email
    const success = await sendOrderEmail({
      type: 'order_confirmation',
      to: checkoutEmail,
      orderNumber: storedOrderNum,
      items: items || [],
      total: total,
      shippingAddress: { email: checkoutEmail }
    });
    
    if (success) {
      if (window.showSuccess) {
        window.showSuccess('Confirmation email resent successfully!');
      }
      if (btn) {
        btn.textContent = 'Sent ✓';
        setTimeout(() => {
          btn.textContent = 'Resend';
          btn.disabled = false;
        }, 3000);
      }
    } else {
      throw new Error('Email delivery failed');
    }
  } catch (error) {
    if (window.showError) {
      window.showError('Failed to resend email. Please try again or contact support.');
    }
    if (btn) {
      btn.textContent = 'Resend';
      btn.disabled = false;
    }
  }
}

/**
 * Generates a unique idempotency key for order creation.
 * Key is stored in sessionStorage and reused on retry.
 * 
 * @returns {string} Idempotency key (format: idem_timestamp_random)
 */
function getOrCreateIdempotencyKey() {
  const storageKey = 'modart_order_idempotency_key';
  
  // Check if we already have a key for this checkout session
  let key = null;
  try {
    key = sessionStorage.getItem(storageKey);
  } catch (e) {
    console.warn('SessionStorage not available:', e);
  }
  
  // Generate new key if none exists
  if (!key) {
    key = `idem_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    try {
      sessionStorage.setItem(storageKey, key);
    } catch (e) {
      console.warn('Failed to store idempotency key:', e);
    }
  }
  
  return key;
}

/**
 * Clears the idempotency key after successful order.
 * Allows new orders to be created.
 */
function clearIdempotencyKey() {
  try {
    sessionStorage.removeItem('modart_order_idempotency_key');
  } catch (e) {
    console.warn('Failed to clear idempotency key:', e);
  }
}

/**
 * Creates a new order in Supabase from the current cart.
 * Uses idempotency key to prevent duplicate orders.
 * Returns { orderId, orderNumber, total, isDuplicate, error }
 */
export async function createOrder(shippingAddress, paymentMethod = 'cod', shippingOverride = null) {
  try {
    const stockCheck = validateCartStock(cart.items);
    if (!stockCheck.valid) {
      return { orderId: null, orderNumber: null, total: 0, error: stockCheck.message };
    }

    const items = cart.items.map(item => ({
      productId:  item.productId,
      size:       item.size,
      qty:        item.qty,
      printAddon: item.printAddon || 0,
      price:      (window._PRODUCTS?.find(p => p.id === item.productId)?.price || 0) + (item.printAddon || 0),
      name:       window._PRODUCTS?.find(p => p.id === item.productId)?.name  || item.productId,
    }));

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const discPct  = (window.getDiscountPercent && window.getDiscountPercent()) || 0;
    const discount = discPct ? Math.round(subtotal * discPct / 100) : 0;
    const shipping = shippingOverride !== null ? shippingOverride : ((subtotal - discount) >= 2499 ? 0 : 149);
    const total    = subtotal - discount + shipping;
    const orderNum = 'MA-' + Date.now().toString().slice(-8);
    
    // Get or create idempotency key
    const idempotencyKey = getOrCreateIdempotencyKey();

    // Use idempotent RPC function
    const client = sb();
    if (!client) return { orderId: null, orderNumber: null, total: 0, error: 'Supabase not available' };
    
    const { data, error } = await client.rpc('create_order_idempotent', {
      p_idempotency_key:  idempotencyKey,
      p_order_number:     orderNum,
      p_user_id:          currentUser?.id || null,
      p_guest_email:      currentUser ? null : shippingAddress.email,
      p_items:            JSON.stringify(items),
      p_shipping_address: JSON.stringify(shippingAddress),
      p_subtotal_inr:     subtotal,
      p_discount_inr:     discount,
      p_shipping_inr:     shipping,
      p_total_inr:        total,
      p_payment_method:   paymentMethod,
    });
    
    if (error) throw error;
    
    // Check if this was a duplicate order
    if (data && data.length > 0) {
      const result = data[0];
      
      if (result.is_duplicate) {
        console.log('⚠️ Duplicate order detected, returning existing order:', result.order_number);
        return { 
          orderId: result.order_id, 
          orderNumber: result.order_number, 
          total, 
          isDuplicate: true,
          error: null 
        };
      }
      
      return { 
        orderId: result.order_id, 
        orderNumber: result.order_number, 
        total, 
        isDuplicate: false,
        error: null 
      };
    }
    
    return { orderId: null, orderNumber: null, total: 0, error: 'Order creation failed' };
  } catch (e) {
    return { orderId: null, orderNumber: null, total: 0, error: e.message };
  }
}

/**
 * Confirms an order after successful payment.
 * Updates status, decrements inventory, increments coupon usage, tracks drop sales, sends confirmation email.
 */
export async function confirmOrder(orderId, paymentId = 'COD') {
  try {
    const client = sb();
    if (!client) return { success: false, error: 'Supabase not available' };
    const { data: order, error: fetchErr } = await client
      .from('orders').select('*').eq('id', orderId).single();
    if (fetchErr) throw fetchErr;

    const { error: updateErr } = await client
      .from('orders')
      .update({ status: 'confirmed', payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (updateErr) throw updateErr;

    const items = JSON.parse(order.items || '[]');
    
    // Decrement stock with order ID for audit trail
    const stockErrors = [];
    for (const item of items) {
      const result = await decrementStock(item.productId, item.size, item.qty, orderId);
      if (!result.success) {
        stockErrors.push(`${item.productId} (${item.size}): ${result.error}`);
      }
    }
    
    // If any stock decrement failed, rollback the order
    if (stockErrors.length > 0) {
      // Rollback order status
      await client
        .from('orders')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', orderId);
      
      // Rollback any successful stock decrements
      await rollbackOrderStock(orderId, 'Stock decrement failed');
      
      return { 
        success: false, 
        error: `Stock decrement failed: ${stockErrors.join(', ')}` 
      };
    }

    // Increment coupon usage via RPC (cleaner than raw fetch)
    const discountCode = window.getDiscountCode ? window.getDiscountCode() : null;
    if (discountCode && order.discount_inr > 0) {
      try {
        // First, get the coupon ID
        const { data: couponData } = await client
          .from('coupons')
          .select('id')
          .eq('code', discountCode)
          .single();
        
        if (couponData) {
          // Increment global usage count
          await client.rpc('increment_coupon_usage', { p_code: discountCode });
          
          // Track per-user usage in coupon_uses table
          await client.from('coupon_uses').insert({
            coupon_id: couponData.id,
            user_id: currentUser?.id || null,
            guest_email: currentUser ? null : order.guest_email,
            order_id: orderId,
            used_at: new Date().toISOString()
          });
        }
      } catch (couponErr) {
        console.warn('Coupon tracking failed:', couponErr.message);
        // Don't fail the order if coupon tracking fails
      }
    }

    // Track drop sales — increment sold_units for any live drops containing purchased products
    for (const item of items) {
      try {
        const { data: liveDrops } = await client
          .from('drops')
          .select('id, product_ids')
          .eq('status', 'live')
          .eq('is_active', true);
        
        if (liveDrops && liveDrops.length > 0) {
          for (const drop of liveDrops) {
            // Check if this product is part of the drop
            if (drop.product_ids && drop.product_ids.includes(item.productId)) {
              await client.rpc('increment_drop_sold_units', {
                p_drop_id: drop.id,
                p_quantity: item.qty
              });
            }
          }
        }
      } catch (dropErr) {
        console.warn('Drop sales tracking failed:', dropErr.message);
        // Don't fail the order if drop tracking fails
      }
    }

    cart.items = [];
    cart.sync();
    // Clear persisted discount after successful order
    try { sessionStorage.removeItem('modart_discount'); } catch {}
    if (window.setDiscountApplied) window.setDiscountApplied(false);
    
    // Clear idempotency key to allow new orders
    clearIdempotencyKey();
    
    return { success: true, order };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Fetches all orders for the current logged-in user with pagination.
 * 
 * @param {Object} options - Pagination options
 * @param {number} options.limit - Number of orders per page (default: 20)
 * @param {string} options.cursor - Cursor for pagination (order ID)
 * @param {string} options.direction - 'next' or 'prev' (default: 'next')
 * @returns {Promise<{orders: Array, hasMore: boolean, nextCursor: string|null}>}
 */
export async function fetchUserOrders(options = {}) {
  if (!currentUser) return { orders: [], hasMore: false, nextCursor: null };
  
  const limit = options.limit || 20;
  const cursor = options.cursor || null;
  const direction = options.direction || 'next';
  
  try {
    const client = sb();
    if (!client) return { orders: [], hasMore: false, nextCursor: null };
    
    let query = client
      .from('orders')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more
    
    // Apply cursor-based pagination
    if (cursor) {
      if (direction === 'next') {
        query = query.lt('created_at', cursor);
      } else {
        query = query.gt('created_at', cursor);
      }
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    const orders = data || [];
    const hasMore = orders.length > limit;
    
    // Remove the extra item if we have more
    if (hasMore) {
      orders.pop();
    }
    
    // Get next cursor (created_at of last item)
    const nextCursor = orders.length > 0 
      ? orders[orders.length - 1].created_at 
      : null;
    
    return { orders, hasMore, nextCursor };
  } catch (e) {
    console.warn('Orders fetch failed:', e.message);
    return { orders: [], hasMore: false, nextCursor: null };
  }
}

/**
 * Updates order status (for admin use).
 * Sends tracking email when status → 'dispatched'.
 */
export async function updateOrderStatus(orderId, status, extra = {}) {
  try {
    const client = sb();
    if (!client) return { success: false, error: 'Supabase not available' };
    const { error } = await client
      .from('orders')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('id', orderId);
    if (error) throw error;

    if (status === 'dispatched' && extra.tracking_number) {
      const { data: order } = await client
        .from('orders').select('*').eq('id', orderId).single();
      if (order) {
        // Get recipient email from guest_email or shipping address
        const addr = (() => { try { return JSON.parse(order.shipping_address || '{}'); } catch { return {}; } })();
        const recipientEmail = order.guest_email || addr.email || null;
        if (recipientEmail) {
          sendOrderEmail({
            type:            'tracking_update',
            to:              recipientEmail,
            orderNumber:     order.order_number,
            trackingNumber:  extra.tracking_number,
            courier:         extra.courier || '',
            shippingAddress: addr,
          }).catch(() => {});
        }
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Renders the orders page with real Supabase data and pagination.
 * 
 * @param {Object} options - Rendering options
 * @param {boolean} options.append - Append to existing orders (for "Load More")
 * @param {string} options.cursor - Pagination cursor
 */
export async function renderOrdersPage(options = {}) {
  const loadingEl   = document.getElementById('orders-loading');
  const emptyEl     = document.getElementById('orders-empty');
  const listEl      = document.getElementById('orders-list');
  const loggedOutEl = document.getElementById('orders-logged-out');
  const loadMoreBtn = document.getElementById('orders-load-more');
  
  if (!loadingEl) return;

  if (!currentUser) {
    loadingEl.style.display   = 'none';
    if (loggedOutEl) loggedOutEl.style.display = 'block';
    return;
  }

  // Show loading only on initial load
  if (!options.append) {
    loadingEl.style.display = 'block';
  }

  const { orders, hasMore, nextCursor } = await fetchUserOrders({
    limit: 20,
    cursor: options.cursor || null
  });
  
  loadingEl.style.display = 'none';

  if (orders.length === 0 && !options.append) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  if (listEl) {
    if (!options.append) {
      listEl.style.display = 'flex';
      listEl.innerHTML = ''; // Clear existing orders
    }
    
    const STATUS_STEPS  = { pending:0, confirmed:1, processing:1, packed:2, dispatched:3, delivered:4 };
    const STATUS_LABELS = { pending:'Pending', confirmed:'Confirmed', processing:'In Production', packed:'Packed', dispatched:'Dispatched', delivered:'Delivered' };
    const STATUS_COLORS = { pending:'var(--g3)', confirmed:'#F59E0B', processing:'#F59E0B', packed:'#F59E0B', dispatched:'var(--red)', delivered:'#22C55E' };
    const STEPS         = ['Placed','Confirmed','Packed','Dispatched','Delivered'];

    const ordersHTML = orders.map(order => {
      const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();
      const step  = STATUS_STEPS[order.status] ?? 0;
      const total = window.formatPrice ? window.formatPrice(order.total_inr) : '₹' + order.total_inr;
      const date  = new Date(order.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      return `<div class="order-card">
        <div class="order-card-hdr">
          <div class="order-card-status" style="color:${STATUS_COLORS[order.status]||'var(--g2)'}">${esc(STATUS_LABELS[order.status]||order.status)}</div>
          <div class="order-card-num">${esc(order.order_number)}</div>
          <div class="order-card-meta">${esc(date)} · ${items.length} item${items.length!==1?'s':''} · ${esc(total)}</div>
        </div>
        <div class="tracking-stepper">
          <div class="stepper-track"><div class="stepper-fill" style="width:${(step/(STEPS.length-1))*100}%"></div></div>
          <div class="stepper-nodes">${STEPS.map((s,i)=>`<div class="stepper-node"><div class="stepper-dot ${i<step?'done':i===step?'active':''}"></div><span class="stepper-lbl ${i<step?'done':i===step?'active':''}">${esc(s)}</span></div>`).join('')}</div>
        </div>
        ${order.tracking_number?`<div style="padding:12px 0;font-size:12px;color:var(--g2);border-top:1px solid var(--border);margin-top:4px"><span style="font-weight:700;color:var(--black)">Tracking:</span> ${order.courier?esc(order.courier)+' — ':''}${esc(order.tracking_number)}</div>`:''}
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 0 4px;border-top:1px solid var(--border)">
          ${items.slice(0,3).map(item=>`<div style="font-size:11px;background:var(--bg-c);padding:4px 10px;border-radius:var(--r-full);color:var(--g1);font-weight:600">${esc(item.name)} · ${esc(item.size)}</div>`).join('')}
          ${items.length>3?`<div style="font-size:11px;color:var(--g3);padding:4px 0">+${items.length-3} more</div>`:''}
        </div>
      </div>`;
    }).join('');
    
    if (options.append) {
      listEl.innerHTML += ordersHTML;
    } else {
      listEl.innerHTML = ordersHTML;
    }
    
    // Show/hide "Load More" button
    if (loadMoreBtn) {
      if (hasMore) {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.onclick = () => {
          loadMoreBtn.textContent = 'Loading...';
          loadMoreBtn.disabled = true;
          renderOrdersPage({ append: true, cursor: nextCursor }).then(() => {
            loadMoreBtn.textContent = 'Load More Orders';
            loadMoreBtn.disabled = false;
          });
        };
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
  }
}

/**
 * Validates checkout form fields.
 * Returns { valid: true } or { valid: false, field: string, message: string }
 */
function validateCheckoutForm(fullName, email, phone, street, city, postal) {
  if (!fullName || fullName.length < 2)
    return { valid: false, field: 'name', message: 'Please enter your full name.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { valid: false, field: 'email', message: 'Please enter a valid email address.' };
  if (!phone || !/^\+?[\d\s\-]{8,15}$/.test(phone))
    return { valid: false, field: 'phone', message: 'Please enter a valid phone number.' };
  if (!street || street.length < 5)
    return { valid: false, field: 'street', message: 'Please enter a valid street address.' };
  if (!city || city.length < 2)
    return { valid: false, field: 'city', message: 'Please enter your city.' };
  if (!postal || !/^\d{6}$/.test(postal))
    return { valid: false, field: 'postal', message: 'Please enter a valid 6-digit PIN code.' };
  return { valid: true };
}

/** Shows an inline error under a checkout field */
function showCheckoutError(field, message) {
  // Clear all errors first
  document.querySelectorAll('#page-checkout .field-err').forEach(el => el.remove());
  document.querySelectorAll('#page-checkout .form-input').forEach(el => el.style.borderColor = '');

  if (!field || !message) return;

  const selectors = {
    name:   '#page-checkout input[autocomplete="name"]',
    email:  '#page-checkout input[autocomplete="email"], #page-checkout input[type="email"]',
    phone:  '#page-checkout input[autocomplete="tel"]',
    street: '#page-checkout input[autocomplete="street-address"]',
    city:   '#page-checkout .form-row-2 input:first-child',
    postal: '#page-checkout .form-row-2 input:last-child',
  };

  const input = document.querySelector(selectors[field]);
  if (input) {
    input.style.borderColor = 'var(--red)';
    const err = document.createElement('div');
    err.className = 'field-err';
    err.style.cssText = 'font-size:11px;color:var(--red);font-weight:600;margin-top:4px;letter-spacing:.02em';
    err.textContent = message;
    input.parentNode.appendChild(err);
    input.focus();
  }
}

/**
 * Handles checkout form submission and creates a real COD order.
 * Redirects to login if user is not authenticated.
 */
export async function handleCheckoutSubmit() {
  // ✅ Require login before checkout
  if (!currentUser) {
    sessionStorage.setItem('modart_checkout_redirect', '1');
    if (window.goTo) window.goTo('login');
    return;
  }

  const btn = document.getElementById('pay-now-btn');
  if (btn) { btn.textContent = 'Placing order…'; btn.disabled = true; }

  // Clear any previous inline errors
  showCheckoutError(null, null);

  const formRowInputs = document.querySelectorAll('#page-checkout .form-row-2 input[type="text"]');

  const fullName = document.querySelector('#page-checkout input[autocomplete="name"]')?.value?.trim();
  const email    = document.querySelector('#page-checkout input[autocomplete="email"], #page-checkout input[type="email"]')?.value?.trim();
  const phone    = document.querySelector('#page-checkout input[autocomplete="tel"]')?.value?.trim();
  const street   = document.querySelector('#page-checkout input[autocomplete="street-address"]')?.value?.trim();
  const city     = formRowInputs[0]?.value?.trim();
  const postal   = formRowInputs[1]?.value?.trim();
  const country  = document.querySelector('#page-checkout select')?.value || 'India';
  const shippingMethod = document.querySelector('#page-checkout input[name="shipping"]:checked')?.value || 'standard';

  // Fix: apply free shipping threshold correctly
  const subtotal = window.cart?.subtotal || 0;
  const shippingCost = shippingMethod === 'express' ? 499 : (subtotal >= 2499 ? 0 : 149);

  // Validate form — show inline errors instead of alert()
  const formCheck = validateCheckoutForm(fullName, email, phone, street, city, postal);
  if (!formCheck.valid) {
    if (btn) { btn.textContent = 'Place Order — Cash on Delivery'; btn.disabled = false; }
    showCheckoutError(formCheck.field, formCheck.message);
    return;
  }

  // Validate cart is not empty
  if (cart.items.length === 0) {
    if (btn) { btn.textContent = 'Place Order — Cash on Delivery'; btn.disabled = false; }
    showCheckoutError('name', 'Your cart is empty. Please add items before checking out.');
    return;
  }

  const shippingAddress = { fullName, email, phone, street, city, postal, country, shippingMethod };
  const { orderId, orderNumber, total, isDuplicate, error } = await createOrder(shippingAddress, 'cod', shippingCost);

  if (error) {
    if (btn) { btn.textContent = 'Place Order — Cash on Delivery'; btn.disabled = false; }
    showCheckoutError('name', 'Could not place order: ' + error);
    return;
  }
  
  // Handle duplicate order (user clicked submit multiple times)
  if (isDuplicate) {
    console.log('⚠️ Duplicate order detected, proceeding with existing order:', orderNumber);
    // Still proceed to confirmation - order already exists
    sessionStorage.setItem('modart_last_order', JSON.stringify({ orderNumber, total, items: cart.items }));
    window.goTo && window.goTo('confirmation');
    return;
  }

  // Save order to sessionStorage BEFORE clearing cart
  sessionStorage.setItem('modart_last_order', JSON.stringify({ orderNumber, total, items: cart.items }));

  const { success, error: confirmError, order } = await confirmOrder(orderId, 'COD');
  if (!success) {
    if (btn) { btn.textContent = 'Place Order — Cash on Delivery'; btn.disabled = false; }
    showCheckoutError('name', 'Order placed but confirmation failed: ' + confirmError);
    return;
  }

  sendOrderEmail({
    type:            'order_confirmation',
    to:              shippingAddress.email,
    orderNumber,
    items:           order?.items ? JSON.parse(order.items) : [],
    total,
    shippingAddress,
  }).catch(() => {});

  // Keep button disabled until navigation completes to prevent double-submit
  window.goTo && window.goTo('confirmation');
}

/**
 * Renders the confirmation page with the real order number from sessionStorage.
 * Falls back gracefully if sessionStorage was cleared.
 */
export function renderConfirmationPage() {
  const badge   = document.getElementById('confirmation-order-badge');
  const noteEl  = document.getElementById('confirmation-email-note');
  const stored  = sessionStorage.getItem('modart_last_order');

  if (!badge) return;

  if (!stored) {
    // sessionStorage cleared — show fallback message
    badge.textContent = 'Your order has been placed';
    if (noteEl) noteEl.style.display = 'block';
    return;
  }

  try {
    const { orderNumber, total, items } = JSON.parse(stored);
    const fmt = window.formatPrice ? window.formatPrice(total) : '₹' + total;
    badge.textContent = `${orderNumber} · ${items?.length||0} item${(items?.length||0)!==1?'s':''} · ${fmt}`;
    if (noteEl) noteEl.style.display = 'none';

    // Populate order summary
    const itemsEl = document.getElementById('confirmation-items');
    if (itemsEl && items && items.length > 0) {
      const src = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : [];
      itemsEl.style.display = 'block';
      itemsEl.innerHTML = `
        <div style="font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:12px">Order Summary</div>
        ${items.map(item => {
          const p = src.find(p => p.id === item.productId);
          const name = p ? p.name : (item.productId || 'Item');
          const lineTotal = window.formatPrice ? window.formatPrice((item.price || 0) * item.qty) : '₹' + ((item.price || 0) * item.qty);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:12px">
            <span style="color:rgba(255,255,255,.75)">${name} <span style="color:rgba(255,255,255,.35)">× ${item.qty} (${item.size})</span></span>
            <span style="font-weight:700;color:#fff">${lineTotal}</span>
          </div>`;
        }).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:10px;font-size:14px;font-weight:800">
          <span style="color:rgba(255,255,255,.6)">Total</span>
          <span style="color:#fff">${fmt}</span>
        </div>`;
    }
    
    // Add email confirmation status and resend button
    const emailStatusEl = document.getElementById('confirmation-email-status');
    if (emailStatusEl) {
      emailStatusEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:rgba(34,197,94,0.1);border-radius:8px;border-left:3px solid #22C55E;margin-top:16px">
          <span class="material-symbols-outlined" style="font-size:20px;color:#22C55E">check_circle</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:#166534">Confirmation email sent</div>
            <div style="font-size:11px;color:#166534;opacity:0.8">Check your inbox for order details</div>
          </div>
          <button id="resend-email-btn" onclick="window.resendOrderEmail && window.resendOrderEmail('${orderNumber}')" style="padding:6px 12px;background:none;border:1px solid #22C55E;border-radius:var(--r-full);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#166534;cursor:pointer;transition:all 0.2s">Resend</button>
        </div>`;
    }
  } catch (e) {
    badge.textContent = 'Your order has been placed';
    if (noteEl) noteEl.style.display = 'block';
  }
}

/**
 * Tracks a guest order by order number + email.
 * Queries Supabase for orders matching both fields.
 */
export async function trackGuestOrder() {
  const orderNumEl = document.getElementById('guest-order-num');
  const emailEl    = document.getElementById('guest-order-email');
  const errEl      = document.getElementById('guest-track-error');
  const listEl     = document.getElementById('orders-list');
  const loggedOutEl = document.getElementById('orders-logged-out');

  const orderNum = orderNumEl?.value?.trim().toUpperCase();
  const email    = emailEl?.value?.trim().toLowerCase();

  if (errEl) errEl.style.display = 'none';

  if (!orderNum) {
    if (errEl) { errEl.textContent = 'Please enter your order number.'; errEl.style.display = 'block'; }
    orderNumEl?.focus();
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; }
    emailEl?.focus();
    return;
  }

  const trackBtn = document.querySelector('#orders-logged-out .btn-red-full');
  if (trackBtn) { trackBtn.textContent = 'Searching…'; trackBtn.disabled = true; }

  try {
    const client = sb();
    if (!client) throw new Error('Supabase not available');
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('order_number', orderNum)
      .eq('guest_email', email)
      .limit(1);

    if (trackBtn) { trackBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">search</span> Track Order'; trackBtn.disabled = false; }

    if (error) throw error;

    if (!data || data.length === 0) {
      if (errEl) { errEl.textContent = 'No order found with that number and email. Please check and try again.'; errEl.style.display = 'block'; }
      return;
    }

    // Found — render the order card
    if (loggedOutEl) loggedOutEl.style.display = 'none';
    if (listEl) {
      listEl.style.display = 'flex';
      const STATUS_STEPS  = { pending:0, confirmed:1, processing:1, packed:2, dispatched:3, delivered:4 };
      const STATUS_LABELS = { pending:'Pending', confirmed:'Confirmed', processing:'In Production', packed:'Packed', dispatched:'Dispatched', delivered:'Delivered' };
      const STATUS_COLORS = { pending:'var(--g3)', confirmed:'#F59E0B', processing:'#F59E0B', packed:'#F59E0B', dispatched:'var(--red)', delivered:'#22C55E' };
      const STEPS = ['Placed','Confirmed','Packed','Dispatched','Delivered'];

      listEl.innerHTML = data.map(order => {
        const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();
        const step  = STATUS_STEPS[order.status] ?? 0;
        const total = window.formatPrice ? window.formatPrice(order.total_inr) : '₹' + order.total_inr;
        const date  = new Date(order.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        return `<div class="order-card">
          <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--g3);margin-bottom:8px">Guest Order</div>
          <div class="order-card-hdr">
            <div class="order-card-status" style="color:${STATUS_COLORS[order.status]||'var(--g2)'}">${esc(STATUS_LABELS[order.status]||order.status)}</div>
            <div class="order-card-num">${esc(order.order_number)}</div>
            <div class="order-card-meta">${esc(date)} · ${items.length} item${items.length!==1?'s':''} · ${esc(total)}</div>
          </div>
          <div class="tracking-stepper">
            <div class="stepper-track"><div class="stepper-fill" style="width:${(step/(STEPS.length-1))*100}%"></div></div>
            <div class="stepper-nodes">${STEPS.map((s,i)=>`<div class="stepper-node"><div class="stepper-dot ${i<step?'done':i===step?'active':''}"></div><span class="stepper-lbl ${i<step?'done':i===step?'active':''}">${esc(s)}</span></div>`).join('')}</div>
          </div>
          ${order.tracking_number?`<div style="padding:12px 0;font-size:12px;color:var(--g2);border-top:1px solid var(--border);margin-top:4px"><span style="font-weight:700;color:var(--black)">Tracking:</span> ${order.courier?esc(order.courier)+' — ':''}${esc(order.tracking_number)}</div>`:''}
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 0 4px;border-top:1px solid var(--border)">
            ${items.slice(0,3).map(item=>`<div style="font-size:11px;background:var(--bg-c);padding:4px 10px;border-radius:var(--r-full);color:var(--g1);font-weight:600">${esc(item.name)} · ${esc(item.size)}</div>`).join('')}
            ${items.length>3?`<div style="font-size:11px;color:var(--g3);padding:4px 0">+${items.length-3} more</div>`:''}
          </div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    if (trackBtn) { trackBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">search</span> Track Order'; trackBtn.disabled = false; }
    if (errEl) { errEl.textContent = 'Something went wrong. Please try again.'; errEl.style.display = 'block'; }
  }
}

/**
 * Allows a user to cancel their own order — only if status is still 'pending'.
 * @param {string} orderId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function cancelOrder(orderId) {
  if (!currentUser) return { success: false, error: 'Not logged in' };

  try {
    const client = sb();
    if (!client) return { success: false, error: 'Supabase not available' };

    // Fetch order and verify ownership + status
    const { data: order, error: fetchErr } = await client
      .from('orders')
      .select('id, status, user_id')
      .eq('id', orderId)
      .single();

    if (fetchErr || !order) return { success: false, error: 'Order not found' };
    if (order.user_id !== currentUser.id) return { success: false, error: 'Unauthorized' };
    if (order.status !== 'pending') {
      return { success: false, error: `Cannot cancel — order is already "${order.status}"` };
    }

    const { error: updateErr } = await client
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateErr) throw updateErr;

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

if (typeof window !== 'undefined') {
  window.createOrder            = createOrder;
  window.confirmOrder           = confirmOrder;
  window.fetchUserOrders        = fetchUserOrders;
  window.updateOrderStatus      = updateOrderStatus;
  window.renderOrdersPage       = renderOrdersPage;
  window.handleCheckoutSubmit   = handleCheckoutSubmit;
  window.renderConfirmationPage = renderConfirmationPage;
  window.trackGuestOrder        = trackGuestOrder;
  window.resendOrderEmail       = resendOrderEmail;
  window.cancelOrder            = cancelOrder;
}
