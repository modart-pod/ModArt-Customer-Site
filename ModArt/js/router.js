/**
 * Router Module - History API (clean URL) Navigation
 * URLs: /shop, /customize, /bag etc. — no # prefix
 */

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
  admin:            'page-admin'
};

/** Resolve pathname to a page name */
function pathToPage(pathname) {
  const clean = pathname.replace(/^\//, '').split('?')[0].split('#')[0] || 'home';
  return PAGES[clean] ? clean : 'home';
}

/** Navigate to a page using pushState */
export function goTo(pageName) {
  const page = pageName || 'home';
  const path = page === 'home' ? '/' : '/' + page;
  if (window.location.pathname !== path) {
    history.pushState({ page }, '', path);
  }
  showPage(page);
  updateMeta(page);
}

/** Display the specified page and hide all others */
export function showPage(pageName) {
  if (!PAGES[pageName]) pageName = 'home';

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(PAGES[pageName]);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  updateNavState(pageName);
  triggerPageRender(pageName);
}

function triggerPageRender(pageName) {
  switch (pageName) {
    case 'home':
    case 'shop':
      window.renderProducts && window.renderProducts(pageName);
      break;
    case 'product':
      window.renderProductDetail && window.renderProductDetail();
      window.renderRelatedProducts && window.renderRelatedProducts();
      if (window._currentProductId) {
        window.renderSizeOptions && window.renderSizeOptions(window._currentProductId);
      } else if (window._PRODUCTS?.[0]) {
        window.renderSizeOptions && window.renderSizeOptions(window._PRODUCTS[0].id);
      }
      break;
    case 'bag':
      window.renderBag && window.renderBag();
      break;
    case 'checkout':
      window.renderBag && window.renderBag();
      window.populateCheckoutSummary && window.populateCheckoutSummary();
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

function updateNavState(pageName) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const desktopMap = { home:'nl-home', shop:'nl-shop', customize:'nl-customize' };
  const dlEl = desktopMap[pageName] && document.getElementById(desktopMap[pageName]);
  if (dlEl) dlEl.classList.add('active');

  document.querySelectorAll('.mob-nav-item').forEach(i => i.classList.remove('active'));
  const mobileMap = { home:'mob-nav-home', shop:'mob-nav-shop', customize:'mob-nav-customize', bag:'mob-nav-bag' };
  const mlEl = mobileMap[pageName] && document.getElementById(mobileMap[pageName]);
  if (mlEl) mlEl.classList.add('active');

  const mobileHdr = document.getElementById('mobile-hdr');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const hideChrome = pageName === 'admin' || pageName === 'customize';
  if (mobileHdr) mobileHdr.style.display = pageName === 'admin' ? 'none' : '';
  if (mobileNav) mobileNav.style.display = hideChrome ? 'none' : '';
}

export function getCurrentPage() {
  return pathToPage(window.location.pathname);
}

export function initRouter() {
  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    const page = e.state?.page || pathToPage(window.location.pathname);
    showPage(page);
    updateMeta(page);
  });

  // Handle legacy hash URLs (redirect to clean URL)
  if (window.location.hash && window.location.hash.length > 1) {
    const hashPage = window.location.hash.slice(1);
    if (PAGES[hashPage]) {
      const path = hashPage === 'home' ? '/' : '/' + hashPage;
      history.replaceState({ page: hashPage }, '', path);
      showPage(hashPage);
      updateMeta(hashPage);
      initNavScroll();
      return;
    }
  }

  // Show initial page from URL path
  const initial = pathToPage(window.location.pathname);
  history.replaceState({ page: initial }, '', window.location.pathname);
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

function initNavScroll() {
  const nav = document.querySelector('.desktop-nav');
  if (!nav) return;

  function update() {
    const onHome = window.location.pathname === '/' || window.location.pathname === '/home';
    const transparent = onHome && window.scrollY < 80;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    if (transparent) {
      nav.style.background           = 'rgba(0,0,0,0)';
      nav.style.borderBottomColor    = 'rgba(255,255,255,0)';
      nav.style.backdropFilter       = 'blur(0px)';
      nav.style.webkitBackdropFilter = 'blur(0px)';
      nav.querySelectorAll('.nav-link, .nav-logo').forEach(l => l.style.color = 'rgba(255,255,255,0.82)');
      nav.querySelectorAll('.nav-icon-btn').forEach(i => i.style.color = 'rgba(255,255,255,0.82)');
    } else {
      // Always dark nav when scrolled or on non-home pages
      nav.style.background           = 'rgba(10,10,10,0.95)';
      nav.style.borderBottomColor    = 'rgba(255,255,255,0.08)';
      nav.style.backdropFilter       = 'blur(16px)';
      nav.style.webkitBackdropFilter = 'blur(16px)';
      nav.querySelectorAll('.nav-link, .nav-logo').forEach(l => l.style.color = '');
      nav.querySelectorAll('.nav-icon-btn').forEach(i => i.style.color = '');
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('popstate', () => setTimeout(update, 30));
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  update();
}

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
