import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

async function tableFromToken(token: string) {
  const { data } = await admin
    .from("tables")
    .select("id")
    .eq("qr_token", token)
    .maybeSingle();
  return data;
}

// With ?t=token: is this table's call open? Without it: list all open calls.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");

  if (token) {
    const table = await tableFromToken(token);
    if (!table) return fail("Unknown table", 404);
    const { data } = await admin
      .from("waiter_calls")
      .select("id")
      .eq("table_id", table.id)
      .eq("status", "open")
      .maybeSingle();
    return NextResponse.json({ called: !!data });
  }

  const { data, error } = await admin
    .from("waiter_calls")
    .select("id, created_at, tables(label)")
    .eq("status", "open")
    .order("created_at");
  if (error) return fail(error.message, 500);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) return fail("Missing table", 400);
  const table = await tableFromToken(token);
  if (!table) return fail("Unknown table", 404);

  // The database allows one open call per table, so repeat taps are harmless
  const { error } = await admin.from("waiter_calls").insert({ table_id: table.id });
  if (error && error.code !== "23505") return fail("Could not call the waiter", 500);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { callId } = await req.json();
  if (!callId) return fail("Missing call", 400);
  const { error } = await admin
    .from("waiter_calls")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("id", callId);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}