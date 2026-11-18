import { supabaseAdmin, requireManager, apiError, apiSuccess } from "@/lib/serverAuth";

export async function GET(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    // Fetch restaurant record
    let restQuery = supabaseAdmin.from("restaurants").select("*");
    if (manager.role !== "platform_admin") {
      restQuery = restQuery.eq("id", manager.restaurantId);
    }
    const { data: restaurants, error: restErr } = await restQuery.limit(1);

    if (restErr || !restaurants || restaurants.length === 0) {
      return apiError("Restaurant profile not found.", 404);
    }
    const restaurant = restaurants[0];

    // Parallel counts
    const [tablesRes, menuRes, openSessionsRes] = await Promise.all([
      supabaseAdmin
        .from("tables")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id),
      supabaseAdmin
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true),
      supabaseAdmin
        .from("table_sessions")
        .select("id, tables!inner(restaurant_id)", { count: "exact", head: true })
        .eq("tables.restaurant_id", restaurant.id)
        .eq("status", "open"),
    ]);

    // Today's sales summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayBills } = await supabaseAdmin
      .from("bills")
      .select(
        `total,
         table_sessions!inner(
           tables!inner(restaurant_id)
         )`
      )
      .eq("table_sessions.tables.restaurant_id", restaurant.id)
      .gte("created_at", todayStart.toISOString());

    const totalSalesToday = (todayBills ?? []).reduce(
      (sum, b) => sum + Number(b.total),
      0
    );

    return apiSuccess({
      restaurant,
      stats: {
        totalTables: tablesRes.count ?? 0,
        activeMenuItems: menuRes.count ?? 0,
        openSessions: openSessionsRes.count ?? 0,
        billsToday: todayBills?.length ?? 0,
        salesToday: Math.round(totalSalesToday * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/overview] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
