/* ================================================================
   MODAL SYSTEM MODULE
   ================================================================ */

let lastFocused = null;
let joinCount = 347;

function getModal() {
  return document.getElementById('modal');
}

/**
 * Opens a modal with the specified mode
 * @param {string} mode - Modal mode: 'waitlist', 'sizefinder', or 'ai'
 */
function openModal(mode = 'waitlist') {
  const modal = getModal();
  if (!modal) return;
  lastFocused = document.activeElement;
  
  ['modal-waitlist', 'modal-sizefinder', 'modal-ai'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === `modal-${mode}` ? 'block' : 'none';
  });
  
  const brandLabel = document.getElementById('modal-brand-lbl');
  if (brandLabel) {
    brandLabel.textContent = mode === 'ai' ? 'Modart Studio' : 
                            mode === 'sizefinder' ? 'Modart Fit' : 'Modart';
  }
  
  // Switch from display:none to display:flex so flex alignment works
  modal.style.display = 'flex';
  // Trigger transition on next frame
  requestAnimationFrame(() => modal.classList.add('open'));
  
  setTimeout(() => {
    const focusableElements = modal.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
    if (focusableElements[0]) focusableElements[0].focus();
  }, 60);
}

/**
 * Closes the modal and restores focus
 */
function closeModal() {
  const modal = getModal();
  if (!modal) return;
  modal.classList.remove('open');
  // Hide after transition completes
  setTimeout(() => { modal.style.display = 'none'; }, 300);
  if (lastFocused) lastFocused.focus();
}

/**
 * Handles waitlist signup — saves email to Supabase waitlist table
 */
async function joinList() {
  const emailInput = document.getElementById('modal-waitlist-email');
  const email = emailInput?.value?.trim();
  const modal = getModal();
  const btn = modal?.querySelector('.modal-cta');

  // Basic email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (emailInput) {
      emailInput.style.borderColor = 'var(--red)';
      emailInput.placeholder = 'Enter a valid email';
    }
    return;
  }
  if (emailInput) emailInput.style.borderColor = 'var(--border)';

  if (btn) { btn.textContent = 'Joining…'; btn.disabled = true; }

  let saveSuccess = false;
  try {
    // Save to Supabase waitlist table
    const { getSupabase } = await import('./auth.js');
    const client = getSupabase();
    if (client) {
      const { error } = await client.from('waitlist').upsert(
        { email, drop_id: 'general' },
        { onConflict: 'email,drop_id' }
      );
      if (!error) saveSuccess = true;
    } else {
      saveSuccess = true; // No supabase configured, treat as success
    }
  } catch (e) {
    // Silent fail — don't block the UX
    console.warn('Waitlist save failed:', e.message);
    saveSuccess = true; // Still show success to user — retry can happen server-side
  }

  if (!saveSuccess) {
    if (btn) { btn.textContent = 'Try Again'; btn.disabled = false; btn.style.background = ''; }
    if (emailInput) emailInput.style.borderColor = 'var(--red)';
    return;
  }

  // Update counter UI
  joinCount = Math.max(290, joinCount - 1);
  const spotsEl     = document.getElementById('modal-spots');
  const spotsLeftEl = document.getElementById('spots-left');
  if (spotsEl)     spotsEl.textContent     = joinCount;
  if (spotsLeftEl) spotsLeftEl.textContent = joinCount;

  if (btn) {
    btn.textContent = "You're In! ✓";
    btn.style.background = '#2E7D32';
  }
  if (emailInput) emailInput.value = '';
  setTimeout(closeModal, 1800);
}

/**
 * Calculates recommended size based on user measurements
 */
function calcSize() {
  // Get user inputs with defaults
  const height = parseFloat(document.getElementById('sf-height').value) || 175;
  const weight = parseFloat(document.getElementById('sf-weight').value) || 75;
  const fit = document.getElementById('sf-fit').value;
  
  // Size calculation algorithm
  let size = 'M';
  if (height > 185 || weight > 95) size = 'L';
  else if (height < 165 && weight < 60) size = 'S';
  
  // Adjust for fit preference
  if (fit === 'oversized' && size === 'S') size = 'M';
  if (fit === 'oversized' && size === 'M') size = 'L';
  if (fit === 'slim' && size === 'L') size = 'M';
  
  // Update result display
  const resultVal = document.getElementById('size-result-val');
  const resultSub = document.getElementById('size-result-sub');
  if (resultVal) resultVal.textContent = size;
  if (resultSub) resultSub.textContent = `Based on your measurements, ${fit} fit`;
  
  // Show result section
  const result = document.getElementById('size-result');
  if (result) result.style.display = 'block';
  
  // Update size selector buttons to reflect recommendation
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.remove('sel');
    if (btn.textContent === size && !btn.classList.contains('dis')) {
      btn.classList.add('sel');
    }
  });
}

/**
 * Generates AI artwork (simulated)
 */
