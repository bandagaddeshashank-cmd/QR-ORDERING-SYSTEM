"use client";

import { useEffect, useState } from "react";

export type EditableOrder = {
  id: string;
  edit_seconds_left: number;
  order_items: {
    id: string;
    name_snapshot: string;
    quantity: number;
    note: string | null;
  }[];
};

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Counts down from the server's figure, so the phone's own clock doesn't matter
function useSecondsLeft(order: EditableOrder, fetchedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  return Math.max(0, order.edit_seconds_left - elapsed);
}

export function ChangeButton({
  order,
  fetchedAt,
  onOpen,
}: {
  order: EditableOrder;
  fetchedAt: number;
  onOpen: () => void;
}) {
  const left = useSecondsLeft(order, fetchedAt);
  if (left <= 0) return null;
  return (
    <button
      onClick={onOpen}
      className="shrink-0 rounded-full border-2 border-[#14511D] px-3 py-0.5 text-xs font-semibold tabular-nums text-[#14511D]"
    >
      Change · {clock(left)}
    </button>
  );
}

export function OrderEditor({
  token,
  order,
  fetchedAt,
  onClose,
  onChanged,
}: {
  token: string;
  order: EditableOrder;
  fetchedAt: number;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const left = useSecondsLeft(order, fetchedAt);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.order_items.map((i) => [i.id, i.quantity]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.order_items.map((i) => [i.id, i.note ?? ""]))
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const open = left > 0;
  const changed = order.order_items.some(
    (i) =>
      (qty[i.id] ?? 0) !== i.quantity ||
      (notes[i.id] ?? "").trim() !== (i.note ?? "")
  );
  const allRemoved = order.order_items.every((i) => (qty[i.id] ?? 0) === 0);

  const step = (id: string, diff: number) => {
    setConfirming(false);
    setQty((q) => ({
      ...q,
      [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + diff)),
    }));
  };

  const send = async (action: "edit" | "cancel") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/order-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          orderId: order.id,
          action,
          items: order.order_items.map((i) => ({
            id: i.id,
            quantity: qty[i.id] ?? 0,
            note: notes[i.id] ?? "",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change the order.");
        return;
      }
      onChanged(
        action === "cancel" || data.cancelled
          ? "Order cancelled."
          : "Order updated. The kitchen can see the change."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Change your order"
    >
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 text-[#1C2333]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Change your order</h2>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 text-2xl">
            ×
          </button>
        </div>

        {open ? (
          <p className="mb-3 text-sm text-[#1C2333]/70">
            You can change this for{" "}
            <b className="tabular-nums">{clock(left)}</b>, as long as the kitchen
            hasn&apos;t started it.
          </p>
        ) : (
          <p className="mb-3 rounded bg-[#F2B01E]/30 p-2 text-sm font-medium">
            The kitchen has started this order, or the change time is over. It
            can&apos;t be changed now.
          </p>
        )}

        <ul className="divide-y divide-[#1C2333]/15">
          {order.order_items.map((i) => {
            const q = qty[i.id] ?? 0;
            return (
              <li key={i.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`min-w-0 flex-1 font-semibold ${
                      q === 0 ? "text-[#1C2333]/40 line-through" : ""
                    }`}
                  >
                    {i.name_snapshot}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      disabled={!open}
                      aria-label={`Remove one ${i.name_snapshot}`}
                      onClick={() => step(i.id, -1)}
                      className="h-9 w-9 rounded border border-[#1C2333]/40 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{q}</span>
                    <button
                      disabled={!open}
                      aria-label={`Add one ${i.name_snapshot}`}
                      onClick={() => step(i.id, 1)}
                      className="h-9 w-9 rounded border border-[#1C2333]/40 disabled:opacity-40"
                    >
                      +
                    </button>
                  </span>
                </div>
                {q > 0 && (
                  <input
                    type="text"
                    maxLength={150}
                    disabled={!open}
                    value={notes[i.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [i.id]: e.target.value }))
                    }
                    placeholder="Note for kitchen"
                    aria-label={`Note for ${i.name_snapshot}`}
                    className="mt-2 h-10 w-full rounded-lg border-2 border-[#1C2333]/30 bg-white px-3 text-base disabled:opacity-50"
                  />
                )}
              </li>
            );
          })}
        </ul>

        {error && <p className="mt-3 font-medium text-red-700">{error}</p>}

        <div className="mt-4 space-y-2">
          <button
            onClick={() => send("edit")}
            disabled={!open || busy || !changed}
            className="h-12 w-full rounded-lg bg-[#1C2333] font-bold text-white disabled:opacity-40"
          >
            {busy
              ? "Saving"
              : allRemoved
              ? "Remove all and cancel order"
              : "Save changes"}
          </button>
          <button
            onClick={() => (confirming ? send("cancel") : setConfirming(true))}
            disabled={!open || busy}
            className="h-12 w-full rounded-lg border-2 border-red-700 font-bold text-red-700 disabled:opacity-40"
          >
            {confirming ? "Yes, cancel the whole order" : "Cancel whole order"}
          </button>
          <button onClick={onClose} className="h-12 w-full rounded-lg font-semibold">
            Keep order as it is
          </button>
        </div>
        <p className="mt-3 text-xs text-[#1C2333]/60">
          To add or swap a dish, close this and order it as a new order.
        </p>
      </div>
    </div>
  );
}