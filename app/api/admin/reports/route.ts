import { connection } from "next/server";
import { supabaseAdmin, requireManager, apiError, apiSuccess } from "@/lib/serverAuth";
import { roundMoney } from "@/lib/dbHelpers";
import type { PaymentMethod } from "@/lib/types";

export async function GET(req: Request) {
  await connection();
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "today"; // today | 7d | 30d | all
    const format = url.searchParams.get("format"); // csv or json

    const now = new Date();
    let startDate: Date | null = new Date();

    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "7d") {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "30d") {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "all") {
      startDate = null;
    } else {
      startDate.setHours(0, 0, 0, 0);
    }

    // Query bills strictly for this restaurant
    let billsQuery = supabaseAdmin
      .from("bills")
      .select(
        `id, bill_number, subtotal, discount, service_charge, tax, total, payment_method, created_at,
         table_sessions!inner(
           id,
           tables!inner(id, label, restaurant_id)
         )`
      )
      .eq("table_sessions.tables.restaurant_id", manager.restaurantId)
      .order("created_at", { ascending: false });

    if (startDate) {
      billsQuery = billsQuery.gte("created_at", startDate.toISOString());
    }

    const { data: bills, error: billsErr } = await billsQuery;

    if (billsErr) {
      console.error("[GET /api/admin/reports] Bills error:", billsErr);
      return apiError("Failed to fetch billing reports.", 500);
    }

    // Query order items for item popularity and category breakdown
    let itemsQuery = supabaseAdmin
      .from("order_items")
      .select(
        `id, name_snapshot, price_snapshot, quantity, status,
         orders!inner(
           id, status, created_at,
           table_sessions!inner(
             tables!inner(restaurant_id)
           )
         ),
         menu_items(category)`
      )
      .eq("orders.table_sessions.tables.restaurant_id", manager.restaurantId)
      .neq("status", "cancelled");

    if (startDate) {
      itemsQuery = itemsQuery.gte("orders.created_at", startDate.toISOString());
    }

    const { data: orderItems, error: itemsErr } = await itemsQuery;
    if (itemsErr) {
      console.error("[GET /api/admin/reports] Order items error:", itemsErr);
    }

    // Query cancelled orders for waste/cancellation tracking
    let cancelledOrdersQuery = supabaseAdmin
      .from("orders")
      .select(
        `id,
         table_sessions!inner(
           tables!inner(restaurant_id)
         )`
      )
      .eq("table_sessions.tables.restaurant_id", manager.restaurantId)
      .eq("status", "cancelled");

    if (startDate) {
      cancelledOrdersQuery = cancelledOrdersQuery.gte("created_at", startDate.toISOString());
    }

    const { data: cancelledOrders } = await cancelledOrdersQuery;

    // Aggregations
    let totalSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalService = 0;

    const paymentBreakdown: Record<PaymentMethod, number> = {
      cash: 0,
      upi: 0,
      card: 0,
      other: 0,
    };

    const tableSalesMap = new Map<string, { label: string; count: number; total: number }>();

    for (const b of bills ?? []) {
      const tot = Number(b.total);
      totalSales += tot;
      totalTax += Number(b.tax);
      totalDiscount += Number(b.discount);
      totalService += Number(b.service_charge);

      const pm = b.payment_method as PaymentMethod;
      if (pm in paymentBreakdown) {
        paymentBreakdown[pm] += tot;
      }

      const tObj = (b.table_sessions as unknown as { tables: { label: string } })?.tables;
      const tLabel = tObj?.label || "Unknown";
      const existing = tableSalesMap.get(tLabel) || { label: tLabel, count: 0, total: 0 };
      existing.count += 1;
      existing.total = roundMoney(existing.total + tot);
      tableSalesMap.set(tLabel, existing);
    }

    // Popular dishes map
    const dishMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    const categoryMap = new Map<string, { category: string; quantity: number; revenue: number }>();

    for (const it of orderItems ?? []) {
      const name = it.name_snapshot;
      const qty = Number(it.quantity) || 0;
      const rev = roundMoney(qty * Number(it.price_snapshot));

      const d = dishMap.get(name) || { name, quantity: 0, revenue: 0 };
      d.quantity += qty;
      d.revenue = roundMoney(d.revenue + rev);
      dishMap.set(name, d);

      const catObj = it.menu_items as unknown as { category: string } | null;
      const cat = catObj?.category || "Other";
      const c = categoryMap.get(cat) || { category: cat, quantity: 0, revenue: 0 };
      c.quantity += qty;
      c.revenue = roundMoney(c.revenue + rev);
      categoryMap.set(cat, c);
    }

    const popularItems = Array.from(dishMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const categorySales = Array.from(categoryMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    const tableUtilization = Array.from(tableSalesMap.values()).sort(
      (a, b) => b.total - a.total
    );

    const billsCount = (bills ?? []).length;
    const averageBillValue = billsCount > 0 ? roundMoney(totalSales / billsCount) : 0;

    // If CSV export requested
    if (format === "csv") {
      let csv = "Bill Number,Date,Table,Payment Method,Subtotal,Discount,Tax,Total\n";
      for (const b of bills ?? []) {
        const tObj = (b.table_sessions as unknown as { tables: { label: string } })?.tables;
        csv += `${b.bill_number},"${new Date(b.created_at).toISOString()}","${tObj?.label || ""}",${b.payment_method},${b.subtotal},${b.discount},${b.tax},${b.total}\n`;
      }

      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="green_embassy_sales_${range}.csv"`,
        },
      });
    }

    return apiSuccess({
      range,
      summary: {
        totalSales: roundMoney(totalSales),
        billsCount,
        averageBillValue,
        totalTax: roundMoney(totalTax),
        totalDiscount: roundMoney(totalDiscount),
        totalService: roundMoney(totalService),
        cancelledOrdersCount: (cancelledOrders ?? []).length,
      },
      paymentBreakdown: {
        cash: roundMoney(paymentBreakdown.cash),
        upi: roundMoney(paymentBreakdown.upi),
        card: roundMoney(paymentBreakdown.card),
        other: roundMoney(paymentBreakdown.other),
      },
      popularItems,
      categorySales,
      tableUtilization,
      recentBills: (bills ?? []).slice(0, 50).map((b) => ({
        id: b.id,
        billNumber: b.bill_number,
        total: Number(b.total),
        discount: Number(b.discount),
        tax: Number(b.tax),
        paymentMethod: b.payment_method,
        tableLabel: (b.table_sessions as unknown as { tables: { label: string } })?.tables?.label ?? "T",
        createdAt: b.created_at,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/reports] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
