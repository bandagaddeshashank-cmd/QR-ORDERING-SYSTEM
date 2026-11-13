"use client";

import { useCallback, useEffect, useState } from "react";

type Line = { name_snapshot: string; quantity: number; note: string | null };
type Order = {
  id: string;
  status: string;
  created_at: string;
  order_items: Line[];
  table_sessions: { tables: { label: string } | null } | null;
};

const COLUMNS = [
  {
    title: "New",
    statuses: ["placed", "accepted"],
    action: "Start preparing",
    to: "preparing",
    color: "border-l-[#2F5DA8]",
    empty: "Waiting for orders.",
  },
  {
    title: "Preparing",
    statuses: ["preparing"],
    action: "Mark ready",
    to: "ready",
    color: "border-l-[#E9A100]",
    empty: "Nothing on the stove.",
  },
  {
    title: "Ready",
    statuses: ["ready"],
    action: "Mark served",
    to: "served",
    color: "border-l-[#1E8A4C]",
    empty: "Nothing waiting to be served.",
  },
];

const minutesSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

export default function Kitchen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [offline, setOffline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen", { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");
      setOrders(await res.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  const advance = async (orderId: string, status: string) => {
    setBusyId(orderId);
    try {
      await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F1] p-5 text-[#1C2333]">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Kitchen</h1>
        <p className={offline ? "font-semibold text-red-700" : "text-[#1C2333]/70"}>
          {offline
            ? "Connection lost. Retrying."
            : `${orders.length} open ${orders.length === 1 ? "order" : "orders"}`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status));
          return (
            <section key={col.title}>
              <h2 className="mb-3 border-b-2 border-[#1C2333] pb-1 text-xl font-bold">
                {col.title}{" "}
                <span className="font-normal text-[#1C2333]/60">{list.length}</span>
              </h2>
              {list.length === 0 && (
                <p className="py-4 text-[#1C2333]/50">{col.empty}</p>
              )}
              <ul className="space-y-3">
                {list.map((o) => {
                  const mins = minutesSince(o.created_at);
                  const late = mins >= 10 && col.title !== "Ready";
                  return (
                    <li key={o.id} className={`border-l-8 bg-white p-4 ${col.color}`}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-bold">
                          {o.table_sessions?.tables?.label}
                        </span>
                        <span
                          className={`text-lg font-semibold tabular-nums ${
                            late ? "text-red-700" : "text-[#1C2333]/70"
                          }`}
                        >
                          {mins} min
                        </span>
                      </div>
                      <ul className="my-3 space-y-1 text-xl">
                        {o.order_items.map((i, idx) => (
                          <li key={idx}>
                            <b className="tabular-nums">{i.quantity} ×</b>{" "}
                            {i.name_snapshot}
                            {i.note && (
                              <span className="mt-1 block rounded bg-[#F2B01E]/30 px-2 py-1 text-base font-semibold">
                                Note: {i.note}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => advance(o.id, col.to)}
                        disabled={busyId === o.id}
                        className="h-14 w-full rounded bg-[#1C2333] text-lg font-bold text-white disabled:opacity-50"
                      >
                        {col.action}
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