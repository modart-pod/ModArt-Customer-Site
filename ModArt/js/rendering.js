/**
 * Rendering Module
 * 
 * Handles DOM manipulation and UI rendering functions for the ModArt application.
 * Extracted from the original modart_v4.html file to separate rendering concerns.
 * 
 * Functions:
 * - renderProducts: Renders product grid for home and shop pages
 * - renderBag: Renders shopping cart items and totals
 * - updateBadges: Updates cart count badges across navigation
 * - toggleWishlist: Handles wishlist toggle interactions
 */

import { PRODUCTS, cart, wishlist, toggleWishlistItem, discountApplied, discountPercent, setDiscountApplied } from './state.js';
import { formatPrice } from './currency.js';

/** Sanitize string for safe innerHTML insertion */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================================================================
   PRODUCT GRID RENDERING
   ================================================================ */

// Track currently viewed product
let currentProductId = null;

/**
 * Renders the product grid for home or shop pages
 * @param {string} page - Page type ('home' or 'shop')
 */
// Static review data keyed by product id (display only, not editable)
const PRODUCT_REVIEWS = {
  'vanta-tee':     { rating: 4.7, count: 128 },
  'elfima-hoodie': { rating: 4.9, count: 214 },
  'cargo-pants':   { rating: 4.5, count:  87 },
  'vanta-hoodie':  { rating: 4.8, count: 302 },
  'knit-sweater':  { rating: 4.6, count:  63 },
  'neo-tee':       { rating: 4.4, count:  41 },
};

function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '<span class="material-symbols-outlined icon" style="font-size:12px;color:var(--amber)">star</span>'.repeat(full)
    + (half ? '<span class="material-symbols-outlined icon" style="font-size:12px;color:var(--amber)">star_half</span>' : '')
    + '<span class="material-symbols-outlined icon" style="font-size:12px;color:var(--border)">star</span>'.repeat(empty);
}

export function renderProducts(page) {
  const id = page === 'home' ? 'home-product-grid' : 'shop-product-grid';
  const grid = document.getElementById(id);
  if (!grid) return;

  const productSource = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
  const prods = page === 'home' ? productSource.slice(0, 4) : productSource;
  const isShop = page === 'shop';

  grid.innerHTML = prods.map(p => {
    const sold = p.stock === 0;
    const low  = p.stock > 0 && p.stock <= 5;
    const wish = wishlist.has(p.id);
    const rev  = PRODUCT_REVIEWS[p.id] || { rating: 4.5, count: 0 };

    const starsRow = isShop ? `
      <div class="card-stars" style="display:flex;align-items:center;gap:2px;padding:4px 10px 0">
        ${renderStars(rev.rating)}
        <span class="card-stars-count" style="font-size:10px;color:var(--g2);margin-left:3px">${rev.count > 0 ? '(' + rev.count + ')' : 'New'}</span>
      </div>` : '';

    return `<div class="product-card" data-product-id="${esc(p.id)}" data-product-price="${p.price}" data-product-stock="${p.stock}" data-product-name="${esc(p.name)}" onclick="window.openProduct && window.openProduct('${esc(p.id)}')" role="article" aria-label="${esc(p.name)}">
      <div class="product-card-img">
        <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>
        ${p.badge ? `<div class="product-card-badge${sold ? ' badge-sold' : low ? ' badge-low' : ''}">${esc(p.badge)}</div>` : ''}
        <div class="product-card-overlay">
          <button class="card-quick-cta" onclick="event.stopPropagation();window.goTo && window.goTo('customize')">Customize</button>
          <button class="wishlist-icon-btn${wish ? ' wishlisted' : ''}" aria-label="${wish ? 'Remove from wishlist' : 'Add to wishlist'}: ${esc(p.name)}" onclick="event.stopPropagation();window.toggleWishlist && window.toggleWishlist('${esc(p.id)}',this)">
            <span class="material-symbols-outlined icon">${wish ? 'favorite' : 'favorite_border'}</span>
          </button>
        </div>
      </div>
      <div class="product-card-series">${esc(p.series)}</div>
      <div class="product-card-name">${esc(p.name)}</div>
      ${starsRow}
      <div class="product-card-footer">
        <div class="product-card-price">${sold ? `<s style="color:var(--g3)">${formatPrice(p.price)}</s>` : formatPrice(p.price)}</div>
        ${low && !sold ? `<div class="product-card-scarcity">Only ${p.stock} Left</div>` : ''}
        ${sold ? '<div style="font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--g3)">Sold Out</div>' : ''}
      </div>
    </div>`;
  }).join('');

  // Rebuild carousel dots after home cards are injected
  if (isShop === false && window._rebuildCarouselDots) {
    window._rebuildCarouselDots();
  }
}

