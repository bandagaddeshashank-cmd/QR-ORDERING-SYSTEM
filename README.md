# Green Embassy — Enterprise QR Ordering & Billing Platform

A modern, production-grade restaurant operations platform designed for fine dining, cafes, and multi-restaurant hospitality chains. Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Supabase (PostgreSQL & Authentication)**.

---

## 1. System Architecture & Modules

The platform is structured into four primary modules:

1. **Customer QR Ordering Interface (`/table`)**
   - Instant guest access via table-specific QR tokens without requiring account creation.
   - Live categorized menu search, FSSAI-compliant Veg/Non-Veg indicators, and item notes.
   - Real-time order progress tracking (`Placed` ➔ `Preparing` ➔ `Ready` ➔ `Served`).
   - Timed modification and cancellation countdown window with atomic claim locks.
   - Real-time "Call Waiter" button with acknowledgment status.

2. **Kitchen Display System (`/kitchen`)**
   - Protected station with Staff/Manager role-based authentication (`KitchenGate`).
   - 3-stage visual pipeline: **New Orders**, **Preparing**, and **Ready for Pickup**.
   - Customer change window countdown display with lock prevention.
   - Built-in Web Audio API order arrival chime with user mute/unmute control.
   - Urgent waiter call alert bar with elapsed minutes timer.

3. **Manager Billing & Settlement Desk (`/billing`)**
   - Protected station with Manager authentication (`ManagerGate`).
   - Live Table Occupancy Grid (Vacant, Dining, Ready for Bill, Unserved warnings).
   - Real-time automated order item aggregation (excluding cancelled dishes).
   - Server-enforced discount validation, configurable GST tax % and service charge %.
   - Multi-method settlement: Cash, UPI, Credit/Debit Card, Other.
   - Auto-generated serial bill numbers and atomic table session closure.
   - Daily KPI dashboard (Real sales revenue, order counts, payment method breakdowns).
   - Professional printable thermal invoice (80mm POS or A4).

4. **Hardened App Router API Endpoints (`/api/*`)**
   - `POST /api/orders`: Multi-tenant scoped order placement with server-side price lookup and rollback on partial failure.
   - `GET /api/orders?t=<token>`: Scoped menu, active table orders, and restaurant metadata.
   - `GET /api/kitchen`: Staff-authenticated listing of active orders scoped by restaurant.
   - `PATCH /api/kitchen`: Staff-authenticated order status state machine enforcement.
   - `GET /api/waiter`: Token-validated customer check and staff-authenticated open call listing.
   - `POST /api/waiter`: Anti-spam waiter calling for active dining tables.
   - `PATCH /api/waiter`: Staff-authenticated waiter call acknowledgment.
   - `POST /api/order-change`: Ownership-verified order editing and timed cancellation.
   - `GET /api/billing`: Manager-authenticated overview metrics, table lists, and bill calculation.
   - `POST /api/billing`: Manager-authenticated atomic bill creation and table session closure.

---

## 2. Security & Multi-Restaurant Isolation

- **Role-Based Authorization (RBAC)**: Manager endpoints require `app_metadata.role = 'manager'`. Kitchen and waiter management endpoints require `role IN ('manager', 'staff')`.
- **Zero Trust Client Pricing**: Dish prices, taxes, service charges, and discounts are computed strictly on the server from PostgreSQL database records. Client-submitted prices are discarded.
- **Multi-Tenant Isolation**: Tables, menu items, table sessions, orders, and bills are constrained to `restaurants.id`. Cross-restaurant data contamination is blocked at the API query level.
- **Protection of Secrets**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side routes in `lib/serverAuth.ts` and is never exposed to client-side bundles.
- **Safe Error Handling**: Database internals, table schemas, and SQL errors are logged securely on the server and replaced with safe, user-facing error messages.

---

## 3. Database Schema & Setup

The database schema and policies are provided in:
`supabase/migrations/20261116000000_schema_and_security.sql`

### Core Database Entities

| Table | Purpose | Multi-Tenant Constraint |
|---|---|---|
| `restaurants` | Restaurant identity, GSTIN, tax %, service charge %, edit window | Primary tenant entity |
| `tables` | Dining tables with unique `qr_token` | Foreign key to `restaurants.id` |
| `menu_items` | Dishes with category, price, veg status, sort order | Foreign key to `restaurants.id` |
| `table_sessions` | Active and closed dining sessions | References `tables.id` (1 open session per table) |
| `orders` | Order tickets (`placed`, `preparing`, `ready`, `served`, `cancelled`) | References `table_sessions.id` |
| `order_items` | Ordered dishes with price snapshots and notes | References `orders.id` & `menu_items.id` |
| `waiter_calls` | Waiter call requests (`open`, `done`) | References `tables.id` (1 open call per table) |
| `bills` | Finalized invoices with serial bill numbers and payment method | References `table_sessions.id` (1 bill per session) |

### Applying the SQL Migration

1. Open your Supabase Dashboard at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Paste the contents of `supabase/migrations/20261116000000_schema_and_security.sql`.
4. Click **Run** to apply constraints, indexes, and Row Level Security policies.

---

## 4. Local Development Quickstart

### Prerequisites

- Node.js 18+ (tested with Node 20 & 26)
- npm or pnpm

### Setup Steps

1. Clone or open the repository.
2. Navigate to the project folder:
   ```bash
   cd qr-ordering
   ```
3. Copy environment variables template:
   ```bash
   cp .env.example .env.local
   ```
4. Configure `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
5. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
6. Run lint and type checks:
   ```bash
   npm run lint
   npx tsc --noEmit
   ```
7. Start the development server:
   ```bash
   npm run dev
   ```
8. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Staff & Manager User Creation in Supabase

To log into the Kitchen Display (`/kitchen`) or Billing Desk (`/billing`), create users in Supabase Auth:

1. In Supabase Dashboard, go to **Authentication ➔ Users**.
2. Click **Add User** (Create user with email & password).
3. To assign the user as **Manager**:
   In the user record's `Raw App Meta Data`, set:
   ```json
   {
     "role": "manager",
     "restaurant_id": "<your-restaurant-uuid>"
   }
   ```
4. To assign the user as **Kitchen Staff**:
   ```json
   {
     "role": "staff",
     "restaurant_id": "<your-restaurant-uuid>"
   }
   ```

---

## 6. Table QR Code Generation Guide

Each dining table is assigned a unique `qr_token` stored in the `tables` table.

For example, for Table T1 with token `b61bd809b5cce05fa43190684d18e8df`:
```text
https://your-domain.com/table?t=b61bd809b5cce05fa43190684d18e8df
```

Generate printable QR code stickers (using standard 300 DPI SVG/PNG generators) with table numbers printed prominently on the acrylic table stands or laminated tent cards.

---

## 7. Production Deployment & Security Checklist

- [x] Configure production domain in Next.js.
- [x] Set environment variables securely in hosting platform (e.g. Vercel, Railway, AWS).
- [x] Enable SSL/HTTPS on production domain.
- [x] Verify `SUPABASE_SERVICE_ROLE_KEY` is marked as secret and never prefixed with `NEXT_PUBLIC_`.
- [x] Ensure Row Level Security (RLS) is enabled on all tables in Supabase.
- [x] Restrict CORS origins in Supabase Auth settings to production domain.
- [x] Conduct end-to-end test of QR order placement, kitchen status transitions, and bill settlement.
