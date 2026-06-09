# ModArt Customer Site — Full UI/UX Audit Report
**Date:** June 9, 2026 | **Scope:** All pages, Mobile + Desktop + Tablet

---

## CRITICAL BUGS (Breaks functionality)

### C1. Mobile header logo position conflict
**File:** `css/fixes.css:713` + `css/responsive.css:58` + `index.html`
**Issue:** `fixes.css` and `responsive.css` both set `.mobile-hdr .mobile-logo-btn { position: static !important }` but the new mobile header HTML uses `position:absolute;left:50%;transform:translateX(-50%)` to centre the logo. The `!important` in fixes.css overrides the inline style and pushes the logo left, breaking the centred layout.
**Status:** ✅ Fixed — removed conflicting overrides

### C2. Duplicate `toggleSearch` and `toggleMobileMenu` functions
**Files:** `js/modals.js` and `js/utils.js` both define `toggleSearch()` and both assign to `window.toggleSearch`. The modals.js version is simpler (uses `style.display` toggle) while utils.js uses the CSS `.open` class pattern. **Last one to run wins** — both assign to `window.toggleSearch` so whichever module initialises last controls the behaviour. The utils.js version is more correct (uses class + requestAnimationFrame), but the modals.js version re-assigns it.
**Status:** ✅ Fixed — removed duplicates from modals.js

### C3. `#modal` has `display:none` but uses `align-items:center` inline
**File:** `index.html:1611`
**Issue:** `style="display:none;...align-items:center;justify-content:center"` — when JS sets `modal.style.display = 'flex'`, the inline `align-items` works. BUT fixes.css has `.modal-card { transform: translateY(20px) scale(.95) }` with no starting `opacity` value and no `visibility` control. On mobile, `body.layout-mobile .modal-card` sets `align-self: flex-end` for a bottom-sheet effect, but the modal flex container uses `align-items: center` (centred) which conflicts — modal appears centred not bottom-anchored.
**Status:** ✅ Fixed

### C4. Cookie banner `bottom:0` on mobile covered by bottom nav
**File:** `fixes.css:~1558`
**Issue:** `#cookie-banner { bottom: calc(72px + env(safe-area-inset-bottom, 0px)) }` at `max-width: 767px` — this IS already in fixes.css but applies at 767px, not tied to `body.layout-mobile`. On tablets that are narrow (768px) the bottom nav is hidden but the cookie banner still uses the 72px offset.
**Status:** ✅ Fixed — tied to layout class instead

### C5. Search overlay inline `display:none` conflicts with `.open` class
**File:** `index.html` search overlay HTML uses `display:none` inline + JS toggles via `style.display='flex'` (modals.js) AND via `style.display + class 'open'` (utils.js). Two systems fighting each other.
**Status:** ✅ Fixed — unified to utils.js approach

---

## HIGH SEVERITY ISSUES

### H1. Mobile header: centred logo visually clashes with absolute positioning
**Cause:** `fixes.css` `.mobile-hdr .mobile-logo-btn { position: static !important }` overrides the inline `position:absolute` set in HTML.
**Fix:** Remove the conflicting `position: static !important` from fixes.css.

### H2. Desktop nav: `About` and `Contact` unreachable from nav
**File:** `index.html` desktop nav only has Home, Shop, Drops, Customize.
**Fix:** These pages exist but are only accessible via footer or mobile drawer. No high-priority fix needed but noted.

### H3. `home-product-grid` carousel vs. grid conflict on mobile
**Issue:** On mobile, `#home-product-grid` uses `display:grid` (2-col), but `initCarousel()` in utils.js treats it as a horizontal scroll container (`track.scrollLeft`, `scrollTo`). When the layout class switches to desktop, the grid becomes a flex carousel. There's no re-init after layout switch, so carousel dots may show stale data.
**Fix:** `initCarousel` guard — only activate scroll logic if desktop layout.

### H4. `wishlisted` badge count not updating on mobile header
**File:** `js/rendering.js updateBadges()`
**Issue:** Updates `wishlist-badge-desk` and `wishlist-badge-nav` but NOT `wishlist-badge-mob-hdr` (the new mobile header wishlist badge).
**Fix:** Add `wishlist-badge-mob-hdr` to the updateBadges loop.

### H5. `body.layout-mobile .modal-card` bottom-sheet style not working
**File:** `css/mobile.css:13 section`
**Issue:** `align-self: flex-end` on `.modal-card` needs the parent `#modal` flex container to use `align-items: flex-end` or `stretch`, not `align-items: center` (which is set inline). The bottom-sheet effect won't work.
**Fix:** Override `#modal` align-items on mobile.

---

## MEDIUM SEVERITY ISSUES

### M1. Page transition — `position:absolute` pages causing scroll
**File:** `css/layout.css`
**Issue:** Hidden pages use `position:absolute; top:0; left:0; right:0` which should collapse them. But `min-height: calc(100vh - var(--nav-h))` still applies, potentially expanding the document height if the absolute positioned pages overflow their stacking context.
**Fix:** Add `height: 0; overflow: hidden` to hidden pages instead of relying solely on position:absolute.

### M2. Cart badge `#wishlist-badge-mob-hdr` never updated
**Severity:** Users can't see wishlist count on mobile header.

### M3. Shop page — filter bar `mask-image` cuts off the sort select
**File:** `css/mobile.css`
**Issue:** `-webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%)` on `#shop-filter-bar` fades the entire bar including the sort `<select>` at the right edge.
**Fix:** Apply mask only to `.shop-filter-btns`, not the whole bar.

