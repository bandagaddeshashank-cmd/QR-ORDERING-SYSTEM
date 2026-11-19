"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { BellIcon, CheckIcon, ClockIcon, AlertCircleIcon } from "@/components/ui/icons";

type Call = {
  id: string;
  created_at: string;
  tables: { label: string } | null;
};

const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

export default function WaiterCalls() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    const loadCalls = async () => {
      try {
        const res = await authFetch("/api/waiter", { cache: "no-store" });
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setCalls(Array.isArray(data) ? data : []);
        }
      } catch {
        // network retry on next poll
      }
    };

    loadCalls();
    const interval = setInterval(loadCalls, 4000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  const handleDone = async (callId: string) => {
    setBusyId(callId);
    try {
      const res = await authFetch("/api/waiter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      if (res.ok) {
        setCalls((prev) => prev.filter((c) => c.id !== callId));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (calls.length === 0) return null;

  return (
    <section
      aria-live="assertive"
      className="mb-6 rounded-3xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-[#161E1C] to-rose-950/80 p-4 sm:p-5 shadow-2xl animate-fade-in select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 border-b border-rose-500/30 pb-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500" />
          </span>
          <div className="flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-rose-400" />
            <h2 className="text-base sm:text-lg font-serif font-extrabold text-white tracking-wide">
              Waitstaff Assistance Requested ({calls.length})
            </h2>
          </div>
        </div>

        <span className="rounded-full bg-rose-600 px-3.5 py-1 text-xs font-extrabold text-white tracking-wider uppercase shadow-md flex items-center gap-1.5">
          <AlertCircleIcon className="w-3.5 h-3.5" />
          <span>Immediate Table Attention</span>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {calls.map((c) => {
          const mins = minutesSince(c.created_at, now);
          const isOverdue = mins >= 3;

          return (
            <div
              key={c.id}
              className={`flex items-center justify-between gap-3 rounded-2xl p-4 border transition-all shadow-lg ${
                isOverdue
                  ? "bg-rose-900/70 border-rose-400 text-rose-50 shadow-rose-950/50"
                  : "bg-[#141A19] border-rose-700/60 text-white"
              }`}
            >
              <div className="min-w-0">
                <span className="text-2xl sm:text-3xl font-serif font-black text-[#E8B95B] tracking-tight block truncate">
                  Table {c.tables?.label ?? "—"}
                </span>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-rose-200/90">
                  <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="tabular-nums">
                    {mins === 0 ? "Just now" : `${mins} min${mins !== 1 ? "s" : ""} ago`}
                  </span>
                  {isOverdue && (
                    <span className="font-extrabold text-rose-300 ml-1 uppercase text-[10px] tracking-wider bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40">
                      Overdue
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDone(c.id)}
                disabled={busyId === c.id}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-extrabold text-white hover:bg-rose-500 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
                aria-label={`Acknowledge waiter call for Table ${c.tables?.label ?? "unknown"}`}
              >
                {busyId === c.id ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Clearing...</span>
                  </span>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    <span>Acknowledge</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
