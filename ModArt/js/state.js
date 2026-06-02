/* ================================================================
   STATE MANAGEMENT MODULE
   ================================================================ */

/* ================================================================
   PRODUCTS STATE — fallback data used when Supabase is unavailable
   Synced with supabase_setup.sql seed data — real ModArt catalogue
   Images: placeholder until real photos uploaded to Supabase Storage
   ================================================================ */

// Product images — real Unsplash photos matching each category
const PRODUCT_IMGS = {
  'regular-tee':         'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
  'full-sleeve-tee':     'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&q=80',
  'oversized-tee':       'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80',
  'longline-curved-tee': 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80',
  'sweatshirt':          'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80',
  'weighted-sweatshirt': 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80',
  'hoodie':              'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=600&q=80',
  'hooded-sweatshirt':   'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80',
  'zipper-hoodie':       'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
  'weighted-zipper':     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  'varsity-jacket':      'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600&q=80',
  'joggers':             'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80',
  'shorts':              'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=600&q=80',
  'womens-tee':          'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=600&q=80',
  'crop-top':            'https://images.unsplash.com/photo-1523398002811-999ca8deecb5?w=600&q=80',
  'crop-hoodie':         'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
  'crop-tank':           'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&q=80',
  'tote-bag':            'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80',
  'drawstring-bag':      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
};
const PLACEHOLDER = (label, id) => PRODUCT_IMGS[id] || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80';

