/**
 * TabletLayout.js
 * Behaviour rules for viewports 768px to 1024px.
 * Shows desktop nav, hides mobile header + bottom nav.
 * Does not contain any visual CSS.
 */

export function applyTabletLayout() {
  const mobileHdr = document.getElementById('mobile-hdr');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const desktopNav = document.querySelector('.desktop-nav');

  if (desktopNav) desktopNav.style.display = '';
  if (mobileHdr)  mobileHdr.style.display  = 'none';
  if (mobileNav)  mobileNav.style.display  = 'none';
}