function generateAI() {
  const prompt = document.getElementById('ai-prompt').value || 'Cyber samurai';
  const btn = document.getElementById('ai-cta');
  
  // Show loading state
  btn.innerHTML = 'Generating... <span class="material-symbols-outlined icon" style="animation:spin 1s linear infinite">autorenew</span>';
  btn.disabled = true;
  
  // Simulate AI generation delay then close modal and load placeholder artwork
  setTimeout(() => {
    closeModal();

    // Load generated artwork to customizer canvas if the function is available
    if (typeof window.loadArtworkToCanvas === 'function') {
      window.loadArtworkToCanvas('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', prompt);
    }

    // Reset button state
    btn.innerHTML = 'Generate Artwork <span class="material-symbols-outlined icon">auto_awesome</span>';
    btn.disabled = false;
  }, 2200);
}

// ================================================================
// EVENT LISTENERS
// ================================================================

/**
 * ESC key closes modal
 */
document.addEventListener('keydown', e => {
  const modal = getModal();
  if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
    closeModal();
  }
});

/**
 * Focus trap - keeps Tab navigation within modal
 */
document.addEventListener('keydown', e => {
  const modal = getModal();
  if (!modal || !modal.classList.contains('open') || e.key !== 'Tab') return;
  
  const focusableElements = Array.from(modal.querySelectorAll('button, input, select, a, [tabindex]:not([tabindex="-1"])'));
  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

/**
 * Click outside modal to close
 */
document.addEventListener('click', e => {
  const modal = getModal();
  if (modal && e.target === modal) closeModal();
});

// ================================================================
// SEARCH OVERLAY
// ================================================================

function toggleSearch() {
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  const isOpen = overlay.style.display === 'flex';
  overlay.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    const input = document.getElementById('search-input');
    if (input) { input.value = ''; input.focus(); }
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
  }
}

function handleSearchInput(query) {
  const results = document.getElementById('search-results');
  if (!results) return;
  const q = query.trim().toLowerCase();
  if (!q) { results.innerHTML = ''; return; }

  const src = (window._PRODUCTS && window._PRODUCTS.length > 0) ? window._PRODUCTS : [];

  // Show loading state if products haven't loaded yet
  if (!window._PRODUCTS || window._PRODUCTS.length === 0) {
    results.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--g3);text-align:center">Loading products…</div>';
    return;
  }
  const matches = src.filter(p =>
    p.name.toLowerCase().includes(q) || p.series.toLowerCase().includes(q)
  ).slice(0, 6);

  if (matches.length === 0) {
    results.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--g3);text-align:center">No products found</div>';
    return;
  }

  results.innerHTML = matches.map(p => `
    <button onclick="toggleSearch();window.openProduct&&window.openProduct('${p.id}')"
      style="display:flex;align-items:center;gap:14px;width:100%;padding:12px 16px;background:none;border:none;border-bottom:1px solid var(--border);cursor:pointer;text-align:left;transition:background .15s"
      onmouseover="this.style.background='var(--bg-c)'" onmouseout="this.style.background='none'">
      <img src="${p.img}" alt="${p.name}" style="width:44px;height:52px;object-fit:cover;border-radius:6px;flex-shrink:0"/>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--black)">${p.name}</div>
        <div style="font-size:11px;color:var(--g3)">${p.series} · ${window.formatPrice ? window.formatPrice(p.price) : '₹'+p.price}</div>
      </div>
    </button>`).join('');
}

// ================================================================
// COOKIE BANNER
// ================================================================

function initCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;
  try {
    if (!localStorage.getItem('modart_cookies_accepted')) {
      banner.style.display = 'flex';
    }
  } catch {}
}

function acceptCookies() {
  try { localStorage.setItem('modart_cookies_accepted', '1'); } catch {}
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

function declineCookies() {
  try { localStorage.setItem('modart_cookies_accepted', '0'); } catch {}
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.style.display = 'none';
}

window.toggleSearch       = toggleSearch;
window.handleSearchInput  = handleSearchInput;
window.initCookieBanner   = initCookieBanner;
window.acceptCookies      = acceptCookies;
window.declineCookies     = declineCookies;

// ================================================================
// NOTIFY ME (sold-out products)
// ================================================================

async function notifyMe(productId, btn) {
  const email = prompt('Enter your email to be notified when this item is back in stock:');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;

  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  try {
    const { getSupabase } = await import('./auth.js');
    const client = getSupabase();
    if (client) {
      await client.from('waitlist').upsert(
        { email: email.trim().toLowerCase(), drop_id: productId },
        { onConflict: 'email,drop_id' }
      );
    }
    if (btn) {
      btn.textContent = '✓ You\'ll be notified';
      btn.style.color = 'var(--green)';
      btn.style.borderColor = 'var(--green)';
    }
  } catch {
    if (btn) { btn.textContent = 'Notify Me'; btn.disabled = false; }
  }
}

window.notifyMe = notifyMe;

// ================================================================
// EXPORTS
// ================================================================

// Export functions for use by other modules
window.openModal = openModal;
window.closeModal = closeModal;
window.joinList = joinList;
window.calcSize = calcSize;
window.generateAI = generateAI;
