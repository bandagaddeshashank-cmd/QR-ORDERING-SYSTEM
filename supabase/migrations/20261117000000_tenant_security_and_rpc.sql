-- ==============================================================================
-- GREEN EMBASSY / MULTI-RESTAURANT PLATFORM
-- MIGRATION: 20261117000000_tenant_security_and_rpc.sql
-- 1. Helper Functions with Hardened search_path & Role Checking
-- 2. Granular Multi-Tenant Row Level Security (RLS) for all 8 Tables
-- 3. Hardened Atomic Bill Settlement RPC (settle_session_bill)
-- 4. Hardened Atomic Order Edit & Cancellation RPC (atomic_order_change)
-- 5. Foreign Key Indexes & Non-Destructive Schema Enhancements
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TENANT CONTEXT & RBAC HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Returns the authenticated user's assigned restaurant UUID from app_metadata
CREATE OR REPLACE FUNCTION public.current_staff_restaurant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE((auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid, NULL);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Returns the authenticated user's role from app_metadata ('manager', 'staff', 'platform_admin')
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Returns true if caller is a restaurant manager or platform administrator
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'platform_admin', 'superadmin'),
    false
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Returns true if caller is an authorized platform super-administrator
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'platform_admin'),
    false
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Restrict function execution permissions to trusted database roles
REVOKE ALL ON FUNCTION public.current_staff_restaurant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_staff_restaurant_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. DROP OBSOLETE POLICIES & APPLY GRANULAR TENANT-AWARE RLS
-- ------------------------------------------------------------------------------

-- Ensure Row Level Security is active on all eight core tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Clean up old broad policies from migration 20261116000000 and ensure idempotency
DROP POLICY IF EXISTS "Staff Read Access: restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Tenant Scoped Access: restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Tenant Select: restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Manager Update: restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Admin Insert: restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Admin Delete: restaurants" ON public.restaurants;

DROP POLICY IF EXISTS "Staff Read Access: tables" ON public.tables;
DROP POLICY IF EXISTS "Tenant Scoped Access: tables" ON public.tables;
DROP POLICY IF EXISTS "Tenant Select: tables" ON public.tables;
DROP POLICY IF EXISTS "Manager Insert: tables" ON public.tables;
DROP POLICY IF EXISTS "Manager Update: tables" ON public.tables;
DROP POLICY IF EXISTS "Manager Delete: tables" ON public.tables;

DROP POLICY IF EXISTS "Staff Read Access: menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Tenant Scoped Access: menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Tenant Select: menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Manager Insert: menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Manager Update: menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Manager Delete: menu_items" ON public.menu_items;

DROP POLICY IF EXISTS "Staff Access: table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Tenant Scoped Access: table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Tenant Select: table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Staff Insert: table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Manager Update: table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Admin Delete: table_sessions" ON public.table_sessions;

DROP POLICY IF EXISTS "Staff Full Access: orders" ON public.orders;
DROP POLICY IF EXISTS "Tenant Scoped Access: orders" ON public.orders;
DROP POLICY IF EXISTS "Tenant Select: orders" ON public.orders;
DROP POLICY IF EXISTS "Staff Insert: orders" ON public.orders;
DROP POLICY IF EXISTS "Staff Update: orders" ON public.orders;
DROP POLICY IF EXISTS "Admin Delete: orders" ON public.orders;

DROP POLICY IF EXISTS "Staff Full Access: order_items" ON public.order_items;
DROP POLICY IF EXISTS "Tenant Scoped Access: order_items" ON public.order_items;
DROP POLICY IF EXISTS "Tenant Select: order_items" ON public.order_items;
DROP POLICY IF EXISTS "Staff Insert: order_items" ON public.order_items;
DROP POLICY IF EXISTS "Staff Update: order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admin Delete: order_items" ON public.order_items;

DROP POLICY IF EXISTS "Staff Full Access: waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Tenant Scoped Access: waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Tenant Select: waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Staff Insert: waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Staff Update: waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Admin Delete: waiter_calls" ON public.waiter_calls;

