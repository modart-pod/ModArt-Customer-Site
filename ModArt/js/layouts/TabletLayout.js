/**
 * TabletLayout.js
 * Behaviour rules for viewports 768px to 1023px.
 * Shows desktop nav, hides mobile header + bottom nav.
 * Does not contain any visual CSS — tablet overrides live in desktop.css.
 */

export function applyTabletLayout() {
  const mobileHdr  = document.getElementById('mobile-hdr');
  const mobileNav  = document.getElementById('mobile-bottom-nav');
  const desktopNav = document.querySelector('.desktop-nav');

  if (desktopNav) desktopNav.style.display = '';
  if (mobileHdr)  mobileHdr.style.display  = 'none';
  if (mobileNav)  mobileNav.style.display  = 'none';

  // Close mobile drawer if it was open
  const drawer  = document.getElementById('mobile-menu-drawer');
  const overlay = document.getElementById('mobile-menu-overlay');
  if (drawer  && drawer.style.display  !== 'none') drawer.style.display  = 'none';
  if (overlay && overlay.style.display !== 'none') overlay.style.display = 'none';
}
