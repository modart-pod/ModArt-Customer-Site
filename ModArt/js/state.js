/* ================================================================
   STATE MANAGEMENT MODULE
   ================================================================ */

/* ================================================================
   PRODUCTS STATE — fallback data used when Supabase is unavailable
   ================================================================ */
export const PRODUCTS = [
  {id:'vanta-tee',     name:'Vanta Black Tee',       series:'Modart Studio',    price:9999,  img:'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&q=80', stock:5,  badge:'New'},
  {id:'elfima-hoodie', name:'Elfima Hoodie',          series:'Craftsmanship',    price:18199, img:'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', stock:3,  badge:'Low Stock'},
  {id:'cargo-pants',   name:'Grid Cargo Pants',       series:'Industrial Line',  price:14599, img:'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80', stock:8,  badge:null},
  {id:'vanta-hoodie',  name:'Vanta Black Hoodie',     series:'Vanta Collection', price:19999, img:'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80', stock:7,  badge:'Drop 02'},
  {id:'knit-sweater',  name:'Boxy Knit Sweater',      series:'Essential Knit',   price:15399, img:'https://images.unsplash.com/photo-1580657018950-c7f7d6a6d990?w=600&q=80', stock:12, badge:null},
  {id:'neo-tee',       name:'Neo-Tokyo Tee',          series:'Cyber Core',       price:7899,  img:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', stock:0,  badge:'Sold Out'},
];

/* ================================================================
   WISHLIST STATE — persisted to localStorage
   ================================================================ */
function loadWishlist() {
  try {
    const saved = localStorage.getItem('modart_wishlist');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

function saveWishlist() {
  try {
    localStorage.setItem('modart_wishlist', JSON.stringify([...wishlist]));
  } catch {}
}

export const wishlist = loadWishlist();

export function toggleWishlistItem(id) {
  if (wishlist.has(id)) wishlist.delete(id);
  else wishlist.add(id);
  saveWishlist();
  // Sync to Supabase for logged-in users
  if (typeof window !== 'undefined' && window.syncWishlistToSupabase) {
    window.syncWishlistToSupabase();
  }
}

/* ================================================================
   CART STATE
   ================================================================ */
export const cart = {
  items: [],

  add(id, size = 'M', printAddon = 0) {
    const ex = this.items.find(i => i.productId === id && i.size === size && (i.printAddon || 0) === printAddon);
    ex ? ex.qty++ : this.items.push({ productId: id, qty: 1, size, printAddon });
    this.sync();
  },

  remove(id, size) {
    // Remove by id+size if size provided, else remove all sizes of that id
    this.items = size
      ? this.items.filter(i => !(i.productId === id && i.size === size))
      : this.items.filter(i => i.productId !== id);
    this.sync();
  },

  updateQty(id, delta, size) {
    const item = size
      ? this.items.find(i => i.productId === id && i.size === size)
      : this.items.find(i => i.productId === id);
    if (item) {
      // Cap at available stock if inventory data exists
      const inv = window.LIVE_INVENTORY?.[id];
      const maxStock = inv ? (inv[item.size] ?? 99) : 99;
      item.qty = Math.min(maxStock, Math.max(1, item.qty + delta));
      this.sync();
    }
  },

  get count() {
    return this.items.reduce((s, i) => s + i.qty, 0);
  },

  get subtotal() {
    const src = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
    return this.items.reduce((s, i) => {
      const p = src.find(p => p.id === i.productId);
      return s + (p ? (p.price + (i.printAddon || 0)) * i.qty : 0);
    }, 0);
  },

  sync() {
    if (typeof window !== 'undefined') {
      if (window.saveCartLocal)      window.saveCartLocal();
      if (window.syncCartToSupabase) window.syncCartToSupabase();
      if (window.renderBag)          window.renderBag();
      if (window.updateBadges)       window.updateBadges();
    }
  },
};

/* ================================================================
   DISCOUNT STATE
   ================================================================ */
export let discountApplied = false;
export let discountPercent = 0;
export let discountCode    = '';

export function setDiscountApplied(value, percent = 10, code = '') {
  discountApplied = value;
  discountPercent = value ? percent : 0;
  discountCode    = value ? code : '';
}

if (typeof window !== 'undefined') {
  window.getDiscountPercent = () => discountPercent;
  window.getDiscountCode    = () => discountCode;
}

/* ================================================================
   CART HELPER FUNCTIONS
   ================================================================ */
export function addToCart(id, size = 'M') {
  cart.add(id, size);
}

/**
 * Adds the currently customized product to cart.
 * Uses the selected product from the customizer if available.
 */
export function addCustToCart() {
  const productId = window._customizerProductId || 'vanta-hoodie';
  const size      = document.querySelector('#page-customize .size-btn.sel')?.dataset?.size || 'M';
  cart.add(productId, size);
  if (typeof window !== 'undefined' && window.goTo) window.goTo('bag');
}

if (typeof window !== 'undefined') {
  window.addToCart    = addToCart;
  window.addCustToCart = addCustToCart;
  window._PRODUCTS    = PRODUCTS;
  window.cart         = cart;
}