DROP POLICY IF EXISTS "Staff Full Access: bills" ON public.bills;
DROP POLICY IF EXISTS "Tenant Scoped Access: bills" ON public.bills;
DROP POLICY IF EXISTS "Manager Select: bills" ON public.bills;
DROP POLICY IF EXISTS "Manager Insert: bills" ON public.bills;
DROP POLICY IF EXISTS "Admin Update: bills" ON public.bills;
DROP POLICY IF EXISTS "Admin Delete: bills" ON public.bills;

-- TABLE 1: RESTAURANTS
-- Read: Any staff/manager of this restaurant or platform admin
CREATE POLICY "Tenant Select: restaurants" ON public.restaurants
FOR SELECT USING (
  id = public.current_staff_restaurant_id() OR public.is_platform_admin()
);

-- Update: Managers only for their assigned restaurant
CREATE POLICY "Manager Update: restaurants" ON public.restaurants
FOR UPDATE USING (
  id = public.current_staff_restaurant_id() AND public.is_manager_or_admin()
) WITH CHECK (
  id = public.current_staff_restaurant_id() AND public.is_manager_or_admin()
);

-- Insert/Delete: Platform admins only
CREATE POLICY "Admin Insert: restaurants" ON public.restaurants
FOR INSERT WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admin Delete: restaurants" ON public.restaurants
FOR DELETE USING (public.is_platform_admin());


-- TABLE 2: TABLES
-- Read: Staff/managers of this restaurant
CREATE POLICY "Tenant Select: tables" ON public.tables
FOR SELECT USING (
  restaurant_id = public.current_staff_restaurant_id() OR public.is_platform_admin()
);

-- Mutations: Managers only
CREATE POLICY "Manager Insert: tables" ON public.tables
FOR INSERT WITH CHECK (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
);

CREATE POLICY "Manager Update: tables" ON public.tables
FOR UPDATE USING (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
) WITH CHECK (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
);

CREATE POLICY "Manager Delete: tables" ON public.tables
FOR DELETE USING (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
);


-- TABLE 3: MENU ITEMS
-- Read: Staff/managers of this restaurant
CREATE POLICY "Tenant Select: menu_items" ON public.menu_items
FOR SELECT USING (
  restaurant_id = public.current_staff_restaurant_id() OR public.is_platform_admin()
);

-- Mutations: Managers only (protects pricing and dish definitions from unauthorized staff edits)
CREATE POLICY "Manager Insert: menu_items" ON public.menu_items
FOR INSERT WITH CHECK (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
);

CREATE POLICY "Manager Update: menu_items" ON public.menu_items
FOR UPDATE USING (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
) WITH CHECK (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
);

CREATE POLICY "Manager Delete: menu_items" ON public.menu_items
FOR DELETE USING (
  (restaurant_id = public.current_staff_restaurant_id() AND public.is_manager_or_admin())
  OR public.is_platform_admin()
);


-- TABLE 4: TABLE SESSIONS
-- Read: Staff/managers of this restaurant
CREATE POLICY "Tenant Select: table_sessions" ON public.table_sessions
FOR SELECT USING (
  table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Insert: Staff or managers opening dining sessions
CREATE POLICY "Staff Insert: table_sessions" ON public.table_sessions
FOR INSERT WITH CHECK (
  table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Update: Managers closing/settling dining sessions
CREATE POLICY "Manager Update: table_sessions" ON public.table_sessions
FOR UPDATE USING (
  (table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) AND public.is_manager_or_admin()) OR public.is_platform_admin()
) WITH CHECK (
  (table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) AND public.is_manager_or_admin()) OR public.is_platform_admin()
);

-- Delete: Platform admins only (preserve dining session history)
CREATE POLICY "Admin Delete: table_sessions" ON public.table_sessions
FOR DELETE USING (public.is_platform_admin());


