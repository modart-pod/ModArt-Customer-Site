/**
 * ModArt Service Worker Registration
 * 
 * Registers the service worker for offline support and caching
 */

/**
 * Registers the service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('✅ Service worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          console.log('🔄 New service worker available');
          
          // Show update notification
          if (window.showInfo) {
            window.showInfo('A new version is available!', {
              duration: 10000,
              action: {
                label: 'Reload',
                callback: () => {
                  newWorker.postMessage({ action: 'skipWaiting' });
                  window.location.reload();
                }
              }
            });
          }
        }
      });
    });

    // Handle controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service worker controller changed');
    });

  } catch (error) {
    console.error('❌ Service worker registration failed:', error);
  }
}

/**
 * Unregisters the service worker
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('✅ Service worker unregistered');
    }
  } catch (error) {
    console.error('❌ Service worker unregistration failed:', error);
  }
}

/**
 * Clears all caches
 */
export async function clearAllCaches() {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('✅ All caches cleared');
    
    if (window.showSuccess) {
      window.showSuccess('Cache cleared successfully');
    }
  } catch (error) {
    console.error('❌ Cache clearing failed:', error);
  }
}

/**
 * Gets cache statistics
 */
export async function getCacheStats() {
  if (!('caches' in window)) {
    return null;
  }

  try {
    const cacheNames = await caches.keys();
    const stats = {};

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      stats[name] = keys.length;
    }

    return stats;
  } catch (error) {
    console.error('❌ Failed to get cache stats:', error);
    return null;
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.registerServiceWorker = registerServiceWorker;
  window.unregisterServiceWorker = unregisterServiceWorker;
  window.clearAllCaches = clearAllCaches;
  window.getCacheStats = getCacheStats;
}

// Auto-register on page load
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerServiceWorker);
  } else {
    registerServiceWorker();
  }
}
