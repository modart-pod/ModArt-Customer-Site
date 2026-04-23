/**
 * ModArt Inventory Reservation Module
 * 
 * ✅ SECURITY FIX: C-7 - Inventory reservation during checkout
 * 
 * Prevents overselling by reserving inventory during checkout.
 * Reservations expire after 10 minutes and are auto-released.
 */

import { supabase, getSupabase } from './auth.js';

// Helper: get live Supabase client
function sb() { return getSupabase() || supabase; }

// Session ID for tracking reservations (persists across page reloads)
let SESSION_ID = null;

// Active reservations for current session
let activeReservations = [];

// Countdown timer interval
let countdownInterval = null;

// Extension interval (extends reservation every 5 minutes if user is active)
let extensionInterval = null;

// Last user activity timestamp
let lastActivity = Date.now();

/**
 * Initializes the reservation system.
 * Generates or retrieves session ID from sessionStorage.
 */
export function initReservationSystem() {
  // Get or create session ID
  SESSION_ID = sessionStorage.getItem('modart_session_id');
  if (!SESSION_ID) {
    SESSION_ID = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('modart_session_id', SESSION_ID);
  }
  
  // Track user activity
  ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
      lastActivity = Date.now();
    }, { passive: true });
  });
  
  // Auto-release reservations on page unload
  window.addEventListener('beforeunload', () => {
    releaseAllReservations('Page closed');
  });
  
  // Start extension interval (extends reservations every 5 minutes if user is active)
  startExtensionInterval();
  
  console.log('✅ Reservation system initialized. Session:', SESSION_ID);
}

/**
 * Reserves inventory for a cart item.
 * 
 * @param {string} productId - Product ID
 * @param {string} size - Size
 * @param {number} quantity - Quantity to reserve
 * @param {number} durationMinutes - Reservation duration (default: 10)
 * @returns {Promise<{success: boolean, reservationId?: string, error?: string}>}
 */
