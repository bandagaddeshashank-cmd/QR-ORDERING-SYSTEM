import { supabaseAdmin, apiError, apiSuccess } from "@/lib/serverAuth";
import { resolveTableFromToken } from "@/lib/dbHelpers";

type EditItemInput = { id: string; quantity: number | string; note?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.token || !body.orderId || !["cancel", "edit"].includes(body.action)) {
      return apiError("Invalid request. Missing token, orderId, or action.", 400);
    }

    const { token, orderId, action, items } = body;

    // 1. Try atomic PostgreSQL RPC if applied in database
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc(
      "atomic_order_change",
      {
        p_order_id: orderId,
        p_table_token: token,
        p_action: action,
        p_items: Array.isArray(items) ? items : [],
      }
    );

    if (!rpcErr && rpcData?.success) {
      return apiSuccess({ success: true, cancelled: !!rpcData.cancelled });
    }

    if (
      rpcErr &&
      rpcErr.code !== "PGRST202" &&
      !rpcErr.message?.includes("function") &&
      !rpcErr.message?.includes("not found")
    ) {
      return apiError(rpcErr.message || "Failed to update order.", 400);
    }

    // 2. Fallback: Secure server-side validation and atomic lock check
    const resolution = await resolveTableFromToken(token);
    if (!resolution) {
      return apiError("Unknown table.", 404);
    }
    const { table, restaurant } = resolution;
    const windowSec = restaurant.cancel_window_seconds ?? 120;

    // Verify table session is currently open
    const { data: session } = await supabaseAdmin
      .from("table_sessions")
      .select("id")
      .eq("table_id", table.id)
      .eq("status", "open")
      .maybeSingle();

    if (!session) {
      return apiError("No active dining session found for this table.", 404);
    }

    // Verify order exists in this session and is currently 'placed'
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, status, created_at")
      .eq("id", orderId)
      .eq("session_id", session.id)
      .maybeSingle();

    if (orderError || !order) {
      return apiError("Order not found for this dining session.", 404);
    }

    if (order.status !== "placed") {
      return apiError(
        "This order has already been accepted or prepared by the kitchen and cannot be altered.",
        409
      );
    }

    // Check lock cutoff time
    const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();
    if (order.created_at < cutoff) {
      return apiError(
        "The allowed modification window has expired. The kitchen is now preparing your dishes.",
        409
      );
    }

    // Action: Cancel Whole Order
    if (action === "cancel") {
      const { data: cancelled, error: cancelError } = await supabaseAdmin
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "placed")
        .gte("created_at", cutoff)
        .select("id");

      if (cancelError || !cancelled?.length) {
        return apiError("Failed to cancel order or modification window just closed.", 409);
      }

      await supabaseAdmin
        .from("order_items")
        .update({ status: "cancelled" })
        .eq("order_id", orderId);

      return apiSuccess({ success: true, cancelled: true });
    }

    // Action: Edit Items in Order
    if (!Array.isArray(items) || items.length === 0) {
      return apiError("No items provided for modification.", 400);
    }

    // Verify ownership of every item in the order
    const { data: existingItems, error: itemsQueryError } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id")
      .eq("order_id", orderId);

    if (itemsQueryError || !existingItems) {
      return apiError("Failed to retrieve current order items.", 500);
    }

    const itemOwnershipSet = new Set(existingItems.map((i) => i.id));
    for (const it of items as EditItemInput[]) {
      if (!it.id || !itemOwnershipSet.has(it.id)) {
        return apiError("Invalid item modification: Item does not belong to this order.", 403);
      }
      const q = Number(it.quantity);
      if (!Number.isInteger(q) || q < 0 || q > 20) {
        return apiError("Item quantity must be an integer between 0 and 20.", 400);
      }
    }

    // Claim order edit lock
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("orders")
      .update({
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "placed")
      .gte("created_at", cutoff)
      .select("id");

    if (claimError || !claimed?.length) {
      return apiError(
        "The change window has expired or the kitchen has begun preparation.",
        409
      );
    }

    // Apply item updates with strict error checking
    for (const it of items as EditItemInput[]) {
      const q = Number(it.quantity);
      if (q === 0) {
        const { error: delErr } = await supabaseAdmin
          .from("order_items")
          .update({ status: "cancelled" })
          .eq("id", it.id)
          .eq("order_id", orderId);

        if (delErr) {
          console.error("[POST /api/order-change] Error cancelling item:", delErr);
        }
      } else {
        const note =
          typeof it.note === "string" ? it.note.trim().slice(0, 150) : "";
        const { error: updErr } = await supabaseAdmin
          .from("order_items")
          .update({
            quantity: q,
            note: note || null,
          })
          .eq("id", it.id)
          .eq("order_id", orderId);

        if (updErr) {
          console.error("[POST /api/order-change] Error updating item:", updErr);
        }
      }
    }

    // Check if any active items remain in the order
    const { data: activeItems } = await supabaseAdmin
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "active");

    if (!activeItems || activeItems.length === 0) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      return apiSuccess({ success: true, cancelled: true });
    }

    return apiSuccess({ success: true, cancelled: false });
  } catch (err) {
    console.error("[POST /api/order-change] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
