-- ==============================================================================
-- GREEN EMBASSY / MULTI-RESTAURANT QR ORDERING & BILLING SYSTEM
-- MIGRATION: 20261116000000_schema_and_security.sql
-- Non-destructive schema setup, integrity constraints, indexes, and RLS policies
-- ==============================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. RESTAURANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gstin TEXT,
    tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (tax_percent >= 0),
    service_charge_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (service_charge_percent >= 0),
    cancel_window_seconds INTEGER NOT NULL DEFAULT 120 CHECK (cancel_window_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    label TEXT NOT NULL,
    qr_token TEXT NOT NULL UNIQUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_restaurant_label 
ON public.tables (restaurant_id, label);

CREATE INDEX IF NOT EXISTS idx_tables_qr_token 
ON public.tables (qr_token);

-- ------------------------------------------------------------------------------
-- 3. MENU ITEMS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_veg BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_active 
ON public.menu_items (restaurant_id, is_active, sort_order, category);

-- ------------------------------------------------------------------------------
-- 4. TABLE SESSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    session_token TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ
);

-- Crucial: Ensure at most ONE open dining session exists per table at any given time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_table_session 
ON public.table_sessions (table_id) 
WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status 
ON public.table_sessions (table_id, status);

-- ------------------------------------------------------------------------------
-- 5. ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'placed' CHECK (
        status IN ('placed', 'accepted', 'preparing', 'ready', 'served', 'cancelled')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_session_id 
ON public.orders (session_id);

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON public.orders (status, created_at);

-- ------------------------------------------------------------------------------
-- 6. ORDER ITEMS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    name_snapshot TEXT NOT NULL,
    price_snapshot NUMERIC(10, 2) NOT NULL CHECK (price_snapshot >= 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 20),
    note TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items (order_id);

-- ------------------------------------------------------------------------------
-- 7. WAITER CALLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waiter_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    done_at TIMESTAMPTZ
);

-- Prevent spamming: only one open waiter call per table simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_waiter_call 
ON public.waiter_calls (table_id) 
WHERE status = 'open';

-- ------------------------------------------------------------------------------
-- 8. BILLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
    bill_number BIGSERIAL,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    service_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (service_charge >= 0),
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure a table session cannot be billed more than once
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_bill_session 
ON public.bills (session_id);

CREATE INDEX IF NOT EXISTS idx_bills_created_at 
ON public.bills (created_at);

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Service Role Key (Server-side API routes) has full administrative access
CREATE POLICY "Service Role Full Access: restaurants" ON public.restaurants
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: tables" ON public.tables
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: menu_items" ON public.menu_items
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: table_sessions" ON public.table_sessions
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: orders" ON public.orders
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: order_items" ON public.order_items
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: waiter_calls" ON public.waiter_calls
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access: bills" ON public.bills
FOR ALL USING (auth.role() = 'service_role');

-- Authenticated Staff & Manager Access
CREATE POLICY "Staff Read Access: restaurants" ON public.restaurants
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff Read Access: tables" ON public.tables
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff Read Access: menu_items" ON public.menu_items
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff Full Access: orders" ON public.orders
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Staff Full Access: order_items" ON public.order_items
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Staff Full Access: waiter_calls" ON public.waiter_calls
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Staff Full Access: bills" ON public.bills
FOR ALL USING (auth.role() = 'authenticated');
