"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  is_veg: boolean;
};
type OrderInfo = {
  id: string;
  status: string;
  created_at: string;
  order_items: { name_snapshot: string; quantity: number }[];
};
type TableInfo = { table: string; restaurant: string; orders: OrderInfo[] };

const STATUS_TEXT: Record<string, string> = {
  placed: "Sent to kitchen",
  accepted: "Sent to kitchen",
  preparing: "Being prepared",
  ready: "Ready, on its way",
  served: "Served",
};

function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border-2 ${
        veg ? "border-green-700" : "border-red-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${veg ? "bg-green-700" : "bg-red-700"}`}
      />
    </span>
  );
}

export default function TablePage() {
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [reviewing, setReviewing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const loadInfo = useCallback(async (t: string) => {
    const res = await fetch(`/api/orders?t=${encodeURIComponent(t)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return setInvalid(true);
    if (res.ok) setInfo(await res.json());
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    setToken(t);
    if (!t) return;
    supabase
      .from("menu_items")
      .select("id, name, description, category, price, is_veg")
      .order("category")
      .order("name")
      .then(({ data }) => setItems(data ?? []));
    loadInfo(t);
    const timer = setInterval(() => loadInfo(t), 5000);
    return () => clearInterval(timer);
  }, [loadInfo]);

  const categories = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items) map.set(i.category, [...(map.get(i.category) ?? []), i]);
    return [...map.entries()];
  }, [items]);

  const change = (id: string, diff: number) =>
    setCart((c) => {
      const next = Math.max(0, Math.min(20, (c[id] ?? 0) + diff));
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const cartLines = items.filter((i) => cart[i.id]);
  const count = cartLines.reduce((s, i) => s + cart[i.id], 0);
  const total = cartLines.reduce((s, i) => s + cart[i.id] * i.price, 0);

  const placeOrder = async () => {
    if (placing || count === 0) return;
    setPlacing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          items: cartLines.map((i) => ({ id: i.id, quantity: cart[i.id] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? "Order failed. Please try again." });
        return;
      }
      setCart({});
      setReviewing(false);
      setNotice({ ok: true, text: "Order placed. The kitchen has it." });
      if (token) loadInfo(token);
    } finally {
      setPlacing(false);
    }
  };

  const wrap = "min-h-screen bg-[#F2F4F1] text-[#1C2333]";

  if (token === "")
    return (
      <div className={`${wrap} p-8 text-center text-lg`}>
        Scan the QR code on your table to see the menu.
      </div>
    );
  if (invalid)
    return (
      <div className={`${wrap} p-8 text-center text-lg`}>
        This QR code isn&apos;t valid. Please ask a staff member for help.
      </div>
    );

  return (
    <div className={`${wrap} mx-auto max-w-md pb-32`}>
      <header className="bg-[#1C2333] px-5 pb-5 pt-8 text-white">
        <p className="text-sm text-white/70">
          {info ? `Table ${info.table}` : "\u00A0"}
        </p>
        <h1 className="text-3xl font-bold leading-tight">
          {info?.restaurant || "Menu"}
        </h1>
      </header>

      {notice && (
        <p
          className={`px-5 py-3 text-sm font-medium ${
            notice.ok ? "bg-green-700 text-white" : "bg-red-700 text-white"
          }`}
        >
          {notice.text}
        </p>
      )}

      {info && info.orders.length > 0 && (
        <section className="px-5 pt-5">
          <h2 className="mb-2 text-lg font-bold">Your orders</h2>
          <ul className="divide-y divide-[#1C2333]/15 border-y border-[#1C2333]/15">
            {info.orders.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-3">
                <span className="text-sm">
                  {o.order_items
                    .map((i) => `${i.quantity} × ${i.name_snapshot}`)
                    .join(", ")}
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    o.status === "ready"
                      ? "bg-green-700 text-white"
                      : o.status === "served"
                      ? "bg-[#1C2333]/10"
                      : "bg-[#F2B01E]"
                  }`}
                >
                  {STATUS_TEXT[o.status] ?? o.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="sticky top-0 z-10 mt-4 flex gap-2 overflow-x-auto border-b border-[#1C2333]/15 bg-[#F2F4F1] px-4 py-3">
        {categories.map(([cat], idx) => (
          <button
            key={cat}
            onClick={() =>
              document
                .getElementById(`cat-${idx}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="shrink-0 rounded-full border border-[#1C2333]/30 px-4 py-1.5 text-sm font-medium"
          >
            {cat}
          </button>
        ))}
      </nav>

      <main className="px-5">
        {categories.map(([cat, list], idx) => (
          <section key={cat} id={`cat-${idx}`} className="scroll-mt-16 pt-6">
            <h2 className="mb-1 text-xl font-bold">{cat}</h2>
            <ul className="divide-y divide-[#1C2333]/15">
              {list.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li key={item.id} className="flex items-start gap-3 py-4">
                    <VegMark veg={item.is_veg} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 text-sm text-[#1C2333]/70">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1 font-medium tabular-nums">₹{item.price}</p>
                    </div>
                    {qty === 0 ? (
                      <button
                        onClick={() => change(item.id, 1)}
                        className="h-10 w-24 rounded-lg border-2 border-[#1C2333] font-bold active:bg-[#1C2333] active:text-white"
                      >
                        Add
                      </button>
                    ) : (
                      <div className="flex h-10 w-24 items-center justify-between rounded-lg bg-[#1C2333] text-white">
                        <button
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => change(item.id, -1)}
                          className="h-10 w-9 text-xl"
                        >
                          −
                        </button>
                        <span className="font-bold tabular-nums">{qty}</span>
                        <button
                          aria-label={`Add one ${item.name}`}
                          onClick={() => change(item.id, 1)}
                          className="h-10 w-9 text-xl"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {items.length === 0 && (
          <p className="py-10 text-center text-[#1C2333]/70">Loading the menu.</p>
        )}
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md">
          {reviewing && (
            <div className="max-h-[55vh] overflow-y-auto border-t border-[#1C2333]/20 bg-white px-5 py-3">
              <ul className="divide-y divide-[#1C2333]/15">
                {cartLines.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 flex-1">{i.name}</span>
                    <span className="flex items-center gap-2">
                      <button
                        aria-label={`Remove one ${i.name}`}
                        onClick={() => change(i.id, -1)}
                        className="h-8 w-8 rounded border border-[#1C2333]/40"
                      >
                        −
                      </button>
                      <span className="w-5 text-center tabular-nums">{cart[i.id]}</span>
                      <button
                        aria-label={`Add one ${i.name}`}
                        onClick={() => change(i.id, 1)}
                        className="h-8 w-8 rounded border border-[#1C2333]/40"
                      >
                        +
                      </button>
                    </span>
                    <span className="w-16 text-right tabular-nums">
                      ₹{cart[i.id] * i.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 bg-[#1C2333] px-5 py-4 text-white">
            <button onClick={() => setReviewing(!reviewing)} className="text-left">
              <span className="block text-sm text-white/70">
                {count} {count === 1 ? "item" : "items"},{" "}
                {reviewing ? "tap to hide" : "tap to review"}
              </span>
              <span className="text-xl font-bold tabular-nums text-[#F2B01E]">
                ₹{total}
              </span>
            </button>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="rounded-lg bg-[#F2B01E] px-5 py-3 font-bold text-[#1C2333] disabled:opacity-50"
            >
              {placing ? "Placing order" : "Place order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}