/**
 * Opens a product detail page for the given product ID
 * @param {string} productId - Product ID to display
 */
export function openProduct(productId) {
  currentProductId = productId;
  window._currentProductId = productId; // expose for router
  if (window.goTo) window.goTo('product');
}

/**
 * Renders the product detail page with data from the current product
 */
export function renderProductDetail() {
  const productSource = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
  const p = productSource.find(p => p.id === currentProductId) || productSource[0];
  const sold = p.stock === 0;
  const low = p.stock > 0 && p.stock <= 5;

  const mainImg = document.getElementById('product-main-img');
  if (mainImg) { mainImg.src = p.img; mainImg.alt = p.name; }

  // Update thumbnails to use the product image
  const thumbs = document.querySelectorAll('#page-product .product-img-thumb');
  if (thumbs.length > 0) {
    thumbs[0].src = p.img;
    thumbs[0].setAttribute('onclick', `switchImg(this,'${p.img}')`);
  }

  const titleEl = document.querySelector('#page-product .product-detail-title');
  if (titleEl) titleEl.textContent = p.name;

  const subtitleEl = document.querySelector('#page-product .product-detail-subtitle');
  if (subtitleEl) subtitleEl.textContent = `${p.series} / Limited Release`;

  // Update eyebrow series label
  const eyebrowEl = document.querySelector('#page-product .eyebrow-red');
  if (eyebrowEl) eyebrowEl.textContent = p.series;

  const priceFormatted = formatPrice(p.price);
  const priceEl = document.getElementById('detail-price');
  if (priceEl) priceEl.textContent = sold ? '' : priceFormatted;

  const priceBtnEl = document.getElementById('detail-price-btn');
  if (priceBtnEl) priceBtnEl.textContent = priceFormatted;

  // Update description
  const descEl = document.querySelector('#page-product .product-detail-desc');
  if (descEl && p.description) descEl.textContent = p.description;

  // Update fabric specs if product has them
  if (p.specs) {
    const specItems = document.querySelectorAll('#page-product .fabric-item');
    const specKeys = Object.keys(p.specs);
    specItems.forEach((item, i) => {
      if (specKeys[i]) {
        const lbl = item.querySelector('.fabric-item-lbl');
        const val = item.querySelector('.fabric-item-val');
        if (lbl) lbl.textContent = specKeys[i];
        if (val) val.textContent = p.specs[specKeys[i]];
      }
    });
  }

  const addBagBtn = document.querySelector('#page-product .btn-black.btn-red-full');
  if (addBagBtn) {
    addBagBtn.onclick = () => { window.addToCart && window.addToCart(p.id); window.goTo && window.goTo('bag'); };
    if (sold) addBagBtn.disabled = true;
  }

  const scarcityEl = document.querySelector('#page-product .scarcity-pill');
  if (scarcityEl) {
    if (sold) scarcityEl.innerHTML = '<span class="scarcity-dot" style="background:var(--g3)"></span> Sold Out';
    else if (low) scarcityEl.innerHTML = `<span class="scarcity-dot"></span> ${p.stock} Left`;
    else scarcityEl.style.display = 'none';
  }

  // Update wishlist button state
  const wishBtn = document.getElementById('wishlist-detail-btn');
  if (wishBtn) {
    const isWished = wishlist.has(p.id);
    const icon = wishBtn.querySelector('.icon');
    if (icon) {
      icon.textContent = isWished ? 'favorite' : 'favorite_border';
      icon.style.color = isWished ? 'var(--red)' : '';
    }
  }
}

