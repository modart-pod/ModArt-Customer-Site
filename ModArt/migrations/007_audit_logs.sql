/**
 * Migration 007: Audit Logging
 * 
 * MONITORING FIX: M-15 - Audit logging for accountability
 * 
 * Creates audit_logs table to track all admin actions and important events.
 * Provides accountability and debugging capabilities.
 */

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Event information
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout', etc.
  entity_type TEXT NOT NULL, -- 'product', 'order', 'user', 'coupon', etc.
  entity_id TEXT, -- ID of the affected entity
  
  -- User information
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT, -- 'admin', 'user', 'guest'
  
  -- Action details
  action TEXT NOT NULL, -- Human-readable description
  changes JSONB, -- Before/after values for updates
  metadata JSONB, -- Additional context
  
  -- Request information
  ip_address TEXT,
  user_agent TEXT,
  request_path TEXT,
  
  -- Status
  status TEXT DEFAULT 'success', -- 'success', 'failure', 'error'
  error_message TEXT,
  
  -- Indexes for fast queries
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'create', 'update', 'delete', 
    'login', 'logout', 'login_failed',
    'order_placed', 'order_updated', 'order_cancelled',
    'product_created', 'product_updated', 'product_deleted',
    'coupon_created', 'coupon_used', 'coupon_deleted',
    'inventory_updated', 'stock_reserved', 'stock_released',
    'admin_action', 'system_event'
  ))
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_status ON audit_logs(status) WHERE status != 'success';

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: System can insert audit logs (service role)
CREATE POLICY "System can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: No one can update or delete audit logs (immutable)
-- (No policies for UPDATE or DELETE = no one can modify)

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_user_id UUID,
  p_user_email TEXT,
  p_user_role TEXT,
  p_action TEXT,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    event_type,
    entity_type,
    entity_id,
    user_id,
    user_email,
    user_role,
    action,
    changes,
    metadata,
    ip_address,
    user_agent,
    request_path,
    status,
    error_message
  ) VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_user_id,
    p_user_email,
    p_user_role,
    p_action,
    p_changes,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_request_path,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create function to get recent audit logs
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_event_type TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  event_type TEXT,
  entity_type TEXT,
  entity_id TEXT,
  user_email TEXT,
  user_role TEXT,
  action TEXT,
  changes JSONB,
  metadata JSONB,
  status TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.event_type,
    al.entity_type,
    al.entity_id,
    al.user_email,
    al.user_role,
    al.action,
    al.changes,
    al.metadata,
    al.status,
    al.error_message
  FROM audit_logs al
  WHERE
    (p_event_type IS NULL OR al.event_type = p_event_type)
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create trigger function to auto-log product changes
CREATE OR REPLACE FUNCTION audit_product_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type TEXT;
  v_action TEXT;
  v_changes JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'product_created';
    v_action := 'Created product: ' || NEW.name;
    v_changes := jsonb_build_object('new', row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'product_updated';
    v_action := 'Updated product: ' || NEW.name;
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'product_deleted';
    v_action := 'Deleted product: ' || OLD.name;
    v_changes := jsonb_build_object('old', row_to_json(OLD));
  END IF;
  
  -- Log the event
  PERFORM log_audit_event(
    v_event_type,
    'product',
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'admin',
    v_action,
    v_changes,
    NULL,
    NULL,
    NULL,
    NULL,
    'success',
    NULL
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for product changes
DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION audit_product_changes();

-- Create trigger function to auto-log order changes
CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type TEXT;
  v_action TEXT;
  v_changes JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'order_placed';
    v_action := 'Order placed: ' || NEW.id;
    v_changes := jsonb_build_object('new', row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'order_updated';
    v_action := 'Order updated: ' || NEW.id;
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'order_cancelled';
    v_action := 'Order cancelled: ' || OLD.id;
    v_changes := jsonb_build_object('old', row_to_json(OLD));
  END IF;
  
  -- Log the event
  PERFORM log_audit_event(
    v_event_type,
    'order',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.email, OLD.email),
    'user',
    v_action,
    v_changes,
    NULL,
    NULL,
    NULL,
    NULL,
    'success',
    NULL
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for order changes
DROP TRIGGER IF EXISTS audit_orders_trigger ON orders;
CREATE TRIGGER audit_orders_trigger
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION audit_order_changes();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION get_audit_logs TO authenticated;

COMMENT ON TABLE audit_logs IS 'Audit log for tracking all admin actions and important events';
COMMENT ON FUNCTION log_audit_event IS 'Logs an audit event with full context';
COMMENT ON FUNCTION get_audit_logs IS 'Retrieves audit logs with optional filters';
