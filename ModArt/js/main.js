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
import { initRealtime } from './realtime.js';
import { initDrops } from './drops.js';
import './orders.js';
import './auth-handlers.js';
import './account.js';
import { initCarousel } from './utils.js';
import './modals.js';
import { showCustomerToast } from './toast.js';

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

  if (el) el.textContent = '—';
  if (stockEl) stockEl.textContent = '—';

  // Cache result for 5 minutes — avoid hitting Supabase on every page load
  const CACHE_KEY = 'modart_live_counter';
  const CACHE_TTL = 5 * 60 * 1000;
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (el) el.textContent = cached.count;
      if (stockEl) stockEl.textContent = cached.stock;
      return;
    }
  } catch {}

  try {
    const { supabase } = await import('./auth.js');
    if (!supabase) return;

    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);

    const { data: inv } = await supabase
      .from('inventory')
      .select('stock')
      .gt('stock', 0);
    const totalStock = inv?.reduce((s, r) => s + r.stock, 0) ?? 0;

    if (el && count != null) el.textContent = count;
    if (stockEl) stockEl.textContent = totalStock;

    // Cache the result
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count: count ?? '—', stock: totalStock, ts: Date.now() }));
    } catch {}
  } catch {
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

// Helper — calls loader progress if available, silently skips if not
function lp(pct, msg) {
  if (window.setLoaderProgress) window.setLoaderProgress(pct, msg);
}

// Wraps a promise with a timeout — resolves/rejects after ms if the promise hasn't settled
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => {
      console.warn(`[loader] "${label}" timed out after ${ms}ms — continuing`);
      resolve(); // resolve (not reject) so the chain always continues
    }, ms))
  ]);
}

async function initApplication() {
  // 0. Wait for Supabase credentials before doing anything auth-related
  if (window.__configReady) await withTimeout(window.__configReady, 4000, 'config fetch');

  // 1. Router + Layout
  lp(8, 'Initialising\u2026');
  initRouter();
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

  // 2. Currency
  lp(14, 'Loading settings\u2026');
  await withTimeout(initCurrency(), 4000, 'initCurrency');
  const badge = document.getElementById('currency-badge');
  if (badge) badge.textContent = getCurrencyBadge();

  // 3. Auth
  lp(22, 'Checking your account\u2026');
  await withTimeout(initAuth(), 6000, 'initAuth');
  markAuthReady();
  if (window.loadWishlistFromSupabase) {
    await withTimeout(window.loadWishlistFromSupabase(), 5000, 'loadWishlist');
  }

  // 4. Cart
  lp(38, 'Loading your cart\u2026');
  await withTimeout(initCartPersistence(), 5000, 'initCartPersistence');

  // 5. Products + inventory
  lp(52, 'Fetching products\u2026');
  await withTimeout(initProducts(), 8000, 'initProducts');

  // Strip any cart items that reference products no longer in the catalogue
  try {
    const { cart: cartState } = await import('./state.js');
    if (window._PRODUCTS && window._PRODUCTS.length > 0) {
      const validIds = new Set(window._PRODUCTS.map(p => p.id));
      const before = cartState.items.length;
      cartState.items = cartState.items.filter(i => validIds.has(i.productId));
      if (cartState.items.length !== before) {
        if (window.saveCartLocal) window.saveCartLocal();
        if (window.updateBadges) window.updateBadges();
      }
    }
  } catch (e) { /* non-critical */ }

  // 6. Realtime + Drops
  lp(70, 'Connecting live updates\u2026');
  initRealtime();
  await withTimeout(initDrops(), 6000, 'initDrops');

  // 7. Customizer
  lp(80, 'Loading studio\u2026');
  try { initCustomizer(); } catch (e) { console.warn('initCustomizer failed:', e); }

  // 8. Render
  lp(90, 'Rendering collection\u2026');
  try { initCarousel(); } catch (e) { console.warn('initCarousel failed:', e); }
  try { renderBag(); } catch (e) { console.warn('renderBag failed:', e); }
  window.renderAccountPage  && window.renderAccountPage();
  window.renderWishlistPage && window.renderWishlistPage();
  updateBadges();
  updateCost();

  // 9. Timers + misc
  lp(96, 'Almost ready\u2026');
  initCountdownTimer();
  initLiveOrdersCounter();
  window.initCookieBanner && window.initCookieBanner();

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

  // 10. Re-render current page
  try {
    const currentPage = window.getCurrentPage ? window.getCurrentPage() : 'home';
    if (currentPage === 'home' || currentPage === 'shop') {
      renderProducts(currentPage);
      if (currentPage === 'home') window._rebuildCarouselDots && window._rebuildCarouselDots();
    }
  } catch (e) {
    console.warn('renderProducts failed during init:', e);
  }

  // 11. Done — animate to 100% then hide loader
  lp(100, 'Welcome to ModArt');
  const loader = document.getElementById('modart-loader');
  if (loader) {
    setTimeout(() => loader.classList.add('hidden'), 800);
  }
}

/* ================================================================
   BOOT
   ================================================================ */
function bootApp() {
  initApplication().catch(err => {
    console.error('[ModArt] initApplication crashed:', err);
    // Force the loader to hide even if init blew up
    lp(100, 'Welcome to ModArt');
    const loader = document.getElementById('modart-loader');
    if (loader) setTimeout(() => loader.classList.add('hidden'), 800);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

export { initApplication };
