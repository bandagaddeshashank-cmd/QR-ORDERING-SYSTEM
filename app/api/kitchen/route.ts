import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, status, created_at, order_items(name_snapshot, quantity, note), table_sessions(tables(label))"
    )
    .in("status", ["placed", "accepted", "preparing", "ready"])
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { orderId, status } = await req.json();
  if (!["preparing", "ready", "served", "cancelled"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const { error } = await admin.from("orders").update({ status }).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}