/**
 * Customizer Engine Module
 * 
 * Handles all customizer functionality including:
 * - Layer management system and drag-and-drop functionality
 * - Transform controls (scale, rotation, opacity)
 * - Undo/redo history management
 * - Quality meter and cost engine calculations
 * - Canvas interaction handlers (mouse and touch)
 * 
 * Requirements: 4.1, 4.7, 4.8
 */

// Imports removed - cart and goTo are not used in this module
import { formatPrice } from './currency.js';

// ================================================================
// CUSTOMIZER STATE
// ================================================================

const cust = {
  layers: [],
  selectedLayer: null,
  history: [],
  future: [],
  snap: true,
  baseCost: 19999,
  printCost: 0,
  zoneCost: 0,
  activeZone: 'front'
};

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function clamp(a, v, b) {
  return Math.min(b, Math.max(a, v));
}

function getCanvasWrap() {
  return document.getElementById('canvas-wrap');
}

// ================================================================
// HISTORY MANAGEMENT (UNDO/REDO)
// ================================================================

function snapShot() {
  cust.history.push(JSON.stringify(cust.layers));
  cust.future = [];
}

function undoLayer() {
  if (cust.history.length === 0) return;
  cust.future.push(JSON.stringify(cust.layers));
  cust.layers = JSON.parse(cust.history.pop());
  rebuildLayerDOM();
}

function redoLayer() {
  if (cust.future.length === 0) return;
  cust.history.push(JSON.stringify(cust.layers));
  cust.layers = JSON.parse(cust.future.pop());
  rebuildLayerDOM();
}
// ================================================================
// LAYER MANAGEMENT SYSTEM
// ================================================================

function createLayerEl(layer) {
  const el = document.createElement('div');
  el.className = 'design-layer';
  el.dataset.id = layer.id;
  el.style.cssText = `left:${layer.x}px;top:${layer.y}px;width:${layer.w}px;height:${layer.h}px;transform:rotate(${layer.r || 0}deg) scale(${layer.s || 1});opacity:${(layer.o || 100) / 100}`;
  
  if (layer.type === 'image') {
    const img = document.createElement('img');
    img.src = layer.src;
    img.alt = 'Design layer';
    img.draggable = false;
    el.appendChild(img);
  } else if (layer.type === 'text') {
    const span = document.createElement('span');
    span.className = 'design-layer-text';
    span.textContent = layer.text;
    span.style.cssText = `font-family:${layer.font};color:${layer.color};font-size:${Math.max(12, layer.h * 0.3)}px`;
    el.appendChild(span);
  }
  
  // Add drag event listeners
  el.addEventListener('mousedown', startDrag);
  el.addEventListener('touchstart', startDragTouch, { passive: false });
  el.addEventListener('click', () => selectLayer(layer.id));
  
  return el;
}

function rebuildLayerDOM() {
  const wrap = getCanvasWrap();
  if (!wrap) return;
  
  // Remove existing layers
  wrap.querySelectorAll('.design-layer').forEach(el => el.remove());
  
  // Add all layers
  cust.layers.forEach(l => {
    const el = createLayerEl(l);
    wrap.appendChild(el);
  });
  
  updateLayersPanel();
}

function selectLayer(id) {
  cust.selectedLayer = id;
  
  // Update visual selection
  document.querySelectorAll('.design-layer').forEach(el => 
    el.classList.toggle('selected', el.dataset.id === id)
  );
  
  const l = cust.layers.find(l => l.id === id);
  if (!l) return;
  
  // Show transform controls
  const ts = document.getElementById('transform-section');
  const qs = document.getElementById('quality-section');
  if (ts) ts.style.display = 'block';
  if (qs) qs.style.display = 'block';
  
  // Update transform sliders
  const ss = document.getElementById('scale-slider');
  const rs = document.getElementById('rot-slider');
  const os = document.getElementById('opacity-slider');
  
  if (ss) {
    ss.value = (l.s || 1) * 100;
    document.getElementById('scale-val').textContent = `${Math.round((l.s || 1) * 100)}%`;
  }
  if (rs) {
    rs.value = l.r || 0;
    document.getElementById('rot-val').textContent = `${l.r || 0}°`;
  }
  if (os) {
    os.value = l.o || 100;
    document.getElementById('opacity-val').textContent = `${l.o || 100}%`;
  }
  
  // Show text tool panel for text layers
  if (l.type === 'text') {
    const ttp = document.getElementById('text-tool-panel');
    if (ttp) {
      ttp.style.display = 'block';
      document.getElementById('text-tool-input').value = l.text || '';
    }
  }
}
function deleteLayer(id) {
  snapShot();
  cust.layers = cust.layers.filter(l => l.id !== id);
  if (cust.selectedLayer === id) cust.selectedLayer = null;
  rebuildLayerDOM();
  updateCost();
}

