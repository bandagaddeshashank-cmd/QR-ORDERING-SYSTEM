"use client";

import { useEffect, useState, useCallback, useId } from "react";
import ManagerGate from "./ManagerGate";
import { authFetch } from "@/lib/authFetch";
import type { PaymentMethod, Bill, BillLine } from "@/lib/types";

type TableCard = {
  id: string;
  label: string;
  hasOpenSession: boolean;
  sessionId: string | null;
  openedAt: string | null;
  orderCount: number;
  unservedCount: number;
  estimatedSubtotal: number;
};

type OverviewData = {
  restaurant: {
    id: string;
    name: string;
    gstin: string | null;
    taxPercent: number;
    servicePercent: number;
  };
  tables: TableCard[];
  todaySummary: {
    totalSales: number;
    billsCount: number;
    totalTax: number;
    totalDiscounts: number;
    averageOrderValue: number;
    paymentBreakdown: Record<PaymentMethod, number>;
  };
  recentBills: {
    id: string;
    billNumber: number;
    table: string;
    subtotal: number;
    discount: number;
    serviceCharge: number;
    tax: number;
    total: number;
    paymentMethod: PaymentMethod;
    createdAt: string;
  }[];
};

const METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "upi", label: "UPI / QR", icon: "📱" },
  { id: "card", label: "Credit/Debit Card", icon: "💳" },
  { id: "other", label: "Other", icon: "🧾" },
];