/* ================================================================
   BAG RENDERING
   ================================================================ */

/**
 * Renders the shopping cart items, totals, and empty state
 */
export function renderBag() {
  const list = document.getElementById('bag-items-list');
  const empty = document.getElementById('bag-empty');
  const countEl = document.getElementById('bag-count');
  const subtotalEl = document.getElementById('bag-subtotal');
  const totalEl = document.getElementById('bag-total');
  
  if (!list) return;
  
  if (cart.items.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
  } else {
    if (empty) empty.style.display = 'none';
    const productSource = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
    list.innerHTML = cart.items.map(item => {
      const p = productSource.find(p => p.id === item.productId);
      if (!p) return '';
      return `<div class="bag-item">
        <div class="bag-img"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/></div>
        <div>
          <div class="bag-item-name">${esc(p.name)}</div>
          <div class="bag-item-series">${esc(p.series)}</div>
          <div class="bag-item-meta">Size: ${esc(item.size)}${item.printAddon ? ` · Print addon: ${formatPrice(item.printAddon)}` : ''} &nbsp; ${formatPrice(p.price + (item.printAddon || 0))} each</div>
          <button class="bag-item-edit" onclick="window.goTo && window.goTo('customize')">Edit Design</button>
          <div class="qty-control" role="group" aria-label="Quantity for ${esc(p.name)}">
            <button class="qty-btn" aria-label="Decrease quantity" onclick="window.cart && window.cart.updateQty('${esc(p.id)}',-1,'${esc(item.size)}')">−</button>
            <span class="qty-val" aria-live="polite">${item.qty}</span>
            <button class="qty-btn" aria-label="Increase quantity" onclick="window.cart && window.cart.updateQty('${esc(p.id)}',1,'${esc(item.size)}')">+</button>
          </div>
          <div class="bag-item-price">${formatPrice(p.price * item.qty)}</div>
        </div>
        <button class="bag-remove-btn" aria-label="Remove ${esc(p.name)}" onclick="window.cart && window.cart.remove('${esc(p.id)}','${esc(item.size)}')"><span class="material-symbols-outlined icon">close</span></button>
      </div>`;
    }).join('');
  }
  
  // Update totals
  const sub = cart.subtotal;
  // discount-row-display shows the applied discount line in the summary
  const discEl = document.getElementById('discount-row-display');
  const pct  = discountApplied ? (discountPercent || 10) : 0;
  const disc = discountApplied ? Math.round(sub * pct / 100) : 0;

  if (discEl) discEl.style.display = disc > 0 ? '' : 'none';

  // Update discount label to show real percent
  const discLabelEl = discEl?.querySelector('span:first-child');
  if (discLabelEl && disc > 0) discLabelEl.textContent = `Discount (${pct}%)`;
  
  const discVal = document.getElementById('discount-val');
  if (discVal) discVal.textContent = `−${formatPrice(disc)}`;
  
  if (countEl) countEl.textContent = `(${cart.count})`;
  if (subtotalEl) subtotalEl.textContent = `${formatPrice(sub)}`;
  if (totalEl) totalEl.textContent = `${formatPrice(sub - disc)}`;
  
  updateBadges();
  updateShippingProgress();
}

/* ================================================================
   BADGE UPDATES
   ================================================================ */

/**
 * Updates cart count badges across all navigation elements
 */
export function updateBadges() {
  const count = cart.count;
  ['cart-badge-desk', 'cart-badge-mob', 'cart-badge-nav'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    }
  });
}

