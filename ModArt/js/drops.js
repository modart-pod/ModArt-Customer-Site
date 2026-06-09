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
      // Deduplicate by drop_number (true unique key) — handles DB duplicates with different IDs
      const seen = new Set();
      LIVE_DROPS = data.filter(d => {
        const key = d.drop_number ?? d.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 10); // cap at 10 max
    }
  } catch (e) {
    console.warn('[Drops] Fetch failed:', e.message);
  }
  return LIVE_DROPS;
}

/**
 * Renders the drop archive section on the home page.
 * On mobile: renders as compact list rows. On desktop: card grid.
 */
export function renderDropsSection() {
  const grid = document.getElementById('drop-archive-grid');
  if (!grid) return;

  const drops = LIVE_DROPS.length > 0 ? LIVE_DROPS : null;

  // If no live data yet, keep the fallback static list visible
  if (!drops) return;

  // On mobile, render as list rows (same as fallback) — no huge cards
  const isMobile = window.innerWidth < 600;
  if (isMobile) {
    const fallback = document.getElementById('drop-list-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
      fallback.style.flexDirection = 'column';
      fallback.innerHTML = drops.map(drop => {
        const isLive = drop.status === 'live';
        const isUpcoming = drop.status === 'upcoming';
        const statusLabel = isLive ? 'Live Now' : isUpcoming ? 'Upcoming' : 'Sold Out';
        const statusClass = isLive ? 'drop-live' : isUpcoming ? '' : 'drop-sold';
        const statusColor = isUpcoming ? 'color:var(--amber)' : '';
        return `<div class="drop-row" onclick="window.goTo&&window.goTo('shop')">
          <div class="drop-num">${String(drop.drop_number || '—').padStart(2,'0')}</div>
          <div class="drop-info">
            <div class="drop-name">${_esc(drop.name)}</div>
            <div class="drop-meta">${statusLabel} · ${drop.total_units||0} Units${drop.sold_units ? ` · ${drop.sold_units} Sold` : ''}</div>
          </div>
          <div class="drop-status ${statusClass}" style="${statusColor}">${statusLabel}</div>
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--g3)">arrow_forward</span>
        </div>`;
      }).join('');
    }
    // Remove any card-style elements that may have been injected
    grid.querySelectorAll('.drop-archive-card').forEach(el => el.remove());
    return;
  }

  // Hide the static fallback list now that we have real data (desktop)
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
 * Renders the full Drops page (#page-drops).
 * Shows live, upcoming, and ended drops with full detail cards.
 */
export function renderDropsPage() {
  const liveGrid     = document.getElementById('drops-page-live');
  const upcomingGrid = document.getElementById('drops-page-upcoming');
  const endedGrid    = document.getElementById('drops-page-ended');
  const liveSection  = document.getElementById('drops-section-live');
  const upSection    = document.getElementById('drops-section-upcoming');
  const endSection   = document.getElementById('drops-section-ended');
  if (!liveGrid) return;

  const drops = LIVE_DROPS.length > 0 ? LIVE_DROPS : _getFallbackDrops();

  const live     = drops.filter(d => d.status === 'live');
  const upcoming = drops.filter(d => d.status === 'upcoming');
  const ended    = drops.filter(d => d.status === 'ended');

  function renderCard(drop) {
    const isLive     = drop.status === 'live';
    const isUpcoming = drop.status === 'upcoming';
    const isEnded    = drop.status === 'ended';
    const soldPct    = drop.total_units > 0
      ? Math.min(100, Math.round((drop.sold_units / drop.total_units) * 100))
      : 0;
    const remaining  = Math.max(0, (drop.total_units || 0) - (drop.sold_units || 0));
    const bgColor    = drop.cover_color || '#1A1A1A';
    const launchStr  = drop.launch_at
      ? new Date(drop.launch_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const endStr     = drop.end_at
      ? new Date(drop.end_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    return `
      <div class="drop-page-card" style="background:var(--white);border:1.5px solid var(--border);border-radius:var(--r-xl);overflow:hidden;transition:box-shadow var(--t)" onmouseover="this.style.boxShadow='0 8px 32px rgba(0,0,0,.1)'" onmouseout="this.style.boxShadow=''">
        <!-- Cover -->
        <div style="position:relative;aspect-ratio:16/7;background:linear-gradient(135deg,${_esc(bgColor)},${_darken(bgColor)});display:flex;align-items:center;justify-content:center;overflow:hidden">
          <div style="font-size:clamp(48px,10vw,96px);font-weight:900;font-style:italic;text-transform:uppercase;color:rgba(255,255,255,.06);letter-spacing:-.04em;user-select:none;pointer-events:none">${_esc((drop.name||'DROP').split(' ')[0].toUpperCase())}</div>
          <div style="position:absolute;top:16px;left:16px">
            ${isLive
              ? `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--red);color:#fff;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;padding:5px 12px;border-radius:var(--r-full)"><span style="width:6px;height:6px;border-radius:50%;background:#fff;animation:blink 1s ease infinite;flex-shrink:0"></span>Live Now</span>`
              : isUpcoming
                ? `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);color:#fff;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;padding:5px 12px;border-radius:var(--r-full)">Upcoming</span>`
                : `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.5);color:rgba(255,255,255,.6);font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;padding:5px 12px;border-radius:var(--r-full)">Ended</span>`
            }
          </div>
          <div style="position:absolute;bottom:16px;right:16px;font-size:11px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.1em;text-transform:uppercase">Drop #${drop.drop_number||'—'}</div>
        </div>
        <!-- Body -->
        <div style="padding:clamp(16px,3vw,24px)">
          <div style="font-size:clamp(18px,3vw,26px);font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-.01em;margin-bottom:6px">${_esc(drop.name)}</div>
          ${drop.description ? `<div style="font-size:13px;color:var(--g2);line-height:1.6;margin-bottom:14px">${_esc(drop.description)}</div>` : ''}
          <!-- Meta row -->
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--g3);background:var(--bg-c);padding:4px 10px;border-radius:var(--r-full)"><span class="material-symbols-outlined" style="font-size:13px">inventory_2</span>${drop.total_units||0} Units</span>
            ${isLive ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--red);background:rgba(215,38,56,.07);padding:4px 10px;border-radius:var(--r-full)"><span class="material-symbols-outlined" style="font-size:13px">timer</span>${remaining} Left</span>` : ''}
            ${launchStr ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--g3);background:var(--bg-c);padding:4px 10px;border-radius:var(--r-full)"><span class="material-symbols-outlined" style="font-size:13px">calendar_today</span>${isUpcoming ? 'Drops ' : ''}${launchStr}</span>` : ''}
            ${drop.price_inr ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--black);background:var(--bg-c);padding:4px 10px;border-radius:var(--r-full)">From ₹${drop.price_inr.toLocaleString('en-IN')}</span>` : ''}
          </div>
          <!-- Progress bar for live/ended -->
          ${(isLive || isEnded) && drop.total_units > 0 ? `
            <div style="margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--g3);margin-bottom:6px">
                <span>${isEnded ? 'Final' : 'Sold'}</span>
                <span>${drop.sold_units||0} / ${drop.total_units} units</span>
              </div>
              <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${soldPct}%;background:${isEnded ? 'var(--black)' : 'var(--red)'};border-radius:2px;transition:width .6s ease"></div>
              </div>
            </div>` : ''}
          <!-- CTA -->
          ${isLive
            ? `<button onclick="window.goTo&&window.goTo('shop')" style="width:100%;padding:14px;background:var(--black);color:#fff;border:none;border-radius:var(--r-full);font-family:var(--font);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:background var(--t)" onmouseover="this.style.background='var(--red)'" onmouseout="this.style.background='var(--black)'">Shop This Drop →</button>`
            : isUpcoming
              ? `<button onclick="window.openModal&&window.openModal('waitlist')" style="width:100%;padding:14px;background:none;color:var(--black);border:1.5px solid var(--black);border-radius:var(--r-full);font-family:var(--font);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:all var(--t)" onmouseover="this.style.background='var(--black)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='var(--black)'">Get Early Access</button>`
              : `<button disabled style="width:100%;padding:14px;background:var(--bg-c);color:var(--g3);border:1.5px solid var(--border);border-radius:var(--r-full);font-family:var(--font);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:not-allowed">Sold Out</button>`
          }
        </div>
      </div>`;
  }

  // Render each section
  if (liveGrid)     liveGrid.innerHTML     = live.length     ? live.map(renderCard).join('')     : '<div style="font-size:13px;color:var(--g3);padding:24px 0">No live drops right now — check back soon.</div>';
  if (upcomingGrid) upcomingGrid.innerHTML = upcoming.length ? upcoming.map(renderCard).join('') : '<div style="font-size:13px;color:var(--g3);padding:24px 0">No upcoming drops announced yet.</div>';
  if (endedGrid)    endedGrid.innerHTML    = ended.length    ? ended.map(renderCard).join('')    : '';

  // Hide ended section if empty
  if (endSection) endSection.style.display = ended.length ? '' : 'none';
}

/**
 * Initialise drops — fetch from DB and render.
 * Also listens for realtime updates.
 */
export async function initDrops() {
  await fetchDrops();
  renderDropsSection();
  renderDropsPage(); // ✅ FIX: always render full drops page on init (uses fallback if Supabase empty)
  _updateManifestoCounter();

  // Listen for realtime drop updates from realtime.js
  window.addEventListener('modart:drop_updated', () => {
    fetchDrops().then(() => {
      renderDropsSection();
      renderDropsPage();
      _updateManifestoCounter();
    });
  });
  window.addEventListener('modart:drop_live', () => {
    fetchDrops().then(() => {
      renderDropsSection();
      renderDropsPage();
      _updateManifestoCounter();
    });
  });
}

function _updateManifestoCounter() {
  const el = document.getElementById('manifesto-drops-live');
  if (el) {
    const liveCount = LIVE_DROPS.filter(d => d.status === 'live').length;
    el.textContent = liveCount > 0 ? liveCount : '—';
  }
  // Show live badge on mobile nav drops button
  const liveBadge = document.getElementById('drops-live-badge');
  if (liveBadge) {
    const hasLive = LIVE_DROPS.some(d => d.status === 'live');
    liveBadge.style.display = hasLive ? '' : 'none';
  }
  // Update hero badge dynamically
  const heroBadge = document.getElementById('hero-drop-badge');
  const heroLabel = document.getElementById('hero-drop-label');
  if (heroBadge) {
    const liveDrop = LIVE_DROPS.find(d => d.status === 'live');
    if (liveDrop) {
      heroBadge.style.display = '';
      if (heroLabel) heroLabel.textContent = `Drop ${liveDrop.drop_number || ''} — Live Now`.trim();
    } else {
      const upcoming = LIVE_DROPS.find(d => d.status === 'upcoming');
      if (upcoming) {
        heroBadge.style.display = '';
        if (heroLabel) heroLabel.textContent = `Drop ${upcoming.drop_number || ''} — Coming Soon`.trim();
      } else {
        heroBadge.style.display = 'none';
      }
    }
  }
  // Update manifesto drop badge
  const manifestoBadge = document.getElementById('manifesto-drop-badge');
  const manifestoName  = document.getElementById('manifesto-drop-name');
  const manifestoSub   = document.getElementById('manifesto-drop-sub');
  if (manifestoBadge) {
    const liveDrop = LIVE_DROPS.find(d => d.status === 'live') || LIVE_DROPS.find(d => d.status === 'upcoming');
    if (liveDrop) {
      manifestoBadge.style.display = '';
      if (manifestoName) manifestoName.textContent = `Drop ${liveDrop.drop_number || ''} — ${liveDrop.name}`;
      if (manifestoSub) manifestoSub.textContent = `${liveDrop.total_units || 200} Units — ${liveDrop.status === 'live' ? 'Live Now' : 'Upcoming'} — Own Manufacture`;
    }
  }
}

if (typeof window !== 'undefined') {
  window.fetchDrops         = fetchDrops;
  window.renderDropsSection = renderDropsSection;
  window.renderDropsPage    = renderDropsPage;
  window.initDrops          = initDrops;
  window.LIVE_DROPS         = LIVE_DROPS;
}
