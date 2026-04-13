/**
 * MobileLayout.js
 * Behaviour rules for viewports under 768px.
 * Manages mobile header visibility and bottom nav.
 * Does not contain any visual CSS.
 */

export function applyMobileLayout() {
  const mobileHdr = document.getElementById('mobile-hdr');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const desktopNav = document.querySelector('.desktop-nav');

  if (desktopNav) desktopNav.style.display = 'none';
  if (mobileHdr)  mobileHdr.style.display  = '';
  if (mobileNav)  mobileNav.style.display  = '';
}
