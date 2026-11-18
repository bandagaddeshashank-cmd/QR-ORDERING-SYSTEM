"use client";

import { useEffect, useState } from "react";
import {
  PencilIcon,
  CloseIcon,
  PlusIcon,
  MinusIcon,
  ClockIcon,
  AlertCircleIcon,
} from "@/components/ui/icons";

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
      className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[#E8B95B]/40 bg-[#E8B95B]/15 px-3 py-1 text-xs font-semibold tabular-nums text-[#173F35] hover:bg-[#E8B95B]/25 active:scale-95 transition-all cursor-pointer shadow-xs"
    >
      <PencilIcon className="w-3 h-3 text-[#173F35]" />
      <span>Edit &middot; {clock(left)}</span>
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF7F0] p-6 text-[#242B2A] shadow-2xl border border-[#173F35]/10">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300 sm:hidden" />
        <div className="mb-4 flex items-center justify-between border-b border-[#173F35]/10 pb-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#173F35]">Modify Order</h2>
            <p className="text-xs text-[#242B2A]/70 mt-0.5 flex items-center gap-1.5 font-sans">
              {open ? (
                <span>
                  Change window active: <b className="text-[#173F35] tabular-nums font-semibold">{clock(left)}</b> remaining
                </span>
              ) : (
                <span className="text-rose-700 font-semibold flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" /> Change window expired
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173F35]/5 text-[#242B2A]/70 hover:bg-[#173F35]/10 cursor-pointer transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <ul className="divide-y divide-[#173F35]/10 mb-4 font-sans">
          {order.order_items.map((i) => {
            const q = qty[i.id] ?? 0;
            return (
              <li key={i.id} className="py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`min-w-0 flex-1 font-medium text-sm ${
                      q === 0 ? "text-[#242B2A]/40 line-through" : "text-[#242B2A]"
                    }`}
                  >
                    {i.name_snapshot}
                  </span>
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#173F35]/20 bg-white p-1 shadow-xs">
                    <button
                      disabled={!open}
                      aria-label={`Reduce ${i.name_snapshot}`}
                      onClick={() => step(i.id, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded text-base font-bold text-[#173F35] hover:bg-[#173F35]/10 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      <MinusIcon className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-semibold tabular-nums text-sm text-[#173F35]">
                      {q}
                    </span>
                    <button
                      disabled={!open}
                      aria-label={`Add ${i.name_snapshot}`}
                      onClick={() => step(i.id, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded text-base font-bold text-[#173F35] hover:bg-[#173F35]/10 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
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
                    placeholder="Preparation note for culinary team"
                    aria-label={`Note for ${i.name_snapshot}`}
                    className="mt-2.5 h-10 w-full rounded-xl border border-[#173F35]/15 bg-white px-3.5 text-xs text-[#242B2A] placeholder:text-[#242B2A]/40 focus:border-[#173F35] focus:ring-1 focus:ring-[#173F35] focus:outline-none transition-all"
                  />
                )}
              </li>
            );
          })}
        </ul>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 shrink-0 text-rose-700" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2.5 font-sans">
          <button
            onClick={() => send("edit")}
            disabled={!open || busy || !changed}
            className="h-12 w-full rounded-xl bg-[#173F35] font-semibold text-[#FAF7F0] shadow-luxury hover:bg-[#102e26] hover:text-[#E8B95B] disabled:opacity-40 transition-all cursor-pointer"
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
            className="h-12 w-full rounded-xl border border-rose-300 bg-rose-50/50 font-semibold text-rose-800 hover:bg-rose-100/70 disabled:opacity-40 transition-all cursor-pointer"
          >
            {confirmingCancel
              ? "Confirm: Yes, Cancel Order"
              : "Cancel Entire Order"}
          </button>

          <button
            onClick={onClose}
            className="h-11 w-full rounded-xl font-medium text-xs text-[#242B2A]/70 hover:text-[#242B2A] hover:bg-[#173F35]/5 cursor-pointer transition-colors"
          >
            Keep Order Unchanged
          </button>
        </div>
      </div>
    </div>
  );
}
