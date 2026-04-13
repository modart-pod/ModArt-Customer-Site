/**
 * Router Module - Hash-based Navigation System
 */

// Page mapping - maps route names to DOM element IDs
const PAGES = {
  home:             'page-home',
  shop:             'page-shop',
  product:          'page-product',
  customize:        'page-customize',
  bag:              'page-bag',
  checkout:         'page-checkout',
  confirmation:     'page-confirmation',
  orders:           'page-orders',
  login:            'page-login',
  register:         'page-register',
  'forgot-password':'page-forgot-password',
  privacy:          'page-privacy',
  terms:            'page-terms',
  about:            'page-about',
  contact:          'page-contact',
  faq:              'page-faq',
  account:          'page-account',
  wishlist:         'page-wishlist',
  community:        'page-community',
  admin:            'page-admin'
};

/**
 * Navigate to a page. Always calls showPage() directly so navigation
 * works even when the hash value doesn't change.
 */
export function goTo(pageName) {
  const page = pageName || 'home';
  // Update hash without relying on hashchange to drive rendering
  if (location.hash !== '#' + page) {
    location.hash = page;
  } else {
    // Hash already matches — showPage won't fire via hashchange, call directly
    showPage(page);
  }
  updateMeta(page);
}

/**
 * Display the specified page and hide all others.
 */
export function showPage(pageName) {
  if (!PAGES[pageName]) pageName = 'home';

  // Hide all pages
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

  // Show target
  const target = document.getElementById(PAGES[pageName]);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  updateNavState(pageName);
  triggerPageRender(pageName);
}

/**
 * Trigger page-specific rendering functions.
 */
function triggerPageRender(pageName) {
  switch (pageName) {
    case 'home':
    case 'shop':
      window.renderProducts && window.renderProducts(pageName);
      break;

    case 'product':
      window.renderProductDetail && window.renderProductDetail();
      window.renderRelatedProducts && window.renderRelatedProducts();
      // Use the currently selected product ID, not just index 0
      if (window._currentProductId) {
        window.renderSizeOptions && window.renderSizeOptions(window._currentProductId);
      } else if (window._PRODUCTS?.[0]) {
        window.renderSizeOptions && window.renderSizeOptions(window._PRODUCTS[0].id);
      }
      break;

    case 'bag':
      window.renderBag && window.renderBag();
      break;

    case 'account':
      window.renderAccountPage && window.renderAccountPage();
      break;

    case 'wishlist':
      window.renderWishlistPage && window.renderWishlistPage();
      break;

    case 'orders':
      window.renderOrdersPage && window.renderOrdersPage();
      break;

    case 'confirmation':
      window.renderConfirmationPage && window.renderConfirmationPage();
      break;
  }
}

/**
 * Update nav active states and mobile nav visibility.
 */
function updateNavState(pageName) {
  // Desktop nav
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const desktopMap = { home:'nl-home', shop:'nl-shop', customize:'nl-customize', community:'nl-community' };
  const dlEl = desktopMap[pageName] && document.getElementById(desktopMap[pageName]);
  if (dlEl) dlEl.classList.add('active');

  // Mobile bottom nav
  document.querySelectorAll('.mob-nav-item').forEach(i => i.classList.remove('active'));
  const mobileMap = { home:'mob-nav-home', shop:'mob-nav-shop', customize:'mob-nav-customize', bag:'mob-nav-bag', community:'mob-nav-community' };
  const mlEl = mobileMap[pageName] && document.getElementById(mobileMap[pageName]);
  if (mlEl) mlEl.classList.add('active');

  // Hide mobile chrome on admin/customize
  const mobileHdr = document.getElementById('mobile-hdr');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const hideChrome = pageName === 'admin' || pageName === 'customize';
  if (mobileHdr) mobileHdr.style.display = pageName === 'admin' ? 'none' : '';
  if (mobileNav) mobileNav.style.display = hideChrome ? 'none' : '';
}

export function getCurrentPage() {
  return location.hash.slice(1) || 'home';
}

/**
 * Initialize the router. Call once after DOM is ready.
 */
export function initRouter() {
  // hashchange drives navigation from browser back/forward and direct URL changes
  window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1) || 'home';
    showPage(page);
    updateMeta(page);
  });

  // Show the initial page
  const initial = location.hash.slice(1) || 'home';
  showPage(initial);
  updateMeta(initial);

  // data-nav attribute delegation
  document.addEventListener('click', e => {
    const navTarget = e.target.closest('[data-nav]');
    if (navTarget) {
      e.preventDefault();
      goTo(navTarget.dataset.nav);
    }
  });

  initNavScroll();
}

