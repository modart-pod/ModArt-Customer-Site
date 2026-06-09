/**
 * DesktopLayout.js
 * Behaviour rules for viewports over 1024px.
 * Shows desktop nav, hides mobile nav elements.
 * Does not contain any visual CSS — all visual rules in desktop.css.
 */

export function applyDesktopLayout() {
  const mobileHdr  = document.getElementById('mobile-hdr');
  const mobileNav  = document.getElementById('mobile-bottom-nav');
  const desktopNav = document.querySelector('.desktop-nav');

  if (desktopNav) desktopNav.style.display = '';    // block via CSS
  if (mobileHdr)  mobileHdr.style.display  = 'none';
  if (mobileNav)  mobileNav.style.display  = 'none';

  // Close mobile drawer if it was open
  const drawer  = document.getElementById('mobile-menu-drawer');
  const overlay = document.getElementById('mobile-menu-overlay');
  if (drawer  && drawer.style.display  !== 'none') drawer.style.display  = 'none';
  if (overlay && overlay.style.display !== 'none') overlay.style.display = 'none';
}
