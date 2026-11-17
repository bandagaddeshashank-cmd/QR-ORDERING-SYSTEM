"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";

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
    const timer = setInterval(() => setNow(Date.now()), 5000);
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
        // network retry on next interval
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
      aria-live="polite"
      className="mb-6 rounded-2xl border-2 border-red-500 bg-red-50 p-4 shadow-lg animate-pulse-subtle"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 rounded-full bg-red-600 animate-ping" />
          <h2 className="text-lg font-black uppercase tracking-wide text-red-900">
            Waitstaff Required at Table ({calls.length})
          </h2>
        </div>
        <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white uppercase">
          Urgent Attention
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {calls.map((c) => {
          const mins = minutesSince(c.created_at, now);
          const isOverdue = mins >= 3;

          return (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-white p-3.5 border border-red-200 shadow-xs"
            >
              <div>
                <span className="text-2xl font-black text-[#193A2D]">
                  Table {c.tables?.label ?? "—"}
                </span>
                <p
                  className={`text-xs font-semibold tabular-nums ${
                    isOverdue ? "text-red-700 font-bold" : "text-[#252D38]/70"
                  }`}
                >
                  Waiting: {mins} min{mins !== 1 ? "s" : ""} ago
                </p>
              </div>

              <button
                onClick={() => handleDone(c.id)}
                disabled={busyId === c.id}
                className="h-10 rounded-xl bg-[#193A2D] px-4 font-bold text-sm text-[#E7B94F] shadow-sm hover:bg-[#122b21] active:scale-95 disabled:opacity-50 transition-all"
              >
                {busyId === c.id ? "Clearing..." : "Acknowledge"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