function updateLayersPanel() {
  const panel = document.getElementById('layers-list');
  if (!panel) return;
  
  if (cust.layers.length === 0) {
    panel.innerHTML = '<div style="font-size:12px;color:var(--g3);text-align:center;padding:20px 0;letter-spacing:.08em;text-transform:uppercase">No layers yet</div>';
    return;
  }
  
  panel.innerHTML = cust.layers.map((l, i) => `
    <div class="layer-item${l.id === cust.selectedLayer ? ' selected' : ''}" onclick="selectLayer('${l.id}')">
      <div class="layer-item-icon">
        <span class="material-symbols-outlined icon">${l.type === 'image' ? 'image' : 'title'}</span>
      </div>
      <div class="layer-item-name">${l.type === 'text' ? l.text.substring(0, 12) || 'Text' : 'Design ' + (i + 1)}</div>
      <button class="layer-item-del" aria-label="Delete layer" onclick="event.stopPropagation();deleteLayer('${l.id}')">
        <span class="material-symbols-outlined icon">delete</span>
      </button>
    </div>`
  ).join('');
}

// ================================================================
// TRANSFORM CONTROLS (SCALE, ROTATION, OPACITY)
// ================================================================

function applyTransform() {
  if (!cust.selectedLayer) return;
  
  const l = cust.layers.find(l => l.id === cust.selectedLayer);
  if (!l) return;
  
  const s = parseInt(document.getElementById('scale-slider').value);
  const r = parseInt(document.getElementById('rot-slider').value);
  const o = parseInt(document.getElementById('opacity-slider').value);
  
  l.s = s / 100;
  l.r = r;
  l.o = o;
  
  // Update display values
  document.getElementById('scale-val').textContent = `${s}%`;
  document.getElementById('rot-val').textContent = `${r}°`;
  document.getElementById('opacity-val').textContent = `${o}%`;
  
  // Apply transform to DOM element
  const el = getCanvasWrap()?.querySelector(`[data-id="${l.id}"]`);
  if (el) {
    el.style.cssText = `left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px;transform:rotate(${l.r}deg) scale(${l.s});opacity:${l.o / 100}`;
  }
}

function centerLayer() {
  if (!cust.selectedLayer) return;
  
  const l = cust.layers.find(l => l.id === cust.selectedLayer);
  if (!l) return;
  
  const wrap = getCanvasWrap();
  if (!wrap) return;
  
  const wr = wrap.getBoundingClientRect();
  l.x = (wr.width - l.w) / 2;
  l.y = (wr.height - l.h) / 2;
  
  const el = wrap.querySelector(`[data-id="${l.id}"]`);
  if (el) {
    el.style.left = `${l.x}px`;
    el.style.top = `${l.y}px`;
  }
}
// ================================================================
// DRAG-AND-DROP FUNCTIONALITY (MOUSE AND TOUCH)
// ================================================================

let dragState = {
  active: false,
  layerId: null,
  startX: 0,
  startY: 0,
  startLX: 0,
  startLY: 0
};

