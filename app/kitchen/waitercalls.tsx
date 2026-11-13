"use client";

import { useCallback, useEffect, useState } from "react";

type Call = {
  id: string;
  created_at: string;
  tables: { label: string } | null;
};

const minutesSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

export default function WaiterCalls() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/waiter", { cache: "no-store" });
      if (res.ok) setCalls(await res.json());
    } catch {
      // ignore, the next check will retry
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  const done = async (callId: string) => {
    setBusyId(callId);
    try {
      await fetch("/api/waiter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (calls.length === 0) return null;

  return (
    <section
      aria-live="polite"
      className="mb-5 border-l-8 border-l-red-700 bg-white p-4"
    >
      <h2 className="mb-2 text-xl font-bold">Waiter needed</h2>
      <ul className="space-y-2">
        {calls.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3">
            <span className="text-2xl font-bold">Table {c.tables?.label}</span>
            <span className="tabular-nums text-[#1C2333]/70">
              {minutesSince(c.created_at)} min
            </span>
            <button
              onClick={() => done(c.id)}
              disabled={busyId === c.id}
              className="h-11 rounded bg-[#1C2333] px-5 font-bold text-white disabled:opacity-50"
            >
              Done
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}