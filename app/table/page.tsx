"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const chip = (status: string) =>
  `shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
    status === "ready"
      ? "bg-green-700 text-white"
      : status === "served"
      ? "bg-[#1C2333]/10"
      : "bg-[#F2B01E]"
  }`;

const summary = (o: OrderInfo) =>
  o.order_items.map((i) => `${i.quantity} × ${i.name_snapshot}`).join(", ");

const needsChoice = (i: Item) => i.description?.startsWith("Choice of") ?? false;

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
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [query, setQuery] = useState("");
  const chipsRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyH, setStickyH] = useState(176);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const showNotice = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    setTimeout(() => setNotice(null), 5000);
  };

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
      .order("sort_order")
      .order("name")
      .then(({ data }) => setItems(data ?? []));
    loadInfo(t);
    const timer = setInterval(() => loadInfo(t), 5000);
    return () => clearInterval(timer);
  }, [loadInfo]);

  // Keep category scrolling accurate as the pinned area grows or shrinks
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStickyH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [invalid]);

  const q = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items) {
      if (q && !`${i.name} ${i.description ?? ""}`.toLowerCase().includes(q))
        continue;
      map.set(i.category, [...(map.get(i.category) ?? []), i]);
    }
    return [...map.entries()];
  }, [items, q]);

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

  const active = info?.orders.filter((o) => o.status !== "served") ?? [];
  const served = info?.orders.filter((o) => o.status === "served") ?? [];

  const placeOrder = async () => {
    if (placing || count === 0) return;

    const missing = cartLines.find(
      (i) => needsChoice(i) && !(notes[i.id] ?? "").trim()
    );
    if (missing) {
      setReviewing(false);
      showNotice(false, `Please write your choice for ${missing.name}`);
      document
        .getElementById(`item-${missing.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setPlacing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          items: cartLines.map((i) => ({
            id: i.id,
            quantity: cart[i.id],
            note: (notes[i.id] ?? "").trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice(false, data.error ?? "Order failed. Please try again.");
        return;
      }
      setCart({});
      setNotes({});
      setReviewing(false);
      showNotice(true, "Order placed. The kitchen has it.");
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
      <div ref={stickyRef} className="sticky top-0 z-20">
        <header className="flex items-center justify-between border-b border-[#DCB736] bg-[#FFF4C2] px-5 py-2">
          <h1 className="m-0">
            <img
              src="/logo.png"
              alt={info?.restaurant || "Restaurant logo"}
              width={98}
              height={64}
              className="h-20 w-auto"
            />
          </h1>
          <span className="ml-3 shrink-0 text-sm font-semibold text-[#14511D]">
            {info ? `Table ${info.table}` : ""}
          </span>
        </header>

        {notice && (
          <p
            className={`px-5 py-2 text-sm font-medium ${
              notice.ok ? "bg-green-700 text-white" : "bg-red-700 text-white"
            }`}
          >
            {notice.text}
          </p>
        )}

        {active.length > 0 && (
          <div className="max-h-24 overflow-y-auto border-b border-[#1C2333]/15 bg-white px-5 py-2">
            <ul className="space-y-1.5">
              {active.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate" title={summary(o)}>
                    {summary(o)}
                  </span>
                  <span className={chip(o.status)}>
                    {STATUS_TEXT[o.status] ?? o.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-b border-[#1C2333]/15 bg-[#F2F4F1] px-4 py-3">
          <div className="relative">
            <input
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes"
              aria-label="Search dishes"
              className="h-11 w-full rounded-lg border-2 border-[#1C2333]/30 bg-white pl-3 pr-10 text-base"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-xl"
              >
                ×
              </button>
            )}
          </div>

          {!q && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() =>
                  chipsRef.current?.scrollBy({ left: -240, behavior: "smooth" })
                }
                aria-label="Scroll categories left"
                className="hidden h-8 w-8 shrink-0 rounded-full border border-[#1C2333]/30 [@media(hover:hover)]:block"
              >
                ‹
              </button>
              <nav
                ref={chipsRef}
                className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
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
              <button
                onClick={() =>
                  chipsRef.current?.scrollBy({ left: 240, behavior: "smooth" })
                }
                aria-label="Scroll categories right"
                className="hidden h-8 w-8 shrink-0 rounded-full border border-[#1C2333]/30 [@media(hover:hover)]:block"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {served.length > 0 && !q && (
        <section className="px-5 pt-5">
          <h2 className="mb-2 text-lg font-bold">Served</h2>
          <ul className="divide-y divide-[#1C2333]/15 border-y border-[#1C2333]/15">
            {served.map((o) => (
              <li key={o.id} className="py-3 text-sm text-[#1C2333]/70">
                {summary(o)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <main className="px-5">
        {categories.map(([cat, list], idx) => (
          <section
            key={cat}
            id={`cat-${idx}`}
            className="pt-6"
            style={{ scrollMarginTop: stickyH + 8 }}
          >
            <h2 className="mb-1 text-xl font-bold">{cat}</h2>
            <ul className="divide-y divide-[#1C2333]/15">
              {list.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li key={item.id} id={`item-${item.id}`} className="py-4">
                    <div className="flex items-start gap-3">
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
                    </div>

                    {qty > 0 && (
                      <div className="ml-7 mt-3">
                        <input
                          type="text"
                          maxLength={150}
                          value={notes[item.id] ?? ""}
                          onChange={(e) =>
                            setNotes((n) => ({ ...n, [item.id]: e.target.value }))
                          }
                          placeholder={
                            needsChoice(item)
                              ? "Your choice, e.g. Manchurian"
                              : "Note for kitchen, e.g. less spicy"
                          }
                          aria-label={`Note for ${item.name}`}
                          className="h-10 w-full rounded-lg border-2 border-[#1C2333]/30 bg-white px-3 text-base"
                        />
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
        {items.length > 0 && q && categories.length === 0 && (
          <p className="py-10 text-center text-[#1C2333]/70">
            No dishes found for &ldquo;{query}&rdquo;.
          </p>
        )}
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md">
          {reviewing && (
            <div className="max-h-[55vh] overflow-y-auto border-t border-[#1C2333]/20 bg-white px-5 py-3">
              <ul className="divide-y divide-[#1C2333]/15">
                {cartLines.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      {i.name}
                      {(notes[i.id] ?? "").trim() && (
                        <small className="block text-[#1C2333]/70">
                          Note: {notes[i.id].trim()}
                        </small>
                      )}
                    </span>
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