import { connection } from "next/server";
import { supabaseAdmin, apiError, apiSuccess } from "@/lib/serverAuth";
import {
  resolveTableFromToken,
  getOrCreateOpenSession,
  validateOrderItems,
} from "@/lib/dbHelpers";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.token || !Array.isArray(body.items) || body.items.length === 0) {
      return apiError("Invalid order request. Please provide items and table token.", 400);
    }

    const resolution = await resolveTableFromToken(body.token);
    if (!resolution) {
      return apiError("Unknown or inactive table. Please rescan the QR code.", 404);
    }
    const { table, restaurant } = resolution;

    // Resolve or open session atomically
    const sessionId = await getOrCreateOpenSession(table.id);
    if (!sessionId) {
      return apiError("Could not initialize dining session for this table.", 500);
    }

    // Validate items strictly against restaurant menu & prices
    const { validItems, error: validationError } = await validateOrderItems(
      restaurant.id,
      body.items
    );
    if (validationError || !validItems) {
      return apiError(validationError ?? "Invalid items submitted.", 400);
    }

    // Insert order header
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({ session_id: sessionId, status: "placed" })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[POST /api/orders] Order insert failed:", orderError);
      return apiError("Could not place order. Please try again.", 500);
    }

    // Insert order items
    const rows = validItems.map((r) => ({
      order_id: order.id,
      ...r,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(rows);

    // Partial failure rollback: remove orphaned order header if items failed
    if (itemsError) {
      console.error("[POST /api/orders] Order items insert failed:", itemsError);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      return apiError("Failed to save order items. Please try again.", 500);
    }

    return apiSuccess({ success: true, orderId: order.id });
  } catch (err) {
    console.error("[POST /api/orders] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    const isPoll = url.searchParams.get("poll") === "1";
    if (!token) return apiError("Missing table QR token", 400);

    const resolution = await resolveTableFromToken(token);
    if (!resolution) {
      return apiError("Unknown or inactive table.", 404);
    }
    const { table, restaurant } = resolution;
    const windowSec = restaurant.cancel_window_seconds ?? 120;

    // Check open session and active waiter call in parallel
    const [sessionRes, waiterCallRes] = await Promise.all([
      supabaseAdmin
        .from("table_sessions")
        .select("id")
        .eq("table_id", table.id)
        .eq("status", "open")
        .maybeSingle(),
      supabaseAdmin
        .from("waiter_calls")
        .select("id")
        .eq("table_id", table.id)
        .eq("status", "open")
        .maybeSingle(),
    ]);

    const session = sessionRes.data;
    const waiterCalled = Boolean(waiterCallRes.data);

    let orders: unknown[] = [];
    if (session) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select(
          "id, status, created_at, edited_at, order_items(id, name_snapshot, price_snapshot, quantity, note, status)"
        )
        .eq("session_id", session.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (!error && data) {
        orders = data.map((o) => {
          const elapsedSec = Math.floor(
            (Date.now() - new Date(o.created_at).getTime()) / 1000
          );
          return {
            ...o,
            edit_seconds_left:
              o.status === "placed" ? Math.max(0, windowSec - elapsedSec) : 0,
          };
        });
      }
    }

    // Lightweight delta for 4-second polling: return orders & waiter status without re-fetching 50 menu items
    if (isPoll) {
      return apiSuccess({
        table: table.label,
        orders,
        waiterCalled,
        sessionOpen: Boolean(session),
      });
    }

    // Fetch active menu items strictly for this restaurant on full load
    const { data: menuItems } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, description, category, price, is_veg")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");

    return apiSuccess({
      table: table.label,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        cancel_window_seconds: windowSec,
        tax_percent: restaurant.tax_percent,
        service_charge_percent: restaurant.service_charge_percent,
      },
      menu: menuItems ?? [],
      orders,
      waiterCalled,
    });
  } catch (err) {
    console.error("[GET /api/orders] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
