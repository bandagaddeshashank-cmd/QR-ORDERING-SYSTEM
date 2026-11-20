-- ==============================================================================
-- GREEN EMBASSY / MULTI-RESTAURANT PLATFORM
-- MIGRATION: 20261120000000_fix_order_change_item_status.sql
-- 1. Fix item_status enum handling in atomic_order_change stored procedure.
-- 2. Eliminate invalid assignment of 'active' (not in item_status enum).
-- 3. Preserve valid kitchen item statuses (pending, preparing, ready, served).
-- 4. Initial status for newly inserted items is 'pending'.
-- 5. Count active remaining items using status != 'cancelled'.
-- ==============================================================================

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
      -- Validate quantity format (must be non-negative integer string)
      IF (v_elem->>'quantity') IS NULL OR NOT ((v_elem->>'quantity') ~ '^\d+$') THEN
        RAISE EXCEPTION 'Item quantity must be a non-negative integer' USING ERRCODE = '22000';
      END IF;
      v_item_qty := (v_elem->>'quantity')::integer;
      v_item_note := COALESCE(SUBSTRING(TRIM(v_elem->>'note') FROM 1 FOR 150), NULL);

      IF v_item_qty < 0 OR v_item_qty > 20 THEN
        RAISE EXCEPTION 'Item quantity must be between 0 and 20' USING ERRCODE = '22000';
      END IF;

      -- Check if updating an existing order item
      IF (v_elem->>'id') IS NOT NULL AND ((v_elem->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        v_item_id := (v_elem->>'id')::uuid;

        SELECT * INTO v_existing_item
        FROM public.order_items
        WHERE id = v_item_id AND order_id = p_order_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item % does not belong to order %', v_item_id, p_order_id USING ERRCODE = '42501';
        END IF;

        -- Price snapshot is NEVER updated by client.
        IF v_item_qty = 0 THEN
          UPDATE public.order_items
          SET status = 'cancelled'
          WHERE id = v_item_id AND order_id = p_order_id;
        ELSE
          -- Update quantity and note while preserving current kitchen status.
          -- If previously cancelled item is restored, reset status to 'pending'.
          UPDATE public.order_items
          SET quantity = v_item_qty,
              note = v_item_note,
              status = CASE 
                WHEN status = 'cancelled' THEN 'pending'::public.item_status
                ELSE status
              END
          WHERE id = v_item_id AND order_id = p_order_id;
        END IF;

      -- Check if inserting a new item into this order
      ELSIF (v_elem->>'menu_item_id') IS NOT NULL AND ((v_elem->>'menu_item_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        DECLARE
          v_menu_item RECORD;
        BEGIN
          SELECT * INTO v_menu_item
          FROM public.menu_items
          WHERE id = (v_elem->>'menu_item_id')::uuid
            AND restaurant_id = v_table.restaurant_id
            AND is_active = true;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item % not found or inactive for this restaurant', (v_elem->>'menu_item_id') USING ERRCODE = '02000';
          END IF;

          IF v_item_qty > 0 THEN
            INSERT INTO public.order_items (
              order_id,
              menu_item_id,
              name_snapshot,
              price_snapshot,
              quantity,
              note,
              status
            ) VALUES (
              p_order_id,
              v_menu_item.id,
              v_menu_item.name,
              v_menu_item.price,
              v_item_qty,
              v_item_note,
              'pending'::public.item_status
            );
          END IF;
        END;
      ELSE
        RAISE EXCEPTION 'Invalid item identifier format' USING ERRCODE = '22000';
      END IF;
    END LOOP;

    -- Count active (non-cancelled) items remaining in this order
    SELECT COUNT(*) INTO v_active_items_count
    FROM public.order_items
    WHERE order_id = p_order_id AND status != 'cancelled';

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
