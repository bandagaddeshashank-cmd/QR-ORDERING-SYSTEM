import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const round = (n: number) => Math.round(n * 100) / 100;
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

type Rest = { name: string; tax_percent: number; service_charge_percent: number };

async function buildBill(sessionId: string, discountInput: number) {
  const { data: session } = await admin
    .from("table_sessions")
    .select("id, status, tables(label, restaurants(name, tax_percent, service_charge_percent))")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const t = session.tables as unknown as { label: string; restaurants: Rest };
  const r = t.restaurants;

  const { data: orders } = await admin
    .from("orders")
    .select("status, order_items(name_snapshot, price_snapshot, quantity, status)")
    .eq("session_id", sessionId)
    .neq("status", "cancelled");

  const map = new Map<string, { name: string; price: number; qty: number }>();
  let notServed = 0;
  for (const o of orders ?? []) {
    if (o.status !== "served") notServed++;
    for (const i of o.order_items ?? []) {
      if (i.status === "cancelled") continue;
      const price = Number(i.price_snapshot);
      const key = `${i.name_snapshot}|${price}`;
      const line = map.get(key) ?? { name: i.name_snapshot, price, qty: 0 };
      line.qty += i.quantity;
      map.set(key, line);
    }
  }

  const lines = [...map.values()].map((l) => ({ ...l, total: round(l.price * l.qty) }));
  const subtotal = round(lines.reduce((s, l) => s + l.total, 0));
  const discount = round(Math.min(Math.max(discountInput || 0, 0), subtotal));
  const taxable = subtotal - discount;
  const service = round((taxable * Number(r.service_charge_percent)) / 100);
  const tax = round(((taxable + service) * Number(r.tax_percent)) / 100);
  const total = round(taxable + service + tax);

  return {
    sessionId,
    status: session.status as string,
    table: t.label,
    restaurant: r.name,
    taxPercent: Number(r.tax_percent),
    servicePercent: Number(r.service_charge_percent),
    lines, subtotal, discount, service, tax, total, notServed,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const label = url.searchParams.get("table")?.trim();
  const discount = Number(url.searchParams.get("discount") || 0);
  if (!label) return fail("Enter a table number", 400);

  const { data: tables } = await admin
    .from("tables").select("id")
    .ilike("label", label.replace(/[%_]/g, "\\$&")).limit(1);
  if (!tables?.[0]) return fail("Table not found", 404);

  const { data: sessions } = await admin
    .from("table_sessions").select("id")
    .eq("table_id", tables[0].id).eq("status", "open").limit(1);
  if (!sessions?.[0]) return fail("No open bill for this table", 404);

  const bill = await buildBill(sessions[0].id, discount);
  if (!bill) return fail("No open bill for this table", 404);
  return NextResponse.json(bill);
}

export async function POST(req: Request) {
    const { sessionId, discount, paymentMethod } = await req.json();
  if (!sessionId) return fail("Missing session", 400);
  if (!["cash", "upi", "card", "other"].includes(paymentMethod))
    return fail("Choose how the bill was paid", 400);

  const bill = await buildBill(sessionId, Number(discount) || 0);
  if (!bill) return fail("Session not found", 404);
  if (bill.status !== "open") return fail("This table is already billed", 409);
  if (bill.lines.length === 0) return fail("Nothing to bill", 400);

  const { data: saved, error } = await admin
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
    .select("bill_number")
    .single();
  if (error || !saved) return fail("Could not save the bill", 409);

  await admin
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sessionId);

    return NextResponse.json({ ...bill, billNumber: saved.bill_number, paymentMethod });
}