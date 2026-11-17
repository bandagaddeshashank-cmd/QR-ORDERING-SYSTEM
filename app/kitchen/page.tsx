"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KitchenGate from "./KitchenGate";
import WaiterCalls from "./waitercalls";
import { authFetch } from "@/lib/authFetch";

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

const COLUMNS = [
  {
    title: "New Orders",
    statuses: ["placed", "accepted"],
    action: "Start Preparing",
    to: "preparing",
    accentBorder: "border-t-amber-500",
    badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
    empty: "No new tickets waiting.",
  },
  {
    title: "Preparing",
    statuses: ["preparing"],
    action: "Mark as Ready",
    to: "ready",
    accentBorder: "border-t-orange-500",
    badgeBg: "bg-orange-100 text-orange-900 border-orange-300",
    empty: "Nothing currently on the stove.",
  },
  {
    title: "Ready for Pickup",
    statuses: ["ready"],
    action: "Mark as Served",
    to: "served",
    accentBorder: "border-t-emerald-600",
    badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
    empty: "No dishes waiting for runners.",
  },
];

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Web Audio API Synthesizer for Kitchen Chime (zero external audio dependencies)
function playKitchenChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Pleasant two-tone restaurant service bell (F5 -> A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(698.46, now); // F5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn("Audio chime autoplay prevented or unsupported:", err);
  }
}

