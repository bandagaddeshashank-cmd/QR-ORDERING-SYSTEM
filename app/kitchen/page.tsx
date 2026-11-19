"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import KitchenGate from "./KitchenGate";
import WaiterCalls from "./waitercalls";
import { authFetch } from "@/lib/authFetch";
import { playKitchenChime } from "@/lib/kdsAudio";
import {
  BellIcon,
  BellOffIcon,
  RefreshCwIcon,
  ClockIcon,
  PencilIcon,
  LockIcon,
  MaximizeIcon,
  MinimizeIcon,
  CheckIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  FlameIcon,
  ChefHatIcon,
  UtensilsIcon,
  GridIcon,
  ReceiptIcon,
} from "@/components/ui/icons";

type Line = {
  id?: string;
  name_snapshot: string;
  quantity: number;
  note: string | null;
  status?: string;
};

type Order = {
  id: string;
  status: string;
  created_at: string;
  edited_at: string | null;
  lock_seconds_left: number;
  order_items: Line[];
  table_sessions: {
    tables: {
      label: string;
      restaurant_id?: string;
    } | null;
  } | null;
};


const subscribeToMute = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getMuteSnapshot = () => {
  try {
    return localStorage.getItem("kds_muted") === "true";
  } catch {
    return false;
  }
};

const getMuteServerSnapshot = () => false;

function useKdsMuted() {
  return useSyncExternalStore(subscribeToMute, getMuteSnapshot, getMuteServerSnapshot);
}

