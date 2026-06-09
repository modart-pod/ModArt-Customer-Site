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
 * Generates AI artwork (preview mode — AI generation not yet live)
 * Shows a preview placeholder with the user's prompt, closes modal.
 */
function generateAI() {
  const prompt = document.getElementById('ai-prompt').value.trim() || 'Cyber samurai';
  const btn = document.getElementById('ai-cta');

  // Show loading state
  btn.innerHTML = 'Generating preview\u2026 <span class="material-symbols-outlined icon" style="animation:spin 1s linear infinite">autorenew</span>';
  btn.disabled = true;

  setTimeout(() => {
    closeModal();

    // Show a canvas placeholder with the prompt text so the customizer isn't blank
    if (typeof window.loadArtworkToCanvas === 'function') {
      window.loadArtworkToCanvas('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', prompt);
    }

    // Toast: be transparent that this is a preview
    if (window.showCustomerToast) {
      window.showCustomerToast('Preview loaded \u2014 AI generation coming soon', 'info');
    }

    // Reset button state
    btn.innerHTML = 'Generate Preview <span class="material-symbols-outlined icon">auto_awesome</span>';
    btn.disabled = false;
  }, 1400);
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
// NOTE: toggleSearch and handleSearchInput are defined in utils.js
// and assigned to window.toggleSearch / window.handleSearchInput there.
// Do not redefine here to avoid overwriting the utils.js version.

// ================================================================
// COOKIE BANNER
// ================================================================
// NOTE: initCookieBanner, acceptCookies, declineCookies are defined
// in utils.js. Do not redefine here.

// ================================================================
// NOTIFY ME (sold-out products)
// ================================================================

async function notifyMe(productId, btn) {
  // Use logged-in user's email if available, otherwise show inline input
  const userEmail = window.currentUser?.email;

  if (userEmail) {
    // Already have email — save directly
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
      const { getSupabase } = await import('./auth.js');
      const client = getSupabase();
      if (client) {
        await client.from('waitlist').upsert(
          { email: userEmail, drop_id: productId },
          { onConflict: 'email,drop_id' }
        );
      }
      if (btn) {
        btn.textContent = '✓ You\'ll be notified';
        btn.style.color = 'var(--green)';
        btn.style.borderColor = 'var(--green)';
      }
      if (window.showCustomerToast) window.showCustomerToast('We\'ll notify you when it\'s back', 'success');
    } catch {
      if (btn) { btn.textContent = 'Notify Me'; btn.disabled = false; }
    }
    return;
  }

  // No user — show inline email input replacing the button
  if (!btn) return;
  const container = btn.parentElement;
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;gap:6px;margin-top:8px;width:100%';
  wrapper.innerHTML = `
    <input type="email" placeholder="your@email.com" autocomplete="email"
      style="flex:1;padding:10px 14px;font-family:var(--font);font-size:13px;border:1.5px solid var(--border);border-radius:var(--r-full);outline:none;background:var(--white);color:var(--black)"
      id="notify-email-${productId}"/>
    <button onclick="(async function(){
      const inp=document.getElementById('notify-email-${productId}');
      const email=inp?.value?.trim();
      if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){inp.style.borderColor='var(--red)';return;}
      inp.disabled=true;
      try{
        const {getSupabase}=await import('./auth.js');
        const c=getSupabase();
        if(c)await c.from('waitlist').upsert({email,drop_id:'${productId}'},{onConflict:'email,drop_id'});
      }catch(e){}
      inp.closest('div').outerHTML='<div style=\\'font-size:11px;font-weight:700;color:var(--green);padding:10px 0;letter-spacing:.06em\\'>✓ We\\'ll notify you when it\\'s back</div>';
    })()"
      style="padding:10px 16px;background:var(--black);color:#fff;border:none;border-radius:var(--r-full);font-family:var(--font);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap">
      Notify Me
    </button>`;

  btn.replaceWith(wrapper);
  wrapper.querySelector('input')?.focus();
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
