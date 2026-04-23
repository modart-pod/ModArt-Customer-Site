/**
 * ModArt Drops Module
 *
 * Fetches drops from Supabase and renders them on the customer site.
 * Listens to modart:drop_updated events from realtime.js to stay in sync.
 */

import { getSupabase } from './auth.js';

export let LIVE_DROPS = [];

function sb() { return getSupabase(); }

/**
 * Fetches all active drops from Supabase.
 */
export async function fetchDrops() {
  try {
    const client = sb();
    if (!client) throw new Error('Supabase not available');
    const { data, error } = await client
      .from('drops')
      .select('*')
      .eq('is_active', true)
      .order('launch_at', { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) {
      LIVE_DROPS = data;
    }
  } catch (e) {
    console.warn('[Drops] Fetch failed:', e.message);
  }
  return LIVE_DROPS;
}

/**
 * Renders the drop archive section on the home page.
 * Targets #drop-archive-grid if it exists.
 */
export function renderDropsSection() {
  const grid = document.getElementById('drop-archive-grid');
  if (!grid) return;

  const drops = LIVE_DROPS.length > 0 ? LIVE_DROPS : null;

  // If no live data yet, keep the fallback static list visible
  if (!drops) return;

  // Hide the static fallback list now that we have real data
  const fallback = document.getElementById('drop-list-fallback');
  if (fallback) fallback.style.display = 'none';

  grid.innerHTML = drops.map(drop => {
    const isLive     = drop.status === 'live';
    const isUpcoming = drop.status === 'upcoming';
    const isEnded    = drop.status === 'ended';
    const soldPct    = drop.total_units > 0
      ? Math.min(100, Math.round((drop.sold_units / drop.total_units) * 100))
      : 0;
    const remaining  = Math.max(0, (drop.total_units || 0) - (drop.sold_units || 0));
    const bgColor    = drop.cover_color || '#1A1A1A';

    const statusPill = isLive
      ? `<span class="drop-pill drop-pill-live"><span class="drop-pill-dot"></span>Live Now</span>`
      : isUpcoming
        ? `<span class="drop-pill drop-pill-upcoming"><span class="drop-pill-dot"></span>Upcoming</span>`
        : `<span class="drop-pill drop-pill-ended"><span class="drop-pill-dot"></span>Ended</span>`;

    const launchStr = drop.launch_at
      ? new Date(drop.launch_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    return `
      <div class="drop-archive-card" data-drop-id="${_esc(drop.id)}" style="--drop-bg:${_esc(bgColor)}">
        <div class="drop-archive-cover" style="background:linear-gradient(135deg,${_esc(bgColor)},${_darken(bgColor)})">
          <div class="drop-archive-cover-text">${_esc((drop.name || 'DROP').split(' ')[0].toUpperCase())}</div>
          <div class="drop-archive-overlay">
            ${statusPill}
            ${isLive ? `<div class="drop-archive-time">${remaining} units left</div>` : ''}
            ${isUpcoming && launchStr ? `<div class="drop-archive-time">Drops ${launchStr}</div>` : ''}
          </div>
        </div>
        <div class="drop-archive-body">
          <div class="drop-archive-num">Drop #${drop.drop_number || '—'}</div>
          <div class="drop-archive-name">${_esc(drop.name)}</div>
          ${drop.description ? `<div class="drop-archive-desc">${_esc(drop.description)}</div>` : ''}
          ${isLive || isEnded ? `
            <div class="drop-archive-progress">
              <div class="drop-archive-progress-hdr">
                <span>${isEnded ? 'Sold Out' : 'Sold'}</span>
                <span>${drop.sold_units || 0} / ${drop.total_units || 0}</span>
              </div>
              <div class="drop-archive-bar-wrap">
                <div class="drop-archive-bar" style="width:${soldPct}%"></div>
              </div>
            </div>
          ` : ''}
          ${isLive ? `
            <button class="drop-archive-cta" onclick="window.goTo && window.goTo('shop')">
              Shop Drop — ₹${(drop.price_inr || 0).toLocaleString('en-IN')}
            </button>
          ` : isUpcoming ? `
            <button class="drop-archive-cta drop-archive-cta-outline" onclick="window.openWaitlistModal && window.openWaitlistModal('${_esc(drop.id)}')">
              Notify Me
            </button>
          ` : `
            <button class="drop-archive-cta drop-archive-cta-muted" disabled>Sold Out</button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

/** Simple HTML escape */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Darken a hex color slightly for gradient */
function _darken(hex) {
  try {
    const h = hex.replace('#', '');
    const r = Math.max(0, parseInt(h.slice(0,2), 16) - 30);
    const g = Math.max(0, parseInt(h.slice(2,4), 16) - 30);
    const b = Math.max(0, parseInt(h.slice(4,6), 16) - 30);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return '#0A0A0A'; }
}

/** Fallback drops when Supabase is unavailable — synced with database seed data */
function _getFallbackDrops() {
  return [
    {
      id: 'drop-08',
      name: 'Void Edition',
      drop_number: 8,
      status: 'live',
      cover_color: '#1A1A1A',
      total_units: 120,
      sold_units: 88,
      price_inr: 19999,
      description: 'Engineered for the void. 120 GSM heavyweight oversized silhouette.',
      launch_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      end_at: new Date(Date.now() + 64800000).toISOString(), // 18 hours from now
      is_active: true
    },
    {
      id: 'drop-09',
      name: 'Origin Series',
      drop_number: 9,
      status: 'upcoming',
      cover_color: '#0F0F0F',
      total_units: 150,
      sold_units: 0,
      price_inr: 22999,
      description: 'Where it all began. The original ModArt silhouette, remastered.',
      launch_at: new Date(Date.now() + 259200000).toISOString(), // 3 days from now
      end_at: new Date(Date.now() + 432000000).toISOString(), // 5 days from now
      is_active: true
    },
    {
      id: 'drop-07',
      name: 'Chrome Core',
      drop_number: 7,
      status: 'ended',
      cover_color: '#111111',
      total_units: 100,
      sold_units: 100,
      price_inr: 17999,
      description: 'Sold out in 4h 12m. The fastest sellout in ModArt history.',
      launch_at: new Date(Date.now() - 1209600000).toISOString(), // 14 days ago
      end_at: new Date(Date.now() - 1036800000).toISOString(), // 12 days ago
      is_active: true
    },
  ];
}

/**
 * Initialise drops — fetch from DB and render.
 * Also listens for realtime updates.
 */
export async function initDrops() {
  await fetchDrops();
  renderDropsSection();
  _updateManifestoCounter();

  // Listen for realtime drop updates from realtime.js
  window.addEventListener('modart:drop_updated', () => {
    fetchDrops().then(() => { renderDropsSection(); _updateManifestoCounter(); });
  });
  window.addEventListener('modart:drop_live', () => {
    fetchDrops().then(() => { renderDropsSection(); _updateManifestoCounter(); });
  });
}

function _updateManifestoCounter() {
  const el = document.getElementById('manifesto-drops-live');
  if (!el) return;
  const liveCount = LIVE_DROPS.filter(d => d.status === 'live').length;
  el.textContent = liveCount > 0 ? liveCount : '—';
}

if (typeof window !== 'undefined') {
  window.fetchDrops       = fetchDrops;
  window.renderDropsSection = renderDropsSection;
  window.initDrops        = initDrops;
  window.LIVE_DROPS       = LIVE_DROPS;
}
