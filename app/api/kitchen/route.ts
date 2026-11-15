import { createClient } from "@supabase/supabase-js";
import { NextResponse, connection } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Windowed = {
  tables: { restaurants: { cancel_window_seconds: number } | null } | null;
} | null;

// Seconds left in the customer's change window (only while the order is New)
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

export async function GET() {
  await connection();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, status, created_at, edited_at, order_items(name_snapshot, quantity, note), table_sessions(tables(label, restaurants(cancel_window_seconds)))"
    )
    .in("status", ["placed", "accepted", "preparing", "ready"])
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = (data ?? []).map((o) => {
    const session = o.table_sessions as unknown as Windowed;
    const windowSec = session?.tables?.restaurants?.cancel_window_seconds ?? 120;
    return { ...o, lock_seconds_left: lockSeconds(o, windowSec) };
  });
  return NextResponse.json(orders);
}

export async function PATCH(req: Request) {
  const { orderId, status } = await req.json();
  if (!["preparing", "ready", "served", "cancelled"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const { data: order } = await admin
    .from("orders")
    .select(
      "status, created_at, table_sessions(tables(restaurants(cancel_window_seconds)))"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // The customer's change window locks the order: the kitchen can't touch it yet
  const session = order.table_sessions as unknown as Windowed;
  const windowSec = session?.tables?.restaurants?.cancel_window_seconds ?? 120;
  const left = lockSeconds(order, windowSec);
  if (left > 0)
    return NextResponse.json(
      {
        error: `The customer can still change this order for ${left} more seconds.`,
      },
      { status: 409 }
    );

  const { error } = await admin
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .neq("status", "cancelled");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}