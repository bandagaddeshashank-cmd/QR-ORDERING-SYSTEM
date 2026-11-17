import { supabaseAdmin, requireManager, apiError, apiSuccess } from "@/lib/serverAuth";
import { roundMoney } from "@/lib/dbHelpers";
import type { PaymentMethod, BillLine, Bill, Restaurant } from "@/lib/types";

type TableJoin = {
  id: string;
  label: string;
  restaurant_id: string;
  restaurants: Restaurant;
};

async function buildBillForSession(
  sessionId: string,
  discountInput: number,
  expectedRestaurantId?: string
) {
  // Fetch session and table with restaurant details
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("table_sessions")
    .select("id, status, tables!inner(id, label, restaurant_id, restaurants!inner(*))")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    return { bill: null, error: "Session not found." };
  }

  const t = session.tables as unknown as TableJoin;
  const r = t.restaurants;

  // Enforce multi-restaurant boundary
  if (expectedRestaurantId && t.restaurant_id !== expectedRestaurantId) {
    return { bill: null, error: "Table session belongs to a different restaurant." };
  }

  // Fetch all orders for this session that are not cancelled
  const { data: orders, error: ordersErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, order_items(id, name_snapshot, price_snapshot, quantity, status)")
    .eq("session_id", sessionId)
    .neq("status", "cancelled");

  if (ordersErr) {
    console.error("[buildBillForSession] Orders query error:", ordersErr);
    return { bill: null, error: "Failed to retrieve orders for session." };
  }

  // Aggregate item quantities and snapshots
  const map = new Map<string, BillLine>();
  let notServed = 0;

  for (const o of orders ?? []) {
    if (o.status !== "served") {
      notServed++;
    }

    for (const item of o.order_items ?? []) {
      if (item.status === "cancelled") continue;
      const price = Number(item.price_snapshot);
      const key = `${item.name_snapshot}|${price}`;
      const line = map.get(key) ?? {
        name: item.name_snapshot,
        price,
        qty: 0,
        total: 0,
      };
      line.qty += item.quantity;
      line.total = roundMoney(line.qty * line.price);
      map.set(key, line);
    }
  }

  const lines = Array.from(map.values());
  const subtotal = roundMoney(lines.reduce((acc, l) => acc + l.total, 0));

  // Server-side discount validation: non-negative and capped at subtotal
  const rawDiscount = Number(discountInput) || 0;
  const discount = roundMoney(Math.min(Math.max(rawDiscount, 0), subtotal));

  const taxable = roundMoney(Math.max(0, subtotal - discount));
  const servicePercent = Number(r.service_charge_percent) || 0;
  const taxPercent = Number(r.tax_percent) || 0;

  const service = roundMoney((taxable * servicePercent) / 100);
  const tax = roundMoney(((taxable + service) * taxPercent) / 100);
  const total = roundMoney(taxable + service + tax);

  const bill: Bill = {
    sessionId: session.id,
    table: t.label,
    restaurant: r.name,
    gstin: r.gstin,
    lines,
    subtotal,
    discount,
    service,
    tax,
    total,
    taxPercent,
    servicePercent,
    notServed,
  };

  return { bill, error: null, sessionStatus: session.status };
}

