/**
 * ModArt Orders Module
 * Creates, fetches, and updates orders in Supabase.
 */

import { supabase, currentUser } from './auth.js';
import { cart }                  from './state.js';
import { decrementStock, validateCartStock } from './products.js';

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
 * Creates a new order in Supabase from the current cart.
 * Validates stock before inserting.
 * Returns { orderId, orderNumber, total, error }
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
    // Use override shipping cost (express=499, standard=149) or calculate from threshold
    const shipping = shippingOverride !== null ? shippingOverride : ((subtotal - discount) >= 2499 ? 0 : 149);
    const total    = subtotal - discount + shipping;
    const orderNum = 'MA-' + Date.now().toString().slice(-8);

    const payload = {
      order_number:     orderNum,
      user_id:          currentUser?.id || null,
      guest_email:      currentUser ? null : shippingAddress.email,
      items:            JSON.stringify(items),
      shipping_address: JSON.stringify(shippingAddress),
      subtotal_inr:     subtotal,
      discount_inr:     discount,
      shipping_inr:     shipping,
      total_inr:        total,
      status:           'pending',
      payment_method:   paymentMethod,
    };

    const { data, error } = await supabase.from('orders').insert(payload).select().single();
    if (error) throw error;
    return { orderId: data.id, orderNumber: data.order_number, total, error: null };
  } catch (e) {
    return { orderId: null, orderNumber: null, total: 0, error: e.message };
  }
}

/**
 * Confirms an order after successful payment.
 * Updates status, decrements inventory, increments coupon usage, sends confirmation email.
 */
export async function confirmOrder(orderId, paymentId = 'COD') {
  try {
    const { data: order, error: fetchErr } = await supabase
      .from('orders').select('*').eq('id', orderId).single();
    if (fetchErr) throw fetchErr;

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'confirmed', payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (updateErr) throw updateErr;

    const items = JSON.parse(order.items || '[]');
    for (const item of items) {
      await decrementStock(item.productId, item.size, item.qty);
    }

    // Increment coupon usage now that order is confirmed (not at validation time)
    const discountCode = window.getDiscountCode ? window.getDiscountCode() : null;
    if (discountCode && order.discount_inr > 0) {
      try {
        const SUPABASE_URL = 'https://ddodctzzsrlgyhtclabz.supabase.co';
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_coupon_usage`, {
          method: 'POST',
          headers: {
            'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2RjdHp6c3JsZ3lodGNsYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY5MzEsImV4cCI6MjA4OTA4MjkzMX0.Wfrlocx56uR_8-5EZoBajIzHt09GX_JcrBCSeZuVqMY',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2RjdHp6c3JsZ3lodGNsYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY5MzEsImV4cCI6MjA4OTA4MjkzMX0.Wfrlocx56uR_8-5EZoBajIzHt09GX_JcrBCSeZuVqMY',
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ p_code: discountCode }),
        }).catch(() => {});
      } catch {}
    }

    cart.items = [];
    cart.sync();
    // Clear persisted discount after successful order
    try { sessionStorage.removeItem('modart_discount'); } catch {}
    if (window.setDiscountApplied) window.setDiscountApplied(false);
    return { success: true, order };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Fetches all orders for the current logged-in user.
 */
export async function fetchUserOrders() {
  if (!currentUser) return [];
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('Orders fetch failed:', e.message);
    return [];
  }
}

/**
 * Updates order status (for admin use).
 * Sends tracking email when status → 'dispatched'.
 */
export async function updateOrderStatus(orderId, status, extra = {}) {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('id', orderId);
    if (error) throw error;

    if (status === 'dispatched' && extra.tracking_number) {
      const { data: order } = await supabase
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
 * Renders the orders page with real Supabase data.
 */
export async function renderOrdersPage() {
  const loadingEl   = document.getElementById('orders-loading');
  const emptyEl     = document.getElementById('orders-empty');
  const listEl      = document.getElementById('orders-list');
  const loggedOutEl = document.getElementById('orders-logged-out');
  if (!loadingEl) return;

  if (!currentUser) {
    loadingEl.style.display   = 'none';
    if (loggedOutEl) loggedOutEl.style.display = 'block';
    return;
  }

  const orders = await fetchUserOrders();
  loadingEl.style.display = 'none';

  if (orders.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (listEl) listEl.style.display = 'flex';

  const STATUS_STEPS  = { pending:0, confirmed:1, processing:1, packed:2, dispatched:3, delivered:4 };
  const STATUS_LABELS = { pending:'Pending', confirmed:'Confirmed', processing:'In Production', packed:'Packed', dispatched:'Dispatched', delivered:'Delivered' };
  const STATUS_COLORS = { pending:'var(--g3)', confirmed:'#F59E0B', processing:'#F59E0B', packed:'#F59E0B', dispatched:'var(--red)', delivered:'#22C55E' };
  const STEPS         = ['Placed','Confirmed','Packed','Dispatched','Delivered'];

  if (listEl) {
    listEl.innerHTML = orders.map(order => {
      const items = (() => { try { return JSON.parse(order.items || '[]'); } catch { return []; } })();
      const step  = STATUS_STEPS[order.status] ?? 0;
      const total = window.formatPrice ? window.formatPrice(order.total_inr) : '₹' + order.total_inr;
      const date  = new Date(order.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      // Use esc() for all user-supplied data to prevent XSS
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
 */
export async function handleCheckoutSubmit() {
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
  const { orderId, orderNumber, total, error } = await createOrder(shippingAddress, 'cod', shippingCost);

  if (error) {
    if (btn) { btn.textContent = 'Place Order — Cash on Delivery'; btn.disabled = false; }
    showCheckoutError('name', 'Could not place order: ' + error);
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
    const { data, error } = await supabase
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

if (typeof window !== 'undefined') {
  window.createOrder            = createOrder;
  window.confirmOrder           = confirmOrder;
  window.fetchUserOrders        = fetchUserOrders;
  window.updateOrderStatus      = updateOrderStatus;
  window.renderOrdersPage       = renderOrdersPage;
  window.handleCheckoutSubmit   = handleCheckoutSubmit;
  window.renderConfirmationPage = renderConfirmationPage;
  window.trackGuestOrder        = trackGuestOrder;
}
