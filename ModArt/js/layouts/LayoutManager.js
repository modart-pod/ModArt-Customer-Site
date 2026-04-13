/**
 * LayoutManager.js
 * Detects viewport breakpoint and applies layout class
 * to document.body. All visual styles stay in CSS files.
 * Does not modify any component or routing logic.
 */

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024
};

function getLayout() {
  const w = window.innerWidth;
  if (w < BREAKPOINTS.mobile) return 'mobile';
  if (w < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

export function initLayoutManager() {
  function apply() {
    const layout = getLayout();
    document.body.classList.remove('layout-mobile', 'layout-tablet', 'layout-desktop');
    document.body.classList.add('layout-' + layout);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 100);
  });

  apply();
}

export function getCurrentLayout() {
  return getLayout();
}

if (typeof window !== 'undefined') {
  window.getCurrentLayout = getLayout;
}