export async function reserveInventory(productId, size, quantity, durationMinutes = 10) {
  try {
    const client = sb();
    if (!client) return { success: false, error: 'Supabase not available' };
    
    if (!SESSION_ID) {
      initReservationSystem();
    }
    
    const { data, error } = await client.rpc('reserve_inventory', {
      p_product_id:       productId,
      p_size:             size,
      p_quantity:         quantity,
      p_session_id:       SESSION_ID,
      p_user_id:          client.auth.user()?.id || null,
      p_duration_minutes: durationMinutes,
    });
    
    if (error) throw error;
    
    // Add to active reservations
    activeReservations.push({
      id:         data,
      productId,
      size,
      quantity,
      expiresAt:  new Date(Date.now() + durationMinutes * 60 * 1000),
    });
    
    console.log(`✅ Reserved ${quantity}x ${productId} (${size}) for ${durationMinutes} minutes`);
    
    return { success: true, reservationId: data };
  } catch (e) {
    console.error('Reservation failed:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Reserves inventory for all items in the cart.
 * 
 * @param {Array} cartItems - Array of cart items {productId, size, qty}
 * @returns {Promise<{success: boolean, reservations?: Array, errors?: Array}>}
 */
export async function reserveCartInventory(cartItems) {
  const reservations = [];
  const errors = [];
  
  for (const item of cartItems) {
    const result = await reserveInventory(item.productId, item.size, item.qty);
    if (result.success) {
      reservations.push(result.reservationId);
    } else {
      errors.push(`${item.productId} (${item.size}): ${result.error}`);
    }
  }
  
  if (errors.length > 0) {
    // Rollback successful reservations
    await releaseAllReservations('Partial reservation failed');
    return { success: false, errors };
  }
  
  // Start countdown timer
  startCountdownTimer();
  
  return { success: true, reservations };
}

/**
 * Releases all reservations for the current session.
 * 
 * @param {string} reason - Reason for release
 * @returns {Promise<{success: boolean, count?: number}>}
 */
export async function releaseAllReservations(reason = 'User action') {
  try {
    const client = sb();
    if (!client || !SESSION_ID) return { success: false };
    
    const { data, error } = await client.rpc('release_reservations', {
      p_session_id: SESSION_ID,
      p_reason:     reason,
    });
    
    if (error) throw error;
    
    activeReservations = [];
    stopCountdownTimer();
    
    console.log(`✅ Released ${data} reservation(s). Reason: ${reason}`);
    
    return { success: true, count: data };
  } catch (e) {
    console.error('Release failed:', e.message);
    return { success: false };
  }
}

/**
 * Releases a specific reservation.
 * 
 * @param {string} reservationId - Reservation ID
 * @param {string} reason - Reason for release
 * @returns {Promise<{success: boolean}>}
 */
export async function releaseReservation(reservationId, reason = 'User action') {
  try {
    const client = sb();
    if (!client) return { success: false };
    
    const { data, error } = await client.rpc('release_reservation', {
      p_reservation_id: reservationId,
      p_reason:         reason,
    });
    
    if (error) throw error;
    
    // Remove from active reservations
    activeReservations = activeReservations.filter(r => r.id !== reservationId);
    
    return { success: data };
  } catch (e) {
    console.error('Release failed:', e.message);
    return { success: false };
  }
}

/**
 * Extends a reservation by additional minutes.
 * 
 * @param {string} reservationId - Reservation ID
 * @param {number} additionalMinutes - Minutes to add (default: 5)
 * @returns {Promise<{success: boolean}>}
 */
export async function extendReservation(reservationId, additionalMinutes = 5) {
  try {
    const client = sb();
    if (!client) return { success: false };
    
    const { data, error } = await client.rpc('extend_reservation', {
      p_reservation_id:     reservationId,
      p_additional_minutes: additionalMinutes,
    });
    
    if (error) throw error;
    
    // Update local expiry
    const reservation = activeReservations.find(r => r.id === reservationId);
    if (reservation) {
      reservation.expiresAt = new Date(reservation.expiresAt.getTime() + additionalMinutes * 60 * 1000);
    }
    
    console.log(`✅ Extended reservation ${reservationId} by ${additionalMinutes} minutes`);
    
    return { success: data };
  } catch (e) {
    console.error('Extension failed:', e.message);
    return { success: false };
  }
}

/**
 * Gets active reservations for the current session.
 * 
 * @returns {Promise<Array>}
 */
export async function getSessionReservations() {
  try {
    const client = sb();
    if (!client || !SESSION_ID) return [];
    
    const { data, error } = await client.rpc('get_session_reservations', {
      p_session_id: SESSION_ID,
    });
    
    if (error) throw error;
    
    return data || [];
  } catch (e) {
    console.error('Failed to fetch reservations:', e.message);
    return [];
  }
}

/**
 * Starts the countdown timer UI.
 * Shows remaining time and auto-releases on expiry.
 */
function startCountdownTimer() {
  stopCountdownTimer(); // Clear any existing timer
  
  countdownInterval = setInterval(async () => {
    if (activeReservations.length === 0) {
      stopCountdownTimer();
      return;
    }
    
    // Find earliest expiry
    const earliest = activeReservations.reduce((min, r) => 
      r.expiresAt < min ? r.expiresAt : min, 
      activeReservations[0].expiresAt
    );
    
    const remaining = Math.max(0, Math.floor((earliest - Date.now()) / 1000));
    
    // Update UI
    updateCountdownUI(remaining);
    
    // Auto-release if expired
    if (remaining === 0) {
      await releaseAllReservations('Reservation expired');
      showExpiryNotification();
    }
  }, 1000);
}

/**
 * Stops the countdown timer.
 */
function stopCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  // Hide countdown UI
  const countdownEl = document.getElementById('reservation-countdown');
  if (countdownEl) countdownEl.style.display = 'none';
}

/**
 * Updates the countdown UI element.
 * 
 * @param {number} seconds - Remaining seconds
 */
function updateCountdownUI(seconds) {
  const countdownEl = document.getElementById('reservation-countdown');
  if (!countdownEl) return;
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;
  
  countdownEl.style.display = 'block';
  countdownEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--bg-c);border-radius:var(--r-md);border:1px solid var(--border)">
      <span class="material-symbols-outlined" style="font-size:18px;color:var(--red)">schedule</span>
      <span style="font-size:13px;font-weight:600;color:var(--g1)">
        Items reserved for <strong style="color:var(--red)">${timeStr}</strong>
      </span>
    </div>
  `;
  
  // Change color when < 2 minutes remaining
  if (seconds < 120) {
    countdownEl.style.animation = 'pulse 1s infinite';
  }
}

/**
 * Shows a notification when reservation expires.
 */
function showExpiryNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position:fixed;top:80px;left:50%;transform:translateX(-50%);
    background:var(--red);color:#fff;padding:16px 24px;
    border-radius:var(--r-md);font-size:13px;font-weight:600;
    z-index:10000;box-shadow:var(--shadow-lg);
    animation:slideDown 0.3s ease-out;
  `;
  notification.textContent = '⏰ Your reservation has expired. Please add items to cart again.';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Starts the extension interval.
 * Extends reservations every 5 minutes if user is active.
 */
function startExtensionInterval() {
  extensionInterval = setInterval(async () => {
    // Only extend if user was active in the last 2 minutes
    const inactiveTime = Date.now() - lastActivity;
    if (inactiveTime > 2 * 60 * 1000) {
      console.log('⏸️ User inactive, skipping reservation extension');
      return;
    }
    
    // Extend all active reservations
    for (const reservation of activeReservations) {
      await extendReservation(reservation.id, 5);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Stops the extension interval.
 */
function stopExtensionInterval() {
  if (extensionInterval) {
    clearInterval(extensionInterval);
    extensionInterval = null;
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.initReservationSystem    = initReservationSystem;
  window.reserveInventory         = reserveInventory;
  window.reserveCartInventory     = reserveCartInventory;
  window.releaseAllReservations   = releaseAllReservations;
  window.releaseReservation       = releaseReservation;
  window.extendReservation        = extendReservation;
  window.getSessionReservations   = getSessionReservations;
}

// Auto-initialize on load
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReservationSystem);
} else if (typeof window !== 'undefined') {
  initReservationSystem();
}
