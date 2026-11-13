import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const { token, items } = await req.json();
  if (!token || !Array.isArray(items) || items.length === 0)
    return fail("Invalid order", 400);

  const { data: table } = await admin
    .from("tables").select("id").eq("qr_token", token).maybeSingle();
  if (!table) return fail("Unknown table", 404);

  // Find this table's open session, or open a new one
  const findSession = () =>
    admin.from("table_sessions").select("id")
      .eq("table_id", table.id).eq("status", "open").maybeSingle();

  let { data: session } = await findSession();
  if (!session) {
    const created = await admin.from("table_sessions")
      .insert({ table_id: table.id }).select("id").single();
    session = created.data ?? (await findSession()).data;
  }
  if (!session) return fail("Could not open table session", 500);

  // Prices come from the database, never from the browser
  const ids = items.map((i: { id: string }) => i.id);
  const { data: menu } = await admin
    .from("menu_items").select("id, name, price")
    .in("id", ids).eq("is_active", true);

  const rows = [];
  for (const line of items) {
    const m = menu?.find((x) => x.id === line.id);
    const qty = Number(line.quantity);
    if (!m || !Number.isInteger(qty) || qty < 1 || qty > 20)
      return fail("Invalid item", 400);
        const note =
      typeof line.note === "string" ? line.note.trim().slice(0, 150) : "";
    rows.push({
      menu_item_id: m.id,
      name_snapshot: m.name,
      price_snapshot: m.price,
      quantity: qty,
      note: note || null,
    });
  }

  const { data: order } = await admin
    .from("orders").insert({ session_id: session.id }).select("id").single();
  if (!order) return fail("Could not save order", 500);

  const { error } = await admin
    .from("order_items").insert(rows.map((r) => ({ order_id: order.id, ...r })));
  if (error) return fail("Could not save items", 500);

  return NextResponse.json({ orderId: order.id });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return fail("Missing table", 400);

  const { data: table } = await admin
    .from("tables")
    .select("id, label, restaurants(name)")
    .eq("qr_token", token)
    .maybeSingle();
  if (!table) return fail("Unknown table", 404);

  const { data: session } = await admin
    .from("table_sessions")
    .select("id")
    .eq("table_id", table.id)
    .eq("status", "open")
    .maybeSingle();

  let orders: unknown[] = [];
  if (session) {
    const { data } = await admin
      .from("orders")
      .select("id, status, created_at, order_items(name_snapshot, quantity)")
      .eq("session_id", session.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    orders = data ?? [];
  }

  const restaurant = table.restaurants as unknown as { name: string } | null;
  return NextResponse.json({
    table: table.label,
    restaurant: restaurant?.name ?? "",
    orders,
  });
}