### M4. `body.layout-mobile .home-hero min-height: 85vw` too tall on landscape
**File:** `css/mobile.css`
**On landscape mobile (e.g. iPhone in landscape):** 85vw = 85% of the shorter dimension, creating a very tall hero. Should use `min-height: min(85vw, 60vh)`.

### M5. Footer brand col `grid-column: 1 / -1` only works if footer-grid has explicit columns
**File:** `css/mobile.css`
**Issue:** `body.layout-mobile .footer-grid { grid-template-columns: 1fr 1fr }` + `body.layout-mobile .footer-brand-col { grid-column: 1 / -1 }` — this works correctly for 2 columns. But `fixes.css` also has a `footer-grid` rule at `@media (max-width: 599px)`. Multiple rules may conflict.

### M6. `body.layout-desktop .home-hero-content` double padding-top
**File:** `css/desktop.css`
**Issue:** `padding-top: calc(var(--nav-h) + clamp(48px, 6vh, 80px))` — but the page already has `padding-top: var(--nav-h)` from `.page`. Since `#page-home` has `padding-top: 0`, the hero content's own padding-top must account for the nav. This is actually correct — `#page-home` has no page-level padding, so `.home-hero-content` needs the full nav-height built in. ✅ No fix needed.

### M7. Drops page: `#drops-live-badge` on mobile bottom nav is a red dot `●`
**File:** `index.html`
**Issue:** `<span class="cart-badge" id="drops-live-badge" style="background:var(--red)">●</span>` — the badge text is a `●` character, not a number. The `.cart-badge` class is designed for numbers (16×16px circle). A dot character renders oddly inside a number badge.
**Fix:** Use an empty badge with a pulse animation instead.

---

## LOW SEVERITY ISSUES

### L1. Review stars on home page use `>star<` (filled) for all 5 stars
**File:** `index.html` — review cards hardcode filled `star` icons. Half-star in review 3 shows `star_half` which is correct. But all reviews show 5 stars which looks fake. Low priority.

### L2. `#page-home > * { flex-shrink: 0 }` in fixes.css may interfere with sections
**File:** `css/fixes.css`
**Issue:** Applied globally to all children including footer — footer inside home page might not shrink. Low visual impact.

### L3. Desktop nav `nav-logo-img` has blank `alt=""` on two of three images
**File:** `index.html` — The `nav-logo-black` and spacer images have `alt=""`. The spacer is `aria-hidden="true"` so fine. `nav-logo-black` should also be `aria-hidden="true"` since `nav-logo-white` already has the descriptive alt.

### L4. Cookie banner `bottom` positioning uses `max-width: 767px` media query
**File:** `fixes.css:~1558` — Should use `body.layout-mobile` class for consistency with rest of layout system.

### L5. Bag page checkout summary: `#co-subtotal`, `#co-total`, `#co-shipping` show raw `0` and `149` initially
**File:** `index.html` — these default values show before JS populates them. Should be empty or `—`.

### L6. `utils.js formatPrice()` uses `$` currency, not `₹`
**File:** `js/utils.js:27` — `return \`$\${price.toFixed(2)}\`` — but `currency.js` has the real `formatPrice` that uses ₹. `utils.js` formatPrice is a stub that's never used (currency.js version is imported everywhere). Low risk.

### L7. `initCarousel` never re-runs on resize
If viewport changes from mobile to desktop, `home-product-grid` layout changes but carousel isn't reinitialised. Dots may be wrong.

---

## ACCESSIBILITY ISSUES

### A1. Mobile bottom nav `#mob-nav-customize` Design+ button has no visible text label for screen readers
The button shows only a `+` icon in the red circle. The `<span>` label "Design" is visually hidden by the `-10px` margin. `aria-label` is missing on the button.

### A2. `<main class="page">` — multiple `<main>` elements in DOM
The SPA has one `<main>` per page (~20 mains), all in DOM simultaneously. Only one should be visible at a time, but screen readers may see all of them. Hidden pages need `aria-hidden="true"` when not active.

### A3. Review stars — no `aria-label` on star icon spans
`<span class="material-symbols-outlined icon">star</span>` repeated 5 times with no grouping `aria-label`. Screen reader would read "star star star star star".

### A4. Search overlay — `role="search"` missing on the search form
The search input is inside a `<div>`, not a `<form role="search">`.

---

## SUMMARY TABLE

| ID | Severity | Category | Fixed |
|----|----------|----------|-------|
| C1 | Critical | Mobile header logo conflict | ✅ |
| C2 | Critical | Duplicate JS functions | ✅ |
| C3 | Critical | Modal mobile bottom-sheet broken | ✅ |
| C4 | Critical | Cookie banner behind mobile nav | ✅ |
| C5 | Critical | Search overlay dual control | ✅ |
| H1 | High | Logo position override | ✅ |
| H4 | High | Wishlist badge missing on mobile | ✅ |
| H5 | High | Modal not bottom-anchored on mobile | ✅ |
| H3 | High | Carousel/grid conflict on resize | ✅ |
| M3 | Medium | Filter bar mask cuts sort select | ✅ |
| M4 | Medium | Hero too tall in landscape | ✅ |
| M7 | Medium | Drops badge wrong format | ✅ |
| L3 | Low | Nav logo alt text | ✅ |
| L5 | Low | Bag summary shows raw numbers | ✅ |
| A1 | Access. | Design+ button no aria-label | ✅ |
| A2 | Access. | Multiple main elements visible | ✅ |

*Report generated June 9, 2026*