function startDrag(e) {
  if (e.target.closest('.layer-handle')) return;
  
  const el = e.currentTarget;
  const l = cust.layers.find(l => l.id === el.dataset.id);
  if (!l) return;
  
  dragState = {
    active: true,
    layerId: l.id,
    startX: e.clientX,
    startY: e.clientY,
    startLX: l.x,
    startLY: l.y
  };
  
  e.preventDefault();
  selectLayer(l.id);
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function startDragTouch(e) {
  if (!e.touches) return;
  
  const el = e.currentTarget;
  const l = cust.layers.find(l => l.id === el.dataset.id);
  if (!l) return;
  
  dragState = {
    active: true,
    layerId: l.id,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    startLX: l.x,
    startLY: l.y
  };
  
  e.preventDefault();
  selectLayer(l.id);
  
  document.addEventListener('touchmove', onDragTouch, { passive: false });
  document.addEventListener('touchend', endDrag);
}

function onDrag(e) {
  if (!dragState.active) return;
  moveDraggedLayer(e.clientX, e.clientY);
}

function onDragTouch(e) {
  if (!dragState.active || !e.touches) return;
  e.preventDefault();
  moveDraggedLayer(e.touches[0].clientX, e.touches[0].clientY);
}

function moveDraggedLayer(cx, cy) {
  const l = cust.layers.find(l => l.id === dragState.layerId);
  if (!l) return;
  
  l.x = dragState.startLX + (cx - dragState.startX);
  l.y = dragState.startLY + (cy - dragState.startY);
  
  // Apply snapping if enabled
  if (cust.snap) {
    l.x = Math.round(l.x / 4) * 4;
    l.y = Math.round(l.y / 4) * 4;
  }
  
  const el = getCanvasWrap()?.querySelector(`[data-id="${l.id}"]`);
  if (el) {
    el.style.left = `${l.x}px`;
    el.style.top = `${l.y}px`;
  }
}

function endDrag() {
  if (dragState.active) snapShot();
  dragState.active = false;
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDragTouch);
  document.removeEventListener('touchend', endDrag);
}
// ================================================================
// QUALITY METER CALCULATIONS
// ================================================================

function setQuality(score) {
  const bar = document.getElementById('quality-bar');
  const dot = document.getElementById('quality-dot');
  const lbl = document.getElementById('quality-lbl');
  const dpiEl = document.getElementById('quality-dpi');
  
  if (!bar) return;
  
  bar.style.width = `${score}%`;
  
  if (score >= 70) {
    bar.style.background = 'var(--green)';
    dot.style.background = 'var(--green)';
    lbl.textContent = 'Perfect Quality';
    lbl.style.color = 'var(--green)';
    if (dpiEl) dpiEl.textContent = '300+ DPI';
  } else if (score >= 40) {
    bar.style.background = 'var(--amber)';
    dot.style.background = 'var(--amber)';
    lbl.textContent = 'Good Quality';
    lbl.style.color = 'var(--amber)';
    if (dpiEl) dpiEl.textContent = '150–299 DPI';
  } else {
    bar.style.background = 'var(--red)';
    dot.style.background = 'var(--red)';
    lbl.textContent = 'Low Quality';
    lbl.style.color = 'var(--red)';
    if (dpiEl) dpiEl.textContent = '<150 DPI';
  }
}

// ================================================================
// COST ENGINE CALCULATIONS
// ================================================================

function updateCost() {
  const zoneCost = cust.activeZone !== 'front' ? 15 : 0;
  const total = cust.baseCost + cust.printCost + zoneCost;
  
  // Update base cost display
  ['cost-base'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatPrice(cust.baseCost);
  });
  
  // Show/hide zone cost row
  const zr = document.getElementById('cost-zone-row');
  if (zr) zr.style.display = zoneCost > 0 ? 'flex' : 'none';
  
  const zt = document.getElementById('cost-zone');
  if (zt) zt.textContent = `+${zoneCost}`;
  
  // Update total cost
  ['cost-total', 'cost-total-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatPrice(total);
  });
}

// ================================================================
// LAYER CREATION FUNCTIONS
// ================================================================