function KitchenKDS() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kds_muted") === "true";
    }
    return false;
  });

  const previousOrderIdsRef = useRef<Set<string>>(new Set());

  // Clock tick for elapsed time & lock countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const minutesSince = (iso: string) =>
    Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

  const lockLeft = (o: Order) =>
    Math.max(
      0,
      o.lock_seconds_left - Math.max(0, Math.floor((now - fetchedAt) / 1000))
    );

  const loadOrders = useCallback(async () => {
    try {
      const res = await authFetch("/api/kitchen", { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");

      const fresh: Order[] = await res.json();
      setOrders(fresh);
      setFetchedAt(Date.now());
      setOffline(false);

      // Check for incoming new orders and chime
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
    setMuted(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("kds_muted", String(next));
    }
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

  return (
    <div className="min-h-screen bg-[#F8F5EF] p-4 sm:p-6 text-[#252D38]">
      {/* Top Station Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#252D38]/10 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#193A2D]">
            Kitchen Display System
          </h1>
          <p className="text-xs font-semibold text-[#252D38]/70 mt-0.5">
            Real-time ticket display & order workflow
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-xs transition-all ${
              muted
                ? "bg-stone-200 text-stone-700 hover:bg-stone-300"
                : "bg-[#193A2D] text-[#E7B94F] hover:bg-[#122b21]"
            }`}
          >
            <span>{muted ? "🔇 Sound Muted" : "🔔 Sound Alert On"}</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={() => loadOrders()}
            className="rounded-xl border border-[#252D38]/20 bg-white px-3 py-2 text-xs font-bold hover:bg-stone-50 shadow-xs transition-all"
          >
            🔄 Refresh
          </button>

          {/* Connection Status Pill */}
          <div
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border shadow-xs ${
              offline
                ? "bg-red-100 text-red-800 border-red-300 animate-pulse"
                : "bg-emerald-50 text-emerald-800 border-emerald-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                offline ? "bg-red-600" : "bg-emerald-600"
              }`}
            />
            <span>
              {offline
                ? "Offline · Retrying"
                : `${orders.length} Active Ticket${orders.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </header>

      {/* Waiter Calls Alert Component */}
      <WaiterCalls />

      {/* 3-Column Kitchen Display Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnOrders = orders.filter((o) => col.statuses.includes(o.status));

          return (
            <section
              key={col.title}
              className={`flex flex-col rounded-3xl bg-white p-4 sm:p-5 shadow-sm border-t-6 border border-[#252D38]/10 ${col.accentBorder}`}
            >
              <div className="mb-4 flex items-center justify-between border-b border-[#252D38]/10 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-[#193A2D]">{col.title}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${col.badgeBg}`}
                  >
                    {columnOrders.length}
                  </span>
                </div>
              </div>

              {columnOrders.length === 0 && (
                <div className="my-auto py-12 text-center text-sm font-medium text-[#252D38]/40">
                  <p>{col.empty}</p>
                </div>
              )}

              <ul className="space-y-4">
                {columnOrders.map((o) => {
                  const elapsedMins = minutesSince(o.created_at);
                  const isLate = elapsedMins >= 12 && col.to !== "served";
                  const lockedSeconds = lockLeft(o);
                  const isLocked = lockedSeconds > 0;

                  return (
                    <li
                      key={o.id}
                      className={`rounded-2xl border p-4 shadow-sm transition-all ${
                        isLate
                          ? "border-red-300 bg-red-50/50"
                          : "border-[#252D38]/15 bg-[#F8F5EF]"
                      }`}
                    >
                      {/* Ticket Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-2xl font-black tracking-tight text-[#193A2D]">
                            Table {o.table_sessions?.tables?.label ?? "—"}
                          </span>
                          <p className="text-[11px] font-mono text-[#252D38]/60 mt-0.5">
                            Ticket #{o.id.slice(0, 6).toUpperCase()}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${
                              isLate
                                ? "bg-red-600 text-white animate-pulse"
                                : "bg-white text-[#252D38] border border-[#252D38]/20"
                            }`}
                          >
                            ⏱ {elapsedMins}m ago
                          </span>
                        </div>
                      </div>

                      {/* Customer Modification Badges */}
                      {o.edited_at && (
                        <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-[#E7B94F] px-2 py-0.5 text-[11px] font-bold text-[#193A2D]">
                          ✏️ Modified by Customer
                        </div>
                      )}

                      {/* Locked countdown notice */}
                      {isLocked && (
                        <div className="mb-3 rounded-xl bg-amber-50 border border-amber-300 p-2 text-xs font-semibold text-amber-900">
                          <span className="font-bold">🔒 Edit Window Open:</span>{" "}
                          Customer can edit for{" "}
                          <span className="tabular-nums font-bold">
                            {clock(lockedSeconds)}
                          </span>
                        </div>
                      )}

                      {/* Items List */}
                      <ul className="my-3 space-y-2 border-y border-[#252D38]/10 py-3 text-sm">
                        {o.order_items.map((item, idx) => (
                          <li key={idx} className="flex flex-col">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-bold text-[#252D38]">
                                <span className="inline-block w-8 font-black text-base text-[#193A2D] tabular-nums">
                                  {item.quantity}×
                                </span>
                                {item.name_snapshot}
                              </span>
                            </div>
                            {item.note && (
                              <div className="ml-8 mt-1 rounded-lg bg-[#E7B94F]/20 px-2 py-1 text-xs font-semibold text-[#193A2D] border border-[#E7B94F]/40">
                                <b>Note:</b> {item.note}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>

                      {/* Action Button */}
                      <button
                        onClick={() => advanceStatus(o.id, col.to)}
                        disabled={busyId === o.id || isLocked}
                        className={`h-12 w-full rounded-xl font-bold text-sm tracking-wide transition-all shadow-md active:scale-98 ${
                          isLocked
                            ? "bg-stone-300 text-stone-600 cursor-not-allowed border border-stone-400"
                            : col.to === "served"
                            ? "bg-emerald-700 text-white hover:bg-emerald-800"
                            : col.to === "ready"
                            ? "bg-[#193A2D] text-[#E7B94F] hover:bg-[#122b21]"
                            : "bg-[#193A2D] text-white hover:bg-[#122b21]"
                        }`}
                      >
                        {busyId === o.id
                          ? "Updating..."
                          : isLocked
                          ? `Locked (${clock(lockedSeconds)})`
                          : col.action}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
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
