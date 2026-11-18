"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import CallWaiter from "./callwaiter";
import { ChangeButton, OrderEditor, type EditableOrder } from "./OrderChanger";
import {
  SearchIcon,
  CloseIcon,
  PlusIcon,
  MinusIcon,
  ArrowRightIcon,
  ShoppingBagIcon,
  SparklesIcon,
  FlameIcon,
  UtensilsIcon,
  CheckCircleIcon,
} from "@/components/ui/icons";
import { DietaryBadge } from "@/components/ui/Badge";
import { MenuCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  is_veg: boolean;
  image_url?: string | null;
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

// Deterministic dish highlighting based on culinary name/description
function getDishHighlight(item: Item, index: number) {
  const text = `${item.name} ${item.description ?? ""}`.toLowerCase();
  if (
    text.includes("signature") ||
    text.includes("chef") ||
    text.includes("truffle") ||
    text.includes("saffron") ||
    text.includes("special")
  ) {
    return {
      label: "Chef's Special",
      Icon: SparklesIcon,
      badgeStyle: "bg-[#E8B95B]/20 text-[#173F35] border border-[#E8B95B]/50 font-bold",
    };
  }
  if (
    text.includes("bestseller") ||
    text.includes("biryani") ||
    text.includes("butter masala") ||
    text.includes("tikka") ||
    index === 0
  ) {
    return {
      label: "Bestseller",
      Icon: FlameIcon,
      badgeStyle: "bg-amber-100 text-amber-900 border border-amber-300 font-bold",
    };
  }
  if (text.includes("popular") || text.includes("crisp") || text.includes("paneer")) {
    return {
      label: "Popular",
      badgeStyle: "bg-[#173F35]/10 text-[#173F35] border border-[#173F35]/20 font-semibold",
    };
  }
  return null;
}

// Elegant culinary placeholder for dishes without dedicated uploaded photography
function DishImagePlaceholder({ category }: { category: string }) {
  const lower = (category || "").toLowerCase();
  const isStarter = lower.includes("starter") || lower.includes("appetizer") || lower.includes("snack") || lower.includes("tandoor");
  const isDessert = lower.includes("dessert") || lower.includes("sweet") || lower.includes("ice");
  const isBeverage = lower.includes("drink") || lower.includes("beverage") || lower.includes("juice") || lower.includes("mocktail");

  return (
    <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#173F35] via-[#12332b] to-[#0c211b] p-2 text-center text-[#E8B95B] shadow-inner border border-[#E8B95B]/30 group-hover:scale-102 transition-transform">
      <div className="absolute inset-0 bg-[radial-gradient(#E8B95B_1px,transparent_1px)] [background-size:8px_8px] opacity-20" />
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 mb-1 backdrop-blur-xs">
        {isStarter && <FlameIcon className="w-4 h-4 text-[#E8B95B]" />}
        {isDessert && <SparklesIcon className="w-4 h-4 text-[#E8B95B]" />}
        {isBeverage && <SparklesIcon className="w-4 h-4 text-cyan-300" />}
        {!isStarter && !isDessert && !isBeverage && <UtensilsIcon className="w-4 h-4 text-[#E8B95B]" />}
      </div>
      <span className="relative z-10 text-[9px] font-serif uppercase tracking-wider text-[#FAF7F0]/90 line-clamp-1 font-bold">
        {category}
      </span>
      <span className="relative z-10 text-[7px] font-sans font-semibold text-[#E8B95B]/80 tracking-widest uppercase">
        Green Embassy
      </span>
    </div>
  );
}

// Fallback-protected Dish Image to prevent broken images and browser console errors
function DishCardImage({
  imageUrl,
  name,
  category,
}: {
  imageUrl?: string | null;
  name: string;
  category: string;
}) {
  const [loadError, setLoadError] = useState(false);

  if (!imageUrl || loadError) {
    return <DishImagePlaceholder category={category} />;
  }

  return (
    <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-2xl border border-[#173F35]/10 shadow-xs">
      <Image
        src={imageUrl}
        alt={name}
        fill
        className="object-cover"
        unoptimized
        onError={() => setLoadError(true)}
      />
    </div>
  );
}

// Order timeline steps mapping
const ORDER_TIMELINE_STEPS = [
  { step: 1, label: "Received", desc: "Sent to Kitchen" },
  { step: 2, label: "Preparing", desc: "Chef on line" },
  { step: 3, label: "Ready", desc: "Plated for runner" },
  { step: 4, label: "Served", desc: "Delivered to table" },
];

function getOrderStepNumber(status: string): number {
  switch (status) {
    case "placed":
    case "accepted":
      return 1;
    case "preparing":
      return 2;
    case "ready":
      return 3;
    case "served":
      return 4;
    default:
      return 1;
  }
}

function TableLoadingScreen() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FAF7F0] p-4 text-[#242B2A]">
      <div className="rounded-3xl bg-[#173F35] p-6 text-center text-[#FAF7F0] shadow-luxury mb-4 animate-pulse">
        <Image
          src="/logo.png"
          alt="Green Embassy Logo"
          width={90}
          height={54}
          className="mx-auto mb-3 h-12 w-auto object-contain opacity-80"
          priority
        />
        <p className="font-serif font-bold text-base text-[#E8B95B]">
          Connecting to Table...
        </p>
      </div>

      <div className="space-y-4">
        <MenuCardSkeleton />
        <MenuCardSkeleton />
        <MenuCardSkeleton />
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
  const [vegOnly, setVegOnly] = useState(false);
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
      if (vegOnly && !item.is_veg) {
        continue;
      }
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
  }, [items, q, vegOnly]);

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

  // Polling using sequential timeout: runs 4s AFTER previous fetch finishes
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
      showNotice(true, "Order confirmed! Our kitchen has begun preparation.");
      refreshTable();
    } catch {
      showNotice(false, "Network error placing order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  // SSR and initial client hydration view
  if (!mounted) {
    return <TableLoadingScreen />;
  }

  // Client view: Missing QR token
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F0] p-6 text-center text-[#242B2A]">
        <div className="rounded-3xl bg-white p-8 shadow-luxury-lg border border-[#173F35]/10 max-w-sm">
          <Image
            src="/logo.png"
            alt="Green Embassy Logo"
            width={120}
            height={80}
            className="mx-auto mb-4 h-16 w-auto object-contain"
            priority
          />
          <h1 className="text-xl font-bold font-serif text-[#173F35] mb-2">
            Welcome to Green Embassy
          </h1>
          <p className="text-sm text-[#242B2A]/70 leading-relaxed font-sans mb-6">
            Please scan the QR code located on your dining table stand with your smartphone camera to view our bespoke menu and order.
          </p>
          <div className="rounded-2xl bg-[#FAF7F0] p-4 border border-[#173F35]/10 text-xs text-[#173F35] font-semibold">
            Need help? Ask our host for assistance.
          </div>
        </div>
      </div>
    );
  }

  // Client view: Invalid QR token
  if (invalid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F0] p-6 text-center text-[#242B2A]">
        <div className="rounded-3xl bg-white p-8 shadow-luxury-lg border border-rose-200 max-w-sm">
          <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto mb-4 text-xl font-bold border border-rose-200">
            !
          </div>
          <h1 className="text-lg font-bold font-serif text-rose-900 mb-2">
            Invalid Table Code
          </h1>
          <p className="text-sm text-[#242B2A]/70 leading-relaxed font-sans">
            This dining table QR token could not be verified or has expired. Please ask our restaurant staff for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FAF7F0] text-[#242B2A] pb-36 selection:bg-[#E8B95B] selection:text-[#173F35]">
      {/* 1. RESTAURANT HERO BANNER */}
      <div className="bg-[#173F35] text-[#FAF7F0] px-4 pt-4 pb-5 rounded-b-3xl shadow-luxury-lg relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-radial from-[#E8B95B]/20 to-transparent blur-2xl" />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-1 backdrop-blur-xs">
              <Image
                src="/logo.png"
                alt="Green Embassy Logo"
                width={70}
                height={44}
                className="h-10 w-auto rounded object-contain"
                priority
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E8B95B] block">
                Haute Cuisine &bull; Dine In
              </span>
              <h1 className="text-lg font-serif font-bold text-white leading-tight">
                {data?.restaurant?.name || "Green Embassy"}
              </h1>
            </div>
          </div>

          <div>
            <CallWaiter token={token} initialCalled={data?.waiterCalled} />
          </div>
        </div>

        {/* Table Number & Status Pill Banner */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 relative z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 items-center justify-center rounded-lg bg-[#E8B95B] px-3 font-serif font-bold text-xs text-[#173F35] shadow-luxury">
              {data ? `Table ${data.table}` : "Table Order"}
            </span>
            <span className="text-xs text-white/75 font-medium">
              Digital Service Active
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#E8B95B]">
            <span className="h-2 w-2 rounded-full bg-[#E8B95B] animate-pulse" />
            <span>Live Kitchen Sync</span>
          </div>
        </div>
      </div>

      {/* Global Alert Notification */}
      {notice && (
        <div
          role="alert"
          className={`mx-4 mt-3 rounded-2xl px-4 py-3 text-xs font-semibold flex items-center justify-between shadow-luxury transition-all ${
            notice.ok
              ? "bg-emerald-800 text-white"
              : "bg-rose-800 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.ok ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-300" />
            ) : (
              <span className="font-bold">!</span>
            )}
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
            aria-label="Dismiss notification"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. ORDER CONFIRMATION & ORDER TRACKING TIMELINE */}
      {activeOrders.length > 0 && (
        <section className="mx-4 mt-4 rounded-3xl bg-white p-4 sm:p-5 border border-[#173F35]/15 shadow-luxury">
          <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#173F35]">
                Active Orders ({activeOrders.length})
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-[#173F35]/70">
              Live Progress
            </span>
          </div>

          <div className="space-y-4">
            {activeOrders.map((ord) => {
              const currentStep = getOrderStepNumber(ord.status);
              const itemsSummary = ord.order_items
                .map((i) => `${i.quantity}× ${i.name_snapshot}`)
                .join(", ");

              return (
                <div
                  key={ord.id}
                  className="rounded-2xl bg-[#FAF7F0] p-3.5 border border-[#173F35]/10 text-xs"
                >
                  {/* Order Header & Edit Button */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-[11px] font-bold text-[#173F35]">
                      Order #{ord.id.slice(0, 6).toUpperCase()}
                    </span>
                    {ord.status === "placed" && (
                      <ChangeButton
                        order={ord}
                        fetchedAt={fetchedAt}
                        onOpen={() => setEditingId(ord.id)}
                      />
                    )}
                  </div>

                  {/* 4-Step Interactive Visual Timeline */}
                  <div className="relative my-3 px-1">
                    <div className="grid grid-cols-4 gap-1">
                      {ORDER_TIMELINE_STEPS.map((s) => {
                        const isDone = currentStep >= s.step;
                        const isCurrent = currentStep === s.step;

                        return (
                          <div key={s.step} className="flex flex-col items-center text-center">
                            {/* Dot / Indicator */}
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                                isCurrent
                                  ? "bg-[#173F35] text-[#E8B95B] ring-4 ring-[#E8B95B]/30"
                                  : isDone
                                  ? "bg-[#173F35] text-[#FAF7F0]"
                                  : "bg-stone-200 text-stone-500"
                              }`}
                            >
                              {isDone ? s.step : s.step}
                            </div>
                            {/* Label */}
                            <span
                              className={`mt-1.5 text-[10px] leading-tight font-semibold ${
                                isCurrent
                                  ? "text-[#173F35] font-bold"
                                  : isDone
                                  ? "text-[#173F35]"
                                  : "text-stone-400"
                              }`}
                            >
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Order Items Description */}
                  <p
                    className="mt-2 text-xs font-semibold text-[#242B2A] truncate"
                    title={itemsSummary}
                  >
                    {itemsSummary}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. STICKY MODERN SEARCH BAR & VEG FILTER */}
      <div className="sticky top-0 z-30 bg-[#FAF7F0]/95 backdrop-blur-md pt-3 pb-2 border-b border-[#173F35]/10">
        <div className="px-4">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes, drinks, desserts..."
                aria-label="Search dishes"
                className="h-11 w-full rounded-full border border-[#173F35]/15 bg-white pl-10 pr-9 text-xs sm:text-sm text-[#242B2A] placeholder:text-[#242B2A]/40 focus:border-[#173F35] focus:ring-1 focus:ring-[#173F35] focus:outline-none transition-all shadow-luxury"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#242B2A]/40">
                <SearchIcon className="w-4 h-4" />
              </span>
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search query"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#173F35]/10 text-xs font-bold text-[#173F35] hover:bg-[#173F35]/20 cursor-pointer"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Veg Only Toggle Switch */}
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-all shadow-luxury cursor-pointer ${
                vegOnly
                  ? "bg-emerald-800 text-white"
                  : "bg-white text-[#242B2A] border border-[#173F35]/15 hover:bg-stone-50"
              }`}
              title="Filter vegetarian dishes only"
            >
              <DietaryBadge isVeg={true} />
              <span className="text-[11px] font-semibold">Veg Only</span>
            </button>
          </div>

          {/* 4. BEAUTIFUL HORIZONTAL SCROLLING CATEGORY NAVIGATION */}
          {!q && categories.length > 0 && (
            <nav
              ref={chipsRef}
              className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {categories.map(([cat, list], idx) => {
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
                    className={`shrink-0 rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#173F35] text-[#E8B95B] border border-[#E8B95B]/50 font-bold shadow-luxury scale-[1.02]"
                        : "bg-white text-[#242B2A]/80 border border-[#173F35]/10 hover:bg-[#FAF7F0] hover:border-[#173F35]/25"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="ml-1.5 opacity-60 text-[10px]">({list.length})</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      {/* Served Dishes Accordion Summary */}
      {servedOrders.length > 0 && !q && (
        <section className="mx-4 mt-3 rounded-2xl bg-stone-100/80 p-3 border border-stone-200 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-stone-700 mb-1">
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-700" />
            <span>Delivered &amp; Served Items</span>
          </div>
          <p className="text-stone-600 leading-relaxed text-[11px]">
            {servedOrders
              .flatMap((o) => o.order_items)
              .map((i) => `${i.quantity}× ${i.name_snapshot}`)
              .join(", ")}
          </p>
        </section>
      )}

      {/* 5. MAIN MENU SECTIONS & FOOD MENU CARDS */}
      <main className="px-4 mt-2">
        {loading && (
          <div className="space-y-4 py-4 animate-fade-in">
            <MenuCardSkeleton />
            <MenuCardSkeleton />
            <MenuCardSkeleton />
          </div>
        )}

        {!loading && categories.length === 0 && (
          <div className="py-6">
            <EmptyState
              icon={UtensilsIcon}
              title={q ? "No Matching Dishes Found" : vegOnly ? "No Vegetarian Dishes" : "Catalog Empty"}
              description={
                q
                  ? `We could not find any menu items matching "${query}". Try searching for another item or browsing by category.`
                  : vegOnly
                  ? "There are currently no vegetarian items listed under this section. Try toggling 'Veg Only' off."
                  : "Our bespoke culinary menu is being curated by the kitchen team. Please check back shortly."
              }
              actionLabel={q ? "Clear Search" : vegOnly ? "Show All Dishes" : undefined}
              onAction={
                q ? () => setQuery("") : vegOnly ? () => setVegOnly(false) : undefined
              }
            />
          </div>
        )}

        {categories.map(([cat, list], idx) => (
          <section
            key={cat}
            id={`cat-${idx}`}
            className="pt-6"
            style={{ scrollMarginTop: "140px" }}
          >
            {/* Category Section Header */}
            <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-2 mb-3.5">
              <h2 className="text-base font-serif font-bold text-[#173F35]">{cat}</h2>
              <span className="text-xs text-[#242B2A]/50 font-medium">
                {list.length} {list.length === 1 ? "dish" : "dishes"}
              </span>
            </div>

            {/* Menu Cards List */}
            <ul className="space-y-3.5">
              {list.map((item, itemIdx) => {
                const qty = cart[item.id] ?? 0;
                const highlight = getDishHighlight(item, itemIdx);

                return (
                  <li
                    key={item.id}
                    id={`item-${item.id}`}
                    className="rounded-3xl bg-white p-4 border border-[#173F35]/10 shadow-luxury hover:border-[#173F35]/25 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Dish Information */}
                      <div className="min-w-0 flex-1">
                        {/* Dietary Badge & Special Labels */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <DietaryBadge isVeg={item.is_veg} />
                          {highlight && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${highlight.badgeStyle}`}
                            >
                              {highlight.Icon && <highlight.Icon className="w-3 h-3" />}
                              <span>{highlight.label}</span>
                            </span>
                          )}
                        </div>

                        {/* Dish Name */}
                        <h3 className="font-serif font-bold text-base leading-snug text-[#173F35]">
                          {item.name}
                        </h3>

                        {/* Dish Description */}
                        {item.description && (
                          <p className="mt-1 text-xs text-[#242B2A]/70 line-clamp-2 leading-relaxed font-sans">
                            {item.description}
                          </p>
                        )}

                        {/* Price */}
                        <p className="mt-2 text-base font-serif font-bold tabular-nums text-[#173F35]">
                          ₹{item.price}
                        </p>
                      </div>

                      {/* Right: Food Image Area + Stepper Controls */}
                      <div className="flex flex-col items-center shrink-0">
                        <DishCardImage
                          imageUrl={item.image_url}
                          name={item.name}
                          category={item.category}
                        />

                        {/* 6. QUANTITY INCREMENT / DECREMENT CONTROLS */}
                        <div className="-mt-4 relative z-10">
                          {qty === 0 ? (
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              className="h-8 w-20 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer border border-[#E8B95B]/40"
                            >
                              <PlusIcon className="w-3 h-3" />
                              <span>ADD</span>
                            </button>
                          ) : (
                            <div className="flex h-8 w-22 items-center justify-between rounded-xl bg-[#173F35] px-1 text-white shadow-luxury border border-[#E8B95B]/40">
                              <button
                                aria-label={`Reduce ${item.name}`}
                                onClick={() => changeQty(item.id, -1)}
                                className="flex h-7 w-6 items-center justify-center text-[#E8B95B] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <MinusIcon className="w-3 h-3" />
                              </button>
                              <span className="font-bold tabular-nums text-xs">
                                {qty}
                              </span>
                              <button
                                aria-label={`Add another ${item.name}`}
                                onClick={() => changeQty(item.id, 1)}
                                className="flex h-7 w-6 items-center justify-center text-[#E8B95B] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <PlusIcon className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preparation note input when selected */}
                    {qty > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#173F35]/10">
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
                          placeholder="Special instructions for chef (e.g. less spicy, no onion)"
                          aria-label={`Note for ${item.name}`}
                          className="h-8 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3 text-xs text-[#242B2A] placeholder:text-[#242B2A]/40 focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
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

      {/* 7 & 8. PREMIUM FLOATING CART BUTTON & SLIDE-UP REVIEW PANEL */}
      {totalCartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3">
          {/* Slide-up Cart Review Panel */}
          {reviewing && (
            <div className="mb-2 max-h-[60vh] overflow-y-auto rounded-3xl border border-[#173F35]/20 bg-white p-5 shadow-luxury-lg">
              {/* Drag handle pill */}
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300" />

              <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBagIcon className="w-4 h-4 text-[#173F35]" />
                  <h3 className="font-serif font-bold text-sm text-[#173F35]">
                    Order Cart ({totalCartCount} items)
                  </h3>
                </div>
                <button
                  onClick={() => setReviewing(false)}
                  className="flex items-center gap-1 text-xs text-[#242B2A]/60 hover:text-[#242B2A] cursor-pointer"
                >
                  <span>Close</span>
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <ul className="divide-y divide-[#173F35]/10">
                {cartLines.map((i) => (
                  <li key={i.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <DietaryBadge isVeg={i.is_veg} />
                          <p className="font-semibold text-[#242B2A]">{i.name}</p>
                        </div>
                        {(notes[i.id] ?? "").trim() && (
                          <p className="text-[11px] text-[#173F35] italic mt-0.5">
                            Note: {notes[i.id].trim()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => changeQty(i.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-[#173F35]/20 font-bold hover:bg-stone-50 cursor-pointer"
                        >
                          <MinusIcon className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold tabular-nums">
                          {cart[i.id]}
                        </span>
                        <button
                          onClick={() => changeQty(i.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-[#173F35]/20 font-bold hover:bg-stone-50 cursor-pointer"
                        >
                          <PlusIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="w-14 text-right font-bold tabular-nums text-[#173F35]">
                        ₹{cart[i.id] * i.price}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Price Calculation Summary */}
              <div className="mt-3 pt-3 border-t border-[#173F35]/10 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[#242B2A]/70 font-medium">
                  <span>Subtotal</span>
                  <span className="font-bold tabular-nums text-[#173F35]">
                    ₹{cartSubtotal}
                  </span>
                </div>
                {data?.restaurant?.tax_percent ? (
                  <div className="flex items-center justify-between text-[#242B2A]/70 text-[11px]">
                    <span>Taxes &amp; GST ({data.restaurant.tax_percent}%)</span>
                    <span className="tabular-nums">
                      ₹{Math.round((cartSubtotal * data.restaurant.tax_percent) / 100)}
                    </span>
                  </div>
                ) : null}
                <div className="pt-2 border-t border-dashed border-[#173F35]/20 flex items-center justify-between text-sm font-bold text-[#173F35]">
                  <span>Total Amount</span>
                  <span className="tabular-nums text-base">
                    ₹{cartSubtotal + (data?.restaurant?.tax_percent ? Math.round((cartSubtotal * data.restaurant.tax_percent) / 100) : 0)}
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-98 disabled:opacity-50 transition-all cursor-pointer border border-[#E8B95B]/40"
                  >
                    {placing ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                        <span>Transmitting Order to Kitchen...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm &amp; Send to Kitchen</span>
                        <ArrowRightIcon className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center text-[10px] text-[#242B2A]/50">
                    Dishes are sent directly to the kitchen line with real-time tracking
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Floating Action Bar */}
          <div className="flex items-center justify-between rounded-3xl bg-[#173F35] px-4 py-3 text-white shadow-luxury-lg border border-[#E8B95B]/30">
            <button
              onClick={() => setReviewing(!reviewing)}
              className="text-left cursor-pointer flex items-center gap-3"
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <ShoppingBagIcon className="w-5 h-5 text-[#E8B95B]" />
                </div>
                <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E8B95B] text-[10px] font-bold text-[#173F35]">
                  {totalCartCount}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-white/75 font-medium">
                  {reviewing ? "Hide Cart Details" : "Review Cart"}
                </p>
                <p className="text-base font-serif font-bold tabular-nums text-[#E8B95B]">
                  ₹{cartSubtotal}
                </p>
              </div>
            </button>

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#E8B95B] px-5 py-2.5 font-bold text-sm text-[#173F35] shadow-gold hover:bg-[#d8a84b] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {placing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#173F35] border-t-transparent" />
                  <span>Placing...</span>
                </>
              ) : (
                <>
                  <span>Place Order</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 10. CUSTOMER ORDER EDITOR & CANCELLATION MODAL */}
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
