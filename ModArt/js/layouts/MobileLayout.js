/**
 * MobileLayout.js
 * Behaviour rules for viewports under 768px.
 * Manages mobile header visibility and bottom nav.
 * Does not contain any visual CSS — all visual rules in mobile.css.
 */

export function applyMobileLayout() {
  const mobileHdr  = document.getElementById('mobile-hdr');
  const mobileNav  = document.getElementById('mobile-bottom-nav');
  const desktopNav = document.querySelector('.desktop-nav');

  if (desktopNav) desktopNav.style.display = 'none';
  if (mobileHdr)  mobileHdr.style.display  = '';    // flex via CSS
  if (mobileNav)  mobileNav.style.display  = '';    // flex via CSS

  // Close mobile drawer if open when layout switches
  const drawer  = document.getElementById('mobile-menu-drawer');
  const overlay = document.getElementById('mobile-menu-overlay');
  if (drawer  && drawer.style.display  !== 'none') drawer.style.display  = 'none';
  if (overlay && overlay.style.display !== 'none') overlay.style.display = 'none';
}
