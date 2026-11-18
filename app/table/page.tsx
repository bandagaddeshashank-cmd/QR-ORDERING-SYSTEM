"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import CallWaiter from "./callwaiter";
import { ChangeButton, OrderEditor, type EditableOrder } from "./OrderChanger";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  is_veg: boolean;
};

type OrderInfo = EditableOrder & {
  status: string;
  created_at: string;
};

type TableResponse = {
  table: string;
  restaurant: {
    id: string;
    name: string;
    cancel_window_seconds: number;
    tax_percent: number;
    service_charge_percent: number;
  };
  menu: Item[];
  orders: OrderInfo[];
  waiterCalled?: boolean;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; step: number }
> = {
  placed: {
    label: "Sent to Kitchen",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    step: 1,
  },
  accepted: {
    label: "Order Accepted",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    step: 1,
  },
  preparing: {
    label: "Being Prepared",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-300",
    step: 2,
  },
  ready: {
    label: "Ready & On Way",
    badgeClass: "bg-emerald-600 text-white border-emerald-700 font-bold",
    step: 3,
  },
  served: {
    label: "Served",
    badgeClass: "bg-stone-200 text-stone-700 border-stone-300",
    step: 4,
  },
};

function VegBadge({ veg }: { veg: boolean }) {
  return (
    <span
      title={veg ? "Vegetarian" : "Non-Vegetarian"}
      aria-label={veg ? "Vegetarian" : "Non-Vegetarian"}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border ${
        veg ? "border-emerald-700" : "border-rose-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          veg ? "bg-emerald-700" : "bg-rose-700"
        }`}
      />
    </span>
  );
}

function TableLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5EF] p-6 text-center text-[#252D38]">
      <div className="rounded-2xl bg-white p-8 shadow-sm border border-[#252D38]/10 max-w-sm text-center">
        <Image
          src="/logo.png"
          alt="Green Embassy Logo"
          width={90}
          height={54}
          className="mx-auto mb-4 h-14 w-auto rounded object-contain"
          priority
        />
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#193A2D] border-t-transparent mb-2" />
        <p className="text-xs font-semibold text-[#193A2D]">Loading Menu...</p>
      </div>
    </div>
  );
}

// React 19 / Next.js 16 compliant hydration hook without cascading renders
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function TableContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";

  const mounted = useIsMounted();
  const [data, setData] = useState<TableResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  // Cart & notes state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");

  const chipsRef = useRef<HTMLElement>(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dataRef = useRef<TableResponse | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const showNotice = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const loading = !data && !invalid;
  const items = useMemo(() => data?.menu ?? [], [data?.menu]);
  const q = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (
        q &&
        !`${item.name} ${item.description ?? ""}`.toLowerCase().includes(q)
      ) {
        continue;
      }
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return Array.from(map.entries());
  }, [items, q]);

  // Robust data fetcher with inFlight guard and AbortController
  const fetchTableData = useCallback(
    async (isPoll = false) => {
      if (!token || inFlightRef.current) return;
      inFlightRef.current = true;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const hasExisting = Boolean(dataRef.current);
        const url =
          isPoll && hasExisting
            ? `/api/orders?t=${encodeURIComponent(token)}&poll=1`
            : `/api/orders?t=${encodeURIComponent(token)}`;

        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (res.status === 404) {
          setInvalid(true);
          return;
        }

        if (res.ok) {
          const json = await res.json();
          setData((prev) => {
            if (isPoll && prev) {
              return {
                ...prev,
                orders: json.orders ?? prev.orders,
                table: json.table ?? prev.table,
                waiterCalled:
                  json.waiterCalled !== undefined
                    ? json.waiterCalled
                    : prev.waiterCalled,
              };
            }
            return json;
          });
          setFetchedAt(Date.now());
          setInvalid(false);
        } else {
          console.warn(`[TablePage] Server responded with HTTP ${res.status}`);
        }
      } catch (err: unknown) {
        // Silently skip if request was intentionally aborted on unmount
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.warn("Table data poll deferred (retry on next cycle):", err);
      } finally {
        inFlightRef.current = false;
      }
    },
    [token]
  );

  // Polling using sequential timeout: runs 4s AFTER previous fetch finishes (never overlaps)
  useEffect(() => {
    if (!token || !mounted) {
      return;
    }

    let active = true;
    let timerId: ReturnType<typeof setTimeout>;

    const pollLoop = async () => {
      if (!active) return;
      await fetchTableData(Boolean(dataRef.current));
      if (active) {
        timerId = setTimeout(pollLoop, 4000);
      }
    };

    pollLoop();

    return () => {
      active = false;
      clearTimeout(timerId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [token, mounted, fetchTableData]);

  // Active category: use explicit choice or fallback to first available
  const currentCategory = activeCategory || categories[0]?.[0] || "";

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, Math.min(20, (prev[id] ?? 0) + delta));
      const updated = { ...prev };
      if (next === 0) {
        delete updated[id];
      } else {
        updated[id] = next;
      }
      return updated;
    });
  };

  const cartLines = items.filter((i) => cart[i.id]);
  const totalCartCount = cartLines.reduce(
    (acc, i) => acc + (cart[i.id] ?? 0),
    0
  );
  const cartSubtotal = cartLines.reduce(
    (acc, i) => acc + (cart[i.id] ?? 0) * i.price,
    0
  );

  const activeOrders = data?.orders.filter((o) => o.status !== "served") ?? [];
  const servedOrders = data?.orders.filter((o) => o.status === "served") ?? [];
  const editingOrder =
    data?.orders.find((o) => o.id === editingId) ?? null;

  const refreshTable = useCallback(async () => {
    await fetchTableData(false);
  }, [fetchTableData]);

  const handlePlaceOrder = async () => {
    if (placing || totalCartCount === 0 || !token) return;

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

      const result = await res.json();
      if (!res.ok) {
        showNotice(
          false,
          result.error ?? "Failed to place order. Please try again."
        );
        return;
      }

      setCart({});
      setNotes({});
      setReviewing(false);
      showNotice(true, "Order placed! Kitchen has received your dishes.");
      refreshTable();
    } catch {
      showNotice(false, "Network error placing order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  // SSR and initial client hydration view (100% match)
  if (!mounted) {
    return <TableLoadingScreen />;
  }

  // Client view: Missing QR token
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5EF] p-6 text-center text-[#252D38]">
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-[#252D38]/10 max-w-sm">
          <Image
            src="/logo.png"
            alt="Restaurant Logo"
            width={120}
            height={80}
            className="mx-auto mb-4 h-16 w-auto"
            priority
          />
          <h1 className="text-xl font-bold text-[#193A2D] mb-2">Welcome</h1>
          <p className="text-sm text-[#252D38]/70 leading-relaxed">
            Please scan the QR code located on your table to view our menu and order.
          </p>
        </div>
      </div>
    );
  }

  // Client view: Invalid QR token
  if (invalid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5EF] p-6 text-center text-[#252D38]">
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-red-200 max-w-sm">
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
            !
          </div>
          <h1 className="text-lg font-bold text-red-700 mb-2">
            Invalid QR Code
          </h1>
          <p className="text-sm text-[#252D38]/70 leading-relaxed">
            This table code could not be verified. Please ask a restaurant staff member for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#F8F5EF] text-[#252D38] pb-36 selection:bg-[#E7B94F] selection:text-[#193A2D]">
      {/* Pinned Restaurant Header & Search */}
      <div className="sticky top-0 z-30 bg-[#F8F5EF]/95 backdrop-blur-md border-b border-[#252D38]/10">
        <header className="flex items-center justify-between px-4 py-3 bg-[#193A2D] text-[#F8F5EF] shadow-sm">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Restaurant Logo"
              width={70}
              height={44}
              className="h-10 w-auto rounded object-contain bg-white/10 p-0.5"
              priority
            />
            <div>
              <h1 className="text-sm font-bold tracking-wide uppercase text-[#E7B94F]">
                {data?.restaurant?.name || "Green Embassy"}
              </h1>
              <p className="text-xs font-semibold text-[#F8F5EF]/80">
                {data ? `Table ${data.table}` : "Table Order"}
              </p>
            </div>
          </div>
          <div>
            <CallWaiter token={token} initialCalled={data?.waiterCalled} />
          </div>
        </header>

        {/* Global Alert Notification */}
        {notice && (
          <div
            role="alert"
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-all ${
              notice.ok
                ? "bg-emerald-700 text-white"
                : "bg-rose-700 text-white"
            }`}
          >
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              className="ml-2 font-bold text-base leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="px-4 py-2.5 bg-[#F8F5EF]">
          <div className="relative">
            <input
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes, drinks, desserts..."
              aria-label="Search dishes"
              className="h-10 w-full rounded-full border border-[#252D38]/20 bg-white pl-9 pr-9 text-sm text-[#252D38] placeholder:text-[#252D38]/50 focus:border-[#193A2D] focus:ring-1 focus:ring-[#193A2D] focus:outline-none transition-all shadow-xs"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#252D38]/40 text-xs">
              🔍
            </span>
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#252D38]/10 text-xs font-bold text-[#252D38]/70 hover:bg-[#252D38]/20"
              >
                ×
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          {!q && categories.length > 0 && (
            <nav
              ref={chipsRef}
              className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {categories.map(([cat], idx) => {
                const isSelected = currentCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      document
                        .getElementById(`cat-${idx}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-[#193A2D] text-[#E7B94F] shadow-xs"
                        : "bg-white text-[#252D38]/80 border border-[#252D38]/15 hover:bg-stone-50"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      {/* Active Orders Tracker Banner */}
      {activeOrders.length > 0 && (
        <section className="mx-4 mt-3 rounded-2xl bg-white p-3.5 border border-[#193A2D]/20 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#193A2D]">
              Active Orders ({activeOrders.length})
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <ul className="space-y-2">
            {activeOrders.map((ord) => {
              const statusCfg = STATUS_CONFIG[ord.status] ?? {
                label: ord.status,
                badgeClass: "bg-stone-200 text-stone-800",
                step: 1,
              };
              const itemsSummary = ord.order_items
                .map((i) => `${i.quantity}× ${i.name_snapshot}`)
                .join(", ");

              return (
                <li
                  key={ord.id}
                  className="rounded-xl bg-[#F8F5EF] p-2.5 border border-[#252D38]/10 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statusCfg.badgeClass}`}
                    >
                      {statusCfg.label}
                    </span>
                    {ord.status === "placed" && (
                      <ChangeButton
                        order={ord}
                        fetchedAt={fetchedAt}
                        onOpen={() => setEditingId(ord.id)}
                      />
                    )}
                  </div>
                  <p
                    className="font-medium text-[#252D38] truncate"
                    title={itemsSummary}
                  >
                    {itemsSummary}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Served Orders Summary */}
      {servedOrders.length > 0 && !q && (
        <section className="mx-4 mt-3 rounded-2xl bg-stone-100 p-3 border border-stone-200 text-xs">
          <h2 className="font-bold text-stone-600 mb-1">Served Items</h2>
          <p className="text-stone-500 leading-relaxed">
            {servedOrders
              .flatMap((o) => o.order_items)
              .map((i) => `${i.quantity}× ${i.name_snapshot}`)
              .join(", ")}
          </p>
        </section>
      )}

      {/* Main Menu Sections */}
      <main className="px-4">
        {loading && (
          <div className="py-16 text-center text-sm text-[#252D38]/60">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#193A2D] border-t-transparent mb-2" />
            <p>Loading fresh restaurant menu...</p>
          </div>
        )}

        {!loading && categories.length === 0 && (
          <div className="py-16 text-center text-sm text-[#252D38]/60">
            {q ? (
              <p>No dishes found matching &ldquo;{query}&rdquo;.</p>
            ) : (
              <p>No menu items currently available for this restaurant.</p>
            )}
          </div>
        )}

        {categories.map(([cat, list], idx) => (
          <section
            key={cat}
            id={`cat-${idx}`}
            className="pt-5"
            style={{ scrollMarginTop: "140px" }}
          >
            <div className="flex items-center justify-between border-b border-[#252D38]/10 pb-1.5 mb-3">
              <h2 className="text-base font-bold text-[#193A2D]">{cat}</h2>
              <span className="text-xs text-[#252D38]/50 font-medium">
                {list.length} {list.length === 1 ? "dish" : "dishes"}
              </span>
            </div>

            <ul className="space-y-3">
              {list.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li
                    key={item.id}
                    id={`item-${item.id}`}
                    className="rounded-2xl bg-white p-3.5 border border-[#252D38]/10 shadow-xs hover:border-[#193A2D]/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="mt-1">
                          <VegBadge veg={item.is_veg} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm leading-snug text-[#252D38]">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="mt-1 text-xs text-[#252D38]/70 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          <p className="mt-2 text-sm font-bold tabular-nums text-[#193A2D]">
                            ₹{item.price}
                          </p>
                        </div>
                      </div>

                      {/* Add Button / Stepper */}
                      <div className="shrink-0">
                        {qty === 0 ? (
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="h-9 w-20 rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] shadow-xs hover:bg-[#122b21] active:scale-95 transition-all"
                          >
                            + ADD
                          </button>
                        ) : (
                          <div className="flex h-9 w-22 items-center justify-between rounded-xl bg-[#193A2D] px-1 text-white shadow-xs">
                            <button
                              aria-label={`Reduce ${item.name}`}
                              onClick={() => changeQty(item.id, -1)}
                              className="h-8 w-7 text-base font-bold text-[#E7B94F] hover:bg-white/10 rounded-lg transition-colors"
                            >
                              −
                            </button>
                            <span className="font-bold tabular-nums text-xs">
                              {qty}
                            </span>
                            <button
                              aria-label={`Add another ${item.name}`}
                              onClick={() => changeQty(item.id, 1)}
                              className="h-8 w-7 text-base font-bold text-[#E7B94F] hover:bg-white/10 rounded-lg transition-colors"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preparation note input when selected */}
                    {qty > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-[#252D38]/5">
                        <input
                          type="text"
                          maxLength={150}
                          value={notes[item.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="Special instruction (e.g. less spicy, no onion)"
                          aria-label={`Note for ${item.name}`}
                          className="h-8 w-full rounded-lg border border-[#252D38]/15 bg-[#F8F5EF] px-2.5 text-xs text-[#252D38] placeholder:text-[#252D38]/50 focus:border-[#193A2D] focus:bg-white focus:outline-none transition-all"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3">
          {/* Slide-up Review Sheet */}
          {reviewing && (
            <div className="mb-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-[#252D38]/15 bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#252D38]/10 pb-2 mb-3">
                <h3 className="font-bold text-sm text-[#193A2D]">
                  Order Review
                </h3>
                <button
                  onClick={() => setReviewing(false)}
                  className="text-xs text-[#252D38]/60 hover:text-[#252D38]"
                >
                  Close ×
                </button>
              </div>

              <ul className="divide-y divide-[#252D38]/10">
                {cartLines.map((i) => (
                  <li key={i.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#252D38]">{i.name}</p>
                        {(notes[i.id] ?? "").trim() && (
                          <p className="text-[11px] text-[#193A2D] italic">
                            Note: {notes[i.id].trim()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => changeQty(i.id, -1)}
                          className="h-6 w-6 rounded border border-[#252D38]/20 font-bold"
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-bold tabular-nums">
                          {cart[i.id]}
                        </span>
                        <button
                          onClick={() => changeQty(i.id, 1)}
                          className="h-6 w-6 rounded border border-[#252D38]/20 font-bold"
                        >
                          +
                        </button>
                      </div>
                      <span className="w-14 text-right font-bold tabular-nums text-[#193A2D]">
                        ₹{cart[i.id] * i.price}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-2 border-t border-[#252D38]/10 flex items-center justify-between text-xs font-semibold">
                <span>Subtotal ({totalCartCount} items)</span>
                <span className="font-bold tabular-nums text-[#193A2D]">
                  ₹{cartSubtotal}
                </span>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between rounded-2xl bg-[#193A2D] px-4 py-3 text-white shadow-xl">
            <button
              onClick={() => setReviewing(!reviewing)}
              className="text-left"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 items-center justify-center rounded-full bg-[#E7B94F] px-2 text-[11px] font-bold text-[#193A2D]">
                  {totalCartCount}
                </span>
                <span className="text-xs text-white/80">
                  {reviewing ? "Hide Details" : "View Order"}
                </span>
              </div>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[#E7B94F]">
                ₹{cartSubtotal}
              </p>
            </button>

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E7B94F] px-5 py-2.5 font-bold text-sm text-[#193A2D] shadow-md hover:bg-[#d8a83e] active:scale-95 disabled:opacity-50 transition-all"
            >
              {placing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#193A2D] border-t-transparent" />
                  Placing...
                </>
              ) : (
                "Place Order →"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Customer Order Editor Modal */}
      {editingOrder && token && (
        <OrderEditor
          key={editingOrder.id}
          token={token}
          order={editingOrder}
          fetchedAt={fetchedAt}
          onClose={() => setEditingId(null)}
          onChanged={(msg) => {
            setEditingId(null);
            showNotice(true, msg);
            refreshTable();
          }}
        />
      )}
    </div>
  );
}

export default function TablePage() {
  return (
    <Suspense fallback={<TableLoadingScreen />}>
      <TableContent />
    </Suspense>
  );
}