function loadArtworkToCanvas(src) {
  snapShot();
  
  const wrap = getCanvasWrap();
  if (!wrap) return;
  
  const wr = wrap.getBoundingClientRect();
  const w = Math.min(160, wr.width * 0.5);
  const h = w * 1.2;
  
  const layer = {
    id: 'layer_' + Date.now(),
    type: 'image',
    src,
    x: (wr.width - w) / 2,
    y: (wr.height - h) / 2,
    w,
    h,
    s: 1,
    r: 0,
    o: 100
  };
  
  cust.layers.push(layer);
  const el = createLayerEl(layer);
  wrap.appendChild(el);
  
  selectLayer(layer.id);
  updateLayersPanel();
  updateCost();
  setQuality(85);
  
  document.getElementById('canvas-tip').textContent = 'Drag to reposition · Use sliders to transform';
}
function addTextLayer() {
  snapShot();
  
  document.getElementById('text-tool-panel').style.display = 'block';
  document.getElementById('transform-section').style.display = 'block';
  
  const wrap = getCanvasWrap();
  if (!wrap) return;
  
  const wr = wrap.getBoundingClientRect();
  const w = clamp(120, wr.width * 0.5, 200);
  const h = 48;
  
  const layer = {
    id: 'layer_' + Date.now(),
    type: 'text',
    text: 'YOUR TEXT',
    font: 'Space Grotesk',
    color: '#ffffff',
    x: (wr.width - w) / 2,
    y: wr.height * 0.35,
    w,
    h,
    s: 1,
    r: 0,
    o: 100
  };
  
  cust.layers.push(layer);
  const el = createLayerEl(layer);
  wrap.appendChild(el);
  
  selectLayer(layer.id);
  updateLayersPanel();
}

function updateTextLayer(val) {
  if (!cust.selectedLayer) return;
  
  const l = cust.layers.find(l => l.id === cust.selectedLayer);
  if (!l || l.type !== 'text') return;
  
  l.text = val || 'Text';
  
  const el = getCanvasWrap()?.querySelector(`[data-id="${l.id}"] span`);
  if (el) el.textContent = l.text;
  
  updateLayersPanel();
}

function selFont(btn, font) {
  document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  
  if (!cust.selectedLayer) return;
  
  const l = cust.layers.find(l => l.id === cust.selectedLayer);
  if (!l || l.type !== 'text') return;
  
  l.font = font;
  
  const el = getCanvasWrap()?.querySelector(`[data-id="${l.id}"] span`);
  if (el) el.style.fontFamily = font;
}

function selTextColor(sw, color) {
  document.querySelectorAll('.color-swatches .color-swatch').forEach(s => s.classList.remove('sel'));
  sw.classList.add('sel');
  
  if (!cust.selectedLayer) return;
  
  const l = cust.layers.find(l => l.id === cust.selectedLayer);
  if (!l || l.type !== 'text') return;
  
  l.color = color;
  
  const el = getCanvasWrap()?.querySelector(`[data-id="${l.id}"] span`);
  if (el) el.style.color = color;
}
// ================================================================
// CANVAS INTERACTION HANDLERS
// ================================================================

function uploadDesign(input) {
  if (!input.files?.length) return;
  
  const file = input.files[0];
  const reader = new FileReader();
  
  reader.onload = e => {
    loadArtworkToCanvas(e.target.result, 'Uploaded Design');
    
    // Calculate quality based on image dimensions
    const img = new Image();
    img.onload = () => {
      const dpi = Math.min(img.width, img.height) / 4 * 2.54; // rough estimate
      setQuality(Math.min(100, dpi * 0.33));
    };
    img.src = e.target.result;
  };
  
  reader.readAsDataURL(file);
}

function selectZone(btn, zone) {
  document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  cust.activeZone = zone;
  
  // Show/hide print zones
  ['front', 'back', 'sleeve'].forEach(z => {
    const el = document.getElementById(`zone-${z}`);
    if (el) el.style.display = z === zone ? 'block' : 'none';
  });
  
  updateCost();
}

function selectColour(sw, _colour, img) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('sel'));
  sw.classList.add('sel');
  
  const el = document.getElementById('canvas-product-img');
  if (el && img) el.src = img;
}

function changeCustProduct(val) {
  const priceMap = { hoodie: 19999, tee: 9999, cargo: 14599 };
  cust.baseCost = priceMap[val] || 19999;

  // Track which product is selected so addCustToCart uses the right one
  const productIdMap = { hoodie: 'vanta-hoodie', tee: 'vanta-tee', cargo: 'cargo-pants' };
  window._customizerProductId = productIdMap[val] || 'vanta-hoodie';

  const imgs = {
    hoodie: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=700&q=85',
    tee:    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=700&q=85',
    cargo:  'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=700&q=85',
  };

  const el = document.getElementById('canvas-product-img');
  if (el) el.src = imgs[val] || imgs.hoodie;

  const name = document.getElementById('cust-product-name');
  if (name) {
    name.textContent = {
      hoodie: 'Vanta Hoodie — Black',
      tee:    'Vanta Black Tee — Black',
      cargo:  'Grid Cargo Pants — Black',
    }[val] || '';
  }

  updateCost();
}

