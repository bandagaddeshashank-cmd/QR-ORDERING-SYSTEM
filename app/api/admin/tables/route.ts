import crypto from "crypto";
import { connection } from "next/server";
import { supabaseAdmin, requireManager, apiError, apiSuccess } from "@/lib/serverAuth";

export async function GET(req: Request) {
  await connection();
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    // Fetch tables for this restaurant
    const { data: tables, error } = await supabaseAdmin
      .from("tables")
      .select("id, label, qr_token, restaurant_id")
      .eq("restaurant_id", manager.restaurantId)
      .order("label", { ascending: true });

    if (error) {
      console.error("[GET /api/admin/tables] Query error:", error);
      return apiError("Failed to fetch tables.", 500);
    }

    // Fetch open sessions for these tables
    const tableIds = (tables ?? []).map((t) => t.id);
    let openSessionMap = new Map<string, string>();

    if (tableIds.length > 0) {
      const { data: openSessions } = await supabaseAdmin
        .from("table_sessions")
        .select("id, table_id, opened_at")
        .in("table_id", tableIds)
        .eq("status", "open");

      openSessionMap = new Map((openSessions ?? []).map((s) => [s.table_id, s.id]));
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    const enriched = (tables ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      qr_token: t.qr_token,
      hasOpenSession: openSessionMap.has(t.id),
      sessionId: openSessionMap.get(t.id) ?? null,
      qrUrl: `${baseUrl}/table?t=${t.qr_token}`,
    }));

    return apiSuccess(enriched);
  } catch (err) {
    console.error("[GET /api/admin/tables] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body?.label || typeof body.label !== "string" || body.label.trim().length === 0) {
      return apiError("Table label (e.g. 'T1' or 'Outdoor-4') is required.", 400);
    }

    const label = body.label.trim().slice(0, 30);

    // Prevent duplicate table label in this restaurant
    const { data: existing } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("restaurant_id", manager.restaurantId)
      .ilike("label", label)
      .maybeSingle();

    if (existing) {
      return apiError(`Table '${label}' already exists in this restaurant.`, 409);
    }

    // Generate unique crypto random hex token
    const qrToken = crypto.randomBytes(16).toString("hex");

    const { data: newTable, error } = await supabaseAdmin
      .from("tables")
      .insert({
        restaurant_id: manager.restaurantId,
        label,
        qr_token: qrToken,
      })
      .select("*")
      .single();

    if (error || !newTable) {
      console.error("[POST /api/admin/tables] Insert error:", error);
      return apiError("Failed to add table.", 500);
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    return apiSuccess(
      {
        success: true,
        table: {
          ...newTable,
          qrUrl: `${baseUrl}/table?t=${newTable.qr_token}`,
        },
      },
      201
    );
  } catch (err) {
    console.error("[POST /api/admin/tables] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body?.tableId) return apiError("Missing table ID.", 400);

    const { tableId, label, regenerateToken } = body;

    // Verify table ownership
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("tables")
      .select("id, restaurant_id, label, qr_token")
      .eq("id", tableId)
      .maybeSingle();

    if (findErr || !existing) {
      return apiError("Table not found.", 404);
    }

    if (manager.role !== "platform_admin" && existing.restaurant_id !== manager.restaurantId) {
      return apiError("Forbidden: Table belongs to another restaurant.", 403);
    }

    const updates: Record<string, unknown> = {};

    if (label !== undefined) {
      if (typeof label !== "string" || label.trim().length === 0) {
        return apiError("Table label cannot be empty.", 400);
      }
      const trimmedLabel = label.trim().slice(0, 30);

      // Check collision with other table
      const { data: collision } = await supabaseAdmin
        .from("tables")
        .select("id")
        .eq("restaurant_id", manager.restaurantId)
        .ilike("label", trimmedLabel)
        .neq("id", tableId)
        .maybeSingle();

      if (collision) {
        return apiError(`Another table with label '${trimmedLabel}' already exists.`, 409);
      }
      updates.label = trimmedLabel;
    }

    if (regenerateToken) {
      // Regenerate token immediately invalidates previous QR code
      updates.qr_token = crypto.randomBytes(16).toString("hex");
    }

    if (Object.keys(updates).length === 0) {
      return apiError("No update fields provided.", 400);
    }

    const { data: updatedTable, error: updateErr } = await supabaseAdmin
      .from("tables")
      .update(updates)
      .eq("id", tableId)
      .select("*")
      .single();

    if (updateErr || !updatedTable) {
      console.error("[PATCH /api/admin/tables] Update error:", updateErr);
      return apiError("Failed to update table.", 500);
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    return apiSuccess({
      success: true,
      table: {
        ...updatedTable,
        qrUrl: `${baseUrl}/table?t=${updatedTable.qr_token}`,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/admin/tables] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const tableId = url.searchParams.get("id");
    if (!tableId) return apiError("Missing table ID.", 400);

    // Verify ownership
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("tables")
      .select("id, restaurant_id, label")
      .eq("id", tableId)
      .maybeSingle();

    if (findErr || !existing) {
      return apiError("Table not found.", 404);
    }

    if (manager.role !== "platform_admin" && existing.restaurant_id !== manager.restaurantId) {
      return apiError("Forbidden: Table belongs to another restaurant.", 403);
    }

    // Check if table currently has an open session
    const { count: openSessions } = await supabaseAdmin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("table_id", tableId)
      .eq("status", "open");

    if (openSessions && openSessions > 0) {
      return apiError("Cannot delete table with an active dining session. Settle and close session first.", 409);
    }

    // Check if table has past sessions
    const { count: pastSessions } = await supabaseAdmin
      .from("table_sessions")
      .select("id", { count: "exact", head: true })
      .eq("table_id", tableId);

    if (pastSessions && pastSessions > 0) {
      return apiError(
        "Cannot delete table with historical session records. Re-label or revoke token instead to preserve billing history.",
        409
      );
    }

    const { error: delErr } = await supabaseAdmin
      .from("tables")
      .delete()
      .eq("id", tableId);

    if (delErr) {
      console.error("[DELETE /api/admin/tables] Delete error:", delErr);
      return apiError("Failed to delete table.", 500);
    }

    return apiSuccess({ success: true, message: `Table ${existing.label} deleted.` });
  } catch (err) {
    console.error("[DELETE /api/admin/tables] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
