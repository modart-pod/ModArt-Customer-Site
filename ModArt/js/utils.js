/**
 * Utility Functions Module
 * 
 * Reusable helper functions for common operations throughout the ModArt application.
 * Extracted from the original modart_v4.html file to promote code reusability and maintainability.
 */

/**
 * Constrains a value between a minimum and maximum range
 * @param {number} min - Minimum allowed value
 * @param {number} value - Value to constrain
 * @param {number} max - Maximum allowed value
 * @returns {number} Constrained value between min and max
 */
export function clamp(min, value, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Formats a price value with proper currency display
 * @param {number} price - Price value to format
 * @param {boolean} showCents - Whether to show cents (default: true)
 * @returns {string} Formatted price string with dollar sign
 */
export function formatPrice(price, showCents = true) {
  if (typeof price !== 'number' || isNaN(price)) {
    return '?0';
  }
  
  if (showCents) {
    return `$${price.toFixed(2)}`;
  } else {
    return `$${Math.round(price)}.00`;
  }
}

/**
 * Creates a debounced version of a function that delays execution until after
 * a specified wait time has elapsed since the last time it was invoked
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generates a unique ID using timestamp and random number
 * @param {string} prefix - Optional prefix for the ID (default: 'id')
 * @returns {string} Unique identifier
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Safely parses a numeric value, returning a default if invalid
 * @param {any} value - Value to parse as number
 * @param {number} defaultValue - Default value if parsing fails (default: 0)
 * @returns {number} Parsed number or default value
 */
export function safeParseNumber(value, defaultValue = 0) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} String with first letter capitalized
 */
export function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncates a string to a specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @param {string} suffix - Suffix to add when truncated (default: '...')
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength, suffix = '...') {
  if (typeof str !== 'string') {
    return '';
  }
  
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export async function handleContactSubmit() {
  const name    = document.getElementById('contact-name')?.value?.trim();
  const email   = document.getElementById('contact-email')?.value?.trim();
  const subject = document.getElementById('contact-subject')?.value?.trim();
  const message = document.getElementById('contact-message')?.value?.trim();
  const errEl   = document.getElementById('contact-error');
  const sucEl   = document.getElementById('contact-success');
  if (errEl) { errEl.style.display='none'; errEl.textContent=''; }
  if (sucEl) { sucEl.style.display='none'; }

  if (!name || !email || !subject || !message) {
    if (errEl) { errEl.textContent='Please fill in all fields.'; errEl.style.display='block'; }
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent='Please enter a valid email address.'; errEl.style.display='block'; }
    return;
  }

  const btn = document.querySelector('#page-contact .btn-red');
  if (btn) { btn.textContent='SendingGÇª'; btn.disabled=true; }

  try {
    const res = await fetch('/api/send-contact-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, subject, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Send failed');
    if (sucEl) { sucEl.textContent = "Message sent! We'll reply within 24 hours."; sucEl.style.display='block'; }
    document.getElementById('contact-name').value    = '';
    document.getElementById('contact-email').value   = '';
    document.getElementById('contact-subject').value = '';
    document.getElementById('contact-message').value = '';
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || 'Could not send message. Please try again.'; errEl.style.display='block'; }
  } finally {
    if (btn) { btn.textContent='Send Message'; btn.disabled=false; }
  }
}

if (typeof window !== 'undefined') {
  window.handleContactSubmit = handleContactSubmit;
}

/* ================================================================
   SEARCH
   ================================================================ */

export function toggleSearch() {
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  const isOpen = overlay.classList.contains('open');
  if (isOpen) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  } else {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('open'));
    const input = document.getElementById('search-input');
    if (input) { input.value = ''; input.focus(); }
    document.getElementById('search-results')?.replaceChildren();
  }
}

export function handleSearch(query) {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;
  const q = (query || '').trim().toLowerCase();
  if (!q) { resultsEl.replaceChildren(); return; }
  const products = window._PRODUCTS || [];
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.series.toLowerCase().includes(q)
  );
  if (!matches.length) {
    resultsEl.innerHTML = '<div style="padding:20px;text-align:center;font-size:12px;color:var(--g3);letter-spacing:.08em;text-transform:uppercase">No results found</div>';
    return;
  }
  // Use textContent for user-visible data to prevent XSS
  resultsEl.replaceChildren();
  matches.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'search-result-item';
    btn.style.cssText = 'display:flex;align-items:center;gap:14px;width:100%;padding:12px 20px;background:none;border:none;border-bottom:1px solid var(--border);cursor:pointer;font-family:var(--font);text-align:left;transition:background var(--t)';
    btn.addEventListener('mouseover', () => btn.style.background = 'var(--bg-c)');
    btn.addEventListener('mouseout',  () => btn.style.background = 'none');
    btn.addEventListener('click', () => {
      window.openProduct && window.openProduct(p.id);
      window.toggleSearch && window.toggleSearch();
    });
    const img = document.createElement('img');
    img.src = p.img; img.alt = p.name;
    img.style.cssText = 'width:44px;height:44px;object-fit:cover;border-radius:var(--r-sm);flex-shrink:0';
    const info = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--black)';
    nameEl.textContent = p.name;
    const seriesEl = document.createElement('div');
    seriesEl.style.cssText = 'font-size:10px;color:var(--g3);letter-spacing:.08em;text-transform:uppercase;margin-top:2px';
    seriesEl.textContent = p.series;
    info.appendChild(nameEl);
    info.appendChild(seriesEl);
    btn.appendChild(img);
    btn.appendChild(info);
    resultsEl.appendChild(btn);
  });
}

