/**
 * ModArt Products Module
 * Fetches products and inventory from Supabase.
 * Falls back to hardcoded PRODUCTS array in state.js if fetch fails.
 */

import { supabase, getSupabase } from './auth.js';

export let LIVE_PRODUCTS  = [];
export let LIVE_INVENTORY = {};

// Use getSupabase() for all DB calls to handle the CDN race condition
function sb() { return getSupabase() || supabase; }

/**
 * Fetches all active products from Supabase.
 * Falls back to hardcoded state.js products if fetch fails.
 */
export async function fetchProducts() {
  try {
    const client = sb();
    if (!client) throw new Error('Supabase not available');
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      LIVE_PRODUCTS = data.map(p => ({
        id:               p.id,
        name:             p.name,
        series:           p.series,
        price:            p.price_inr,
        img:              p.images?.[0] || 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80',
        images:           p.images || [],
        stock:            0,
        badge:            p.badge || null,
        description:      p.description,
        fabric_gsm:       p.fabric_gsm,
        fabric_material:  p.fabric_material,
        fabric_origin:    p.fabric_origin,
        fabric_shrinkage: p.fabric_shrinkage,
        fabric_finish:    p.fabric_finish,
        print_durability: p.print_durability,
        tags:             p.tags || [],
      }));
    }
  } catch (e) {
    console.warn('Products fetch failed, using local fallback:', e.message);
  }
  return LIVE_PRODUCTS;
}

/**
 * Fetches inventory for all products.
 * Returns object keyed by product_id → { size: stock }
 */
export async function fetchInventory() {
  try {
    const client = sb();
    if (!client) throw new Error('Supabase not available');
    const { data, error } = await client
      .from('inventory')
      .select('product_id, size, stock');

    if (error) throw error;

    if (data) {
      LIVE_INVENTORY = {};
      data.forEach(row => {
        if (!LIVE_INVENTORY[row.product_id]) {
          LIVE_INVENTORY[row.product_id] = {};
        }
        LIVE_INVENTORY[row.product_id][row.size] = row.stock;
      });

      LIVE_PRODUCTS.forEach(p => {
        const inv  = LIVE_INVENTORY[p.id] || {};
        p.stock    = Object.values(inv).reduce((sum, s) => sum + s, 0);
        p.inventory = inv;
        p.badge    = p.stock === 0 ? 'Sold Out'
                   : p.stock <= 5  ? 'Low Stock'
                   : p.badge;
      });
    }
  } catch (e) {
    console.warn('Inventory fetch failed:', e.message);
  }
  return LIVE_INVENTORY;
}

/**
 * Returns available sizes for a product with stock counts.
 */
export function getSizesForProduct(productId) {
  const inv        = LIVE_INVENTORY[productId] || {};
  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  return SIZE_ORDER
    .filter(size => size in inv)
    .map(size => ({
      size,
      stock:     inv[size],
      available: inv[size] > 0,
    }));
}

/**
 * Syncs total stock count from LIVE_INVENTORY back to the product object
 * and window._PRODUCTS so the UI reflects the latest stock immediately.
 */
function _syncProductStock(productId) {
  const inv = LIVE_INVENTORY[productId] || {};
  const totalStock = Object.values(inv).reduce((s, v) => s + v, 0);
  const p = LIVE_PRODUCTS.find(p => p.id === productId);
  if (p) {
    p.stock = totalStock;
    p.badge = totalStock === 0 ? 'Sold Out' : totalStock <= 5 ? 'Low Stock' : p.badge;
  }
  if (typeof window !== 'undefined') {
    window.LIVE_INVENTORY = LIVE_INVENTORY;
    window._PRODUCTS      = LIVE_PRODUCTS;
  }
}

/**
 * Atomically decrements stock using a Supabase RPC to prevent overselling.
 * Falls back to read-then-write if RPC not available.
 */
export async function decrementStock(productId, size, quantity = 1) {
  try {
    const client = sb();
    if (!client) return { success: false, error: 'Supabase not available' };
    // Try atomic RPC first (prevents race conditions / overselling)
    const { data: rpcData, error: rpcErr } = await client.rpc('decrement_stock', {
      p_product_id: productId,
      p_size:       size,
      p_quantity:   quantity,
    });

    if (!rpcErr) {
      if (rpcData === false) throw new Error(`Insufficient stock for ${productId} size ${size}`);
      if (LIVE_INVENTORY[productId]) {
        LIVE_INVENTORY[productId][size] = Math.max(0, (LIVE_INVENTORY[productId][size] || 0) - quantity);
      }
      // Update total stock on the product object so UI reflects immediately
      _syncProductStock(productId);
      return { success: true };
    }

    // Fallback: read-then-write (less safe but works without RPC)
    const { data: current } = await client
      .from('inventory')
      .select('stock')
      .eq('product_id', productId)
      .eq('size', size)
      .single();

    if (!current || current.stock < quantity) {
      throw new Error(`Insufficient stock for ${productId} size ${size}`);
    }

    const { error } = await client
      .from('inventory')
      .update({ stock: current.stock - quantity, updated_at: new Date().toISOString() })
      .eq('product_id', productId)
      .eq('size', size);

    if (error) throw error;

    if (LIVE_INVENTORY[productId]) {
      LIVE_INVENTORY[productId][size] = current.stock - quantity;
    }
    _syncProductStock(productId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Validates that all cart items have sufficient stock before checkout.
 * Returns { valid: true } or { valid: false, message: string }
 */
export function validateCartStock(cartItems) {
  for (const item of cartItems) {
    const inv = LIVE_INVENTORY[item.productId];
    if (!inv) continue; // no inventory data — allow (fallback products)
    const available = inv[item.size] ?? 0;
    if (available < item.qty) {
      const productName = window._PRODUCTS?.find(p => p.id === item.productId)?.name || item.productId;
      return {
        valid:   false,
        message: `"${productName}" (${item.size}) only has ${available} left in stock.`,
      };
    }
  }
  return { valid: true };
}

/**
 * Initialises products and inventory together.
 * Real-time subscriptions are handled by realtime.js to avoid duplicate channels.
 */
export async function initProducts() {
  await fetchProducts();
  await fetchInventory();
  if (typeof window !== 'undefined') {
    window._PRODUCTS      = LIVE_PRODUCTS;
    window.LIVE_INVENTORY = LIVE_INVENTORY;
  }
  return LIVE_PRODUCTS;
}

if (typeof window !== 'undefined') {
  window.fetchProducts       = fetchProducts;
  window.fetchInventory      = fetchInventory;
  window.getSizesForProduct  = getSizesForProduct;
  window.decrementStock      = decrementStock;
  window.validateCartStock   = validateCartStock;
  window.initProducts        = initProducts;
}