const money = (n: number) =>
  "₹" +
  (n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function BillingDashboard() {
  const discountInputId = useId();
  const [tab, setTab] = useState<"overview" | "settle" | "history">("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Active bill state
  const [searchTable, setSearchTable] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [currentBill, setCurrentBill] = useState<Bill | null>(null);
  const [settledBill, setSettledBill] = useState<Bill | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadOverview = useCallback(async () => {
    try {
      const res = await authFetch("/api/billing?mode=overview", {
        cache: "no-store",
      });
      if (res.ok) {
        const data: OverviewData = await res.json();
        setOverview(data);
        setLoadingOverview(false);
      }
    } catch (err) {
      console.error("Failed to fetch billing overview:", err);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    const fetchOverview = async () => {
      try {
        const res = await authFetch("/api/billing?mode=overview", {
          cache: "no-store",
        });
        if (res.ok && isSubscribed) {
          const data: OverviewData = await res.json();
          setOverview(data);
          setLoadingOverview(false);
        }
      } catch (err) {
        console.error("Failed to fetch billing overview:", err);
      }
    };

    fetchOverview();
    const timer = setInterval(fetchOverview, 8000);
    return () => {
      isSubscribed = false;
      clearInterval(timer);
    };
  }, []);


  const loadBill = async (opts: { table?: string; sessionId?: string; disc?: string }) => {
    setError("");
    setSuccessMsg("");
    setSettledBill(null);

    const discValue = opts.disc !== undefined ? opts.disc : discount;
    let url = `/api/billing?discount=${encodeURIComponent(discValue)}`;
    if (opts.sessionId) {
      url += `&sessionId=${encodeURIComponent(opts.sessionId)}`;
    } else if (opts.table) {
      url += `&table=${encodeURIComponent(opts.table)}`;
    } else if (activeSessionId) {
      url += `&sessionId=${encodeURIComponent(activeSessionId)}`;
    } else if (searchTable) {
      url += `&table=${encodeURIComponent(searchTable)}`;
    } else {
      return;
    }

    try {
      setBusy(true);
      const res = await authFetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setCurrentBill(null);
        setError(data.error ?? "Failed to retrieve table bill.");
        return;
      }

      setCurrentBill(data);
      setActiveSessionId(data.sessionId);
      setSearchTable(data.table);
      setTab("settle");
    } catch {
      setError("Network error loading bill.");
    } finally {
      setBusy(false);
    }
  };

  const handleSettleBill = async () => {
    if (!currentBill || !paymentMethod || busy) return;
    setBusy(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await authFetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentBill.sessionId,
          discount: Number(discount) || 0,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate bill.");
        return;
      }

      setSettledBill(data);
      setCurrentBill(null);
      setSuccessMsg(`Bill #${data.billNumber} generated successfully. Table session closed.`);
      loadOverview();
    } catch {
      setError("Failed to record settlement. Please verify connection.");
    } finally {
      setBusy(false);
    }
  };

  const resetToOverview = () => {
    setCurrentBill(null);
    setSettledBill(null);
    setSearchTable("");
    setActiveSessionId(null);
    setDiscount("0");
    setPaymentMethod("");
    setError("");
    setSuccessMsg("");
    setTab("overview");
  };

  const activeDisplayBill = settledBill || currentBill;

  return (
    <div className="min-h-screen bg-[#F8F5EF] p-4 sm:p-6 text-[#252D38] print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl">
        {/* Navigation Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#252D38]/10 pb-4 print:hidden">
          <div>
            <h1 className="text-3xl font-black text-[#193A2D]">Billing & Revenue</h1>
            <p className="text-xs font-semibold text-[#252D38]/70 mt-0.5">
              {overview?.restaurant.name ?? "Restaurant"} · Operations Desk
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("overview")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs ${
                tab === "overview"
                  ? "bg-[#193A2D] text-[#E7B94F]"
                  : "bg-white text-[#252D38] hover:bg-stone-50 border border-[#252D38]/15"
              }`}
            >
              📊 Tables & Metrics
            </button>
            <button
              onClick={() => setTab("settle")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs ${
                tab === "settle"
                  ? "bg-[#193A2D] text-[#E7B94F]"
                  : "bg-white text-[#252D38] hover:bg-stone-50 border border-[#252D38]/15"
              }`}
            >
              🧾 Settle Bill {currentBill ? `(Table ${currentBill.table})` : ""}
            </button>
            <button
              onClick={() => setTab("history")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs ${
                tab === "history"
                  ? "bg-[#193A2D] text-[#E7B94F]"
                  : "bg-white text-[#252D38] hover:bg-stone-50 border border-[#252D38]/15"
              }`}
            >
              📑 Bill History
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3.5 text-xs font-bold text-red-700 border border-red-200 print:hidden"
          >
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 border border-emerald-300 print:hidden"
          >
            ✓ {successMsg}
          </div>
        )}

        {/* TAB 1: OVERVIEW & ACTIVE TABLES */}
        {tab === "overview" && (
          <div className="space-y-6 print:hidden">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 border border-[#252D38]/10 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-[#252D38]/60">
                  Today&apos;s Revenue
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-[#193A2D] tabular-nums">
                  {money(overview?.todaySummary.totalSales ?? 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                  {overview?.todaySummary.billsCount ?? 0} bills settled today
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 border border-[#252D38]/10 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-[#252D38]/60">
                  Active Dining Tables
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-[#193A2D] tabular-nums">
                  {overview?.tables.filter((t) => t.hasOpenSession).length ?? 0}
                  <span className="text-base font-normal text-[#252D38]/50">
                    {" "}
                    / {overview?.tables.length ?? 0}
                  </span>
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#252D38]/70">
                  Current occupied dining capacity
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 border border-[#252D38]/10 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-[#252D38]/60">
                  Average Order Value
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-[#193A2D] tabular-nums">
                  {money(overview?.todaySummary.averageOrderValue ?? 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#252D38]/70">
                  Average revenue per table
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 border border-[#252D38]/10 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-[#252D38]/60">
                  Tax Collected (GST)
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-[#193A2D] tabular-nums">
                  {money(overview?.todaySummary.totalTax ?? 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#252D38]/70">
                  Discounts given: {money(overview?.todaySummary.totalDiscounts ?? 0)}
                </p>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="rounded-2xl bg-white p-5 border border-[#252D38]/10 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#252D38]/60 mb-3">
                Payment Collection Breakdown (Today)
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {METHODS.map((m) => {
                  const val = overview?.todaySummary.paymentBreakdown[m.id] ?? 0;
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl bg-[#F8F5EF] p-3 border border-[#252D38]/10"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#252D38]/80">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </div>
                      <p className="mt-1.5 text-lg font-bold text-[#193A2D] tabular-nums">
                        {money(val)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Table Grid */}
            <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-[#193A2D]">
                    Restaurant Tables Grid
                  </h2>
                  <p className="text-xs text-[#252D38]/70">
                    Tap any occupied table to open itemized bill and settle payment
                  </p>
                </div>
                <button
                  onClick={() => loadOverview()}
                  className="rounded-lg border border-[#252D38]/20 bg-[#F8F5EF] px-3 py-1.5 text-xs font-bold hover:bg-[#252D38]/10"
                >
                  Refresh Grid
                </button>
              </div>

              {loadingOverview && (
                <div className="py-12 text-center text-sm text-[#252D38]/60">
                  Loading tables...
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {(overview?.tables ?? []).map((tbl) => {
                  const isOccupied = tbl.hasOpenSession;
                  const hasUnserved = tbl.unservedCount > 0;

                  return (
                    <button
                      key={tbl.id}
                      onClick={() => {
                        if (isOccupied && tbl.sessionId) {
                          loadBill({ sessionId: tbl.sessionId });
                        }
                      }}
                      className={`flex flex-col justify-between rounded-2xl p-4 text-left border transition-all ${
                        isOccupied
                          ? "border-[#193A2D] bg-[#193A2D]/5 hover:bg-[#193A2D]/10 hover:shadow-md cursor-pointer"
                          : "border-stone-200 bg-stone-50/60 opacity-60 cursor-default"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xl font-black text-[#193A2D]">
                          {tbl.label}
                        </span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isOccupied
                              ? hasUnserved
                                ? "bg-amber-500 animate-pulse"
                                : "bg-emerald-600"
                              : "bg-stone-300"
                          }`}
                        />
                      </div>

                      <div className="mt-3">
                        {isOccupied ? (
                          <>
                            <p className="text-xs font-bold text-[#193A2D] tabular-nums">
                              Est: {money(tbl.estimatedSubtotal)}
                            </p>
                            <p className="text-[11px] font-semibold text-[#252D38]/70">
                              {tbl.orderCount} order{tbl.orderCount !== 1 ? "s" : ""}
                              {hasUnserved && (
                                <span className="block text-amber-800 font-bold">
                                  ⏳ {tbl.unservedCount} unserved
                                </span>
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs font-medium text-stone-500">Vacant</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SETTLE BILL & PRINTABLE RECEIPT */}
        {tab === "settle" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            {/* Left Column: Table Finder & Payment Form */}
            <div className="space-y-5 print:hidden">
              {/* Table Search Header */}
              <div className="rounded-2xl bg-white p-5 border border-[#252D38]/10 shadow-xs">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#193A2D] mb-3">
                  Find Table Bill
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchTable.trim()) {
                      loadBill({ table: searchTable.trim(), disc: "0" });
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={searchTable}
                    onChange={(e) => setSearchTable(e.target.value)}
                    placeholder="Enter table label (e.g. T1, Table 2)"
                    className="h-12 min-w-0 flex-1 rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-base font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || !searchTable.trim()}
                    className="h-12 rounded-xl bg-[#193A2D] px-5 font-bold text-sm text-[#E7B94F] shadow-xs hover:bg-[#122b21] disabled:opacity-50 transition-all"
                  >
                    {busy ? "Loading..." : "Load Bill"}
                  </button>
                </form>
              </div>

              {/* Settlement Form (if bill loaded and not yet closed) */}
              {currentBill && (
                <div className="rounded-2xl bg-white p-6 border border-[#252D38]/10 shadow-sm space-y-5">
                  <h2 className="text-base font-bold text-[#193A2D]">
                    Bill Settlement: Table {currentBill.table}
                  </h2>

                  {/* Unserved warning banner */}
                  {currentBill.notServed > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 font-semibold">
                      ⚠️ <b>Notice:</b> {currentBill.notServed} order(s) for this table have not been marked as served by the kitchen.
                    </div>
                  )}

                  {/* Discount adjustment */}
                  <div>
                    <label
                      htmlFor={discountInputId}
                      className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1"
                    >
                      Discount Amount (₹)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={discountInputId}
                        type="number"
                        min="0"
                        max={currentBill.subtotal}
                        step="1"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="h-11 w-36 rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3 text-right font-bold tabular-nums text-base focus:border-[#193A2D] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => loadBill({ disc: discount })}
                        className="h-11 rounded-xl border border-[#252D38]/20 bg-stone-50 px-4 text-xs font-bold hover:bg-stone-100"
                      >
                        Apply Discount
                      </button>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-2">
                      Select Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex flex-col items-center justify-center rounded-xl p-3 border text-xs font-bold transition-all shadow-xs ${
                            paymentMethod === m.id
                              ? "border-[#193A2D] bg-[#193A2D] text-[#E7B94F]"
                              : "border-[#252D38]/20 bg-[#F8F5EF] text-[#252D38] hover:bg-stone-100"
                          }`}
                        >
                          <span className="text-xl mb-1">{m.icon}</span>
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleSettleBill}
                    disabled={busy || !paymentMethod}
                    className="h-14 w-full rounded-xl bg-[#193A2D] text-base font-bold text-[#E7B94F] shadow-lg hover:bg-[#122b21] disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {busy
                      ? "Recording Settlement..."
                      : `Settle & Close Table (${money(currentBill.total)})`}
                  </button>
                </div>
              )}

              {/* Success / Next table button */}
              {settledBill && (
                <div className="rounded-2xl bg-white p-6 border border-emerald-300 shadow-sm text-center space-y-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#193A2D]">
                      Table Settled Successfully
                    </h3>
                    <p className="text-xs text-[#252D38]/70 mt-1">
                      Bill #{settledBill.billNumber} created. Session closed and table is now vacant.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => window.print()}
                      className="h-11 rounded-xl bg-[#193A2D] px-6 text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21]"
                    >
                      🖨️ Print Customer Invoice
                    </button>
                    <button
                      onClick={resetToOverview}
                      className="h-11 rounded-xl border border-[#252D38]/20 bg-stone-50 px-6 text-xs font-bold text-[#252D38] hover:bg-stone-100"
                    >
                      Next Table →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Thermal Receipt Preview / Printable Invoice */}
            <div>
              {activeDisplayBill ? (
                <div className="rounded-3xl border border-[#252D38]/15 bg-white p-6 shadow-xl print:border-0 print:p-0">
                  <div className="flex items-center justify-between border-b border-[#252D38]/10 pb-3 mb-4 print:hidden">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#193A2D]">
                      Invoice Preview
                    </span>
                    <button
                      onClick={() => window.print()}
                      className="rounded-lg bg-[#193A2D] px-3 py-1.5 text-xs font-bold text-[#E7B94F]"
                    >
                      🖨️ Print
                    </button>
                  </div>

                  {/* Standard Restaurant 80mm Thermal Receipt */}
                  <div className="font-mono text-xs text-[#252D38] leading-tight space-y-3">
                    <div className="text-center space-y-1">
                      <p className="text-base font-bold uppercase tracking-wide">
                        {activeDisplayBill.restaurant}
                      </p>
                      {activeDisplayBill.gstin && (
                        <p className="text-[11px] text-[#252D38]/70">
                          GSTIN: {activeDisplayBill.gstin}
                        </p>
                      )}
                      <p className="text-sm font-bold">
                        Table {activeDisplayBill.table}
                      </p>
                      {activeDisplayBill.billNumber && (
                        <p className="font-bold">
                          TAX INVOICE #{activeDisplayBill.billNumber}
                        </p>
                      )}
                      <p className="text-[11px] text-[#252D38]/60">
                        Date: {new Date().toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="border-t border-dashed border-[#252D38]/40 pt-2 pb-1">
                      <div className="flex justify-between font-bold text-[11px] mb-1">
                        <span>ITEM / QTY</span>
                        <span>AMOUNT</span>
                      </div>
                      <ul className="space-y-1">
                        {activeDisplayBill.lines.map((l: BillLine, i: number) => (
                          <li key={i} className="flex justify-between">
                            <span className="truncate pr-2">
                              {l.qty} × {l.name}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {money(l.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t border-dashed border-[#252D38]/40 pt-2 space-y-1 tabular-nums">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{money(activeDisplayBill.subtotal)}</span>
                      </div>
                      {activeDisplayBill.discount > 0 && (
                        <div className="flex justify-between text-emerald-800">
                          <span>Discount</span>
                          <span>−{money(activeDisplayBill.discount)}</span>
                        </div>
                      )}
                      {activeDisplayBill.servicePercent > 0 && (
                        <div className="flex justify-between">
                          <span>Service Charge ({activeDisplayBill.servicePercent}%)</span>
                          <span>{money(activeDisplayBill.service)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>GST ({activeDisplayBill.taxPercent}%)</span>
                        <span>{money(activeDisplayBill.tax)}</span>
                      </div>
                    </div>

                    <div className="border-t-2 border-[#252D38] pt-2 flex justify-between text-base font-black tabular-nums">
                      <span>TOTAL PAYABLE</span>
                      <span>{money(activeDisplayBill.total)}</span>
                    </div>

                    {activeDisplayBill.paymentMethod && (
                      <div className="border-t border-dashed border-[#252D38]/40 pt-2 text-center font-bold uppercase text-[11px]">
                        PAID VIA: {activeDisplayBill.paymentMethod}
                      </div>
                    )}

                    <div className="text-center pt-3 text-[11px] text-[#252D38]/60 border-t border-dashed border-[#252D38]/40">
                      <p>Thank you for dining with us!</p>
                      <p>Have a wonderful day.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[#252D38]/20 bg-white/50 p-12 text-center text-sm text-[#252D38]/50 print:hidden">
                  <span className="text-3xl block mb-2">🧾</span>
                  Select an active dining table or enter a table label to generate the invoice preview.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BILL HISTORY */}
        {tab === "history" && (
          <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm print:hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-[#193A2D]">
                  Today&apos;s Settled Bills ({overview?.recentBills.length ?? 0})
                </h2>
                <p className="text-xs text-[#252D38]/70">
                  Complete audit log of finalized receipts and settlements
                </p>
              </div>
              <button
                onClick={() => loadOverview()}
                className="rounded-lg border border-[#252D38]/20 bg-[#F8F5EF] px-3 py-1.5 text-xs font-bold hover:bg-[#252D38]/10"
              >
                Refresh Log
              </button>
            </div>

            {(overview?.recentBills.length ?? 0) === 0 ? (
              <p className="py-12 text-center text-sm text-[#252D38]/50">
                No bills settled yet today.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#252D38]/15 text-[#252D38]/60 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 pr-3">Bill #</th>
                      <th className="py-2.5 px-3">Table</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right">Tax</th>
                      <th className="py-2.5 pl-3 text-right">Final Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252D38]/10 font-medium">
                    {overview?.recentBills.map((b) => (
                      <tr key={b.id} className="hover:bg-stone-50">
                        <td className="py-3 pr-3 font-bold text-[#193A2D]">
                          #{b.billNumber}
                        </td>
                        <td className="py-3 px-3 font-semibold">Table {b.table}</td>
                        <td className="py-3 px-3 text-[#252D38]/70">
                          {new Date(b.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-3 uppercase text-[11px] font-bold text-[#193A2D]">
                          {b.paymentMethod}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {money(b.subtotal)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-emerald-800">
                          {b.discount > 0 ? `−${money(b.discount)}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {money(b.tax)}
                        </td>
                        <td className="py-3 pl-3 text-right font-black tabular-nums text-[#193A2D] text-sm">
                          {money(b.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <ManagerGate>
      <BillingDashboard />
    </ManagerGate>
  );
}