// Debounced version for input events
let _searchTimer;
export function handleSearchDebounced(query) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => handleSearch(query), 280);
}

/* ================================================================
   IMAGE ZOOM
   ================================================================ */

export function zoomImage(img) {
  if (!img) return;
  const isZoomed = img.classList.contains('zoomed');
  if (isZoomed) { resetZoom(img); return; }
  img.classList.add('zoomed');
  img.style.transform = 'scale(1.85)';
  img.style.cursor = 'zoom-out';
  img.style.transition = 'transform .3s ease';
  img.style.transformOrigin = '50% 50%';
  img.addEventListener('mousemove', _trackZoom);
}

export function resetZoom(img) {
  if (!img) return;
  img.classList.remove('zoomed');
  img.style.transform = '';
  img.style.cursor = 'zoom-in';
  img.removeEventListener('mousemove', _trackZoom);
}

function _trackZoom(e) {
  const rect = this.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  this.style.transformOrigin = `${x}% ${y}%`;
}

/* ================================================================
   COOKIE CONSENT
   ================================================================ */

export function initCookieBanner() {
  if (localStorage.getItem('modart_cookies_accepted')) return;
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'flex';
}

export function acceptCookies() {
  localStorage.setItem('modart_cookies_accepted', '1');
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

export function declineCookies() {
  localStorage.setItem('modart_cookies_accepted', '0');
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.toggleSearch          = toggleSearch;
  window.handleSearch          = handleSearch;
  window.handleSearchDebounced = handleSearchDebounced;
  window.zoomImage      = zoomImage;
  window.resetZoom      = resetZoom;
  window.initCookieBanner = initCookieBanner;
  window.acceptCookies  = acceptCookies;
  window.declineCookies = declineCookies;
}

export function toggleMobileMenu() {
  const overlay = document.getElementById('mobile-menu-overlay');
  const drawer  = document.getElementById('mobile-menu-drawer');
  if (!overlay || !drawer) return;
  const isOpen = drawer.style.display === 'flex';
  overlay.style.display = isOpen ? 'none' : 'block';
  drawer.style.display  = isOpen ? 'none' : 'flex';
  document.body.style.overflow = isOpen ? '' : 'hidden';
}
if (typeof window !== 'undefined') {
  window.toggleMobileMenu = toggleMobileMenu;
}

// GöÇGöÇ Dark / Light theme toggle GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ
export function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('modart-theme', next); } catch(e) {}
}

// Apply saved theme on load (call this as early as possible)
export function applyStoredTheme() {
  try {
    const saved = localStorage.getItem('modart-theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch(e) {}
}

if (typeof window !== 'undefined') {
  window.toggleTheme = toggleTheme;
  window.applyStoredTheme = applyStoredTheme;
}

/* ================================================================
   HOME CAROUSEL
   ================================================================ */

export function initCarousel() {
  const track = document.getElementById('home-product-grid');
  const dotsEl = document.getElementById('carousel-dots');
  if (!track || !dotsEl) return;

  const cards = () => Array.from(track.querySelectorAll('.product-card'));

  // Build dots once cards are rendered
  function buildDots() {
    const items = cards();
    if (!items.length) return;
    dotsEl.innerHTML = items.map((_, i) =>
      `<button class="carousel-dot${i === 0 ? ' active' : ''}" aria-label="Go to slide ${i + 1}" onclick="scrollCarouselTo(${i})"></button>`
    ).join('');
  }

  // Sync active dot on scroll
  track.addEventListener('scroll', () => {
    const items = cards();
    if (!items.length) return;
    const scrollLeft = track.scrollLeft;
    const cardW = items[0].offsetWidth + 16; // width + gap
    const idx = Math.round(scrollLeft / cardW);
    dotsEl.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }, { passive: true });

  // Expose rebuild so renderProducts can call it after injecting cards
  window._rebuildCarouselDots = buildDots;
}

export function scrollCarousel(dir) {
  const track = document.getElementById('home-product-grid');
  if (!track) return;
  const cards = track.querySelectorAll('.product-card');
  if (!cards.length) return;
  const cardW = cards[0].offsetWidth + 16;
  track.scrollBy({ left: dir * cardW * 2, behavior: 'smooth' });
}

export function scrollCarouselTo(idx) {
  const track = document.getElementById('home-product-grid');
  if (!track) return;
  const cards = track.querySelectorAll('.product-card');
  if (!cards[idx]) return;
  const cardW = cards[0].offsetWidth + 16;
  track.scrollTo({ left: idx * cardW, behavior: 'smooth' });
}

if (typeof window !== 'undefined') {
  window.scrollCarousel   = scrollCarousel;
  window.scrollCarouselTo = scrollCarouselTo;
  window.initCarousel     = initCarousel;
}



