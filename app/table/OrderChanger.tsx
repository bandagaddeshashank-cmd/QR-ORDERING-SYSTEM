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

// Counts down from the server's figure
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
      className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[#193A2D] bg-[#193A2D]/10 px-3 py-1 text-xs font-semibold tabular-nums text-[#193A2D] hover:bg-[#193A2D]/20 active:scale-95 transition-all"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#E7B94F] animate-ping" />
      Edit · {clock(left)}
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
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState("");

  const open = left > 0;
  const changed = order.order_items.some(
    (i) =>
      (qty[i.id] ?? 0) !== i.quantity ||
      (notes[i.id] ?? "").trim() !== (i.note ?? "")
  );
  const allRemoved = order.order_items.every((i) => (qty[i.id] ?? 0) === 0);

  const step = (id: string, diff: number) => {
    setConfirmingCancel(false);
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
          ? "Order cancelled successfully."
          : "Order updated. Kitchen is notified."
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Modify your placed order"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#F8F5EF] p-6 text-[#252D38] shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-[#252D38]/10 pb-3">
          <div>
            <h2 className="text-xl font-bold text-[#193A2D]">Modify Order</h2>
            <p className="text-xs text-[#252D38]/70 mt-0.5">
              {open ? (
                <span>
                  Change window active: <b className="text-[#193A2D] tabular-nums font-semibold">{clock(left)}</b> remaining
                </span>
              ) : (
                <span className="text-red-700 font-semibold">Change window expired</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#252D38]/5 text-2xl text-[#252D38]/70 hover:bg-[#252D38]/10"
          >
            ×
          </button>
        </div>

        <ul className="divide-y divide-[#252D38]/10 mb-4">
          {order.order_items.map((i) => {
            const q = qty[i.id] ?? 0;
            return (
              <li key={i.id} className="py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`min-w-0 flex-1 font-semibold text-sm ${
                      q === 0 ? "text-[#252D38]/40 line-through" : "text-[#252D38]"
                    }`}
                  >
                    {i.name_snapshot}
                  </span>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#252D38]/20 bg-white p-1">
                    <button
                      disabled={!open}
                      aria-label={`Reduce ${i.name_snapshot}`}
                      onClick={() => step(i.id, -1)}
                      className="h-8 w-8 rounded text-lg font-bold text-[#193A2D] hover:bg-[#193A2D]/10 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums text-sm">
                      {q}
                    </span>
                    <button
                      disabled={!open}
                      aria-label={`Add ${i.name_snapshot}`}
                      onClick={() => step(i.id, 1)}
                      className="h-8 w-8 rounded text-lg font-bold text-[#193A2D] hover:bg-[#193A2D]/10 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
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
                    placeholder="Preparation note for kitchen"
                    aria-label={`Note for ${i.name_snapshot}`}
                    className="mt-2.5 h-10 w-full rounded-lg border border-[#252D38]/20 bg-white px-3 text-sm focus:border-[#193A2D] focus:outline-none"
                  />
                )}
              </li>
            );
          })}
        </ul>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={() => send("edit")}
            disabled={!open || busy || !changed}
            className="h-12 w-full rounded-xl bg-[#193A2D] font-bold text-[#F8F5EF] shadow-md hover:bg-[#122b21] disabled:opacity-40 transition-all"
          >
            {busy
              ? "Updating..."
              : allRemoved
              ? "Remove All & Cancel Order"
              : "Confirm Changes"}
          </button>

          <button
            onClick={() =>
              confirmingCancel ? send("cancel") : setConfirmingCancel(true)
            }
            disabled={!open || busy}
            className="h-12 w-full rounded-xl border-2 border-red-700 font-bold text-red-700 hover:bg-red-50 disabled:opacity-40 transition-all"
          >
            {confirmingCancel
              ? "Confirm: Yes, Cancel Order"
              : "Cancel Entire Order"}
          </button>

          <button
            onClick={onClose}
            className="h-11 w-full rounded-xl font-semibold text-[#252D38]/70 hover:text-[#252D38]"
          >
            Keep Order Unchanged
          </button>
        </div>
      </div>
    </div>
  );
}
