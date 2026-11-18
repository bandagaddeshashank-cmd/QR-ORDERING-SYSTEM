"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import KitchenGate from "./KitchenGate";
import WaiterCalls from "./waitercalls";
import { authFetch } from "@/lib/authFetch";
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

// Web Audio API Synthesizer for Kitchen Bell Chime (zero external audio files)
function playKitchenChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Pleasant high-clarity restaurant service bell (F5 -> A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(698.46, now); // F5
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.85);
  } catch (err) {
    console.warn("KDS audio chime blocked or unsupported:", err);
  }
}

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
    <div className="min-h-screen bg-[#101514] text-stone-100 p-4 sm:p-6 flex flex-col font-sans selection:bg-[#E8B95B] selection:text-[#173F35]">
      {/* 1. TOP KDS COMMAND BAR */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#161E1C] px-5 py-4 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173F35] border border-[#E8B95B]/40 text-[#E8B95B] shadow-inner">
            <FlameIcon className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-serif font-extrabold tracking-wide text-white">
                Kitchen Display System
              </h1>
              <span className="rounded-full bg-emerald-950/80 border border-emerald-500/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Live Production
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Green Embassy • Culinary Ticket Dispatch & Expediting
            </p>
          </div>
        </div>

        {/* Action Controls & Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Urgent Tickets Alert Indicator */}
          {urgentOrdersCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl bg-rose-950/80 border border-rose-500/80 px-3 py-2 text-xs font-bold text-rose-200 animate-pulse">
              <AlertCircleIcon className="w-4 h-4 text-rose-400" />
              <span>{urgentOrdersCount} Delayed (&gt;15m)</span>
            </div>
          )}

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleMute}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-md ${
              muted
                ? "bg-stone-800 text-stone-400 border border-stone-700 hover:bg-stone-700 hover:text-stone-200"
                : "bg-[#173F35] text-[#E8B95B] border border-[#E8B95B]/40 hover:bg-[#102e26]"
            }`}
            title={muted ? "Sound alerts disabled (click to enable)" : "Sound alerts enabled"}
          >
            {muted ? (
              <>
                <BellOffIcon className="w-4 h-4 text-stone-400" />
                <span>Audio Muted</span>
              </>
            ) : (
              <>
                <BellIcon className="w-4 h-4 text-[#E8B95B]" />
                <span>Audio Alert On</span>
              </>
            )}
          </button>

          {/* Fullscreen Mode Toggle */}
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-stone-200 hover:bg-white/10 transition-all cursor-pointer shadow-md"
            title="Toggle Fullscreen Kitchen Mode"
          >
            {isFullscreen ? (
              <>
                <MinimizeIcon className="w-4 h-4 text-[#E8B95B]" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <MaximizeIcon className="w-4 h-4 text-stone-300" />
                <span className="hidden sm:inline">Fullscreen Mode</span>
              </>
            )}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadOrders()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-stone-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer shadow-md"
            title="Refresh active tickets"
          >
            <RefreshCwIcon className="w-4 h-4" />
          </button>

          {/* Network Health Indicator */}
          <div
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold border shadow-md ${
              offline
                ? "bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse"
                : "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                offline ? "bg-rose-500" : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span>
              {offline
                ? "Offline · Reconnecting"
                : `${orders.length} Active Ticket${orders.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </header>

      {/* 2. WAITER CALLS DOCKED ALERT */}
      <WaiterCalls />

      {/* 3. THREE-COLUMN KITCHEN PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
        {/* ========================================================= */}
        {/* COLUMN 1: NEW ORDERS */}
        {/* ========================================================= */}
        <section className="flex flex-col rounded-3xl bg-[#161E1C] p-4 sm:p-5 border-t-4 border-t-[#E8B95B] border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-serif font-extrabold text-white tracking-wide">
                New Orders
              </h2>
              <span className="rounded-full bg-[#E8B95B] text-[#173F35] font-extrabold px-3 py-0.5 text-xs shadow-md">
                {newOrders.length}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E8B95B]">
              Intake Desk
            </span>
          </div>

          {newOrders.length === 0 && (
            <div className="py-20 text-center text-stone-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-stone-600">
                <CheckIcon className="w-6 h-6" />
              </div>
              <p className="font-serif text-sm font-semibold text-stone-400">All caught up</p>
              <p className="text-xs text-stone-600 mt-1">No new tickets waiting to be prepared.</p>
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
                      ? "bg-gradient-to-b from-rose-950/40 via-[#1C2523] to-[#1C2523] border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                      : "bg-[#1C2523] border-white/10 hover:border-[#E8B95B]/40"
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
                    <div>
                      <span className="text-3xl font-serif font-black tracking-tight text-[#E8B95B] block">
                        Table {o.table_sessions?.tables?.label ?? "—"}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                        #{o.id.slice(0, 6)} • {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                    <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-[#E8B95B]/20 border border-[#E8B95B]/50 px-3 py-1 text-xs font-bold text-[#E8B95B]">
                      <PencilIcon className="w-3.5 h-3.5" />
                      <span>Modified by Customer</span>
                    </div>
                  )}

                  {/* Edit Window Lock Countdown */}
                  {isLocked && (
                    <div className="mb-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 p-3 text-xs text-amber-200 flex items-center gap-2">
                      <LockIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold">Customer Edit Grace Window: </span>
                        <span>Locked for </span>
                        <span className="font-mono font-extrabold text-amber-300">
                          {formatClock(lockedSeconds)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dishes List */}
                  <ul className="space-y-3.5 my-4">
                    {o.order_items.map((item, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-start text-base">
                          <span className="font-mono font-extrabold text-xl text-[#E8B95B] w-9 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-white tracking-wide flex-1">
                            {item.name_snapshot}
                          </span>
                        </div>

                        {item.note && (
                          <div className="ml-9 mt-1 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200">
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
                    className={`w-full h-13 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                      isLocked
                        ? "bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed"
                        : "bg-[#173F35] text-[#E8B95B] border border-[#E8B95B]/40 hover:bg-[#102e26] hover:border-[#E8B95B] active:scale-98"
                    }`}
                  >
                    {busyId === o.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                        Updating Station...
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
        <section className="flex flex-col rounded-3xl bg-[#161E1C] p-4 sm:p-5 border-t-4 border-t-emerald-500 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-serif font-extrabold text-white tracking-wide">
                Preparing
              </h2>
              <span className="rounded-full bg-emerald-500 text-[#101514] font-extrabold px-3 py-0.5 text-xs shadow-md">
                {preparingOrders.length}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Active Cooking
            </span>
          </div>

          {preparingOrders.length === 0 && (
            <div className="py-20 text-center text-stone-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-stone-600">
                <FlameIcon className="w-6 h-6" />
              </div>
              <p className="font-serif text-sm font-semibold text-stone-400">Burners idle</p>
              <p className="text-xs text-stone-600 mt-1">Move new tickets to preparing when cooking starts.</p>
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
                      ? "bg-gradient-to-b from-rose-950/50 via-[#1C2523] to-[#1C2523] border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                      : isWarning
                      ? "bg-gradient-to-b from-amber-950/40 via-[#1C2523] to-[#1C2523] border-amber-500/70"
                      : "bg-[#1C2523] border-white/10 hover:border-emerald-500/50"
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
                    <div>
                      <span className="text-3xl font-serif font-black tracking-tight text-white block">
                        Table {o.table_sessions?.tables?.label ?? "—"}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                        #{o.id.slice(0, 6)} • Cooking in Progress
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold font-mono tabular-nums shadow-sm ${
                          isUrgent
                            ? "bg-rose-600 text-white animate-pulse"
                            : isWarning
                            ? "bg-amber-600 text-white"
                            : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatElapsed(sec)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Customer Modification Pill */}
                  {o.edited_at && (
                    <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-[#E8B95B]/20 border border-[#E8B95B]/50 px-3 py-1 text-xs font-bold text-[#E8B95B]">
                      <PencilIcon className="w-3.5 h-3.5" />
                      <span>Order Modified</span>
                    </div>
                  )}

                  {/* Dishes List */}
                  <ul className="space-y-3.5 my-4">
                    {o.order_items.map((item, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-start text-base">
                          <span className="font-mono font-extrabold text-xl text-emerald-400 w-9 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-white tracking-wide flex-1">
                            {item.name_snapshot}
                          </span>
                        </div>

                        {item.note && (
                          <div className="ml-9 mt-1 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200">
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
                    className="w-full h-13 rounded-2xl bg-emerald-600 font-bold text-sm text-white tracking-wide hover:bg-emerald-500 active:scale-98 transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {busyId === o.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Plating Order...
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
        <section className="flex flex-col rounded-3xl bg-[#161E1C] p-4 sm:p-5 border-t-4 border-t-green-400 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-serif font-extrabold text-white tracking-wide">
                Ready for Pickup
              </h2>
              <span className="rounded-full bg-green-400 text-[#101514] font-extrabold px-3 py-0.5 text-xs shadow-md">
                {readyOrders.length}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-400">
              Plated & Waiting
            </span>
          </div>

          {readyOrders.length === 0 && (
            <div className="py-20 text-center text-stone-500">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-stone-600">
                <CheckIcon className="w-6 h-6" />
              </div>
              <p className="font-serif text-sm font-semibold text-stone-400">Pass counter clear</p>
              <p className="text-xs text-stone-600 mt-1">Dishes ready for food runners will appear here.</p>
            </div>
          )}

          <div className="space-y-4">
            {readyOrders.map((o) => {
              const sec = elapsedSeconds(o.created_at);

              return (
                <article
                  key={o.id}
                  className="rounded-2xl p-5 bg-[#1C2523] border border-green-500/40 shadow-xl transition-all hover:border-green-400"
                >
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
                    <div>
                      <span className="text-3xl font-serif font-black tracking-tight text-green-300 block">
                        Table {o.table_sessions?.tables?.label ?? "—"}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                        #{o.id.slice(0, 6)} • Ready for Table
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-950/80 border border-green-500/50 px-3 py-1 text-xs font-bold font-mono text-green-300 tabular-nums shadow-sm">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatElapsed(sec)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Dishes List */}
                  <ul className="space-y-3.5 my-4">
                    {o.order_items.map((item, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-start text-base">
                          <span className="font-mono font-extrabold text-xl text-green-400 w-9 shrink-0">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-white tracking-wide flex-1">
                            {item.name_snapshot}
                          </span>
                        </div>

                        {item.note && (
                          <div className="ml-9 mt-1 rounded-xl bg-green-950/40 border border-green-600/30 px-3 py-1.5 text-xs font-medium text-green-200">
                            <b>Note:</b> {item.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Advance Button: Mark Served */}
                  <button
                    onClick={() => advanceStatus(o.id, "served")}
                    disabled={busyId === o.id}
                    className="w-full h-13 rounded-2xl bg-green-600 font-bold text-sm text-white tracking-wide hover:bg-green-500 active:scale-98 transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {busyId === o.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Serving Ticket...
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
