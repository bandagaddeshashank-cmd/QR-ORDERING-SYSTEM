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
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
      badgeStyle: "bg-gradient-to-r from-[#E8B95B]/25 to-[#E8B95B]/10 text-[#173F35] border border-[#E8B95B]/60 font-bold shadow-xs",
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
      badgeStyle: "bg-gradient-to-r from-amber-100 to-amber-50 text-amber-900 border border-amber-300 font-bold shadow-xs",
    };
  }
  if (text.includes("popular") || text.includes("crisp") || text.includes("paneer")) {
    return {
      label: "Popular",
      Icon: UtensilsIcon,
      badgeStyle: "bg-[#173F35]/10 text-[#173F35] border border-[#173F35]/20 font-semibold shadow-xs",
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
    <div className="relative flex h-28 w-28 sm:h-32 sm:w-32 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#173F35] via-[#1B483D] to-[#0D241E] p-2.5 text-center text-[#E8B95B] shadow-inner border border-[#E8B95B]/30 group-hover:scale-102 transition-transform select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#E8B95B_1px,transparent_1px)] [background-size:8px_8px] opacity-25" />
      <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 mb-1.5 backdrop-blur-xs border border-[#E8B95B]/20 shadow-xs">
        {isStarter && <FlameIcon className="w-4.5 h-4.5 text-[#E8B95B]" />}
        {isDessert && <SparklesIcon className="w-4.5 h-4.5 text-[#E8B95B]" />}
        {isBeverage && <SparklesIcon className="w-4.5 h-4.5 text-cyan-300" />}
        {!isStarter && !isDessert && !isBeverage && <UtensilsIcon className="w-4.5 h-4.5 text-[#E8B95B]" />}
      </div>
      <span className="relative z-10 text-[10px] font-serif uppercase tracking-wider text-[#FAF7F0] line-clamp-1 font-bold">
        {category}
      </span>
      <span className="relative z-10 text-[8px] font-sans font-bold text-[#E8B95B]/85 tracking-widest uppercase mt-0.5">
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
    <div className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-2xl border border-[#173F35]/15 shadow-sm group-hover:shadow-md transition-all">
      <Image
        src={imageUrl}
        alt={name}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        unoptimized
        onError={() => setLoadError(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
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
  const activeCategoryRef = useRef<string>("");
  const isManualScrollRef = useRef(false);
  const manualScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intersectingMapRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());

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

  // Keep activeCategoryRef synchronized
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  // Category navigation scroll arrow states
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateScrollArrows = useCallback(() => {
    const nav = chipsRef.current;
    if (!nav) return;

    const scrollLeft = nav.scrollLeft;
    const clientWidth = nav.clientWidth;
    const scrollWidth = nav.scrollWidth;

    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);

    if (!overflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  // Center the active category chip in the horizontal scrolling navigation bar
  const scrollChipIntoView = useCallback(
    (cat: string) => {
      const nav = chipsRef.current;
      if (!nav) return;
      const activeIdx = categories.findIndex(([c]) => c === cat);
      if (activeIdx === -1) return;
      const chip = nav.children[activeIdx] as HTMLElement | undefined;
      if (!chip) return;
      const chipLeft = chip.offsetLeft;
      const chipWidth = chip.offsetWidth;
      const navWidth = nav.offsetWidth;
      const targetScrollLeft = Math.max(0, chipLeft - navWidth / 2 + chipWidth / 2);
      nav.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
      setTimeout(updateScrollArrows, 80);
      setTimeout(updateScrollArrows, 250);
    },
    [categories, updateScrollArrows]
  );

  const handleScrollLeft = useCallback(() => {
    const nav = chipsRef.current;
    if (!nav) return;

    const currentScroll = nav.scrollLeft;
    const clientWidth = nav.clientWidth;
    const scrollAmount = Math.max(120, Math.round(clientWidth * 0.75));
    const targetScroll = Math.max(0, currentScroll - scrollAmount);

    // Find closest preceding chip start to keep chips neatly aligned
    const chips = Array.from(nav.children) as HTMLElement[];
    let snappedTarget = targetScroll;
    for (let i = chips.length - 1; i >= 0; i--) {
      const chip = chips[i];
      if (chip.offsetLeft <= targetScroll + 30 && chip.offsetLeft >= targetScroll - 40) {
        snappedTarget = Math.max(0, chip.offsetLeft - 8);
        break;
      }
    }

    nav.scrollTo({
      left: snappedTarget,
      behavior: "smooth",
    });

    requestAnimationFrame(updateScrollArrows);
    setTimeout(updateScrollArrows, 60);
    setTimeout(updateScrollArrows, 180);
    setTimeout(updateScrollArrows, 350);
  }, [updateScrollArrows]);

  const handleScrollRight = useCallback(() => {
    const nav = chipsRef.current;
    if (!nav) return;

    const currentScroll = nav.scrollLeft;
    const clientWidth = nav.clientWidth;
    const maxScroll = Math.max(0, nav.scrollWidth - clientWidth);
    const scrollAmount = Math.max(120, Math.round(clientWidth * 0.75));
    const targetScroll = Math.min(maxScroll, currentScroll + scrollAmount);

    // Find closest upcoming chip start to keep chips neatly aligned
    const chips = Array.from(nav.children) as HTMLElement[];
    let snappedTarget = targetScroll;
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      if (chip.offsetLeft >= targetScroll - 30 && chip.offsetLeft <= targetScroll + 40) {
        snappedTarget = Math.min(maxScroll, chip.offsetLeft - 8);
        break;
      }
    }

    nav.scrollTo({
      left: snappedTarget,
      behavior: "smooth",
    });

    requestAnimationFrame(updateScrollArrows);
    setTimeout(updateScrollArrows, 60);
    setTimeout(updateScrollArrows, 180);
    setTimeout(updateScrollArrows, 350);
  }, [updateScrollArrows]);

  // Monitor category navigation scroll position to update arrow disabled states
  useEffect(() => {
    const nav = chipsRef.current;
    if (!nav || !mounted) return;

    updateScrollArrows();

    nav.addEventListener("scroll", updateScrollArrows, { passive: true });
    window.addEventListener("resize", updateScrollArrows);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateScrollArrows();
      });
      ro.observe(nav);
    }

    const timer = setTimeout(updateScrollArrows, 100);

    return () => {
      nav.removeEventListener("scroll", updateScrollArrows);
      window.removeEventListener("resize", updateScrollArrows);
      if (ro) ro.disconnect();
      clearTimeout(timer);
    };
  }, [mounted, categories, q, updateScrollArrows]);

  // Auto-scroll the horizontal category nav when active category changes
  useEffect(() => {
    if (currentCategory && mounted) {
      const timer = setTimeout(() => {
        scrollChipIntoView(currentCategory);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentCategory, categories, mounted, scrollChipIntoView]);

  // Handle manual category chip click
  const handleCategoryClick = useCallback(
    (cat: string, idx: number) => {
      isManualScrollRef.current = true;
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
      }

      setActiveCategory(cat);
      scrollChipIntoView(cat);

      const target = document.getElementById(`cat-${idx}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      manualScrollTimerRef.current = setTimeout(() => {
        isManualScrollRef.current = false;
      }, 850);
    },
    [scrollChipIntoView]
  );

  // Clear manual scroll lock on direct touch/wheel interaction
  useEffect(() => {
    const cancelManualLock = () => {
      if (isManualScrollRef.current) {
        isManualScrollRef.current = false;
        if (manualScrollTimerRef.current) {
          clearTimeout(manualScrollTimerRef.current);
        }
      }
    };
    window.addEventListener("wheel", cancelManualLock, { passive: true });
    window.addEventListener("touchmove", cancelManualLock, { passive: true });
    return () => {
      window.removeEventListener("wheel", cancelManualLock);
      window.removeEventListener("touchmove", cancelManualLock);
      if (manualScrollTimerRef.current) {
        clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, []);

  // IntersectionObserver to monitor all rendered category sections and sync navigation
  useEffect(() => {
    if (!mounted || categories.length === 0 || q) {
      return;
    }

    const intersectingMap = intersectingMapRef.current;
    intersectingMap.clear();
    const activationOffset = 150;

    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Do not override selection while smooth click-scroll animation is running
      if (isManualScrollRef.current) {
        return;
      }

      entries.forEach((entry) => {
        const cat = entry.target.getAttribute("data-category");
        if (cat) {
          if (entry.isIntersecting) {
            intersectingMapRef.current.set(cat, entry);
          } else {
            intersectingMapRef.current.delete(cat);
          }
        }
      });

      if (intersectingMapRef.current.size === 0) {
        return;
      }

      const visibleList: { category: string; index: number; top: number; bottom: number }[] = [];
      intersectingMapRef.current.forEach((entry, cat) => {
        const idxAttr = entry.target.getAttribute("data-index");
        const idx = idxAttr ? parseInt(idxAttr, 10) : 0;
        const rect = entry.boundingClientRect;
        visibleList.push({
          category: cat,
          index: idx,
          top: rect.top,
          bottom: rect.bottom,
        });
      });

      visibleList.sort((a, b) => a.index - b.index);

      // Identify category that reached or passed the activation line
      const passedActivation = visibleList.filter((s) => s.top <= activationOffset);

      let targetCat: string | null = null;
      if (passedActivation.length > 0) {
        // Lowest section on page that has crossed the line
        targetCat = passedActivation[passedActivation.length - 1].category;
      } else if (visibleList.length > 0) {
        targetCat = visibleList[0].category;
      }

      if (targetCat && targetCat !== activeCategoryRef.current) {
        activeCategoryRef.current = targetCat;
        setActiveCategory(targetCat);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: "-135px 0px -65% 0px",
      threshold: [0, 0.1, 0.25],
    });

    categories.forEach((_c, idx) => {
      const el = document.getElementById(`cat-${idx}`);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
      intersectingMap.clear();
    };
  }, [mounted, categories, q]);

  // Boundary scroll sync for very top (hero) and very bottom of menu
  useEffect(() => {
    if (!mounted || categories.length === 0 || q) return;

    let ticking = false;
    const handleScrollBoundary = () => {
      if (isManualScrollRef.current || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (isManualScrollRef.current) return;

        const scrollY = window.scrollY;
        const scrollHeight = document.documentElement.scrollHeight;
        const innerHeight = window.innerHeight;

        // Top boundary: near very top of page
        if (scrollY < 80 && categories[0]?.[0]) {
          const firstCat = categories[0][0];
          if (activeCategoryRef.current !== firstCat) {
            activeCategoryRef.current = firstCat;
            setActiveCategory(firstCat);
          }
          return;
        }

        // Bottom boundary: reached end of page
        if (scrollY + innerHeight >= scrollHeight - 50 && categories.length > 0) {
          const lastCat = categories[categories.length - 1][0];
          if (activeCategoryRef.current !== lastCat) {
            activeCategoryRef.current = lastCat;
            setActiveCategory(lastCat);
          }
        }
      });
    };

    window.addEventListener("scroll", handleScrollBoundary, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollBoundary);
    };
  }, [mounted, categories, q]);

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

  // Financial calculations
  const taxAmount = data?.restaurant?.tax_percent
    ? Math.round((cartSubtotal * data.restaurant.tax_percent) / 100)
    : 0;
  const serviceChargeAmount = data?.restaurant?.service_charge_percent
    ? Math.round((cartSubtotal * data.restaurant.service_charge_percent) / 100)
    : 0;
  const grandTotal = cartSubtotal + taxAmount + serviceChargeAmount;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FAF7F0] text-[#242B2A] pb-36 selection:bg-[#E8B95B] selection:text-[#173F35]">
      {/* 1. RESTAURANT HERO BANNER */}
      <header className="relative overflow-hidden rounded-b-3xl bg-[#173F35] px-4 pt-5 pb-4 text-[#FAF7F0] shadow-luxury-lg">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-radial from-[#E8B95B]/25 to-transparent blur-2xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-radial from-[#E8B95B]/15 to-transparent blur-xl" />

        <div className="relative z-10 flex items-center justify-between gap-2.5 sm:gap-3 mb-3.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-1 border border-[#E8B95B]/35 backdrop-blur-xs shadow-luxury">
              <Image
                src="/logo.png"
                alt="Green Embassy Logo"
                width={64}
                height={40}
                className="h-7 sm:h-8 w-auto object-contain drop-shadow"
                priority
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-serif font-bold text-white leading-tight truncate tracking-wide">
                {data?.restaurant?.name || "Green Embassy"}
              </h1>
            </div>
          </div>

          <div className="shrink-0">
            <CallWaiter token={token} initialCalled={data?.waiterCalled} />
          </div>
        </div>

        {/* Table Number & Status Pill Banner */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E8B95B] via-[#f1ce7c] to-[#d8a84b] px-3.5 py-1 font-serif font-bold text-xs text-[#173F35] shadow-luxury border border-white/30">
              <span className="text-[9px] uppercase font-sans tracking-widest font-black opacity-80">
                Table
              </span>
              <span className="text-xs font-serif font-black tracking-wide">
                {data ? data.table : "—"}
              </span>
            </div>
            <span className="text-[11px] text-white/85 font-medium hidden sm:inline">
              Tableside Ordering
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#E8B95B] font-semibold bg-black/20 px-2.5 py-1 rounded-full border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8B95B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8B95B]" />
            </span>
            <span>Live Kitchen Sync</span>
          </div>
        </div>
      </header>

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
          <div className="flex items-center gap-2 min-w-0">
            {notice.ok ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-300" />
            ) : (
              <span className="font-bold shrink-0">!</span>
            )}
            <span className="truncate">{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors shrink-0 ml-2 cursor-pointer"
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
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
              </span>
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

                  {/* 4-Step Interactive Visual Timeline with Connecting Line */}
                  <div className="relative my-3.5 px-2">
                    {/* Background track line */}
                    <div className="absolute top-3 left-6 right-6 h-0.5 bg-stone-200 -z-0">
                      <div
                        className="h-full bg-[#173F35] transition-all duration-500 ease-out"
                        style={{
                          width:
                            currentStep === 1
                              ? "0%"
                              : currentStep === 2
                              ? "33.3%"
                              : currentStep === 3
                              ? "66.6%"
                              : "100%",
                        }}
                      />
                    </div>
                    <div className="relative z-10 grid grid-cols-4 gap-1">
                      {ORDER_TIMELINE_STEPS.map((s) => {
                        const isDone = currentStep > s.step;
                        const isCurrent = currentStep === s.step;

                        return (
                          <div key={s.step} className="flex flex-col items-center text-center">
                            {/* Dot / Node */}
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-200 ${
                                isCurrent
                                  ? "bg-[#173F35] text-[#E8B95B] ring-4 ring-[#E8B95B]/40 font-black shadow-xs scale-105"
                                  : isDone
                                  ? "bg-[#173F35] text-[#FAF7F0] ring-2 ring-[#FAF7F0]"
                                  : "bg-white text-stone-400 border border-stone-300"
                              }`}
                            >
                              {isDone ? (
                                <CheckIcon className="w-3.5 h-3.5 text-[#E8B95B]" />
                              ) : (
                                s.step
                              )}
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
                            <span className="text-[9px] text-[#242B2A]/50 hidden sm:block">
                              {s.desc}
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
      <div className="sticky top-0 z-30 bg-[#FAF7F0]/95 backdrop-blur-md pt-3 pb-2.5 border-b border-[#173F35]/10 shadow-xs">
        <div className="px-4 space-y-2.5">
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
                className="h-11 w-full rounded-full border border-[#173F35]/15 bg-white pl-10 pr-9 text-xs sm:text-sm text-[#242B2A] placeholder:text-[#242B2A]/40 focus:border-[#173F35] focus:ring-2 focus:ring-[#173F35]/15 focus:outline-none transition-all shadow-luxury"
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
              className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-bold transition-all shadow-luxury cursor-pointer select-none active:scale-95 ${
                vegOnly
                  ? "bg-emerald-800 text-white border border-emerald-900 shadow-sm"
                  : "bg-white text-[#242B2A] border border-[#173F35]/15 hover:bg-stone-50"
              }`}
              title="Filter vegetarian dishes only"
            >
              <DietaryBadge isVeg={true} />
              <span className="text-[11px] font-semibold">Veg Only</span>
            </button>
          </div>

          {/* 4. BEAUTIFUL HORIZONTAL SCROLLING CATEGORY NAVIGATION WITH ARROWS */}
          {!q && categories.length > 0 && (
            <div className="relative flex items-center gap-1.5">
              {/* Left Arrow Button */}
              {hasOverflow && (
                <button
                  type="button"
                  onClick={handleScrollLeft}
                  disabled={!canScrollLeft}
                  aria-label="Scroll categories left"
                  title="Previous categories"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#173F35] text-[#E8B95B] border border-[#E8B95B]/35 shadow-luxury transition-all select-none ${
                    canScrollLeft
                      ? "hover:bg-[#102e26] hover:border-[#E8B95B]/70 active:scale-90 cursor-pointer opacity-100"
                      : "opacity-25 cursor-not-allowed pointer-events-none"
                  }`}
                >
                  <ChevronLeftIcon className="w-4 h-4 text-[#E8B95B]" />
                </button>
              )}

              <nav
                ref={chipsRef}
                className="flex-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none"
              >
                {categories.map(([cat, list], idx) => {
                  const isSelected = currentCategory === cat;
                  return (
                    <button
                      key={cat}
                      data-category={cat}
                      data-index={idx}
                      onClick={() => handleCategoryClick(cat, idx)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none ${
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

              {/* Right Arrow Button */}
              {hasOverflow && (
                <button
                  type="button"
                  onClick={handleScrollRight}
                  disabled={!canScrollRight}
                  aria-label="Scroll categories right"
                  title="Next categories"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#173F35] text-[#E8B95B] border border-[#E8B95B]/35 shadow-luxury transition-all select-none ${
                    canScrollRight
                      ? "hover:bg-[#102e26] hover:border-[#E8B95B]/70 active:scale-90 cursor-pointer opacity-100"
                      : "opacity-25 cursor-not-allowed pointer-events-none"
                  }`}
                >
                  <ChevronRightIcon className="w-4 h-4 text-[#E8B95B]" />
                </button>
              )}
            </div>
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
            data-category={cat}
            data-index={idx}
            className="pt-6"
            style={{ scrollMarginTop: "145px" }}
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
                    className={`group relative rounded-3xl p-4 sm:p-5 border transition-all duration-200 ${
                      qty > 0
                        ? "bg-white border-[#E8B95B] ring-1 ring-[#E8B95B]/40 shadow-luxury-lg"
                        : "bg-white border-[#173F35]/10 shadow-luxury hover:border-[#173F35]/25 hover:shadow-luxury-lg"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      {/* Left: Dish Information */}
                      <div className="min-w-0 flex-1">
                        {/* Dietary Badge & Special Labels */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
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
                        <h3 className="font-serif font-bold text-base sm:text-lg leading-snug text-[#173F35] tracking-tight group-hover:text-[#102e26] transition-colors">
                          {item.name}
                        </h3>

                        {/* Dish Description */}
                        {item.description && (
                          <p className="mt-1 text-xs text-[#242B2A]/70 line-clamp-2 leading-relaxed font-sans">
                            {item.description}
                          </p>
                        )}

                        {/* Price */}
                        <p className="mt-2.5 text-base sm:text-lg font-serif font-bold tabular-nums text-[#173F35]">
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
                              aria-label={`Add ${item.name} to cart`}
                              className="flex h-9 w-24 items-center justify-center gap-1 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-95 transition-all cursor-pointer border border-[#E8B95B]/40"
                            >
                              <PlusIcon className="w-3.5 h-3.5" />
                              <span>ADD</span>
                            </button>
                          ) : (
                            <div className="flex h-9.5 w-26 items-center justify-between rounded-xl bg-[#173F35] px-1 text-white shadow-luxury border border-[#E8B95B]/40">
                              <button
                                aria-label={`Reduce ${item.name}`}
                                onClick={() => changeQty(item.id, -1)}
                                className="flex h-8.5 w-8 items-center justify-center text-[#E8B95B] hover:bg-white/10 rounded-lg transition-colors cursor-pointer active:scale-90"
                              >
                                <MinusIcon className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-bold tabular-nums text-xs text-white">
                                {qty}
                              </span>
                              <button
                                aria-label={`Add another ${item.name}`}
                                onClick={() => changeQty(item.id, 1)}
                                className="flex h-8.5 w-8 items-center justify-center text-[#E8B95B] hover:bg-white/10 rounded-lg transition-colors cursor-pointer active:scale-90"
                              >
                                <PlusIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preparation note input when selected */}
                    {qty > 0 && (
                      <div className="mt-3.5 pt-2.5 border-t border-[#173F35]/10 animate-fade-in">
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
                          className="h-8.5 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3 text-xs text-[#242B2A] placeholder:text-[#242B2A]/45 focus:border-[#173F35] focus:bg-white focus:outline-none transition-all shadow-inner"
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
        <>
          {/* Backdrop Overlay when Reviewing */}
          {reviewing && (
            <div
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setReviewing(false)}
              aria-label="Close cart review sheet"
            />
          )}

          <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3">
            {/* Slide-up Cart Review Panel */}
            {reviewing && (
              <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-3xl border border-[#173F35]/20 bg-white p-5 shadow-2xl animate-slide-up">
                {/* Drag handle pill */}
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300" />

                <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#173F35]/10 text-[#173F35]">
                      <ShoppingBagIcon className="w-4 h-4 text-[#173F35]" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-sm text-[#173F35]">
                        Your Order Summary
                      </h3>
                      <p className="text-[10px] text-[#242B2A]/60">
                        {totalCartCount} {totalCartCount === 1 ? "dish" : "dishes"} selected
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReviewing(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF7F0] text-[#242B2A]/70 hover:bg-[#173F35] hover:text-white cursor-pointer transition-colors"
                    aria-label="Close cart review"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                <ul className="divide-y divide-[#173F35]/10">
                  {cartLines.map((i) => (
                    <li key={i.id} className="py-3 first:pt-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <DietaryBadge isVeg={i.is_veg} />
                            <p className="font-semibold text-sm text-[#242B2A] leading-tight truncate">
                              {i.name}
                            </p>
                          </div>
                          {(notes[i.id] ?? "").trim() && (
                            <p className="text-[11px] text-[#173F35] italic mt-1 bg-[#173F35]/5 px-2 py-0.5 rounded-md inline-block">
                              Note: {notes[i.id].trim()}
                            </p>
                          )}
                        </div>

                        {/* Cart Stepper */}
                        <div className="flex items-center gap-1 rounded-xl border border-[#173F35]/20 bg-[#FAF7F0] p-0.5">
                          <button
                            onClick={() => changeQty(i.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-[#173F35] hover:bg-white cursor-pointer active:scale-90 transition-all"
                            aria-label={`Decrease ${i.name}`}
                          >
                            <MinusIcon className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold tabular-nums text-xs text-[#173F35]">
                            {cart[i.id]}
                          </span>
                          <button
                            onClick={() => changeQty(i.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-[#173F35] hover:bg-white cursor-pointer active:scale-90 transition-all"
                            aria-label={`Increase ${i.name}`}
                          >
                            <PlusIcon className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="w-16 text-right font-serif font-bold text-sm tabular-nums text-[#173F35]">
                          ₹{cart[i.id] * i.price}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Price Calculation Summary */}
                <div className="mt-3 pt-3 border-t border-[#173F35]/10 space-y-1.5 text-xs font-sans">
                  <div className="flex items-center justify-between text-[#242B2A]/75 font-medium">
                    <span>Subtotal ({totalCartCount} items)</span>
                    <span className="font-bold tabular-nums text-[#173F35]">
                      ₹{cartSubtotal}
                    </span>
                  </div>
                  {data?.restaurant?.tax_percent ? (
                    <div className="flex items-center justify-between text-[#242B2A]/65 text-[11px]">
                      <span>Taxes &amp; GST ({data.restaurant.tax_percent}%)</span>
                      <span className="tabular-nums font-medium">₹{taxAmount}</span>
                    </div>
                  ) : null}
                  {data?.restaurant?.service_charge_percent ? (
                    <div className="flex items-center justify-between text-[#242B2A]/65 text-[11px]">
                      <span>Service Charge ({data.restaurant.service_charge_percent}%)</span>
                      <span className="tabular-nums font-medium">₹{serviceChargeAmount}</span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t border-dashed border-[#173F35]/20 flex items-center justify-between text-sm font-bold text-[#173F35]">
                    <span className="font-serif">Total Payable</span>
                    <span className="tabular-nums font-serif text-lg font-black text-[#173F35]">
                      ₹{grandTotal}
                    </span>
                  </div>

                  <div className="pt-3">
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
                      Dishes are transmitted directly to the kitchen display with real-time tracking
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Floating Action Bar */}
            <div className="flex items-center justify-between rounded-3xl bg-[#173F35] px-4 py-3 text-white shadow-luxury-lg border border-[#E8B95B]/30 backdrop-blur-md">
              <button
                onClick={() => setReviewing(!reviewing)}
                className="text-left cursor-pointer flex items-center gap-3 select-none"
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-[#E8B95B]/20">
                    <ShoppingBagIcon className="w-5 h-5 text-[#E8B95B]" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E8B95B] text-[10px] font-black text-[#173F35] shadow-xs">
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
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#E8B95B] via-[#f1ce7c] to-[#d8a84b] px-5 py-2.5 font-bold text-sm text-[#173F35] shadow-gold hover:opacity-95 active:scale-95 disabled:opacity-50 transition-all cursor-pointer border border-white/20 select-none"
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
        </>
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
