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
  
  modal.classList.add('open');
  
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
  if (lastFocused) lastFocused.focus();
}

/**
 * Handles waitlist signup
 */
function joinList() {
  joinCount = Math.max(290, joinCount - 1);
  const spotsEl     = document.getElementById('modal-spots');
  const spotsLeftEl = document.getElementById('spots-left');
  if (spotsEl)     spotsEl.textContent     = joinCount;
  if (spotsLeftEl) spotsLeftEl.textContent = joinCount;

  const modal = getModal();
  const btn = modal?.querySelector('.modal-cta');
  if (btn) {
    btn.textContent = "You're In! ✓";
    btn.style.background = '#2E7D32';
  }
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
// EXPORTS
// ================================================================

// Export functions for use by other modules
window.openModal = openModal;
window.closeModal = closeModal;
window.joinList = joinList;
window.calcSize = calcSize;
window.generateAI = generateAI;