/* ================================================================
   WISHLIST INTERACTIONS
   ================================================================ */

/**
 * Toggles wishlist state for a product and updates UI
 * @param {string} id - Product ID
 * @param {HTMLElement} btn - Wishlist button element
 */
export function toggleWishlist(id, btn) {
  toggleWishlistItem(id); // persists to localStorage
  const isWished = wishlist.has(id);
  btn.classList.toggle('wishlisted', isWished);
  btn.querySelector('.icon').textContent = isWished ? 'favorite' : 'favorite_border';
  btn.setAttribute('aria-label', (isWished ? 'Remove from wishlist' : 'Add to wishlist'));
}

/**
 * Toggles wishlist state for product detail page — persists to state
 * @param {HTMLElement} btn - Wishlist button element
 */
export function toggleWishlistDetail(btn) {
  const productId = window._currentProductId;
  if (productId) {
    toggleWishlistItem(productId);
    const isWished = wishlist.has(productId);
    const icon = btn.querySelector('.icon');
    if (icon) {
      icon.textContent = isWished ? 'favorite' : 'favorite_border';
      icon.style.color = isWished ? 'var(--red)' : '';
    }
  } else {
    // Fallback: just toggle visually if no product ID
    const icon = btn.querySelector('.icon');
    if (!icon) return;
    const isWish = icon.textContent === 'favorite';
    icon.textContent = isWish ? 'favorite_border' : 'favorite';
    icon.style.color = isWish ? '' : 'var(--red)';
  }
}

/* ================================================================
   DISCOUNT FUNCTIONS
   ================================================================ */

/**
 * Applies discount code — validates server-side via Netlify function.
 * Falls back to client-side check if function unavailable.
 */
export async function applyDiscount() {
  const input  = document.getElementById('discount-input');
  const errEl  = document.getElementById('discount-error');
  const code   = input?.value?.trim().toUpperCase();
  if (!code) return;

  if (errEl) errEl.style.display = 'none';

  try {
    const res = await fetch('/api/validate-coupon', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      setDiscountApplied(true, data.discount || 10, code);
      renderBag();
      if (input) input.style.borderColor = 'var(--green)';
      // Show discount label
      const discLbl = document.getElementById('discount-code-label');
      if (discLbl) discLbl.textContent = code + ' (−' + (data.discount || 10) + '%)';
      return;
    }
    // Invalid code
    if (input) input.style.borderColor = 'var(--red)';
    if (errEl) { errEl.textContent = data.message || 'Invalid discount code.'; errEl.style.display = 'block'; }
  } catch {
    // Fallback
    if (code === 'MODART10') {
      setDiscountApplied(true, 10, code);
      renderBag();
      if (input) input.style.borderColor = 'var(--green)';
    } else {
      if (input) input.style.borderColor = 'var(--red)';
      if (errEl) { errEl.textContent = 'Invalid discount code.'; errEl.style.display = 'block'; }
    }
  }
}

// Make functions and objects globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.renderProducts = renderProducts;
  window.renderBag = renderBag;
  window.updateBadges = updateBadges;
  window.toggleWishlist = toggleWishlist;
  window.toggleWishlistDetail = toggleWishlistDetail;
  window.applyDiscount = applyDiscount;
  window.openProduct = openProduct;
  window.renderProductDetail = renderProductDetail;
  
  // Make cart object available globally for onclick handlers
  window.cart = cart;

  // addToCart shorthand used by product detail page — includes print addon if selected
  window.addToCart = (productId, size) => {
    const selectedSize = size || document.querySelector('.size-btn.sel')?.dataset?.size || 'M';
    const printAddon = window._printAddon || 0;
    cart.add(productId, selectedSize, printAddon);
  };
}

/* ================================================================
   SHOP FILTER + SORT
   ================================================================ */

