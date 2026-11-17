import { connection } from "next/server";
import { supabaseAdmin, requireStaff, apiError, apiSuccess } from "@/lib/serverAuth";
import type { OrderStatus } from "@/lib/types";

type Windowed = {
  tables: {
    restaurant_id: string;
    restaurants: { cancel_window_seconds: number } | null;
  } | null;
} | null;

const lockSeconds = (
  o: { status: string; created_at: string },
  windowSec: number
) =>
  o.status === "placed"
    ? Math.max(
        0,
        windowSec -
          Math.floor((Date.now() - new Date(o.created_at).getTime()) / 1000)
      )
    : 0;

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  placed: ["preparing", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
};

export async function GET(req: Request) {
  try {
    await connection();
    const { staff, errorResponse } = await requireStaff(req);
    if (errorResponse) return errorResponse;

    let query = supabaseAdmin
      .from("orders")
      .select(
        `id, status, created_at, edited_at,
         order_items(id, name_snapshot, quantity, note, status),
         table_sessions!inner(
           id,
           tables!inner(
             id, label, restaurant_id,
             restaurants(id, name, cancel_window_seconds)
           )
         )`
      )
      .in("status", ["placed", "accepted", "preparing", "ready"])
      .order("created_at", { ascending: true });

    // Multi-tenant restaurant scoping
    if (staff?.restaurantId) {
      query = query.eq("table_sessions.tables.restaurant_id", staff.restaurantId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/kitchen] Query error:", error);
      return apiError("Unable to retrieve kitchen orders.", 500);
    }

    const orders = (data ?? []).map((o) => {
      const session = o.table_sessions as unknown as Windowed;
      const windowSec = session?.tables?.restaurants?.cancel_window_seconds ?? 120;
      return {
        ...o,
        lock_seconds_left: lockSeconds(o, windowSec),
      };
    });

    return apiSuccess(orders);
  } catch (err) {
    console.error("[GET /api/kitchen] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { staff, errorResponse } = await requireStaff(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body || !body.orderId || !body.status) {
      return apiError("Invalid request. Missing orderId or status.", 400);
    }

    const { orderId, status } = body;
    const allowedStatuses: OrderStatus[] = [
      "preparing",
      "ready",
      "served",
      "cancelled",
    ];
    if (!allowedStatuses.includes(status)) {
      return apiError("Invalid target status.", 400);
    }

    // Fetch existing order with restaurant info
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, status, created_at,
         table_sessions(
           tables(
             restaurant_id,
             restaurants(cancel_window_seconds)
           )
         )`
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return apiError("Order not found.", 404);
    }

    // Multi-tenant isolation check
    const session = order.table_sessions as unknown as Windowed;
    const orderRestaurantId = session?.tables?.restaurant_id;
    if (staff?.restaurantId && orderRestaurantId && staff.restaurantId !== orderRestaurantId) {
      return apiError("Forbidden: Order does not belong to your restaurant.", 403);
    }

    // Validate state machine transition
    const currentStatus = order.status;
    const validTargets = VALID_TRANSITIONS[currentStatus] || [];
    if (!validTargets.includes(status)) {
      return apiError(
        `Invalid status transition from '${currentStatus}' to '${status}'.`,
        400
      );
    }

    // Protect customer edit/cancellation window: kitchen cannot start preparing while locked
    const windowSec = session?.tables?.restaurants?.cancel_window_seconds ?? 120;
    const left = lockSeconds(order, windowSec);
    if (status === "preparing" && left > 0) {
      return apiError(
        `Customer can still modify this order for ${left} more seconds.`,
        409
      );
    }

    // Execute update safely
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[PATCH /api/kitchen] Update error:", updateError);
      return apiError("Failed to update order status.", 500);
    }

    return apiSuccess({ success: true, orderId, status });
  } catch (err) {
    console.error("[PATCH /api/kitchen] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
