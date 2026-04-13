/**
 * ModArt Account & Wishlist Module
 */
import { currentUser, supabase } from './auth.js';
import { PRODUCTS, wishlist, toggleWishlistItem } from './state.js';

/** Sanitize for safe innerHTML */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Renders the account page based on auth state.
 */
export function renderAccountPage() {
  const loggedOut = document.getElementById('account-logged-out');
  const loggedIn  = document.getElementById('account-logged-in');

  if (!currentUser) {
    if (loggedOut) loggedOut.style.display = 'block';
    if (loggedIn)  loggedIn.style.display  = 'none';
    return;
  }
  if (loggedOut) loggedOut.style.display = 'none';
  if (loggedIn)  loggedIn.style.display  = 'block';

  const name     = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'You';
  const email    = currentUser.email || '';
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Use textContent to avoid XSS
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  set('account-avatar', initials);
  set('account-name',   name);
  set('account-email',  email);
  setVal('profile-name',  name);
  setVal('profile-email', email);

  const wishCount = document.getElementById('acct-wish-count');
  if (wishCount) wishCount.textContent = wishlist.size;
}

/**
 * Saves updated profile name to Supabase.
 */
export async function saveProfile() {
  const nameEl = document.getElementById('profile-name');
  const sucEl  = document.getElementById('profile-success');
  const errEl  = document.getElementById('profile-error');
  const name   = nameEl?.value?.trim();

  if (errEl) errEl.style.display = 'none';
  if (!name || name.length < 2) {
    if (errEl) { errEl.textContent = 'Name must be at least 2 characters.'; errEl.style.display = 'block'; }
    return;
  }
  if (!currentUser) return;

  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) {
    if (errEl) { errEl.textContent = error.message; errEl.style.display = 'block'; }
    return;
  }
  if (sucEl) {
    sucEl.textContent   = 'Profile updated.';
    sucEl.style.display = 'block';
    setTimeout(() => { sucEl.style.display = 'none'; }, 3000);
  }
  // Update nav avatar immediately
  const navAvatar = document.getElementById('nav-avatar');
  if (navAvatar) {
    const parts = name.trim().split(/\s+/);
    navAvatar.textContent = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name[0].toUpperCase();
  }
}

/**
 * Renders the wishlist page using live products if available.
 */
export function renderWishlistPage() {
  const grid     = document.getElementById('wishlist-grid');
  const empty    = document.getElementById('wishlist-empty');
  const countEl  = document.getElementById('wishlist-count');
  const shareBtn = document.getElementById('share-wishlist-btn');
  if (!grid || !empty) return;

  // Use live products if available
  const src   = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : PRODUCTS;
  const items = src.filter(p => wishlist.has(p.id));

  if (countEl) countEl.textContent = `(${items.length})`;

  if (items.length === 0) {
    empty.style.display = 'block';
    grid.style.display  = 'none';
    if (shareBtn) shareBtn.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  grid.style.display  = '';
  if (shareBtn) shareBtn.style.display = '';

  grid.innerHTML = items.map(p => `
    <div class="product-card" onclick="window.openProduct && window.openProduct('${esc(p.id)}')" role="article" aria-label="${esc(p.name)}">
      <div class="product-card-img">
        <img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"/>
        <div class="product-card-overlay">
          <button class="wishlist-icon-btn wishlisted" aria-label="Remove ${esc(p.name)} from wishlist"
            onclick="event.stopPropagation();window.toggleWishlist && window.toggleWishlist('${esc(p.id)}',this);window.renderWishlistPage && window.renderWishlistPage()">
            <span class="material-symbols-outlined icon">favorite</span>
          </button>
        </div>
      </div>
      <div class="product-card-series">${esc(p.series)}</div>
      <div class="product-card-name">${esc(p.name)}</div>
      <div class="product-card-footer">
        <div class="product-card-price">${window.formatPrice ? window.formatPrice(p.price) : '₹' + p.price}</div>
      </div>
    </div>`).join('');
}

/**
 * Copies a shareable wishlist URL to clipboard.
 */
export function shareWishlist() {
  const ids = Array.from(wishlist).join(',');
  const url = `${window.location.origin}${window.location.pathname}?wishlist=${encodeURIComponent(ids)}`;
  navigator.clipboard?.writeText(url).then(() => {
    const btn = document.getElementById('share-wishlist-btn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  }).catch(() => {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

if (typeof window !== 'undefined') {
  window.renderAccountPage  = renderAccountPage;
  window.renderWishlistPage = renderWishlistPage;
  window.saveProfile        = saveProfile;
  window.shareWishlist      = shareWishlist;
}
