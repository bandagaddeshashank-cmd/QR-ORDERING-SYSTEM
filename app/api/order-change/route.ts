import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

type Edit = { id: string; quantity: number; note?: string };

export async function POST(req: Request) {
  const { token, orderId, action, items } = await req.json();
  if (!token || !orderId || !["cancel", "edit"].includes(action))
    return fail("Invalid request", 400);

  // The table behind this QR code, and how long customers may change orders
  const { data: table } = await admin
    .from("tables")
    .select("id, restaurants(cancel_window_seconds)")
    .eq("qr_token", token)
    .maybeSingle();
  if (!table) return fail("Unknown table", 404);
  const windowSec =
    (table.restaurants as unknown as { cancel_window_seconds: number } | null)
      ?.cancel_window_seconds ?? 120;

  // The order must belong to this table's open session
  const { data: session } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", table.id)
    .eq("status", "open")
    .maybeSingle();
  if (!session) return fail("Order not found", 404);

  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!order) return fail("Order not found", 404);

  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();
  const tooLate = () =>
    fail("The kitchen has started this order, or the change time is over.", 409);

  if (action === "cancel") {
    const { data } = await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("status", "placed")
      .gte("created_at", cutoff)
      .select("id");
    if (!data?.length) return tooLate();
    return NextResponse.json({ ok: true, cancelled: true });
  }

  if (!Array.isArray(items) || items.length === 0)
    return fail("Nothing to change", 400);
  for (const it of items as Edit[]) {
    const q = Number(it.quantity);
    if (!it.id || !Number.isInteger(q) || q < 0 || q > 20)
      return fail("Invalid item", 400);
  }

  // Claim the order: only works while it is still New and inside the time window
  const { data: claimed } = await admin
    .from("orders")
    .update({ edited_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "placed")
    .gte("created_at", cutoff)
    .select("id");
  if (!claimed?.length) return tooLate();

  for (const it of items as Edit[]) {
    const q = Number(it.quantity);
    if (q === 0) {
      await admin
        .from("order_items")
        .delete()
        .eq("id", it.id)
        .eq("order_id", orderId);
    } else {
      const note =
        typeof it.note === "string" ? it.note.trim().slice(0, 150) : "";
      await admin
        .from("order_items")
        .update({ quantity: q, note: note || null })
        .eq("id", it.id)
        .eq("order_id", orderId);
    }
  }

  // If every dish was removed, the order is cancelled
  const { count } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if (!count) {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    return NextResponse.json({ ok: true, cancelled: true });
  }
  return NextResponse.json({ ok: true, cancelled: false });
}