function toggleSnap() {
  cust.snap = !cust.snap;
  const btn = document.getElementById('snap-toggle');
  if (btn) btn.textContent = `SNAPPING: ${cust.snap ? 'ON' : 'OFF'}`;
}
// ================================================================
// PRODUCT DETAIL FUNCTIONS (SHARED WITH CUSTOMIZER)
// ================================================================

let baseDetailPrice = 19999;
let printAddon = 0;

function selectPrint(btn, _name, addon) {
  document.querySelectorAll('.print-type-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  
  printAddon = addon;
  const total = baseDetailPrice + printAddon;
  
  const el = document.getElementById('detail-price');
  const btn2 = document.getElementById('detail-price-btn');
  
  if (el) el.textContent = formatPrice(total);
  if (btn2) btn2.textContent = formatPrice(total);
}

function switchImg(thumb, src) {
  document.querySelectorAll('.product-img-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
  
  const main = document.getElementById('product-main-img');
  if (main) main.src = src;
}

function selSize(btn) {
  btn.closest('.size-options')?.querySelectorAll('.size-btn:not(.dis)').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

function toggleAcc(btn) {
  const body = btn.nextElementSibling;
  const isOpen = body.classList.contains('open');
  
  // Close all accordions
  btn.closest('.acc-list')?.querySelectorAll('.acc-body.open').forEach(b => {
    b.classList.remove('open');
    b.previousElementSibling.classList.remove('open');
    b.previousElementSibling.setAttribute('aria-expanded', 'false');
  });
  
  // Open this accordion if it wasn't open
  if (!isOpen) {
    body.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
}

// ================================================================
// INITIALIZATION AND EXPORTS
// ================================================================

function initCustomizer() {
  // Set default product ID for addCustToCart
  window._customizerProductId = 'vanta-hoodie';

  updateCost();
  
  // Set up event listeners for transform sliders
  const scaleSlider = document.getElementById('scale-slider');
  const rotSlider = document.getElementById('rot-slider');
  const opacitySlider = document.getElementById('opacity-slider');
  
  if (scaleSlider) scaleSlider.addEventListener('input', applyTransform);
  if (rotSlider) rotSlider.addEventListener('input', applyTransform);
  if (opacitySlider) opacitySlider.addEventListener('input', applyTransform);
  
  // Set up text tool input listener
  const textInput = document.getElementById('text-tool-input');
  if (textInput) {
    textInput.addEventListener('input', (e) => updateTextLayer(e.target.value));
  }
}

// Export functions for global access
export {
  initCustomizer,
  uploadDesign,
  addTextLayer,
  selectPrint,
  switchImg,
  selSize,
  toggleAcc,
  selectZone,
  selectColour,
  changeCustProduct,
  toggleSnap,
  centerLayer,
  undoLayer,
  redoLayer,
  selFont,
  selTextColor,
  deleteLayer,
  selectLayer,
  loadArtworkToCanvas,
  setQuality,
  updateCost
};

window.addTextLayer      = addTextLayer;
window.selectColour      = selectColour;
window.selectZone        = selectZone;
window.selectPrint       = selectPrint;
window.selSize           = selSize;
window.toggleAcc         = toggleAcc;
window.switchImg         = switchImg;
window.selFont           = selFont;
window.selTextColor      = selTextColor;
window.applyTransform    = applyTransform;
window.centerLayer       = centerLayer;
window.toggleSnap        = toggleSnap;
window.undoLayer         = undoLayer;
window.redoLayer         = redoLayer;
window.changeCustProduct = changeCustProduct;
window.loadArtworkToCanvas = loadArtworkToCanvas;
window.uploadDesign      = uploadDesign;
window.deleteLayer       = deleteLayer;
window.selectLayer       = selectLayer;
window.updateTextLayer   = updateTextLayer;