/**
 * ModArt Admin Notifications
 * 
 * UX FIX: H-19 - Admin notifications for new orders
 * 
 * Provides browser notifications and sound alerts for new orders.
 * Uses Supabase Realtime to listen for order events.
 */

import { supabase, getSupabase } from './auth.js';

// Notification sound (data URI for a simple beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6OyrWBUIQ5zd8sFuJAUuhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvs6aFQEQtMpeHxuWUcBTaN1e/OfSkFKH7M8NqPOwsSXLHo7atYFQhDnN3ywW4kBS+Ez/PbiTYGHGq77OmhUBELTKXh8bllHAU2jdXvzn0pBSh+zPDajzsKElyx6O2rWBUIQ5zd8sFuJAUvhM/z24k2Bhxqu+zpoVARC0yl4fG5ZRwFNo3V7859KQUofszw2o87ChJcsejtq1gVCEOc3fLBbiQFL4TP89uJNgYcarvsw==';

let notificationPermission = 'default';
let isListening = false;
let realtimeChannel = null;
let notificationSound = null;
let notificationsEnabled = true;

/**
 * Requests browser notification permission
 * @returns {Promise<string>} Permission status
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    notificationPermission = 'denied';
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    
    // Save preference
    try {
      localStorage.setItem('modart_notifications_enabled', permission === 'granted' ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save notification preference:', e);
    }
    
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

/**
 * Shows a browser notification
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 */
function showNotification(title, options = {}) {
  if (notificationPermission !== 'granted' || !notificationsEnabled) {
    return;
  }

  try {
    const notification = new Notification(title, {
      icon: '/assets/images/logo-black.png',
      badge: '/assets/images/logo-black.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) {
        options.onClick();
      }
    };

    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

/**
 * Plays notification sound
 */
function playNotificationSound() {
  if (!notificationsEnabled) return;

  try {
    if (!notificationSound) {
      notificationSound = new Audio(NOTIFICATION_SOUND);
      notificationSound.volume = 0.5;
    }
    notificationSound.play().catch(e => {
      console.warn('Failed to play notification sound:', e);
    });
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}

/**
 * Handles new order notification
 * @param {Object} order - Order data
 */
function handleNewOrder(order) {
  console.log('📦 New order received:', order);

  // Parse order items
  let items = [];
  try {
    items = JSON.parse(order.items || '[]');
  } catch (e) {
    console.warn('Failed to parse order items:', e);
  }

  const itemCount = items.length;
  const total = order.total_inr || 0;
  const formattedTotal = window.formatPrice ? window.formatPrice(total) : `₹${total}`;

  // Show browser notification
  showNotification('New Order Received! 🎉', {
    body: `Order ${order.order_number}\n${itemCount} item${itemCount !== 1 ? 's' : ''} • ${formattedTotal}`,
    tag: `order-${order.id}`,
    onClick: () => {
      // Navigate to orders page
      if (window.location.pathname.includes('admin.html')) {
        // Already on admin page, just scroll to orders
        const ordersSection = document.getElementById('admin-orders');
        if (ordersSection) {
          ordersSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  });

  // Play sound
  playNotificationSound();

  // Show toast notification (if available)
  if (window.showSuccess) {
    window.showSuccess(`New order: ${order.order_number} (${formattedTotal})`, {
      duration: 8000,
      action: {
        label: 'View',
        callback: () => {
          const ordersSection = document.getElementById('admin-orders');
          if (ordersSection) {
            ordersSection.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    });
  }

  // Update order count badge (if exists)
  const badge = document.getElementById('new-orders-badge');
  if (badge) {
    const currentCount = parseInt(badge.textContent || '0');
    badge.textContent = currentCount + 1;
    badge.style.display = 'inline-block';
  }

  // Refresh orders list (if function exists)
  if (window.refreshAdminOrders) {
    window.refreshAdminOrders();
  }
}

/**
 * Starts listening for new orders via Supabase Realtime
 */
export async function startOrderNotifications() {
  if (isListening) {
    console.log('Already listening for order notifications');
    return;
  }

  const client = getSupabase() || supabase;
  if (!client) {
    console.error('Supabase client not available');
    return;
  }

  try {
    // Subscribe to orders table inserts
    realtimeChannel = client
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order insert event:', payload);
          if (payload.new) {
            handleNewOrder(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to order notifications');
          isListening = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Failed to subscribe to order notifications');
          isListening = false;
        }
      });
  } catch (error) {
    console.error('Failed to start order notifications:', error);
  }
}

/**
 * Stops listening for new orders
 */
export async function stopOrderNotifications() {
  if (!isListening || !realtimeChannel) {
    return;
  }

  try {
    const client = getSupabase() || supabase;
    if (client && realtimeChannel) {
      await client.removeChannel(realtimeChannel);
      realtimeChannel = null;
      isListening = false;
      console.log('✅ Unsubscribed from order notifications');
    }
  } catch (error) {
    console.error('Failed to stop order notifications:', error);
  }
}

/**
 * Toggles notification sound on/off
 * @param {boolean} enabled - Enable or disable sound
 */
export function toggleNotificationSound(enabled) {
  notificationsEnabled = enabled;
  
  try {
    localStorage.setItem('modart_notifications_sound', enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save sound preference:', e);
  }
}

/**
 * Gets notification settings from localStorage
 * @returns {Object} Notification settings
 */
export function getNotificationSettings() {
  try {
    const soundEnabled = localStorage.getItem('modart_notifications_sound');
    const notifEnabled = localStorage.getItem('modart_notifications_enabled');
    
    return {
      sound: soundEnabled !== 'false',
      notifications: notifEnabled === 'true',
      permission: notificationPermission
    };
  } catch (e) {
    return {
      sound: true,
      notifications: false,
      permission: 'default'
    };
  }
}

/**
 * Initializes admin notifications
 * Auto-starts if on admin page and user is logged in
 */
export async function initAdminNotifications() {
  // Check if on admin page
  const isAdminPage = window.location.pathname.includes('admin.html');
  if (!isAdminPage) {
    return;
  }

  // Load settings
  const settings = getNotificationSettings();
  notificationsEnabled = settings.sound;
  notificationPermission = Notification.permission;

  // Request permission if not already granted
  if (notificationPermission === 'default') {
    // Show a prompt to enable notifications
    if (window.showInfo) {
      window.showInfo('Enable notifications to get alerts for new orders', {
        duration: 10000,
        action: {
          label: 'Enable',
          callback: async () => {
            const permission = await requestNotificationPermission();
            if (permission === 'granted') {
              if (window.showSuccess) {
                window.showSuccess('Notifications enabled!');
              }
              startOrderNotifications();
            }
          }
        }
      });
    }
  } else if (notificationPermission === 'granted') {
    // Auto-start notifications
    startOrderNotifications();
  }

  console.log('✅ Admin notifications initialized');
}

// Export for window access
if (typeof window !== 'undefined') {
  window.requestNotificationPermission = requestNotificationPermission;
  window.startOrderNotifications = startOrderNotifications;
  window.stopOrderNotifications = stopOrderNotifications;
  window.toggleNotificationSound = toggleNotificationSound;
  window.getNotificationSettings = getNotificationSettings;
  window.initAdminNotifications = initAdminNotifications;
}

// Auto-initialize on admin page
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for auth to initialize
      setTimeout(initAdminNotifications, 1000);
    });
  } else {
    setTimeout(initAdminNotifications, 1000);
  }
}
