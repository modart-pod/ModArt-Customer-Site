/**
 * Product Recommendations Module
 * 
 * Phase 7: Customer Features
 * Provides personalised product recommendations based on:
 * - Browsing history
 * - Cart contents
 * - Wishlist items
 * - Purchase history
 * - Product tags/series similarity
 */

import { PRODUCTS } from './state.js';

const HISTORY_KEY = 'modart_browse_history';
const MAX_HISTORY = 20;

/* ── Browsing history ─────────────────────────────────────── */

export function trackProductView(productId) {
  try {
    const history = getBrowseHistory();
    const filtered = history.filter(id => id !== productId);
    filtered.unshift(productId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
  } catch {}
}

export function getBrowseHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

/* ── Scoring engine ───────────────────────────────────────── */

/**
 * Scores a candidate product against a set of seed products.
 * Higher score = more relevant.
 */
function scoreProduct(candidate, seeds, purchasedIds = []) {
  if (purchasedIds.includes(candidate.id)) return -1; // already bought

  let score = 0;

  for (const seed of seeds) {
    if (seed.id === candidate.id) continue;

    // Same series → strong signal
    if (seed.series && candidate.series === seed.series) score += 4;

    // Shared tags
    const seedTags = seed.tags || [];
    const candTags = candidate.tags || [];
    const shared = seedTags.filter(t => candTags.includes(t)).length;
    score += shared * 2;

    // Similar price range (within 30%)
    if (seed.price && candidate.price) {
      const ratio = Math.abs(candidate.price - seed.price) / seed.price;
      if (ratio < 0.3) score += 1;
    }
  }

  // Boost in-stock items
  if (candidate.stock > 0) score += 1;
  // Boost low-stock (urgency)
  if (candidate.stock > 0 && candidate.stock <= 5) score += 1;

  return score;
}

/**
 * Returns up to `limit` recommended products.
 * @param {Object} opts
 * @param {string[]} opts.excludeIds   - Product IDs to exclude (current product, cart items, etc.)
 * @param {string[]} opts.seedIds      - Product IDs to base recommendations on
 * @param {string[]} opts.purchasedIds - Already-purchased IDs (never recommend again)
 * @param {number}   opts.limit        - Max results (default 4)
 */
export function getRecommendations({ excludeIds = [], seedIds = [], purchasedIds = [], limit = 4 } = {}) {
  const src = (window._PRODUCTS?.length > 0) ? window._PRODUCTS : PRODUCTS;

  const seeds = seedIds
    .map(id => src.find(p => p.id === id))
    .filter(Boolean);

  // Fall back to browse history if no seeds provided
  if (seeds.length === 0) {
    const history = getBrowseHistory();
    history.slice(0, 5).forEach(id => {
      const p = src.find(p => p.id === id);
      if (p) seeds.push(p);
    });
  }

  const candidates = src.filter(p => !excludeIds.includes(p.id));

  const scored = candidates
    .map(p => ({ product: p, score: scoreProduct(p, seeds, purchasedIds) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ product }) => product);
}

/* ── "You may also like" section renderer ─────────────────── */

export function renderRecommendations(containerId, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const recs = getRecommendations(opts);
  if (recs.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  container.innerHTML = recs.map(p => {
    const sold = p.stock === 0;
    const low  = p.stock > 0 && p.stock <= 5;
    const fmt  = window.formatPrice ? window.formatPrice(p.price) : '₹' + p.price;
    return `
      <div class="product-card rec-card"
           data-product-id="${esc(p.id)}"
           onclick="window.openProduct && window.openProduct('${esc(p.id)}')"
           role="article" aria-label="${esc(p.name)}">
        <div class="product-card-img">
          <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>
          ${p.badge ? `<div class="product-card-badge${sold?' badge-sold':low?' badge-low':''}">${esc(p.badge)}</div>` : ''}
        </div>
        <div class="product-card-series">${esc(p.series)}</div>
        <div class="product-card-name">${esc(p.name)}</div>
        <div class="product-card-footer">
          <div class="product-card-price">${sold ? `<s style="color:var(--g3)">${fmt}</s>` : fmt}</div>
          ${low && !sold ? `<div class="product-card-scarcity">Only ${p.stock} Left</div>` : ''}
          ${sold ? '<div style="font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--g3)">Sold Out</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Abandoned-cart recovery helpers ─────────────────────── */

const ABANDON_KEY  = 'modart_cart_abandon_ts';
const ABANDON_SENT = 'modart_abandon_email_sent';
const ABANDON_DELAY = 30 * 60 * 1000; // 30 minutes

/**
 * Call this whenever the cart changes.
 * Records the timestamp so we can detect abandonment.
 */
export function markCartActivity() {
  try {
    localStorage.setItem(ABANDON_KEY, String(Date.now()));
    localStorage.removeItem(ABANDON_SENT); // reset sent flag on new activity
  } catch {}
}

/**
 * Checks if the cart has been abandoned (no activity for ABANDON_DELAY).
 * Returns true if an email should be sent.
 */
export function shouldSendAbandonEmail(cartItems = []) {
  if (!cartItems.length) return false;
  try {
    const alreadySent = localStorage.getItem(ABANDON_SENT);
    if (alreadySent) return false;

    const ts = parseInt(localStorage.getItem(ABANDON_KEY) || '0');
    return ts > 0 && (Date.now() - ts) >= ABANDON_DELAY;
  } catch { return false; }
}

/**
 * Marks the abandon email as sent so we don't send duplicates.
 */
export function markAbandonEmailSent() {
  try { localStorage.setItem(ABANDON_SENT, '1'); } catch {}
}

/**
 * Sends an abandoned-cart recovery email via the API.
 */
export async function sendAbandonCartEmail(email, cartItems) {
  if (!email || !cartItems?.length) return false;
  if (!shouldSendAbandonEmail(cartItems)) return false;

  try {
    const res = await fetch('/api/send-contact-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'abandoned_cart',
        to: email,
        items: cartItems,
        recoveryUrl: window.location.origin + '/?cart=recover',
      }),
    });
    if (res.ok) {
      markAbandonEmailSent();
      return true;
    }
  } catch {}
  return false;
}

/* ── Social sharing ───────────────────────────────────────── */

export function shareProduct(productId, platform = 'copy') {
  const src = (window._PRODUCTS?.length > 0) ? window._PRODUCTS : PRODUCTS;
  const product = src.find(p => p.id === productId);
  if (!product) return;

  const url  = `${window.location.origin}/?product=${productId}`;
  const text = `Check out the ${product.name} on ModArt — ${product.series}`;

  switch (platform) {
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
      break;
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener');
      break;
    case 'instagram':
      // Instagram doesn't support direct URL sharing; copy to clipboard instead
      copyToClipboard(url);
      if (window.showInfo) window.showInfo('Link copied — paste it in your Instagram story!');
      break;
    case 'copy':
    default:
      copyToClipboard(url);
      if (window.showSuccess) window.showSuccess('Link copied to clipboard!');
      break;
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

/* ── Loyalty points (client-side ledger) ─────────────────── */

const POINTS_KEY = 'modart_loyalty_points';
const POINTS_PER_RUPEE = 0.01; // 1 point per ₹100 spent
const POINTS_REDEEM_RATE = 0.10; // 10 points = ₹1 discount

export function getLoyaltyPoints() {
  try { return parseInt(localStorage.getItem(POINTS_KEY) || '0'); } catch { return 0; }
}

export function addLoyaltyPoints(orderTotal) {
  const earned = Math.floor(orderTotal * POINTS_PER_RUPEE);
  if (earned <= 0) return 0;
  try {
    const current = getLoyaltyPoints();
    localStorage.setItem(POINTS_KEY, String(current + earned));
    return earned;
  } catch { return 0; }
}

export function redeemLoyaltyPoints(points) {
  const current = getLoyaltyPoints();
  const toRedeem = Math.min(points, current);
  if (toRedeem <= 0) return 0;
  try {
    localStorage.setItem(POINTS_KEY, String(current - toRedeem));
    return Math.floor(toRedeem / POINTS_REDEEM_RATE); // returns ₹ discount
  } catch { return 0; }
}

export function getLoyaltyTier(points) {
  if (points >= 5000) return { name: 'Platinum', color: '#8B5CF6', next: null, nextAt: null };
  if (points >= 2000) return { name: 'Gold',     color: '#F59E0B', next: 'Platinum', nextAt: 5000 };
  if (points >= 500)  return { name: 'Silver',   color: '#6B7280', next: 'Gold',     nextAt: 2000 };
  return                     { name: 'Bronze',   color: '#D97706', next: 'Silver',   nextAt: 500  };
}

/* ── Referral system ─────────────────────────────────────── */

const REFERRAL_KEY = 'modart_referral_code';

export function getOrCreateReferralCode(userId) {
  try {
    const stored = localStorage.getItem(REFERRAL_KEY);
    if (stored) return stored;
    // Generate deterministic code from userId or random
    const base = userId
      ? userId.replace(/-/g, '').slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
    const code = 'REF' + base;
    localStorage.setItem(REFERRAL_KEY, code);
    return code;
  } catch { return null; }
}

export function getReferralLink(userId) {
  const code = getOrCreateReferralCode(userId);
  return code ? `${window.location.origin}/?ref=${code}` : window.location.origin;
}

export function checkReferralParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      sessionStorage.setItem('modart_referred_by', ref);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {}
}

export function getReferredBy() {
  try { return sessionStorage.getItem('modart_referred_by'); } catch { return null; }
}

/* ── Gift cards (client-side validation) ─────────────────── */

const GIFT_CARDS = {
  // Format: code → { balance, currency, expiry }
  // In production these would be validated server-side
};

export async function validateGiftCard(code) {
  if (!code) return { valid: false, message: 'Please enter a gift card code.' };

  try {
    // Server-side validation
    const res = await fetch('/api/validate-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), type: 'gift_card' }),
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      return { valid: true, balance: data.balance || 0, discount: data.discount || 0 };
    }
    return { valid: false, message: data.message || 'Invalid gift card code.' };
  } catch {
    return { valid: false, message: 'Could not validate gift card. Please try again.' };
  }
}

/* ── Window exports ───────────────────────────────────────── */

if (typeof window !== 'undefined') {
  window.trackProductView       = trackProductView;
  window.getRecommendations     = getRecommendations;
  window.renderRecommendations  = renderRecommendations;
  window.shareProduct           = shareProduct;
  window.getLoyaltyPoints       = getLoyaltyPoints;
  window.addLoyaltyPoints       = addLoyaltyPoints;
  window.redeemLoyaltyPoints    = redeemLoyaltyPoints;
  window.getLoyaltyTier         = getLoyaltyTier;
  window.getReferralLink        = getReferralLink;
  window.checkReferralParam     = checkReferralParam;
  window.getReferredBy          = getReferredBy;
  window.validateGiftCard       = validateGiftCard;
  window.markCartActivity       = markCartActivity;
  window.sendAbandonCartEmail   = sendAbandonCartEmail;
}