export async function GET(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const tableLabel = url.searchParams.get("table")?.trim();
    const sessionId = url.searchParams.get("sessionId")?.trim();
    const discount = Number(url.searchParams.get("discount") || 0);

    // 1. Single Table/Session Bill Lookup
    if (tableLabel || sessionId) {
      let targetSessionId = sessionId;

      if (!targetSessionId && tableLabel) {
        let tableQuery = supabaseAdmin
          .from("tables")
          .select("id, label, restaurant_id")
          .ilike("label", tableLabel.replace(/[%_]/g, "\\$&"));

        if (manager?.restaurantId) {
          tableQuery = tableQuery.eq("restaurant_id", manager.restaurantId);
        }

        const { data: tables } = await tableQuery.limit(1);
        if (!tables || tables.length === 0) {
          return apiError(`Table '${tableLabel}' not found.`, 404);
        }

        const { data: session } = await supabaseAdmin
          .from("table_sessions")
          .select("id")
          .eq("table_id", tables[0].id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) {
          return apiError(`No active bill found for Table ${tables[0].label}.`, 404);
        }
        targetSessionId = session.id;
      }

      const { bill, error } = await buildBillForSession(
        targetSessionId!,
        discount,
        manager?.restaurantId
      );

      if (error || !bill) {
        return apiError(error ?? "Unable to build bill.", 404);
      }

      return apiSuccess(bill);
    }

    // 2. Manager Dashboard Overview Mode
    let restQuery = supabaseAdmin.from("restaurants").select("*");
    if (manager?.restaurantId) {
      restQuery = restQuery.eq("id", manager.restaurantId);
    }
    const { data: restaurants } = await restQuery.limit(1);
    const restaurant = restaurants?.[0] as Restaurant | undefined;

    if (!restaurant) {
      return apiError("Restaurant record not found.", 404);
    }

    // Fetch all tables for this restaurant
    const { data: tables } = await supabaseAdmin
      .from("tables")
      .select("id, label, restaurant_id")
      .eq("restaurant_id", restaurant.id)
      .order("label", { ascending: true });

    // Fetch open sessions for these tables
    const tableIds = (tables ?? []).map((t) => t.id);
    const { data: openSessions } = await supabaseAdmin
      .from("table_sessions")
      .select("id, table_id, status, opened_at")
      .in("table_id", tableIds)
      .eq("status", "open");

    const openSessionMap = new Map((openSessions ?? []).map((s) => [s.table_id, s]));

    // Fetch active orders for these open sessions
    const sessionIds = (openSessions ?? []).map((s) => s.id);
    const activeOrdersCount: Record<string, { total: number; unserved: number; sum: number }> = {};

    if (sessionIds.length > 0) {
      const { data: activeOrders } = await supabaseAdmin
        .from("orders")
        .select("id, session_id, status, order_items(price_snapshot, quantity, status)")
        .in("session_id", sessionIds)
        .neq("status", "cancelled");

      for (const ord of activeOrders ?? []) {
        const stats = activeOrdersCount[ord.session_id] ?? { total: 0, unserved: 0, sum: 0 };
        stats.total++;
        if (ord.status !== "served") stats.unserved++;
        for (const it of ord.order_items ?? []) {
          if (it.status !== "cancelled") {
            stats.sum += Number(it.price_snapshot) * Number(it.quantity);
          }
        }
        activeOrdersCount[ord.session_id] = stats;
      }
    }

    const tableCards = (tables ?? []).map((tbl) => {
      const s = openSessionMap.get(tbl.id);
      const stats = s ? activeOrdersCount[s.id] : null;
      return {
        id: tbl.id,
        label: tbl.label,
        hasOpenSession: !!s,
        sessionId: s?.id ?? null,
        openedAt: s?.opened_at ?? null,
        orderCount: stats?.total ?? 0,
        unservedCount: stats?.unserved ?? 0,
        estimatedSubtotal: roundMoney(stats?.sum ?? 0),
      };
    });

    // Fetch today's completed bills for the sales summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayBills, error: billsErr } = await supabaseAdmin
      .from("bills")
      .select(
        `id, bill_number, subtotal, discount, service_charge, tax, total, payment_method, created_at,
         table_sessions!inner(
           id,
           tables!inner(id, label, restaurant_id)
         )`
      )
      .eq("table_sessions.tables.restaurant_id", restaurant.id)
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    if (billsErr) {
      console.error("[GET /api/billing] Bills query error:", billsErr);
    }

    const completedBills = (todayBills ?? []).map((b) => {
      const s = b.table_sessions as unknown as { tables: { label: string } };
      return {
        id: b.id,
        billNumber: b.bill_number,
        table: s?.tables?.label ?? "Unknown",
        subtotal: Number(b.subtotal),
        discount: Number(b.discount),
        serviceCharge: Number(b.service_charge),
        tax: Number(b.tax),
        total: Number(b.total),
        paymentMethod: b.payment_method as PaymentMethod,
        createdAt: b.created_at,
      };
    });

    // Aggregate real sales statistics from actual database records
    let totalSales = 0;
    let totalTax = 0;
    let totalDiscounts = 0;
    const paymentBreakdown: Record<PaymentMethod, number> = {
      cash: 0,
      upi: 0,
      card: 0,
      other: 0,
    };

    for (const b of completedBills) {
      totalSales += b.total;
      totalTax += b.tax;
      totalDiscounts += b.discount;
      if (b.paymentMethod && b.paymentMethod in paymentBreakdown) {
        paymentBreakdown[b.paymentMethod] += b.total;
      }
    }

    return apiSuccess({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        gstin: restaurant.gstin,
        taxPercent: restaurant.tax_percent,
        servicePercent: restaurant.service_charge_percent,
      },
      tables: tableCards,
      todaySummary: {
        totalSales: roundMoney(totalSales),
        billsCount: completedBills.length,
        totalTax: roundMoney(totalTax),
        totalDiscounts: roundMoney(totalDiscounts),
        averageOrderValue: completedBills.length > 0 ? roundMoney(totalSales / completedBills.length) : 0,
        paymentBreakdown: {
          cash: roundMoney(paymentBreakdown.cash),
          upi: roundMoney(paymentBreakdown.upi),
          card: roundMoney(paymentBreakdown.card),
          other: roundMoney(paymentBreakdown.other),
        },
      },
      recentBills: completedBills.slice(0, 20),
    });
  } catch (err) {
    console.error("[GET /api/billing] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body || !body.sessionId || !body.paymentMethod) {
      return apiError("Invalid request. Missing sessionId or paymentMethod.", 400);
    }

    const { sessionId, discount, paymentMethod } = body;
    const validMethods: PaymentMethod[] = ["cash", "upi", "card", "other"];
    if (!validMethods.includes(paymentMethod)) {
      return apiError("Invalid payment method. Choose Cash, UPI, Card, or Other.", 400);
    }

    // Build and verify bill strictly on server
    const { bill, error, sessionStatus } = await buildBillForSession(
      sessionId,
      Number(discount) || 0,
      manager?.restaurantId
    );

    if (error || !bill) {
      return apiError(error ?? "Dining session not found.", 404);
    }

    if (sessionStatus !== "open") {
      return apiError("This dining session has already been settled and closed.", 409);
    }

    if (bill.lines.length === 0) {
      return apiError("Cannot generate bill: No active orders found in this session.", 400);
    }

    // Save bill record
    const { data: savedBill, error: billInsertErr } = await supabaseAdmin
      .from("bills")
      .insert({
        session_id: sessionId,
        subtotal: bill.subtotal,
        discount: bill.discount,
        service_charge: bill.service,
        tax: bill.tax,
        total: bill.total,
        payment_method: paymentMethod,
      })
      .select("id, bill_number, created_at")
      .single();

    if (billInsertErr || !savedBill) {
      console.error("[POST /api/billing] Bill insert failed:", billInsertErr);
      return apiError("Failed to record bill. Table session was not closed.", 409);
    }

    // Close session atomically
    const { error: sessionUpdateErr } = await supabaseAdmin
      .from("table_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("status", "open");

    if (sessionUpdateErr) {
      console.error("[POST /api/billing] Session closure warning:", sessionUpdateErr);
    }

    return apiSuccess({
      ...bill,
      id: savedBill.id,
      billNumber: savedBill.bill_number,
      paymentMethod,
      createdAt: savedBill.created_at,
      success: true,
    });
  } catch (err) {
    console.error("[POST /api/billing] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
