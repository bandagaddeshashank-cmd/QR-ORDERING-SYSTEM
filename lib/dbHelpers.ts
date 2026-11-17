import { supabaseAdmin } from "./serverAuth";
import type { Restaurant, Table } from "./types";

export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Short in-memory cache for table token resolution (30s TTL) to prevent hammering Supabase on 4s polling
const tokenCache = new Map<
  string,
  { data: { table: Table; restaurant: Restaurant }; expiresAt: number }
>();

/**
 * Resolves a table and its parent restaurant from the QR token
 */
export async function resolveTableFromToken(token: string): Promise<{
  table: Table;
  restaurant: Restaurant;
} | null> {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim();

  // Check in-memory cache first
  const cached = tokenCache.get(cleanToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("id, restaurant_id, label, qr_token, restaurants(*)")
    .eq("qr_token", cleanToken)
    .maybeSingle();

  if (error || !data || !data.restaurants) {
    if (error) console.error("[resolveTableFromToken] DB error:", error);
    return null;
  }

  const restaurant = data.restaurants as unknown as Restaurant;
  const table: Table = {
    id: data.id,
    restaurant_id: data.restaurant_id,
    label: data.label,
    qr_token: data.qr_token,
  };

  const resolved = { table, restaurant };
  tokenCache.set(cleanToken, { data: resolved, expiresAt: Date.now() + 30000 });
  return resolved;
}

/**
 * Atomically finds an open session for a table or creates a new one
 */
export async function getOrCreateOpenSession(tableId: string): Promise<string | null> {
  // Check for existing open session
  const { data: existing, error: findError } = await supabaseAdmin
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "open")
    .maybeSingle();

  if (existing?.id) return existing.id;
  if (findError) {
    console.error("[getOrCreateOpenSession] Find error:", findError);
  }

  // Attempt to open new session
  const { data: created, error: insertError } = await supabaseAdmin
    .from("table_sessions")
    .insert({ table_id: tableId, status: "open" })
    .select("id")
    .single();

  if (created?.id) return created.id;

  // If insert had a collision with a concurrent request, re-query
  const { data: retry } = await supabaseAdmin
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "open")
    .maybeSingle();

  if (retry?.id) return retry.id;

  console.error("[getOrCreateOpenSession] Failed to create session:", insertError);
  return null;
}

export type ValidatedOrderItem = {
  menu_item_id: string;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  note: string | null;
};

/**
 * Validates order items against database prices and enforces restaurant isolation
 */
export async function validateOrderItems(
  restaurantId: string,
  rawItems: { id: string; quantity: number | string; note?: string }[]
): Promise<{ validItems: ValidatedOrderItem[] | null; error: string | null }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { validItems: null, error: "Please select at least one item." };
  }

  if (rawItems.length > 50) {
    return { validItems: null, error: "Order exceeds maximum limit of 50 item types." };
  }

  const ids = rawItems.map((i) => i.id).filter(Boolean);
  if (ids.length !== rawItems.length) {
    return { validItems: null, error: "Invalid item reference in order." };
  }

  // Fetch active menu items strictly scoped to THIS restaurant
  const { data: menuItems, error } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, price, is_active, restaurant_id")
    .in("id", ids)
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true);

  if (error || !menuItems) {
    console.error("[validateOrderItems] Query error:", error);
    return { validItems: null, error: "Unable to verify menu items." };
  }

  const menuMap = new Map(menuItems.map((m) => [m.id, m]));
  const rows: ValidatedOrderItem[] = [];

  for (const item of rawItems) {
    const menuItem = menuMap.get(item.id);
    if (!menuItem) {
      return {
        validItems: null,
        error: "One or more selected dishes are no longer available on this menu.",
      };
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return {
        validItems: null,
        error: `Invalid quantity for ${menuItem.name}. Must be between 1 and 20.`,
      };
    }

    const note =
      typeof item.note === "string" ? item.note.trim().slice(0, 150) : "";

    rows.push({
      menu_item_id: menuItem.id,
      name_snapshot: menuItem.name,
      price_snapshot: Number(menuItem.price),
      quantity: qty,
      note: note || null,
    });
  }

  return { validItems: rows, error: null };
}
