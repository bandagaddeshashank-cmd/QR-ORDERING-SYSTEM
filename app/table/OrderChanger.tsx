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
      aria-label={`Modify order #${order.id.slice(0, 6)}, ${clock(left)} remaining`}
      className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[#E8B95B]/60 bg-gradient-to-r from-[#E8B95B]/25 to-[#E8B95B]/15 px-3 py-1 text-xs font-bold tabular-nums text-[#173F35] hover:bg-[#E8B95B]/35 active:scale-95 transition-all cursor-pointer shadow-xs select-none"
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Modify your placed order"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 text-[#242B2A] shadow-2xl border border-[#173F35]/15 animate-slide-up">
        {/* Mobile drag handle */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-300 sm:hidden" />

        <div className="mb-4 flex items-start justify-between border-b border-[#173F35]/10 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg sm:text-xl font-bold text-[#173F35]">
                Modify Order #{order.id.slice(0, 6).toUpperCase()}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {open ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8B95B]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#173F35] border border-[#E8B95B]/40">
                  <ClockIcon className="w-3.5 h-3.5 text-[#173F35]" />
                  <span>Window Active &bull; <b className="tabular-nums font-bold">{clock(left)}</b> left</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
                  <ClockIcon className="w-3.5 h-3.5 text-rose-700" />
                  <span>Window Expired &bull; Cooking Started</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF7F0] text-[#242B2A]/70 hover:bg-[#173F35] hover:text-white cursor-pointer transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <ul className="divide-y divide-[#173F35]/10 mb-4 font-sans">
          {order.order_items.map((i) => {
            const q = qty[i.id] ?? 0;
            return (
              <li key={i.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`min-w-0 flex-1 font-semibold text-sm ${
                      q === 0 ? "text-[#242B2A]/40 line-through" : "text-[#173F35]"
                    }`}
                  >
                    {i.name_snapshot}
                    {q === 0 && (
                      <span className="block text-[10px] text-rose-600 no-underline font-medium">
                        Will be removed from order
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 rounded-xl border border-[#173F35]/20 bg-[#FAF7F0] p-0.5 shadow-xs">
                    <button
                      disabled={!open}
                      aria-label={`Reduce ${i.name_snapshot}`}
                      onClick={() => step(i.id, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-[#173F35] hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      <MinusIcon className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums text-sm text-[#173F35]">
                      {q}
                    </span>
                    <button
                      disabled={!open}
                      aria-label={`Add ${i.name_snapshot}`}
                      onClick={() => step(i.id, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-[#173F35] hover:bg-white disabled:opacity-30 cursor-pointer transition-colors"
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
                    placeholder="Instructions for chef (e.g. less spicy, no nuts)"
                    aria-label={`Note for ${i.name_snapshot}`}
                    className="mt-2 h-9 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3 text-xs text-[#242B2A] placeholder:text-[#242B2A]/40 focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
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

        <div className="space-y-2 font-sans pt-1">
          <button
            onClick={() => send("edit")}
            disabled={!open || busy || !changed}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-40 transition-all cursor-pointer border border-[#E8B95B]/40 active:scale-98"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                <span>Updating Order...</span>
              </span>
            ) : allRemoved ? (
              <span>Remove All Dishes &amp; Cancel Order</span>
            ) : (
              <span>Confirm &amp; Update Order</span>
            )}
          </button>

          <button
            onClick={() =>
              confirmingCancel ? send("cancel") : setConfirmingCancel(true)
            }
            disabled={!open || busy}
            className={`h-11 w-full rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
              confirmingCancel
                ? "bg-rose-700 text-white border-rose-800 shadow-luxury animate-pulse"
                : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
            }`}
          >
            {confirmingCancel
              ? "Are you sure? Click to Confirm Cancellation"
              : "Cancel Entire Order"}
          </button>

          <button
            onClick={onClose}
            className="h-9 w-full rounded-xl text-xs font-medium text-[#242B2A]/60 hover:text-[#242B2A] hover:bg-[#173F35]/5 cursor-pointer transition-colors"
          >
            Keep Order Unchanged
          </button>
        </div>
      </div>
    </div>
  );
}
