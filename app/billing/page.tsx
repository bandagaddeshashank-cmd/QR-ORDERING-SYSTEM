"use client";

import { useState } from "react";
import ManagerGate from "./ManagerGate";
import { authFetch } from "../../lib/authFetch";

type Line = { name: string; price: number; qty: number; total: number };
type Bill = {
  sessionId: string;
  table: string;
  restaurant: string;
  lines: Line[];
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
  taxPercent: number;
  servicePercent: number;
  notServed: number;
  billNumber?: number;
  paymentMethod?: string;
};

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
];

const money = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BillingScreen() {
  const [table, setTable] = useState("");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (disc: string) => {
    setError("");
    setClosed(false);
    const res = await authFetch(
      `/api/billing?table=${encodeURIComponent(table)}&discount=${encodeURIComponent(disc)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) {
      setBill(null);
      return setError(data.error ?? "Something went wrong");
    }
    setBill(data);
  };

  const closeBill = async () => {
    if (!bill || busy || !method) return;
    setBusy(true);
    try {
      const res = await authFetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: bill.sessionId,
          discount: Number(discount) || 0,
          paymentMethod: method,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Something went wrong");
      setBill(data);
      setClosed(true);
    } finally {
      setBusy(false);
    }
  };

  const nextTable = () => {
    setBill(null);
    setTable("");
    setDiscount("0");
    setMethod("");
    setClosed(false);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#F2F4F1] p-5 text-[#1C2333] print:bg-white print:p-0">
      <main className="mx-auto max-w-md">
        <h1 className="mb-4 text-3xl font-bold print:hidden">Billing</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDiscount("0");
            setMethod("");
            load("0");
          }}
          className="mb-4 flex gap-2 print:hidden"
        >
          <input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="Table number, e.g. T1"
            className="h-12 min-w-0 flex-1 rounded-lg border-2 border-[#1C2333] bg-white px-3 text-lg"
          />
          <button
            type="submit"
            className="h-12 rounded-lg bg-[#1C2333] px-5 font-bold text-white"
          >
            Find bill
          </button>
        </form>

        {error && (
          <p className="mb-4 font-medium text-red-700 print:hidden">{error}</p>
        )}

        {bill && (
          <>
            {bill.notServed > 0 && !closed && (
              <p className="mb-3 rounded border border-[#E9A100] bg-[#E9A100]/15 p-2 text-sm print:hidden">
                {bill.notServed} {bill.notServed === 1 ? "order is" : "orders are"} not
                marked served yet.
              </p>
            )}

            <div
              style={{ fontFamily: "var(--font-plex), monospace" }}
              className="border border-[#1C2333]/10 bg-white px-6 py-6 text-sm print:border-0 print:px-0"
            >
              <div className="text-center">
                <p className="text-lg font-bold">{bill.restaurant}</p>
                <p>Table {bill.table}</p>
                {bill.billNumber && <p>Bill no. {bill.billNumber}</p>}
                <p className="text-[#1C2333]/60">
                  {new Date().toLocaleString("en-IN")}
                </p>
              </div>

              <hr className="my-4 border-dashed border-[#1C2333]/40" />

              <ul className="space-y-1.5">
                {bill.lines.map((l, i) => (
                  <li key={i} className="grid grid-cols-[1fr_auto] gap-3">
                    <span>
                      {l.qty} × {l.name}
                    </span>
                    <span className="tabular-nums">{money(l.total)}</span>
                  </li>
                ))}
              </ul>

              <hr className="my-4 border-dashed border-[#1C2333]/40" />

              <div className="space-y-1.5 tabular-nums">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{money(bill.subtotal)}</span>
                </div>
                {bill.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>−{money(bill.discount)}</span>
                  </div>
                )}
                {bill.servicePercent > 0 && (
                  <div className="flex justify-between">
                    <span>Service charge ({bill.servicePercent}%)</span>
                    <span>{money(bill.service)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax ({bill.taxPercent}%)</span>
                  <span>{money(bill.tax)}</span>
                </div>
              </div>

              <hr className="my-4 border-dashed border-[#1C2333]/40" />

              <div className="flex justify-between text-xl font-bold tabular-nums">
                <span>Total</span>
                <span>{money(bill.total)}</span>
              </div>

              {closed && bill.paymentMethod && (
                <p className="mt-4 text-center">
                  Paid by {METHODS.find((m) => m.id === bill.paymentMethod)?.label}
                </p>
              )}

              <p className="mt-6 text-center text-[#1C2333]/60">
                Thank you. Visit again.
              </p>
            </div>

            <div className="mt-4 space-y-3 print:hidden">
              {!closed ? (
                <>
                  <label className="flex items-center justify-between">
                    <span>Discount (₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      onBlur={() => load(discount)}
                      className="h-10 w-28 rounded border-2 border-[#1C2333]/40 bg-white px-2 text-right"
                    />
                  </label>

                  <fieldset>
                    <legend className="mb-2">How was it paid?</legend>
                    <div className="grid grid-cols-4 gap-2">
                      {METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMethod(m.id)}
                          aria-pressed={method === m.id}
                          className={`h-11 rounded-lg border-2 font-semibold ${
                            method === m.id
                              ? "border-[#1C2333] bg-[#1C2333] text-white"
                              : "border-[#1C2333]/40"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <button
                    onClick={closeBill}
                    disabled={busy || !method}
                    className="h-14 w-full rounded-lg bg-[#1C2333] text-lg font-bold text-white disabled:opacity-40"
                  >
                    {busy ? "Closing table" : "Generate bill and close table"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => window.print()}
                    className="h-14 w-full rounded-lg bg-[#1C2333] text-lg font-bold text-white"
                  >
                    Print bill
                  </button>
                  <button
                    onClick={nextTable}
                    className="h-12 w-full rounded-lg border-2 border-[#1C2333] font-bold"
                  >
                    Next table
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function Billing() {
  return (
    <ManagerGate>
      <BillingScreen />
    </ManagerGate>
  );
}