export function filterShop(type, btn) {
  document.querySelectorAll('.shop-filter-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = '';
    b.style.color = '';
    b.style.borderColor = '';
  });
  if (btn) btn.classList.add('active');

  // Map filter types to series keywords — works with any products added via admin
  const SERIES_MAP = {
    hoodies: ['hoodie'],
    tees:    ['tee'],
    bottoms: ['cargo', 'pant', 'short'],
  };

  const grid = document.getElementById('shop-product-grid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('[data-product-id]'));
  cards.forEach(card => {
    const pid   = card.dataset.productId?.toLowerCase() || '';
    const name  = card.dataset.productName?.toLowerCase() || '';
    const stock = parseInt(card.dataset.productStock || '1');
    let show = true;
    if (type === 'instock') {
      show = stock > 0;
    } else if (type !== 'all' && SERIES_MAP[type]) {
      const keywords = SERIES_MAP[type];
      show = keywords.some(kw => pid.includes(kw) || name.includes(kw));
    }
    card.style.display = show ? '' : 'none';
  });
}

export function sortShop(value) {
  const grid = document.getElementById('shop-product-grid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('[data-product-id]'));
  cards.sort((a, b) => {
    const pa = parseFloat(a.dataset.productPrice || '0');
    const pb = parseFloat(b.dataset.productPrice || '0');
    const na = a.dataset.productName || '';
    const nb = b.dataset.productName || '';
    if (value === 'price-asc')  return pa - pb;
    if (value === 'price-desc') return pb - pa;
    if (value === 'name-asc')   return na.localeCompare(nb);
    return 0;
  });
  cards.forEach(card => grid.appendChild(card));
}

/* ================================================================
   RELATED PRODUCTS
   ================================================================ */

export function renderRelatedProducts(excludeId) {
  const grid = document.getElementById('related-product-grid');
  if (!grid) return;
  const productSource = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
  const related = productSource.filter(p => p.id !== (excludeId || currentProductId || 'vanta-hoodie')).slice(0, 3);
  grid.innerHTML = related.map(p => {
    const wish = wishlist.has(p.id);
    const sold = p.stock === 0;
    const low  = p.stock > 0 && p.stock <= 5;
    return `<div class="product-card" data-product-id="${esc(p.id)}" data-product-price="${p.price}" data-product-stock="${p.stock}" data-product-name="${esc(p.name)}" onclick="window.openProduct&&window.openProduct('${esc(p.id)}')" role="article" aria-label="${esc(p.name)}">
      <div class="product-card-img">
        <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>
        ${p.badge ? `<div class="product-card-badge${sold?' badge-sold':low?' badge-low':''}">${esc(p.badge)}</div>` : ''}
        <div class="product-card-overlay">
          <button class="card-quick-cta" onclick="event.stopPropagation();window.goTo&&window.goTo('customize')">Customize</button>
          <button class="wishlist-icon-btn${wish?' wishlisted':''}" aria-label="Wishlist ${esc(p.name)}" onclick="event.stopPropagation();window.toggleWishlist&&window.toggleWishlist('${esc(p.id)}',this)">
            <span class="material-symbols-outlined icon">${wish?'favorite':'favorite_border'}</span>
          </button>
        </div>
      </div>
      <div class="product-card-series">${esc(p.series)}</div>
      <div class="product-card-name">${esc(p.name)}</div>
      <div class="product-card-footer">
        <div class="product-card-price">${sold?`<s style="color:var(--g3)">${formatPrice(p.price)}</s>`:formatPrice(p.price)}</div>
        ${low&&!sold?`<div class="product-card-scarcity">Only ${p.stock} Left</div>`:''}
        ${sold?'<div style="font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--g3)">Sold Out</div>':''}
      </div>
    </div>`;
  }).join('');
}

/* ================================================================
   CHECKOUT SUMMARY POPULATION
   ================================================================ */

/**
 * Populates the checkout sidebar with cart items, subtotal, and total.
 * Re-runs when shipping method changes.
 */
export function populateCheckoutSummary() {
  if (!window.cart) return;
  const src      = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
  const itemsEl  = document.getElementById('checkout-items');
  const coSub    = document.getElementById('co-subtotal');
  const coTotal  = document.getElementById('co-total');
  const coShip   = document.getElementById('co-shipping');

  if (itemsEl) {
    itemsEl.innerHTML = window.cart.items.map(item => {
      const p = src.find(p => p.id === item.productId);
      if (!p) return '';
      const lineTotal = window.formatPrice ? window.formatPrice(p.price * item.qty) : '₹' + (p.price * item.qty);
      return `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px">
        <span style="color:var(--g2)">${esc(p.name)} × ${item.qty} <span style="color:var(--g3)">(${esc(item.size)})</span></span>
        <span style="font-weight:700">${lineTotal}</span>
      </div>`;
    }).join('') || '<div style="font-size:12px;color:var(--g3)">No items in cart</div>';
  }

  const sub = window.cart.subtotal;
  const shippingMethod = document.querySelector('#page-checkout input[name="shipping"]:checked')?.value || 'standard';
  const shipping = shippingMethod === 'express' ? 499 : (sub >= 2499 ? 0 : 149);
  const total = sub + shipping;

  const fmt = v => window.formatPrice ? window.formatPrice(v) : '₹' + v;
  if (coSub)  coSub.textContent  = fmt(sub);
  if (coShip) coShip.textContent = shipping === 0 ? 'Free' : fmt(shipping);
  if (coTotal) coTotal.textContent = fmt(total);
}

if (typeof window !== 'undefined') {
  window.populateCheckoutSummary = populateCheckoutSummary;
}



function updateShippingProgress() {
  const FREE_THRESHOLD = 2499;
  const subtotal = cart.subtotal;
  const progBar = document.getElementById('shipping-progress-bar');
  const progMsg = document.getElementById('shipping-progress-msg');
  if (!progBar || !progMsg) return;
  if (subtotal >= FREE_THRESHOLD) {
    progMsg.textContent = 'You have free shipping!';
    progMsg.style.color = 'var(--green)';
    progBar.style.width = '100%';
  } else {
    const remaining = FREE_THRESHOLD - subtotal;
    const pct = Math.min(100, (subtotal / FREE_THRESHOLD) * 100);
    const fmt = window.formatPrice ? window.formatPrice(remaining) : '₹' + remaining;
    progMsg.textContent = `${fmt} away from free shipping`;
    progMsg.style.color = 'var(--g2)';
    progBar.style.width = pct + '%';
  }
}

if (typeof window !== 'undefined') {
  window.filterShop = filterShop;
  window.sortShop = sortShop;
  window.renderRelatedProducts = renderRelatedProducts;
}

/* ================================================================
   SIZE OPTIONS (live inventory)
   ================================================================ */

export function renderSizeOptions(productId) {
  const container = document.getElementById('size-options-dynamic');
  if (!container) return;

  const sizes = (window.getSizesForProduct && productId)
    ? window.getSizesForProduct(productId)
    : [
        { size:'XS', stock:5, available:true },
        { size:'S',  stock:5, available:true },
        { size:'M',  stock:5, available:true },
        { size:'L',  stock:5, available:true },
        { size:'XL', stock:0, available:false },
      ];

  container.innerHTML = sizes.map((s, i) =>
    `<button
      class="size-btn${i === 0 && s.available ? ' sel' : ''}${!s.available ? ' dis' : ''}"
      onclick="selSize(this)"
      data-size="${s.size}"
      ${!s.available ? 'disabled title="Out of stock"' : ''}>
      ${s.size}
      ${s.stock <= 3 && s.available ? `<span style="display:block;font-size:8px;color:var(--red);font-weight:700;letter-spacing:.06em">${s.stock} left</span>` : ''}
    </button>`
  ).join('');
}

if (typeof window !== 'undefined') {
  window.renderSizeOptions = renderSizeOptions;
}