export const PRODUCTS = [
  // -- TEES ------------------------------------------------------
  {
    id: 'regular-tee', name: 'Regular Tee', series: 'Modart Tees', price: 250,
    img: PLACEHOLDER('Regular Tee'), images: [PLACEHOLDER('Regular Tee')],
    stock: 50, badge: null,
    description: 'Classic unisex regular fit tee. 180 GSM ring-spun cotton. Available in 15 colours.',
    fabric_gsm: '180 GSM', fabric_material: '100% Ring-Spun Cotton',
    tags: ['tee','regular','unisex','cotton']
  },
  {
    id: 'full-sleeve-tee', name: 'Full Sleeve Tee', series: 'Modart Tees', price: 300,
    img: PLACEHOLDER('Full Sleeve Tee'), images: [PLACEHOLDER('Full Sleeve Tee')],
    stock: 42, badge: null,
    description: 'Unisex full sleeve tee in 180 GSM cotton. Clean silhouette, all-season wear.',
    fabric_gsm: '180 GSM', fabric_material: '100% Ring-Spun Cotton',
    tags: ['tee','full-sleeve','unisex','cotton']
  },
  {
    id: 'oversized-tee', name: 'Oversized Tee', series: 'Modart Tees', price: 500,
    img: PLACEHOLDER('Oversized Tee'), images: [PLACEHOLDER('Oversized Tee')],
    stock: 42, badge: null,
    description: 'Heavyweight 240 GSM oversized tee. Dropped shoulders, boxy fit. Available in 7 colours.',
    fabric_gsm: '240 GSM', fabric_material: '100% Combed Cotton',
    tags: ['tee','oversized','unisex','heavyweight']
  },
  {
    id: 'longline-curved-tee', name: 'Longline Curved Tee', series: 'Modart Tees', price: 400,
    img: PLACEHOLDER('Longline Curved Tee'), images: [PLACEHOLDER('Longline Curved Tee')],
    stock: 42, badge: null,
    description: 'Extended length curved hem tee. 180 GSM. Relaxed street-ready silhouette.',
    fabric_gsm: '180 GSM', fabric_material: '100% Ring-Spun Cotton',
    tags: ['tee','longline','curved','unisex']
  },

  // -- SWEATSHIRTS -----------------------------------------------
  {
    id: 'sweatshirt', name: 'Sweatshirt', series: 'Modart Fleece', price: 500,
    img: PLACEHOLDER('Sweatshirt'), images: [PLACEHOLDER('Sweatshirt')],
    stock: 42, badge: null,
    description: 'Unisex crew-neck sweatshirt. 300 GSM fleece. Soft brushed interior, 15 colour options.',
    fabric_gsm: '300 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['sweatshirt','crewneck','unisex','fleece']
  },
  {
    id: 'weighted-sweatshirt', name: 'Weighted Sweatshirt', series: 'Modart Fleece', price: 600,
    img: PLACEHOLDER('Weighted Sweatshirt'), images: [PLACEHOLDER('Weighted Sweatshirt')],
    stock: 42, badge: 'New',
    description: 'Premium 400 GSM heavyweight sweatshirt. Dense fleece, structured fit. 15 colours.',
    fabric_gsm: '400 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['sweatshirt','weighted','heavyweight','unisex']
  },

  // -- HOODIES ---------------------------------------------------
  {
    id: 'hoodie', name: 'Hoodie', series: 'Modart Hoodies', price: 600,
    img: PLACEHOLDER('Hoodie'), images: [PLACEHOLDER('Hoodie')],
    stock: 42, badge: null,
    description: 'Classic pullover hoodie. 300 GSM. Kangaroo pocket, adjustable drawstring. 15 colours.',
    fabric_gsm: '300 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['hoodie','pullover','unisex','fleece']
  },
  {
    id: 'hooded-sweatshirt', name: 'Hooded Sweatshirt', series: 'Modart Hoodies', price: 650,
    img: PLACEHOLDER('Hooded Sweatshirt'), images: [PLACEHOLDER('Hooded Sweatshirt')],
    stock: 42, badge: null,
    description: 'Hooded sweatshirt with premium 300 GSM fleece. Relaxed fit, 15 colour options.',
    fabric_gsm: '300 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['hoodie','hooded','sweatshirt','unisex']
  },
  {
    id: 'zipper-hoodie', name: 'Zipper Hoodie', series: 'Modart Hoodies', price: 650,
    img: PLACEHOLDER('Zipper Hoodie'), images: [PLACEHOLDER('Zipper Hoodie')],
    stock: 42, badge: null,
    description: 'Full-zip hoodie. 300 GSM. Metal zipper, kangaroo pocket. 15 colours.',
    fabric_gsm: '300 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['hoodie','zipper','zip-up','unisex']
  },
  {
    id: 'weighted-zipper', name: 'Weighted Zipper Hoodie', series: 'Modart Hoodies', price: 700,
    img: PLACEHOLDER('Weighted Zipper'), images: [PLACEHOLDER('Weighted Zipper')],
    stock: 42, badge: 'New',
    description: 'Premium 400 GSM full-zip hoodie. Heavy fleece, structured silhouette. 15 colours.',
    fabric_gsm: '400 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['hoodie','zipper','weighted','heavyweight']
  },

  // -- JACKETS ---------------------------------------------------
  {
    id: 'varsity-jacket', name: 'Varsity Jacket', series: 'Modart Jackets', price: 900,
    img: PLACEHOLDER('Varsity Jacket'), images: [PLACEHOLDER('Varsity Jacket')],
    stock: 42, badge: null,
    description: 'Classic varsity jacket. 300 GSM body with contrast sleeves. Snap buttons. 15 colours.',
    fabric_gsm: '300 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['jacket','varsity','unisex','premium']
  },

  // -- BOTTOMS ---------------------------------------------------
  {
    id: 'joggers', name: 'Joggers', series: 'Modart Bottoms', price: 400,
    img: PLACEHOLDER('Joggers'), images: [PLACEHOLDER('Joggers')],
    stock: 42, badge: null,
    description: 'Unisex joggers. 260 GSM. Elastic waistband, tapered fit, ribbed cuffs. 10 colours.',
    fabric_gsm: '260 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['joggers','bottoms','unisex','fleece']
  },
  {
    id: 'shorts', name: 'Shorts', series: 'Modart Bottoms', price: 200,
    img: PLACEHOLDER('Shorts'), images: [PLACEHOLDER('Shorts')],
    stock: 42, badge: null,
    description: 'Unisex fleece shorts. 280 GSM. Elastic waistband, relaxed fit. 10 colours.',
    fabric_gsm: '280 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['shorts','bottoms','unisex']
  },

  // -- WOMEN -----------------------------------------------------
  {
    id: 'womens-tee', name: "Women's Tee", series: 'Modart Women', price: 250,
    img: PLACEHOLDER("Women's Tee"), images: [PLACEHOLDER("Women's Tee")],
    stock: 42, badge: null,
    description: "Women's fitted tee. 180 GSM ring-spun cotton. Flattering cut. 15 colours.",
    fabric_gsm: '180 GSM', fabric_material: '100% Ring-Spun Cotton',
    tags: ['tee','women','fitted','cotton']
  },
  {
    id: 'crop-top', name: 'Crop Top', series: 'Modart Women', price: 300,
    img: PLACEHOLDER('Crop Top'), images: [PLACEHOLDER('Crop Top')],
    stock: 42, badge: null,
    description: "Women's crop top. 180 GSM. Cropped length, relaxed fit. 8 colours.",
    fabric_gsm: '180 GSM', fabric_material: '100% Ring-Spun Cotton',
    tags: ['crop','top','women','cotton']
  },
  {
    id: 'crop-hoodie', name: 'Crop Hoodie', series: 'Modart Women', price: 500,
    img: PLACEHOLDER('Crop Hoodie'), images: [PLACEHOLDER('Crop Hoodie')],
    stock: 42, badge: null,
    description: "Women's crop hoodie. 320 GSM premium fleece. Cropped silhouette. 8 colours.",
    fabric_gsm: '320 GSM', fabric_material: '80% Cotton 20% Polyester',
    tags: ['crop','hoodie','women','fleece']
  },
  {
    id: 'crop-tank', name: 'Crop Tank', series: 'Modart Women', price: 300,
    img: PLACEHOLDER('Crop Tank'), images: [PLACEHOLDER('Crop Tank')],
    stock: 42, badge: null,
    description: "Women's crop tank top. 180 GSM. Sleeveless, racerback style. 8 colours.",
    fabric_gsm: '180 GSM', fabric_material: '100% Ring-Spun Cotton',
    tags: ['crop','tank','women','sleeveless']
  },

  // -- ACCESSORIES -----------------------------------------------
  {
    id: 'tote-bag', name: 'Cotton Tote Bag', series: 'Modart Accessories', price: 100,
    img: PLACEHOLDER('Tote Bag'), images: [PLACEHOLDER('Tote Bag')],
    stock: 100, badge: null,
    description: 'Natural cotton tote bag. Spacious main compartment. Available in various sizes.',
    fabric_gsm: null, fabric_material: '100% Natural Cotton',
    tags: ['bag','tote','accessories','cotton']
  },
  {
    id: 'drawstring-bag', name: 'Drawstring Backpack', series: 'Modart Accessories', price: 150,
    img: PLACEHOLDER('Drawstring Bag'), images: [PLACEHOLDER('Drawstring Bag')],
    stock: 100, badge: null,
    description: 'Natural cotton drawstring backpack. Lightweight and versatile. Various sizes.',
    fabric_gsm: null, fabric_material: '100% Natural Cotton',
    tags: ['bag','drawstring','backpack','accessories']
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
  // Update nav badges immediately
  if (typeof window !== 'undefined' && window.updateBadges) {
    window.updateBadges();
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
  // Use the active customizer product, fall back to first available product
  const productId = window._customizerProductId
    || (window._PRODUCTS && window._PRODUCTS.length > 0 ? window._PRODUCTS[0].id : null);
  if (!productId) {
    if (window.showCustomerToast) window.showCustomerToast('No product selected', 'error');
    return;
  }
  const size = document.querySelector('#page-customize .size-btn.sel')?.dataset?.size || 'M';
  cart.add(productId, size);
  if (typeof window !== 'undefined' && window.goTo) window.goTo('bag');
}

if (typeof window !== 'undefined') {
  window.addToCart    = addToCart;
  window.addCustToCart = addCustToCart;
  window._PRODUCTS    = PRODUCTS;
  window.cart         = cart;
}
