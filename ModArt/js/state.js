/* ================================================================
   STATE MANAGEMENT MODULE
   ================================================================ */

/* ================================================================
   PRODUCTS STATE — fallback data used when Supabase is unavailable
   Synced with database seed data from supabase_setup_complete.sql
   ================================================================ */
export const PRODUCTS = [
  {
    id: 'vanta-tee',
    name: 'Vanta Black Tee',
    series: 'Modart Studio',
    price: 9999,
    img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'
    ],
    stock: 17,
    badge: 'New',
    description: 'A clean, structured tee built from 220 GSM ring-spun cotton. Minimal by design, maximum in quality.',
    fabric_gsm: '220 GSM',
    fabric_material: '100% Ring-Spun Cotton',
    fabric_origin: 'India',
    fabric_shrinkage: '<2%',
    fabric_finish: 'Matte',
    print_durability: '50+ Washes',
    tags: ['tee', 'minimal', 'cotton', 'black']
  },
  {
    id: 'elfima-hoodie',
    name: 'Elfima Hoodie',
    series: 'Craftsmanship',
    price: 18199,
    img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
    images: [
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800'
    ],
    stock: 8,
    badge: 'Low Stock',
    description: 'Heavyweight hoodie with a structured silhouette. Brushed fleece interior for warmth without bulk.',
    fabric_gsm: '380 GSM',
    fabric_material: '80% Cotton 20% Polyester',
    fabric_origin: 'Portugal',
    fabric_shrinkage: '<3%',
    fabric_finish: 'Brushed',
    print_durability: '50+ Washes',
    tags: ['hoodie', 'heavyweight', 'fleece', 'winter']
  },
  {
    id: 'cargo-pants',
    name: 'Grid Cargo Pants',
    series: 'Industrial Line',
    price: 14599,
    img: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800',
    images: [
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800',
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800'
    ],
    stock: 15,
    badge: null,
    description: 'Utility-forward cargo pants with a relaxed fit. Reinforced seams and deep pockets built for everyday wear.',
    fabric_gsm: '280 GSM',
    fabric_material: '100% Cotton Twill',
    fabric_origin: 'India',
    fabric_shrinkage: '<2%',
    fabric_finish: 'Washed',
    print_durability: '60+ Washes',
    tags: ['pants', 'cargo', 'utility', 'cotton']
  },
  {
    id: 'vanta-hoodie',
    name: 'Vanta Black Hoodie',
    series: 'Vanta Collection',
    price: 19999,
    img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
    images: [
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
      'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800'
    ],
    stock: 22,
    badge: 'Drop 02',
    description: 'Engineered for the modern minimalist. Oversized silhouette crafted from rare high-density Supima cotton.',
    fabric_gsm: '400 GSM',
    fabric_material: '100% Supima Cotton',
    fabric_origin: 'Portugal',
    fabric_shrinkage: '<2%',
    fabric_finish: 'Matte',
    print_durability: '50+ Washes',
    tags: ['hoodie', 'premium', 'supima', 'oversized', 'black']
  },
  {
    id: 'knit-sweater',
    name: 'Boxy Knit Sweater',
    series: 'Essential Knit',
    price: 15399,
    img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800',
    images: [
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800',
      'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800'
    ],
    stock: 21,
    badge: null,
    description: 'A relaxed boxy knit with a dropped shoulder. Made from a premium cotton-wool blend for year-round wear.',
    fabric_gsm: '320 GSM',
    fabric_material: '70% Cotton 30% Wool',
    fabric_origin: 'Portugal',
    fabric_shrinkage: '<3%',
    fabric_finish: 'Natural',
    print_durability: '40+ Washes',
    tags: ['sweater', 'knit', 'wool', 'boxy']
  },
  {
    id: 'neo-tee',
    name: 'Neo-Tokyo Tee',
    series: 'Cyber Core',
    price: 7899,
    img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800'
    ],
    stock: 0,
    badge: 'Sold Out',
    description: 'Inspired by the neon-lit streets of Tokyo. Lightweight and breathable with a subtle texture weave.',
    fabric_gsm: '200 GSM',
    fabric_material: '100% Combed Cotton',
    fabric_origin: 'India',
    fabric_shrinkage: '<2%',
    fabric_finish: 'Smooth',
    print_durability: '50+ Washes',
    tags: ['tee', 'lightweight', 'cotton', 'graphic']
  },
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
   CART STATE - Improved with immutability helpers
   ================================================================ */

