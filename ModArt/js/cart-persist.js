/**
 * ModArt Cart Persistence
 * Saves cart to localStorage immediately (works without login).
 * Syncs to Supabase carts table when user is logged in.
 * Auth-safe: sync is deferred until auth state is confirmed.
 */
import { cart } from './state.js';
import { supabase, getSupabase } from './auth.js';

const LS_KEY = 'modart_cart';

// Helper: get live client
function sb() { return getSupabase() || supabase; }

// Track whether auth has resolved so we don't sync prematurely
let _authReady = false;

export function markAuthReady() {
  _authReady = true;
}

export function saveCartLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cart.items));
  } catch (e) {}
}

export function loadCartLocal() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const items = JSON.parse(saved);
      if (Array.isArray(items)) {
        cart.items = items;
      }
    }
  } catch (e) {}
}

export async function syncCartToSupabase() {
  // Only sync after auth has resolved and user is logged in
  if (!_authReady) return;
  const user = window.currentUser;
  const client = sb();
  if (!user || !client) return;
  try {
    await client.from('carts').upsert({
      user_id:    user.id,
      items:      JSON.stringify(cart.items),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (e) {}
}

export async function loadCartFromSupabase() {
  const user = window.currentUser;
  const client = sb();
  if (!user || !client) return;
  try {
    const { data } = await client
      .from('carts')
      .select('items')
      .eq('user_id', user.id)
      .single();
    if (data?.items) {
      const items = JSON.parse(data.items);
      if (Array.isArray(items)) {
        // Merge: keep local items not in cloud, prefer cloud quantities
        const merged = [...items];
        cart.items.forEach(local => {
          const exists = merged.find(c => c.productId === local.productId && c.size === local.size);
          if (!exists) merged.push(local);
        });
        cart.items = merged;
        saveCartLocal();
      }
    }
  } catch (e) {}
}

export async function initCartPersistence() {
  // 1. Load from localStorage immediately (fast, no network)
  loadCartLocal();
  // 2. Then merge with Supabase cloud cart (if logged in)
  await loadCartFromSupabase();
  // 3. Update badges after cart is loaded
  if (window.updateBadges) window.updateBadges();
}

if (typeof window !== 'undefined') {
  window.saveCartLocal       = saveCartLocal;
  window.syncCartToSupabase  = syncCartToSupabase;
  window.initCartPersistence = initCartPersistence;
  window.markAuthReady       = markAuthReady;
}