const formatClock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function KitchenKDS() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const muted = useKdsMuted();

  const previousOrderIdsRef = useRef<Set<string>>(new Set());

  // Clock tick every second for real-time elapsed timers and lock countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const elapsedSeconds = (iso: string) =>
    Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));

  const formatElapsed = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const lockLeft = (o: Order) =>
    Math.max(
      0,
      o.lock_seconds_left - Math.max(0, Math.floor((now - fetchedAt) / 1000))
    );

  const loadOrders = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await authFetch("/api/kitchen", { cache: "no-store" });
      if (!res.ok) throw new Error("Bad response from KDS API");

      const fresh: Order[] = await res.json();
      setOrders(fresh);
      setFetchedAt(Date.now());
      setOffline(false);

      // Check for incoming new orders and sound the chime
      const currentIds = new Set(fresh.map((o) => o.id));
      const hasNew = fresh.some(
        (o) =>
          (o.status === "placed" || o.status === "accepted") &&
          !previousOrderIdsRef.current.has(o.id)
      );

      if (hasNew && previousOrderIdsRef.current.size > 0 && !muted) {
        playKitchenChime();
      }
      previousOrderIdsRef.current = currentIds;
    } catch {
      setOffline(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [muted]);

  useEffect(() => {
    let isSubscribed = true;

    const poll = async () => {
      if (isSubscribed) await loadOrders();
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [loadOrders]);

  const toggleMute = () => {
    const next = !muted;
    try {
      localStorage.setItem("kds_muted", String(next));
      window.dispatchEvent(new Event("storage"));
    } catch {}
    if (!next) {
      playKitchenChime();
    }
  };

  const advanceStatus = async (orderId: string, nextStatus: string) => {
    setBusyId(orderId);
    try {
      await authFetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });
      await loadOrders();
    } catch (err) {
      console.error("Failed to advance order status:", err);
    } finally {
      setBusyId(null);
    }
  };

  // Order stage buckets
  const newOrders = orders.filter((o) => o.status === "placed" || o.status === "accepted");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  // Urgent orders count (tickets over 15 minutes that haven't been served)
  const urgentOrdersCount = orders.filter(
    (o) => elapsedSeconds(o.created_at) >= 900 && o.status !== "served"
  ).length;

  return (
    <div className="min-h-screen bg-[#0C100F] text-stone-100 p-3 sm:p-5 flex flex-col font-sans selection:bg-[#E8B95B] selection:text-[#173F35]">
      {/* 1. TOP KDS COMMAND BAR */}
      <header className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3.5 rounded-3xl bg-[#141A18] px-5 py-3.5 border border-white/10 shadow-2xl">
        {/* Brand & Crest */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#173F35] to-[#0d241e] border border-[#E8B95B]/40 text-[#E8B95B] shadow-luxury">
            <FlameIcon className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-serif font-black tracking-wide text-white">
                Kitchen Display System
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Dispatch
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              GREEN EMBASSY &bull; Culinary Expediting &amp; Ticket Operations
            </p>
          </div>
        </div>

        {/* Live Operational Counters Strip */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-stone-300">
            <ClockIcon className="w-3.5 h-3.5 text-[#E8B95B]" />
            <span className="font-mono tabular-nums text-sm">
              {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-[#E8B95B]/15 border border-[#E8B95B]/30 px-3 py-1.5 text-xs font-bold text-[#E8B95B]">
            <span>New:</span>
            <span className="font-mono text-sm">{newOrders.length}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
            <span>Prep:</span>
            <span className="font-mono text-sm">{preparingOrders.length}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-green-500/15 border border-green-500/30 px-3 py-1.5 text-xs font-bold text-green-300">
            <span>Ready:</span>
            <span className="font-mono text-sm">{readyOrders.length}</span>
          </div>
        </div>

        {/* Action Controls & Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Delayed Tickets Alert Indicator */}
          {urgentOrdersCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl bg-rose-950/90 border border-rose-500 px-3 py-1.5 text-xs font-bold text-rose-200 animate-pulse shadow-lg">
              <AlertCircleIcon className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{urgentOrdersCount} Delayed (&gt;15m)</span>
            </div>
          )}

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleMute}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-md select-none border ${
              muted
                ? "bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700 hover:text-stone-200"
                : "bg-[#173F35] text-[#E8B95B] border-[#E8B95B]/40 hover:bg-[#102e26]"
            }`}
            title={muted ? "Sound alerts disabled (click to enable)" : "Sound alerts enabled (click to mute)"}
            aria-label={muted ? "Enable audio notification chime" : "Mute audio notification chime"}
          >
            {muted ? (
              <>
                <BellOffIcon className="w-4 h-4 text-stone-400" />
                <span className="hidden sm:inline">Muted</span>
              </>
            ) : (
              <>
                <BellIcon className="w-4 h-4 text-[#E8B95B]" />
                <span className="hidden sm:inline">Sound On</span>
              </>
            )}
          </button>

          {/* Fullscreen Mode Toggle */}
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-white/10 transition-all cursor-pointer shadow-md select-none"
            title="Toggle Fullscreen Kitchen Monitor"
            aria-label={isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
          >
            {isFullscreen ? (
              <>
                <MinimizeIcon className="w-4 h-4 text-[#E8B95B]" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <MaximizeIcon className="w-4 h-4 text-stone-300" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadOrders()}
            disabled={isRefreshing}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer shadow-md"
            title="Refresh active tickets"
            aria-label="Refresh kitchen orders"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#E8B95B]" : ""}`} />
          </button>

          {/* Operational Portal Quick Nav */}
          <Link
            href="/admin"
            className="hidden sm:flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white transition-all shadow-md"
            title="Executive Admin Console"
            aria-label="Open Admin Dashboard"
          >
            <GridIcon className="w-4 h-4" />
          </Link>

          <Link
            href="/billing"
            className="hidden sm:flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white transition-all shadow-md"
            title="Cashier & Billing Desk"
            aria-label="Open Billing Desk"
          >
            <ReceiptIcon className="w-4 h-4 text-emerald-400" />
          </Link>

          {/* Network Health Indicator */}
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border shadow-md ${
              offline
                ? "bg-rose-950/90 text-rose-300 border-rose-500 animate-pulse"
                : "bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                offline ? "bg-rose-500" : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span className="hidden sm:inline">
              {offline
                ? "Offline &bull; Reconnecting"
                : `${orders.length} Active`}
            </span>
          </div>
        </div>
      </header>

      {/* 2. WAITER CALLS DOCKED ALERT */}
      <WaiterCalls />

      {/* 3. THREE-COLUMN KITCHEN PIPELINE */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 xl:gap-5 flex-1 items-start min-w-0">
        {/* ========================================================= */}
        {/* COLUMN 1: NEW ORDERS */}
        {/* ========================================================= */}
        <section className="flex flex-col rounded-3xl bg-[#141A18] p-4 sm:p-5 border-t-4 border-t-[#E8B95B] border border-white/10 shadow-2xl lg:max-h-[calc(100vh-165px)] lg:overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#173F35_transparent]">
          <div className="sticky top-0 z-10 bg-[#141A18]/95 backdrop-blur-xs flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-serif font-black text-white tracking-wide">
                New Orders
              </h2>
              <span className="rounded-full bg-[#E8B95B] text-[#173F35] font-black px-3 py-0.5 text-xs shadow-md tabular-nums">
                {newOrders.length}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E8B95B]">
              Intake Desk
            </span>
          </div>

          {newOrders.length === 0 && (
            <div className="py-20 text-center text-stone-500">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-stone-600 border border-white/10">
                <ChefHatIcon className="w-7 h-7" />
              </div>
              <p className="font-serif text-base font-bold text-stone-300">Intake Queue Clear</p>
              <p className="text-xs text-stone-500 mt-1">No new guest orders waiting for cooking assignment.</p>
            </div>
          )}

          <div className="space-y-4">
            {newOrders.map((o) => {
              const sec = elapsedSeconds(o.created_at);
              const lockedSeconds = lockLeft(o);
              const isLocked = lockedSeconds > 0;
              const isDelayed = sec >= 600; // >= 10 mins

              return (
                <article
                  key={o.id}
                  className={`rounded-2xl p-5 border transition-all shadow-xl ${
                    isDelayed
                      ? "bg-gradient-to-b from-rose-950/50 via-[#1B2321] to-[#1B2321] border-rose-500/90 shadow-[0_0_24px_rgba(244,63,94,0.2)]"
                      : "bg-[#1B2321] border-white/10 hover:border-[#E8B95B]/50"
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
                    <div>
                      <span className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#E8B95B] block">
                        Table {o.table_sessions?.tables?.label ?? "—"}
                      </span>
                      <span className="text-xs font-mono text-stone-400 uppercase tracking-wider mt-0.5 block">
                        #{o.id.slice(0, 6).toUpperCase()} &bull; {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold font-mono tabular-nums shadow-sm ${
                          isDelayed
                            ? "bg-rose-600 text-white animate-pulse"
                            : "bg-white/10 text-stone-200 border border-white/10"
                        }`}
                      >
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatElapsed(sec)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Customer Modification Pill */}
                  {o.edited_at && (
                    <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-[#E8B95B]/20 border border-[#E8B95B]/50 px-3 py-1.5 text-xs font-bold text-[#E8B95B]">
                      <PencilIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Modified by Customer Tableside</span>
                    </div>
                  )}

                  {/* Edit Window Lock Countdown */}
                  {isLocked && (
                    <div className="mb-3.5 rounded-xl bg-amber-950/70 border border-amber-500/70 p-3 text-xs text-amber-200 flex items-center gap-2">
                      <LockIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold">Customer Edit Grace Window: </span>
                        <span>Locked for </span>
                        <span className="font-mono font-black text-amber-300">
                          {formatClock(lockedSeconds)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dishes List */}
                  <ul className="space-y-3.5 my-4">
                    {o.order_items.map((item, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-start text-base sm:text-lg">
                          <span className="font-mono font-black text-2xl sm:text-3xl text-[#E8B95B] w-10 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-white tracking-wide flex-1 leading-snug">
                            {item.name_snapshot}
                          </span>
                        </div>

                        {item.note && (
                          <div className="ml-10 mt-1 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200">
                            <span className="text-[#E8B95B] font-extrabold uppercase text-[10px] tracking-wider block">
                              Chef Preparation Note:
                            </span>
                            {item.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Advance Button: Start Cooking */}
                  <button
                    onClick={() => advanceStatus(o.id, "preparing")}
                    disabled={busyId === o.id || isLocked}
                    className={`w-full h-14 rounded-2xl font-black text-sm tracking-wide transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                      isLocked
                        ? "bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed"
                        : "bg-[#173F35] text-[#E8B95B] border border-[#E8B95B]/40 hover:bg-[#102e26] hover:border-[#E8B95B] active:scale-98"
                    }`}
                  >
                    {busyId === o.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                        <span>Updating Station...</span>
                      </span>
                    ) : isLocked ? (
                      <span>Locked ({formatClock(lockedSeconds)})</span>
                    ) : (
                      <>
                        <span>Start Cooking</span>
                        <ArrowRightIcon className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* COLUMN 2: PREPARING (ON STOVE / IN KITCHEN) */}
        {/* ========================================================= */}
        <section className="flex flex-col rounded-3xl bg-[#141A18] p-4 sm:p-5 border-t-4 border-t-emerald-500 border border-white/10 shadow-2xl lg:max-h-[calc(100vh-165px)] lg:overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#173F35_transparent]">
          <div className="sticky top-0 z-10 bg-[#141A18]/95 backdrop-blur-xs flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-serif font-black text-white tracking-wide">
                Preparing
              </h2>
              <span className="rounded-full bg-emerald-500 text-[#0C100F] font-black px-3 py-0.5 text-xs shadow-md tabular-nums">
                {preparingOrders.length}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Active Cooking
            </span>
          </div>

          {preparingOrders.length === 0 && (
            <div className="py-20 text-center text-stone-500">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-stone-600 border border-white/10">
                <FlameIcon className="w-7 h-7" />
              </div>
              <p className="font-serif text-base font-bold text-stone-300">Cook Line Idle</p>
              <p className="text-xs text-stone-500 mt-1">Move new tickets to preparing when cooking starts.</p>
            </div>
          )}

          <div className="space-y-4">
            {preparingOrders.map((o) => {
              const sec = elapsedSeconds(o.created_at);
              const isUrgent = sec >= 900; // >= 15 mins
              const isWarning = sec >= 600 && sec < 900; // 10-15 mins

              return (
                <article
                  key={o.id}
                  className={`rounded-2xl p-5 border transition-all shadow-xl ${
                    isUrgent
                      ? "bg-gradient-to-b from-rose-950/60 via-[#1B2321] to-[#1B2321] border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.25)]"
                      : isWarning
                      ? "bg-gradient-to-b from-amber-950/50 via-[#1B2321] to-[#1B2321] border-amber-500/80"
                      : "bg-[#1B2321] border-white/10 hover:border-emerald-500/60"
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
                    <div>
                      <span className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-white block">
                        Table {o.table_sessions?.tables?.label ?? "—"}
                      </span>
                      <span className="text-xs font-mono text-stone-400 uppercase tracking-wider mt-0.5 block">
                        #{o.id.slice(0, 6).toUpperCase()} &bull; Cooking Active
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold font-mono tabular-nums shadow-sm ${
                          isUrgent
                            ? "bg-rose-600 text-white animate-pulse"
                            : isWarning
                            ? "bg-amber-600 text-white"
                            : "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
                        }`}
                      >
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatElapsed(sec)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Customer Modification Pill */}
                  {o.edited_at && (
                    <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-[#E8B95B]/20 border border-[#E8B95B]/50 px-3 py-1.5 text-xs font-bold text-[#E8B95B]">
                      <PencilIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Order Modified</span>
                    </div>
                  )}

                  {/* Dishes List */}
                  <ul className="space-y-3.5 my-4">
                    {o.order_items.map((item, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-start text-base sm:text-lg">
                          <span className="font-mono font-black text-2xl sm:text-3xl text-emerald-400 w-10 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-white tracking-wide flex-1 leading-snug">
                            {item.name_snapshot}
                          </span>
                        </div>

                        {item.note && (
                          <div className="ml-10 mt-1 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200">
                            <span className="text-[#E8B95B] font-extrabold uppercase text-[10px] tracking-wider block">
                              Chef Preparation Note:
                            </span>
                            {item.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Advance Button: Mark Ready */}
                  <button
                    onClick={() => advanceStatus(o.id, "ready")}
                    disabled={busyId === o.id}
                    className="w-full h-14 rounded-2xl bg-emerald-600 font-black text-sm text-white tracking-wide hover:bg-emerald-500 active:scale-98 transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/40"
                  >
                    {busyId === o.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Plating Order...</span>
                      </span>
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4" />
                        <span>Mark Ready for Pickup</span>
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* COLUMN 3: READY FOR RUNNER / TABLE PICKUP */}
        {/* ========================================================= */}
        <section className="flex flex-col rounded-3xl bg-[#141A18] p-4 sm:p-5 border-t-4 border-t-green-400 border border-white/10 shadow-2xl lg:max-h-[calc(100vh-165px)] lg:overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#173F35_transparent]">
          <div className="sticky top-0 z-10 bg-[#141A18]/95 backdrop-blur-xs flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-serif font-black text-white tracking-wide">
                Ready for Pickup
              </h2>
              <span className="rounded-full bg-green-400 text-[#0C100F] font-black px-3 py-0.5 text-xs shadow-md tabular-nums">
                {readyOrders.length}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-400">
              Plated &amp; Waiting
            </span>
          </div>

          {readyOrders.length === 0 && (
            <div className="py-20 text-center text-stone-500">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-stone-600 border border-white/10">
                <UtensilsIcon className="w-7 h-7" />
              </div>
              <p className="font-serif text-base font-bold text-stone-300">Pass Counter Clear</p>
              <p className="text-xs text-stone-500 mt-1">Plated dishes waiting for food runners will appear here.</p>
            </div>
          )}

          <div className="space-y-4">
            {readyOrders.map((o) => {
              const sec = elapsedSeconds(o.created_at);

              return (
                <article
                  key={o.id}
                  className="rounded-2xl p-5 bg-[#1B2321] border border-green-500/50 shadow-xl transition-all hover:border-green-400"
                >
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
                    <div>
                      <span className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-emerald-300 block">
                        Table {o.table_sessions?.tables?.label ?? "—"}
                      </span>
                      <span className="text-xs font-mono text-stone-400 uppercase tracking-wider mt-0.5 block">
                        #{o.id.slice(0, 6).toUpperCase()} &bull; Ready for Table
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-950/90 border border-green-500/60 px-3 py-1 text-xs font-bold font-mono text-green-300 tabular-nums shadow-sm">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatElapsed(sec)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Dishes List */}
                  <ul className="space-y-3.5 my-4">
                    {o.order_items.map((item, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-start text-base sm:text-lg">
                          <span className="font-mono font-black text-2xl sm:text-3xl text-green-400 w-10 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-white tracking-wide flex-1 leading-snug">
                            {item.name_snapshot}
                          </span>
                        </div>

                        {item.note && (
                          <div className="ml-10 mt-1 rounded-xl bg-green-950/40 border border-green-600/30 px-3 py-1.5 text-xs font-semibold text-green-200">
                            <span className="text-green-400 font-extrabold uppercase text-[10px] tracking-wider block">
                              Chef Note:
                            </span>
                            {item.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Advance Button: Mark Served */}
                  <button
                    onClick={() => advanceStatus(o.id, "served")}
                    disabled={busyId === o.id}
                    className="w-full h-14 rounded-2xl bg-green-600 font-black text-sm text-white tracking-wide hover:bg-green-500 active:scale-98 transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-green-400/40"
                  >
                    {busyId === o.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Serving Ticket...</span>
                      </span>
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4" />
                        <span>Mark Order as Served</span>
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Kitchen() {
  return (
    <KitchenGate>
      <KitchenKDS />
    </KitchenGate>
  );
}