/**
 * Creates a snapshot of current cart state for testing/rollback
 * @returns {Object} Cart state snapshot
 */
function createCartSnapshot() {
  return {
    items: JSON.parse(JSON.stringify(cart.items)),
    timestamp: Date.now(),
  };
}

/**
 * Restores cart from a snapshot
 * @param {Object} snapshot - Cart snapshot to restore
 */
function restoreCartSnapshot(snapshot) {
  cart.items = JSON.parse(JSON.stringify(snapshot.items));
  cart.sync();
}

export const cart = {
  items: [],
  _snapshots: [],

  /**
   * Creates a snapshot before mutation (for testing/rollback)
   */
  snapshot() {
    const snap = createCartSnapshot();
    this._snapshots.push(snap);
    // Keep only last 10 snapshots
    if (this._snapshots.length > 10) {
      this._snapshots.shift();
    }
    return snap;
  },

  /**
   * Restores to previous snapshot
   */
  rollback() {
    if (this._snapshots.length > 0) {
      const snap = this._snapshots.pop();
      restoreCartSnapshot(snap);
      return true;
    }
    return false;
  },

  /**
   * Clears all snapshots
   */
  clearSnapshots() {
    this._snapshots = [];
  },

  add(id, size = 'M', printAddon = 0) {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      console.error('Invalid product ID');
      return false;
    }

    const ex = this.items.find(i => i.productId === id && i.size === size && (i.printAddon || 0) === printAddon);
    
    if (ex) {
      // Immutable update
      ex.qty++;
    } else {
      // Immutable add
      this.items.push({ productId: id, qty: 1, size, printAddon });
    }
    
    this.sync();
    return true;
  },

  remove(id, size) {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      console.error('Invalid product ID');
      return false;
    }

    // Immutable filter
    const originalLength = this.items.length;
    this.items = size
      ? this.items.filter(i => !(i.productId === id && i.size === size))
      : this.items.filter(i => i.productId !== id);
    
    const removed = originalLength !== this.items.length;
    if (removed) {
      this.sync();
    }
    return removed;
  },

  updateQty(id, delta, size) {
    // Validate inputs
    if (!id || typeof id !== 'string' || typeof delta !== 'number') {
      console.error('Invalid parameters');
      return false;
    }

    const item = size
      ? this.items.find(i => i.productId === id && i.size === size)
      : this.items.find(i => i.productId === id);
    
    if (item) {
      // Cap at available stock if inventory data exists
      const inv = window.LIVE_INVENTORY?.[id];
      const maxStock = inv ? (inv[item.size] ?? 99) : 99;
      const newQty = Math.min(maxStock, Math.max(1, item.qty + delta));
      
      // Only sync if quantity actually changed
      if (newQty !== item.qty) {
        item.qty = newQty;
        this.sync();
        return true;
      }
    }
    return false;
  },

  /**
   * Clears all items from cart
   */
  clear() {
    this.items = [];
    this.sync();
  },

  /**
   * Gets cart item by product ID and size
   */
  getItem(id, size) {
    return this.items.find(i => i.productId === id && i.size === size);
  },

  /**
   * Checks if product is in cart
   */
  hasItem(id, size = null) {
    return size
      ? this.items.some(i => i.productId === id && i.size === size)
      : this.items.some(i => i.productId === id);
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

  /**
   * Gets cart state as plain object (for serialization)
   */
  toJSON() {
    return {
      items: this.items,
      count: this.count,
      subtotal: this.subtotal,
    };
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
   DISCOUNT STATE — persisted to sessionStorage so it survives refresh
   ================================================================ */
function _loadDiscount() {
  try {
    const saved = sessionStorage.getItem('modart_discount');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { applied: false, percent: 0, code: '' };
}

const _savedDiscount = _loadDiscount();
export let discountApplied = _savedDiscount.applied;
export let discountPercent = _savedDiscount.percent;
export let discountCode    = _savedDiscount.code;

export function setDiscountApplied(value, percent = 10, code = '') {
  discountApplied = value;
  discountPercent = value ? percent : 0;
  discountCode    = value ? code : '';
  // Persist to sessionStorage so discount survives page refresh
  try {
    if (value) {
      sessionStorage.setItem('modart_discount', JSON.stringify({ applied: true, percent: discountPercent, code: discountCode }));
    } else {
      sessionStorage.removeItem('modart_discount');
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  window.getDiscountPercent  = () => discountPercent;
  window.getDiscountCode     = () => discountCode;
  window.setDiscountApplied  = setDiscountApplied;
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