/**
 * Transparent nav on home hero, opaque elsewhere.
 * Dark-mode aware. Observes theme attribute changes.
 */
function initNavScroll() {
  const nav = document.querySelector('.desktop-nav');
  if (!nav) return;

  function update() {
    const onHome = !location.hash || location.hash === '#' || location.hash === '#home';
    const transparent = onHome && window.scrollY < 80;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    if (transparent) {
      nav.style.background        = 'rgba(0,0,0,0)';
      nav.style.borderBottomColor = 'rgba(255,255,255,0)';
      nav.style.backdropFilter    = 'blur(0px)';
      nav.style.webkitBackdropFilter = 'blur(0px)';
      nav.querySelectorAll('.nav-link, .nav-logo').forEach(l => l.style.color = 'rgba(255,255,255,0.82)');
      nav.querySelectorAll('.nav-icon-btn').forEach(i => i.style.color = 'rgba(255,255,255,0.82)');
      const logo = nav.querySelector('.nav-logo-img');
      if (logo) logo.style.filter = 'brightness(0) invert(1)';
    } else {
      nav.style.background        = dark ? 'rgba(13,13,26,0.95)' : 'rgba(247,245,241,0.97)';
      nav.style.borderBottomColor = dark ? 'rgba(124,58,237,0.22)' : 'rgba(226,223,216,1)';
      nav.style.backdropFilter    = 'blur(16px)';
      nav.style.webkitBackdropFilter = 'blur(16px)';
      nav.querySelectorAll('.nav-link, .nav-logo').forEach(l => l.style.color = '');
      nav.querySelectorAll('.nav-icon-btn').forEach(i => i.style.color = '');
      const logo = nav.querySelector('.nav-logo-img');
      if (logo) logo.style.filter = dark ? 'brightness(0) invert(1)' : 'brightness(0) invert(0)';
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('hashchange', () => setTimeout(update, 30));
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  update();
}

// Global exposure for inline onclick handlers
if (typeof window !== 'undefined') {
  window.goTo = goTo;
  window.showPage = showPage;
  window.getCurrentPage = getCurrentPage;
}

/* ================================================================
   SEO META UPDATES
   ================================================================ */

const META_MAP = {
  home:        { title: 'ModArt — Premium Custom Garment Studio',     desc: 'Design your own limited drop. Wear art that means something. Built for creators, worn by culture.' },
  shop:        { title: 'Shop — ModArt',                               desc: 'Browse the latest limited drops. Premium streetwear, made in-house.' },
  product:     { title: 'Product — ModArt',                            desc: 'Limited release. Premium quality. Made to order.' },
  customize:   { title: 'Design Studio — ModArt',                      desc: 'Upload your art, generate AI designs, and create your own limited drop.' },
  bag:         { title: 'Your Bag — ModArt',                           desc: 'Review your selected items and proceed to checkout.' },
  checkout:    { title: 'Checkout — ModArt',                           desc: 'Secure checkout. SSL encrypted.' },
  confirmation:{ title: 'Order Confirmed — ModArt',                    desc: 'Your order has been placed successfully.' },
  orders:      { title: 'My Orders — ModArt',                          desc: 'Track your ModArt orders.' },
  account:     { title: 'My Account — ModArt',                         desc: 'Manage your orders, profile, and preferences.' },
  wishlist:    { title: 'Wishlist — ModArt',                           desc: 'Your saved ModArt pieces.' },
  community:   { title: 'Community — ModArt',                          desc: 'Creator spotlight, leaderboard, and community drops.' },
  login:       { title: 'Sign In — ModArt',                            desc: 'Sign in to your ModArt account.' },
  register:    { title: 'Create Account — ModArt',                     desc: 'Join ModArt. First access every drop.' },
  'forgot-password': { title: 'Reset Password — ModArt',              desc: 'Reset your ModArt account password.' },
  privacy:     { title: 'Privacy Policy — ModArt',                     desc: 'How ModArt handles your personal data.' },
  terms:       { title: 'Terms & Conditions — ModArt',                 desc: 'ModArt terms of service.' },
  about:       { title: 'About — ModArt',                              desc: 'The story behind ModArt.' },
  contact:     { title: 'Contact — ModArt',                            desc: 'Get in touch with the ModArt team.' },
  faq:         { title: 'FAQ — ModArt',                                desc: 'Frequently asked questions about ModArt.' },
  admin:       { title: 'Admin — ModArt',                              desc: '' },
};

function updateMeta(pageName) {
  const meta = META_MAP[pageName] || META_MAP.home;
  document.title = meta.title;
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) descEl.setAttribute('content', meta.desc);
}