-- TABLE 5: ORDERS
-- Read: Staff/managers of this restaurant
CREATE POLICY "Tenant Select: orders" ON public.orders
FOR SELECT USING (
  session_id IN (
    SELECT ts.id FROM public.table_sessions ts
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Insert: Customer QR orders (handled via service_role API) or staff
CREATE POLICY "Staff Insert: orders" ON public.orders
FOR INSERT WITH CHECK (
  session_id IN (
    SELECT ts.id FROM public.table_sessions ts
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Update: Kitchen staff and managers updating order lifecycle (preparing, ready, served, cancelled)
CREATE POLICY "Staff Update: orders" ON public.orders
FOR UPDATE USING (
  session_id IN (
    SELECT ts.id FROM public.table_sessions ts
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
) WITH CHECK (
  session_id IN (
    SELECT ts.id FROM public.table_sessions ts
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Delete: Platform admins only (orders should be cancelled, not deleted)
CREATE POLICY "Admin Delete: orders" ON public.orders
FOR DELETE USING (public.is_platform_admin());


-- TABLE 6: ORDER ITEMS
-- Read: Staff/managers of this restaurant
CREATE POLICY "Tenant Select: order_items" ON public.order_items
FOR SELECT USING (
  order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.table_sessions ts ON o.session_id = ts.id
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Insert: Staff or service role
CREATE POLICY "Staff Insert: order_items" ON public.order_items
FOR INSERT WITH CHECK (
  order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.table_sessions ts ON o.session_id = ts.id
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Update: Staff updating item status (e.g. item cancelled)
CREATE POLICY "Staff Update: order_items" ON public.order_items
FOR UPDATE USING (
  order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.table_sessions ts ON o.session_id = ts.id
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
) WITH CHECK (
  order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.table_sessions ts ON o.session_id = ts.id
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Delete: Platform admins only
CREATE POLICY "Admin Delete: order_items" ON public.order_items
FOR DELETE USING (public.is_platform_admin());


-- TABLE 7: WAITER CALLS
-- Read: Staff/managers of this restaurant
CREATE POLICY "Tenant Select: waiter_calls" ON public.waiter_calls
FOR SELECT USING (
  table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Insert: Staff or service_role
CREATE POLICY "Staff Insert: waiter_calls" ON public.waiter_calls
FOR INSERT WITH CHECK (
  table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Update: Staff marking waiter calls as done
CREATE POLICY "Staff Update: waiter_calls" ON public.waiter_calls
FOR UPDATE USING (
  table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
) WITH CHECK (
  table_id IN (
    SELECT id FROM public.tables WHERE restaurant_id = public.current_staff_restaurant_id()
  ) OR public.is_platform_admin()
);

-- Delete: Platform admins only
CREATE POLICY "Admin Delete: waiter_calls" ON public.waiter_calls
FOR DELETE USING (public.is_platform_admin());


-- TABLE 8: BILLS
-- Read: Managers of this restaurant only
CREATE POLICY "Manager Select: bills" ON public.bills
FOR SELECT USING (
  (session_id IN (
    SELECT ts.id FROM public.table_sessions ts
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) AND public.is_manager_or_admin()) OR public.is_platform_admin()
);

-- Insert: Managers settling sessions (or executed via atomic RPC / service_role)
CREATE POLICY "Manager Insert: bills" ON public.bills
FOR INSERT WITH CHECK (
  (session_id IN (
    SELECT ts.id FROM public.table_sessions ts
    JOIN public.tables t ON ts.table_id = t.id
    WHERE t.restaurant_id = public.current_staff_restaurant_id()
  ) AND public.is_manager_or_admin()) OR public.is_platform_admin()
);

-- Update / Delete: Bills are immutable financial records; direct client edits are strictly forbidden
CREATE POLICY "Admin Update: bills" ON public.bills
FOR UPDATE USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admin Delete: bills" ON public.bills
FOR DELETE USING (public.is_platform_admin());


-- ------------------------------------------------------------------------------
-- 3. HARDENED ATOMIC BILL SETTLEMENT RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_session_bill(
  p_session_id UUID,
  p_restaurant_id UUID,
  p_discount NUMERIC,
  p_payment_method TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_calling_restaurant_id UUID;
  v_session RECORD;
  v_table RECORD;
  v_restaurant RECORD;
  v_existing_bill RECORD;
  v_subtotal NUMERIC := 0.00;
  v_discount NUMERIC := 0.00;
  v_taxable NUMERIC := 0.00;
  v_service NUMERIC := 0.00;
  v_tax NUMERIC := 0.00;
  v_total NUMERIC := 0.00;
  v_bill RECORD;
  v_unserved_count INTEGER := 0;
  v_item_count INTEGER := 0;
BEGIN
  -- 1. Verify Manager Authorization
  IF auth.role() = 'authenticated' THEN
    IF NOT public.is_manager_or_admin() THEN
      RAISE EXCEPTION 'Forbidden: Manager authorization required to settle bills' USING ERRCODE = '42501';
    END IF;
  ELSIF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Valid authentication required' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate payment method
  IF p_payment_method NOT IN ('cash', 'upi', 'card', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method USING ERRCODE = '22000';
  END IF;

  -- 3. Lock and retrieve dining session exclusively (prevents concurrent settlements)
  SELECT * INTO v_session
  FROM public.table_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dining session % not found', p_session_id USING ERRCODE = '02000';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Dining session % is already closed and settled', p_session_id USING ERRCODE = '23505';
  END IF;

  -- 4. Retrieve table record
  SELECT * INTO v_table
  FROM public.tables
  WHERE id = v_session.table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table record not found for session' USING ERRCODE = '02000';
  END IF;

  -- 5. Multi-Tenant Authorization Enforcement
  IF auth.role() = 'authenticated' AND NOT public.is_platform_admin() THEN
    v_calling_restaurant_id := public.current_staff_restaurant_id();
    IF v_calling_restaurant_id IS NULL THEN
      RAISE EXCEPTION 'Forbidden: User has no assigned restaurant in app_metadata' USING ERRCODE = '42501';
    END IF;
    IF v_table.restaurant_id <> v_calling_restaurant_id THEN
      RAISE EXCEPTION 'Forbidden: You cannot settle bills for another restaurant' USING ERRCODE = '42501';
    END IF;
    IF p_restaurant_id IS NOT NULL AND p_restaurant_id <> v_calling_restaurant_id THEN
      RAISE EXCEPTION 'Forbidden: Restaurant ID parameter mismatch' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- For service_role or other privileged backend execution:
    IF NOT public.is_platform_admin() THEN
      IF p_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Restaurant ID is required and cannot be NULL to settle bill' USING ERRCODE = '42501';
      END IF;
      IF v_table.restaurant_id <> p_restaurant_id THEN
        RAISE EXCEPTION 'Forbidden: Table session belongs to a different restaurant' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = v_table.restaurant_id;

  -- 6. Prevent duplicate bill settlement
  SELECT * INTO v_existing_bill
  FROM public.bills
  WHERE session_id = p_session_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Bill has already been recorded for this session' USING ERRCODE = '23505';
  END IF;

  -- 7. Calculate unserved orders and subtotal strictly from non-cancelled items
  SELECT COUNT(*) INTO v_unserved_count
  FROM public.orders
  WHERE session_id = p_session_id
    AND status <> 'cancelled'
    AND status <> 'served';

  SELECT COALESCE(SUM(ROUND(oi.price_snapshot * oi.quantity, 2)), 0.00), COUNT(oi.id)
  INTO v_subtotal, v_item_count
  FROM public.order_items oi
  JOIN public.orders o ON oi.order_id = o.id
  WHERE o.session_id = p_session_id
    AND o.status <> 'cancelled'
    AND oi.status <> 'cancelled';

  IF v_item_count = 0 OR v_subtotal <= 0.00 THEN
    RAISE EXCEPTION 'Cannot settle bill: no active billable items in this session' USING ERRCODE = '22000';
  END IF;

  -- 8. Server-Enforced Financial Calculations
  -- Validate discount: non-negative and capped at subtotal
  v_discount := ROUND(LEAST(GREATEST(COALESCE(p_discount, 0.00), 0.00), v_subtotal), 2);
  v_taxable := ROUND(GREATEST(0.00, v_subtotal - v_discount), 2);

  -- Compute service charge and GST
  v_service := ROUND((v_taxable * COALESCE(v_restaurant.service_charge_percent, 0.00)) / 100.0, 2);
  v_tax := ROUND(((v_taxable + v_service) * COALESCE(v_restaurant.tax_percent, 5.00)) / 100.0, 2);
  v_total := ROUND(v_taxable + v_service + v_tax, 2);

  IF v_total < 0.00 THEN
    RAISE EXCEPTION 'Calculated bill total cannot be negative' USING ERRCODE = '22000';
  END IF;

  -- 9. Insert bill record atomically
  INSERT INTO public.bills (
    session_id,
    subtotal,
    discount,
    service_charge,
    tax,
    total,
    payment_method,
    created_at
  ) VALUES (
    p_session_id,
    v_subtotal,
    v_discount,
    v_service,
    v_tax,
    v_total,
    p_payment_method,
    timezone('utc'::text, now())
  )
  RETURNING * INTO v_bill;

  -- 10. Atomically close dining session
  UPDATE public.table_sessions
  SET status = 'closed',
      closed_at = timezone('utc'::text, now())
  WHERE id = p_session_id;

  -- 11. Auto-resolve any open waiter calls for this table
  UPDATE public.waiter_calls
  SET status = 'done',
      done_at = timezone('utc'::text, now())
  WHERE table_id = v_table.id
    AND status = 'open';

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', v_bill.id,
    'bill_number', v_bill.bill_number,
    'subtotal', v_bill.subtotal,
    'discount', v_bill.discount,
    'service_charge', v_bill.service_charge,
    'tax', v_bill.tax,
    'total', v_bill.total,
    'payment_method', v_bill.payment_method,
    'table_label', v_table.label,
    'unserved_count', v_unserved_count,
    'created_at', v_bill.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public execution on billing settlement; allow managers and backend API
REVOKE ALL ON FUNCTION public.settle_session_bill(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_session_bill(UUID, UUID, NUMERIC, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. HARDENED ATOMIC ORDER EDIT & CANCELLATION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_order_change(
  p_order_id UUID,
  p_table_token TEXT,
  p_action TEXT,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_table RECORD;
  v_restaurant RECORD;
  v_session RECORD;
  v_order RECORD;
  v_window_seconds INTEGER := 120;
  v_cutoff TIMESTAMPTZ;
  v_elem JSONB;
  v_item_id UUID;
  v_item_qty INTEGER;
  v_item_note TEXT;
  v_existing_item RECORD;
  v_active_items_count INTEGER := 0;
BEGIN
  -- 1. Validate action parameter
  IF p_action NOT IN ('cancel', 'edit') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action USING ERRCODE = '22000';
  END IF;

  -- 2. Validate cryptographic table QR token
  SELECT * INTO v_table
  FROM public.tables
  WHERE qr_token = p_table_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive table token' USING ERRCODE = '02000';
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = v_table.restaurant_id;

  v_window_seconds := COALESCE(v_restaurant.cancel_window_seconds, 120);

  -- 3. Lock and retrieve order exclusively (prevents concurrent race conditions with kitchen)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = '02000';
  END IF;

  -- 4. Verify order belongs to active open session of this specific table
  SELECT * INTO v_session
  FROM public.table_sessions
  WHERE id = v_order.session_id
    AND table_id = v_table.id
    AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order does not belong to active dining session of this table' USING ERRCODE = '42501';
  END IF;

  -- 5. Prevent modification after preparation begins
  IF v_order.status <> 'placed' THEN
    RAISE EXCEPTION 'Order is already % and cannot be modified or cancelled', v_order.status USING ERRCODE = '22000';
  END IF;

  -- 6. Check modification window cutoff
  v_cutoff := timezone('utc'::text, now()) - (v_window_seconds * interval '1 second');
  IF v_order.created_at < v_cutoff THEN
    RAISE EXCEPTION 'The allowed modification window has expired (% seconds). Kitchen is preparing your dishes.', v_window_seconds USING ERRCODE = '22000';
  END IF;

  -- 7. Execute Cancel Action
  IF p_action = 'cancel' THEN
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_order_id;

    UPDATE public.order_items
    SET status = 'cancelled'
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'cancelled', true);
  END IF;

  -- 8. Execute Edit Action
  IF p_action = 'edit' THEN
    IF jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'No items provided for modification' USING ERRCODE = '22000';
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      -- Validate UUID format of item ID
      IF (v_elem->>'id') IS NULL OR NOT ((v_elem->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        RAISE EXCEPTION 'Invalid item identifier format' USING ERRCODE = '22000';
      END IF;
      v_item_id := (v_elem->>'id')::uuid;

      -- Validate quantity format (must be non-negative integer string)
      IF (v_elem->>'quantity') IS NULL OR NOT ((v_elem->>'quantity') ~ '^\d+$') THEN
        RAISE EXCEPTION 'Item quantity must be a non-negative integer' USING ERRCODE = '22000';
      END IF;
      v_item_qty := (v_elem->>'quantity')::integer;
      v_item_note := COALESCE(SUBSTRING(TRIM(v_elem->>'note') FROM 1 FOR 150), NULL);

      IF v_item_qty < 0 OR v_item_qty > 20 THEN
        RAISE EXCEPTION 'Item quantity must be between 0 and 20' USING ERRCODE = '22000';
      END IF;

      -- Check ownership of item strictly within this order
      SELECT * INTO v_existing_item
      FROM public.order_items
      WHERE id = v_item_id AND order_id = p_order_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % does not belong to order %', v_item_id, p_order_id USING ERRCODE = '42501';
      END IF;

      -- Crucial: price_snapshot is NEVER updated. Client cannot modify prices.
      IF v_item_qty = 0 THEN
        UPDATE public.order_items
        SET status = 'cancelled'
        WHERE id = v_item_id AND order_id = p_order_id;
      ELSE
        UPDATE public.order_items
        SET quantity = v_item_qty,
            note = v_item_note,
            status = 'active'
        WHERE id = v_item_id AND order_id = p_order_id;
      END IF;
    END LOOP;

    -- Count active items remaining in this order
    SELECT COUNT(*) INTO v_active_items_count
    FROM public.order_items
    WHERE order_id = p_order_id AND status = 'active';

    IF v_active_items_count = 0 THEN
      UPDATE public.orders
      SET status = 'cancelled',
          updated_at = timezone('utc'::text, now()),
          edited_at = timezone('utc'::text, now())
      WHERE id = p_order_id;

      RETURN jsonb_build_object('success', true, 'cancelled', true);
    ELSE
      UPDATE public.orders
      SET updated_at = timezone('utc'::text, now()),
          edited_at = timezone('utc'::text, now())
      WHERE id = p_order_id;

      RETURN jsonb_build_object('success', true, 'cancelled', false);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public execution; allow customer QR token callers, staff, and service role
REVOKE ALL ON FUNCTION public.atomic_order_change(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_order_change(UUID, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. FOREIGN KEY INDEXES & NON-DESTRUCTIVE SCHEMA ENHANCEMENTS
-- ------------------------------------------------------------------------------

-- Foreign key indexes preventing sequential scans during cascade checks and joins
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id 
ON public.order_items (menu_item_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_status 
ON public.order_items (order_id, status);

CREATE INDEX IF NOT EXISTS idx_waiter_calls_table_id 
ON public.waiter_calls (table_id);

-- Non-destructive extended branding attributes on restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT true;
