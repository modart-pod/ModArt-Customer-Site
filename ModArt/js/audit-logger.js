/**
 * Audit Logger
 * 
 * MONITORING FIX: M-15 - Client-side audit logging
 * 
 * Logs important user actions and events for accountability and debugging.
 * Sends logs to Supabase audit_logs table.
 */

/**
 * Logs an audit event
 * @param {Object} event - Event details
 * @returns {Promise<string|null>} Log ID or null if failed
 */
export async function logAuditEvent(event) {
  const {
    eventType,
    entityType,
    entityId = null,
    action,
    changes = null,
    metadata = null,
    status = 'success',
    errorMessage = null,
  } = event;

  // Validate required fields
  if (!eventType || !entityType || !action) {
    console.error('❌ Audit log missing required fields:', event);
    return null;
  }

  try {
    // Get current user
    const user = window.currentUser || null;
    const userId = user?.id || null;
    const userEmail = user?.email || 'guest';
    const userRole = user?.role || 'guest';

    // Get request context
    const ipAddress = null; // Will be set by server
    const userAgent = navigator.userAgent;
    const requestPath = window.location.pathname;

    // Call Supabase RPC function
    if (window.supabase) {
      const { data, error } = await window.supabase.rpc('log_audit_event', {
        p_event_type: eventType,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_user_id: userId,
        p_user_email: userEmail,
        p_user_role: userRole,
        p_action: action,
        p_changes: changes,
        p_metadata: metadata,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_request_path: requestPath,
        p_status: status,
        p_error_message: errorMessage,
      });

      if (error) {
        console.error('❌ Failed to log audit event:', error);
        return null;
      }

      console.log('✅ Audit event logged:', eventType, action);
      return data;
    } else {
      console.warn('⚠️ Supabase not available, audit event not logged');
      return null;
    }
  } catch (error) {
    console.error('❌ Error logging audit event:', error);
    return null;
  }
}

/**
 * Logs a product action
 * @param {string} action - Action type ('create', 'update', 'delete')
 * @param {Object} product - Product data
 * @param {Object} oldProduct - Old product data (for updates)
 */
export async function logProductAction(action, product, oldProduct = null) {
  const eventType = `product_${action}d`;
  const changes = oldProduct ? { old: oldProduct, new: product } : { new: product };

  return await logAuditEvent({
    eventType,
    entityType: 'product',
    entityId: product.id,
    action: `${action.charAt(0).toUpperCase() + action.slice(1)}d product: ${product.name}`,
    changes,
  });
}

/**
 * Logs an order action
 * @param {string} action - Action type ('placed', 'updated', 'cancelled')
 * @param {Object} order - Order data
 * @param {Object} oldOrder - Old order data (for updates)
 */
export async function logOrderAction(action, order, oldOrder = null) {
  const eventType = `order_${action}`;
  const changes = oldOrder ? { old: oldOrder, new: order } : { new: order };

  return await logAuditEvent({
    eventType,
    entityType: 'order',
    entityId: order.id,
    action: `Order ${action}: ${order.id}`,
    changes,
    metadata: {
      total: order.total,
      items: order.items?.length || 0,
    },
  });
}

/**
 * Logs a coupon action
 * @param {string} action - Action type ('created', 'used', 'deleted')
 * @param {Object} coupon - Coupon data
 */
export async function logCouponAction(action, coupon) {
  const eventType = `coupon_${action}`;

  return await logAuditEvent({
    eventType,
    entityType: 'coupon',
    entityId: coupon.code,
    action: `Coupon ${action}: ${coupon.code}`,
    changes: { new: coupon },
  });
}

/**
 * Logs an authentication event
 * @param {string} action - Action type ('login', 'logout', 'login_failed')
 * @param {Object} user - User data
 * @param {string} errorMessage - Error message (for failed logins)
 */
export async function logAuthEvent(action, user = null, errorMessage = null) {
  return await logAuditEvent({
    eventType: action,
    entityType: 'user',
    entityId: user?.id || null,
    action: `User ${action}${user ? ': ' + user.email : ''}`,
    status: errorMessage ? 'failure' : 'success',
    errorMessage,
  });
}

/**
 * Logs an inventory action
 * @param {string} action - Action type ('updated', 'reserved', 'released')
 * @param {Object} inventory - Inventory data
 */
export async function logInventoryAction(action, inventory) {
  const eventType = `inventory_${action}`;

  return await logAuditEvent({
    eventType,
    entityType: 'inventory',
    entityId: inventory.product_id,
    action: `Inventory ${action}: ${inventory.product_id}`,
    changes: { new: inventory },
    metadata: {
      size: inventory.size,
      quantity: inventory.quantity,
    },
  });
}

/**
 * Logs an admin action
 * @param {string} action - Action description
 * @param {Object} metadata - Additional context
 */
export async function logAdminAction(action, metadata = null) {
  return await logAuditEvent({
    eventType: 'admin_action',
    entityType: 'system',
    entityId: null,
    action,
    metadata,
  });
}

/**
 * Logs a system event
 * @param {string} action - Event description
 * @param {Object} metadata - Additional context
 */
export async function logSystemEvent(action, metadata = null) {
  return await logAuditEvent({
    eventType: 'system_event',
    entityType: 'system',
    entityId: null,
    action,
    metadata,
  });
}

/**
 * Gets recent audit logs
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit logs
 */
export async function getAuditLogs(options = {}) {
  const {
    limit = 100,
    offset = 0,
    eventType = null,
    entityType = null,
    userId = null,
  } = options;

  try {
    if (!window.supabase) {
      console.warn('⚠️ Supabase not available');
      return [];
    }

    const { data, error } = await window.supabase.rpc('get_audit_logs', {
      p_limit: limit,
      p_offset: offset,
      p_event_type: eventType,
      p_entity_type: entityType,
      p_user_id: userId,
    });

    if (error) {
      console.error('❌ Failed to get audit logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error getting audit logs:', error);
    return [];
  }
}

// Export for window access
if (typeof window !== 'undefined') {
  window.logAuditEvent = logAuditEvent;
  window.logProductAction = logProductAction;
  window.logOrderAction = logOrderAction;
  window.logCouponAction = logCouponAction;
  window.logAuthEvent = logAuthEvent;
  window.logInventoryAction = logInventoryAction;
  window.logAdminAction = logAdminAction;
  window.logSystemEvent = logSystemEvent;
  window.getAuditLogs = getAuditLogs;
}
