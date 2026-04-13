/**
 * DesktopLayout.js
 * Behaviour rules for viewports over 1024px.
 * Shows desktop nav, hides mobile nav elements.
 * Does not contain any visual CSS.
 */

export function applyDesktopLayout() {
  const mobileHdr = document.getElementById('mobile-hdr');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const desktopNav = document.querySelector('.desktop-nav');

  if (desktopNav) desktopNav.style.display = '';
  if (mobileHdr)  mobileHdr.style.display  = 'none';
  if (mobileNav)  mobileNav.style.display  = 'none';
}
