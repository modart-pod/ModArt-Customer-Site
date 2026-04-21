/**
 * Main Entry Point Module
 * Coordinates all modules and handles application initialization.
 */

import { initRouter } from './router.js';
import { renderProducts, renderBag, updateBadges, populateCheckoutSummary } from './rendering.js';
import { initCustomizer, updateCost } from './customizer.js';
import { initLayoutManager } from './layouts/LayoutManager.js';
import { applyMobileLayout  } from './layouts/MobileLayout.js';
import { applyTabletLayout  } from './layouts/TabletLayout.js';
import { applyDesktopLayout } from './layouts/DesktopLayout.js';
import { initCurrency, getCurrencyBadge } from './currency.js';
import { initAuth } from './auth.js';
import { initCartPersistence, markAuthReady } from './cart-persist.js';
import { initProducts } from './products.js';
import './orders.js';
import './auth-handlers.js';
import './account.js';import { initCarousel } from './utils.js';
import './modals.js';

/* ================================================================
   COUNTDOWN TIMER
   ================================================================ */
function initCountdownTimer() {
  // Persist end time in sessionStorage so it doesn't reset on refresh
  const STORAGE_KEY = 'modart_drop_end';
  let end = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0');
  if (!end || end < Date.now()) {
    end = Date.now() + 48 * 3600 * 1000;
    sessionStorage.setItem(STORAGE_KEY, String(end));
  }

  function tick() {
    const remaining = Math.max(0, end - Date.now());
    const hours   = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const fmt = n => String(n).padStart(2, '0');
    ['h-h', 'h-m', 'h-s'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = fmt([hours, minutes, seconds][i]);
    });
  }
  tick();
  setInterval(tick, 1000);
}

/* ================================================================
   LIVE ORDERS COUNTER — reads from Supabase
   ================================================================ */
async function initLiveOrdersCounter() {
  const el      = document.getElementById('live-count');
  const stockEl = document.getElementById('drop-stock');

  // Set placeholder immediately
  if (el) el.textContent = '—';
  if (stockEl) stockEl.textContent = '—';

  try {
    // Dynamically import supabase to avoid circular deps
    const { supabase } = await import('./auth.js');
    if (!supabase) return;

    // Count orders from last 24h
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);

    if (el && count != null) el.textContent = count;

    // Count total inventory for active drops
    const { data: inv } = await supabase
      .from('inventory')
      .select('stock')
      .gt('stock', 0);
    const totalStock = inv?.reduce((s, r) => s + r.stock, 0) ?? 0;
    if (stockEl) stockEl.textContent = totalStock;
  } catch (e) {
    if (el) el.textContent = '—';
    if (stockEl) stockEl.textContent = '—';
  }
}

/* ================================================================
   CSS ANIMATION INJECTION
   ================================================================ */
function injectRequiredStyles() {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}';
  document.head.appendChild(style);
}

/* ================================================================
   APPLICATION INITIALIZATION
   ================================================================ */
async function initApplication() {
  // 1. Show initial page immediately — don't block on network
  initRouter();

  // 2. Layout
  initLayoutManager();
  function applyCorrectLayout() {
    const w = window.innerWidth;
    if (w < 768)       applyMobileLayout();
    else if (w < 1024) applyTabletLayout();
    else               applyDesktopLayout();
  }
  applyCorrectLayout();
  let layoutTimer;
  window.addEventListener('resize', () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(applyCorrectLayout, 100);
  });

  // 3. Currency (fast, cached in sessionStorage)
  await initCurrency();
  const badge = document.getElementById('currency-badge');
  if (badge) badge.textContent = getCurrencyBadge();

  // 4. Auth — must complete before cart sync
  await initAuth();
  markAuthReady(); // signal cart-persist that auth is resolved
  // Load user-specific wishlist after auth
  if (window.loadWishlistFromSupabase) await window.loadWishlistFromSupabase();

  // 5. Cart — load local first, then merge with cloud
  await initCartPersistence();

  // 6. Products + inventory
  await initProducts();

  // 7. Customizer
  initCustomizer();

  // 8. Render all pages
  renderProducts('home');
  initCarousel();
  window._rebuildCarouselDots && window._rebuildCarouselDots();
  renderProducts('shop');
  renderBag();
  window.renderAccountPage  && window.renderAccountPage();
  window.renderWishlistPage && window.renderWishlistPage();
  updateBadges();
  updateCost();

  // 9. Timers
  initCountdownTimer();
  initLiveOrdersCounter();

  // 10. Misc
  injectRequiredStyles();
  window.initCookieBanner && window.initCookieBanner();

  // 11. Scroll fade-in
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.section, .manifesto, .community, .reviews-section, .early-access, .drop-archive')
    .forEach(el => { el.classList.add('fade-in-section'); fadeObserver.observe(el); });

  // 12. Re-render current page now that data is loaded
  const currentPage = window.getCurrentPage ? window.getCurrentPage() : 'home';
  if (currentPage === 'home' || currentPage === 'shop') {
    renderProducts(currentPage);
    if (currentPage === 'home') window._rebuildCarouselDots && window._rebuildCarouselDots();
  }
}

/* ================================================================
   BOOT
   ================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApplication);
} else {
  initApplication();
}

export { initApplication };
