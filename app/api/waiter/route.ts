import { connection } from "next/server";
import { supabaseAdmin, requireStaff, apiError, apiSuccess } from "@/lib/serverAuth";
import { resolveTableFromToken } from "@/lib/dbHelpers";

export async function GET(req: Request) {
  await connection();
  try {
    await connection();
    const token = new URL(req.url).searchParams.get("t");

    // Customer query: check if current table has an active waiter call
    if (token) {
      const resolution = await resolveTableFromToken(token);
      if (!resolution) return apiError("Unknown table", 404);

      const { data, error } = await supabaseAdmin
        .from("waiter_calls")
        .select("id")
        .eq("table_id", resolution.table.id)
        .eq("status", "open")
        .maybeSingle();

      if (error) {
        console.error("[GET /api/waiter?t=] DB error:", error);
      }
      return apiSuccess({ called: !!data });
    }

    // Staff query: requires staff authentication
    const { staff, errorResponse } = await requireStaff(req);
    if (errorResponse) return errorResponse;

    let query = supabaseAdmin
      .from("waiter_calls")
      .select("id, created_at, tables!inner(id, label, restaurant_id)")
      .eq("status", "open")
      .order("created_at", { ascending: true });

    if (staff.role !== "platform_admin") {
      query = query.eq("tables.restaurant_id", staff.restaurantId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/waiter] Query error:", error);
      return apiError("Failed to fetch waiter calls.", 500);
    }

    return apiSuccess(data ?? []);
  } catch (err) {
    console.error("[GET /api/waiter] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.token) return apiError("Missing table QR token.", 400);

    const resolution = await resolveTableFromToken(body.token);
    if (!resolution) return apiError("Unknown table.", 404);

    // Database unique index on (table_id) where status = 'open' prevents duplicates
    const { error } = await supabaseAdmin
      .from("waiter_calls")
      .insert({ table_id: resolution.table.id, status: "open" });

    if (error && error.code !== "23505") {
      console.error("[POST /api/waiter] Insert error:", error);
      return apiError("Could not alert waiter. Please try again.", 500);
    }

    return apiSuccess({ success: true, called: true });
  } catch (err) {
    console.error("[POST /api/waiter] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { staff, errorResponse } = await requireStaff(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body?.callId) return apiError("Missing waiter call identifier.", 400);

    // Verify call and check restaurant ownership
    const { data: call, error: findError } = await supabaseAdmin
      .from("waiter_calls")
      .select("id, tables(restaurant_id)")
      .eq("id", body.callId)
      .maybeSingle();

    if (findError || !call) {
      return apiError("Waiter call not found.", 404);
    }

    const callTable = call.tables as unknown as { restaurant_id: string } | null;
    if (staff.role !== "platform_admin" && callTable?.restaurant_id !== staff.restaurantId) {
      return apiError("Forbidden: Waiter call belongs to another restaurant.", 403);
    }

    const { error: updateError } = await supabaseAdmin
      .from("waiter_calls")
      .update({
        status: "done",
        done_at: new Date().toISOString(),
      })
      .eq("id", body.callId);

    if (updateError) {
      console.error("[PATCH /api/waiter] Update error:", updateError);
      return apiError("Failed to update waiter call status.", 500);
    }

    return apiSuccess({ success: true });
  } catch (err) {
    console.error("[PATCH /api/waiter] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
