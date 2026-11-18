"use client";

import { useEffect, useState, useCallback, useId } from "react";
import Link from "next/link";
import ManagerGate from "./ManagerGate";
import ReceiptPreview from "./ReceiptPreview";
import { TableCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { authFetch } from "@/lib/authFetch";
import type { PaymentMethod, Bill } from "@/lib/types";
import {
  CashIcon,
  QrCodeIcon,
  CreditCardIcon,
  ReceiptIcon,
  ClockIcon,
  PrinterIcon,
  AlertCircleIcon,
  CheckIcon,
  ArrowRightIcon,
  RefreshCwIcon,
  SearchIcon,
  ChefHatIcon,
  GridIcon,
  SparklesIcon,
  CloseIcon,
} from "@/components/ui/icons";

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

const METHODS: {
  id: PaymentMethod;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "cash", label: "Cash Desk", description: "Physical cash drawer", Icon: CashIcon },
  { id: "upi", label: "UPI & QR", description: "Instant QR / Google Pay / PhonePe", Icon: QrCodeIcon },
  { id: "card", label: "Card POS", description: "Credit / Debit POS terminal", Icon: CreditCardIcon },
  { id: "other", label: "Other / Ledger", description: "Voucher / Account charge", Icon: ReceiptIcon },
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

  // Active Bill & Settlement State
  const [searchTable, setSearchTable] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [tenderCash, setTenderCash] = useState<string>("");
  const [currentBill, setCurrentBill] = useState<Bill | null>(null);
  const [settledBill, setSettledBill] = useState<Bill | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Table filter
  const [tableFilter, setTableFilter] = useState<"all" | "occupied" | "vacant">("all");
  const [historySearch, setHistorySearch] = useState("");

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

  // Polling for live table status updates
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
    const timer = setInterval(fetchOverview, 6000);
    return () => {
      isSubscribed = false;
      clearInterval(timer);
    };
  }, []);

  // Authoritative Bill Fetch
  const loadBill = async (opts: { table?: string; sessionId?: string; disc?: string }) => {
    setError(null);
    setSuccessMsg(null);
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
      setTenderCash(String(Math.ceil(data.total)));
      setTab("settle");
    } catch {
      setError("Network error loading table bill.");
    } finally {
      setBusy(false);
    }
  };

  // Settle Bill via POST
  const handleSettleBill = async () => {
    if (!currentBill || !paymentMethod || busy) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

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
        setError(data.error ?? "Failed to process bill settlement.");
        return;
      }

      setSettledBill(data);
      setCurrentBill(null);
      setSuccessMsg(`Invoice #${data.billNumber} finalized. Table session closed.`);
      loadOverview();
    } catch {
      setError("Failed to record settlement. Please verify database connectivity.");
    } finally {
      setBusy(false);
    }
  };

  // Quick Preset Discounts
  const applyPresetDiscount = (amount: number) => {
    const safeAmount = Math.max(0, Math.min(amount, currentBill?.subtotal || 0));
    setDiscount(String(safeAmount));
    loadBill({ disc: String(safeAmount) });
  };

  const applyPercentDiscount = (percent: number) => {
    if (!currentBill) return;
    const calc = Math.round((currentBill.subtotal * (percent / 100)) * 100) / 100;
    setDiscount(String(calc));
    loadBill({ disc: String(calc) });
  };

  const resetToOverview = () => {
    setCurrentBill(null);
    setSettledBill(null);
    setSearchTable("");
    setActiveSessionId(null);
    setDiscount("0");
    setPaymentMethod("");
    setTenderCash("");
    setError(null);
    setSuccessMsg(null);
    setTab("overview");
  };

  const activeDisplayBill = settledBill || currentBill;

  // Filter Tables
  const occupiedTables = overview?.tables.filter((t) => t.hasOpenSession) || [];
  const vacantTables = overview?.tables.filter((t) => !t.hasOpenSession) || [];
  const filteredTables = (overview?.tables || []).filter((t) => {
    if (tableFilter === "occupied") return t.hasOpenSession;
    if (tableFilter === "vacant") return !t.hasOpenSession;
    return true;
  });

  // Filter History
  const filteredHistory = (overview?.recentBills || []).filter((b) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      b.table.toLowerCase().includes(q) ||
      String(b.billNumber).includes(q) ||
      b.paymentMethod.toLowerCase().includes(q)
    );
  });

  // Cash change calculation
  const tenderNumber = parseFloat(tenderCash) || 0;
  const cashChange = activeDisplayBill ? Math.max(0, tenderNumber - activeDisplayBill.total) : 0;

  return (
    <div className="min-h-screen bg-[#FAF7F0] p-4 sm:p-6 text-[#242B2A] print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">
        {/* TOP STATION HEADER & NAVIGATION */}
        <header className="mb-6 rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B] font-serif font-extrabold text-lg shadow-inner">
                GE
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-serif font-bold text-[#173F35]">
                    POS Billing & Settlement Desk
                  </h1>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Station Active
                  </span>
                </div>
                <p className="text-xs text-[#242B2A]/60 mt-0.5">
                  {overview?.restaurant.name ?? "Green Embassy"} • Authorized Cashier & Audit Terminal
                </p>
              </div>
            </div>

            {/* Quick Cross-Portal Links & Station Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-2xl bg-[#FAF7F0] p-1 border border-[#173F35]/10 text-xs font-bold">
                <button
                  onClick={() => setTab("overview")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 transition-all cursor-pointer ${
                    tab === "overview"
                      ? "bg-[#173F35] text-[#E8B95B] shadow-luxury"
                      : "text-[#242B2A]/70 hover:text-[#173F35]"
                  }`}
                >
                  <GridIcon className="w-3.5 h-3.5" />
                  <span>Floor & Metrics</span>
                </button>

                <button
                  onClick={() => setTab("settle")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 transition-all cursor-pointer ${
                    tab === "settle"
                      ? "bg-[#173F35] text-[#E8B95B] shadow-luxury"
                      : "text-[#242B2A]/70 hover:text-[#173F35]"
                  }`}
                >
                  <ReceiptIcon className="w-3.5 h-3.5" />
                  <span>
                    Settle Terminal {currentBill ? `(Table ${currentBill.table})` : ""}
                  </span>
                </button>

                <button
                  onClick={() => setTab("history")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 transition-all cursor-pointer ${
                    tab === "history"
                      ? "bg-[#173F35] text-[#E8B95B] shadow-luxury"
                      : "text-[#242B2A]/70 hover:text-[#173F35]"
                  }`}
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>Settled Log ({overview?.recentBills.length ?? 0})</span>
                </button>
              </div>

              {/* Cross Portal Links */}
              <Link
                href="/kitchen"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#173F35]/15 bg-white px-3 py-2 text-xs font-semibold text-[#173F35] hover:bg-[#FAF7F0] shadow-xs transition-colors"
                title="Kitchen Display System"
              >
                <ChefHatIcon className="w-3.5 h-3.5 text-amber-700" />
                <span>Kitchen</span>
              </Link>

              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#173F35]/15 bg-white px-3 py-2 text-xs font-semibold text-[#173F35] hover:bg-[#FAF7F0] shadow-xs transition-colors"
                title="Admin Management"
              >
                <span>Admin</span>
              </Link>
            </div>
          </div>
        </header>

        {/* NOTIFICATION FEEDBACK BANNERS */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between rounded-2xl bg-rose-50 p-4 text-xs font-semibold text-rose-900 border border-rose-200 shadow-luxury print:hidden"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-950 border border-emerald-200 shadow-luxury print:hidden"
          >
            <div className="flex items-center gap-2.5">
              <CheckIcon className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: FLOOR OVERVIEW & ACTIVE TABLES */}
        {/* ========================================================= */}
        {tab === "overview" && (
          <div className="space-y-6 print:hidden">
            {/* 4 REVENUE & FINANCIAL KPI CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Today's Gross Revenue */}
              <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                  Gross Revenue Today
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                  {money(overview?.todaySummary.totalSales ?? 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-800">
                  {overview?.todaySummary.billsCount ?? 0} settled transactions
                </p>
              </div>

              {/* Active Dining Floor */}
              <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                  Occupied Tables
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                  {occupiedTables.length}{" "}
                  <span className="text-base font-normal text-[#242B2A]/50">
                    / {overview?.tables.length ?? 0}
                  </span>
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#242B2A]/70">
                  {vacantTables.length} tables vacant & ready
                </p>
              </div>

              {/* Average Order Value (AOV) */}
              <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                  Average Bill Value
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                  {money(overview?.todaySummary.averageOrderValue ?? 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#242B2A]/70">
                  Average spend per seated table
                </p>
              </div>

              {/* GST Tax Collected */}
              <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                  GST Tax Collected
                </span>
                <p className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                  {money(overview?.todaySummary.totalTax ?? 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#242B2A]/70">
                  Total discounts given: {money(overview?.todaySummary.totalDiscounts ?? 0)}
                </p>
              </div>
            </div>

            {/* PAYMENT METHOD AUDIT BREAKDOWN */}
            <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#242B2A]/50 mb-3">
                Verified Payment Collections (Today)
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {METHODS.map((m) => {
                  const val = overview?.todaySummary.paymentBreakdown[m.id] ?? 0;
                  const Icon = m.Icon;
                  const totalRev = overview?.todaySummary.totalSales || 1;
                  const pct = Math.round((val / totalRev) * 100);

                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-[#FAF7F0] p-4 border border-[#173F35]/10 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-[#173F35]" />
                          <span className="font-bold text-[#242B2A]">{m.label}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#173F35]/70">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-lg font-bold text-[#173F35] tabular-nums mt-1">
                        {money(val)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LIVE FLOOR TABLE SELECTION GRID */}
            <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-serif font-bold text-[#173F35]">
                    Dining Floor Table Matrix
                  </h2>
                  <p className="text-xs text-[#242B2A]/60 mt-0.5">
                    Click any occupied table to open itemized bill and settle payment
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex rounded-xl bg-[#FAF7F0] p-1 border border-[#173F35]/10 text-xs font-bold">
                    <button
                      onClick={() => setTableFilter("all")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        tableFilter === "all" ? "bg-[#173F35] text-[#E8B95B]" : "text-[#242B2A]/70"
                      }`}
                    >
                      All ({overview?.tables.length ?? 0})
                    </button>
                    <button
                      onClick={() => setTableFilter("occupied")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        tableFilter === "occupied" ? "bg-[#E8B95B] text-[#173F35]" : "text-[#242B2A]/70"
                      }`}
                    >
                      Occupied ({occupiedTables.length})
                    </button>
                    <button
                      onClick={() => setTableFilter("vacant")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        tableFilter === "vacant" ? "bg-emerald-800 text-white" : "text-[#242B2A]/70"
                      }`}
                    >
                      Vacant ({vacantTables.length})
                    </button>
                  </div>

                  <button
                    onClick={() => loadOverview()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold hover:bg-white cursor-pointer transition-colors shadow-xs"
                  >
                    <RefreshCwIcon className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {loadingOverview && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 mb-4">
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                  <TableCardSkeleton />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {filteredTables.map((tbl) => {
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
                          ? "border-[#E8B95B] bg-gradient-to-b from-amber-50/50 to-white hover:border-[#173F35] hover:shadow-luxury-lg cursor-pointer shadow-luxury"
                          : "border-[#173F35]/10 bg-[#FAF7F0]/60 opacity-60 cursor-default"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xl font-serif font-bold text-[#173F35]">
                          Table {tbl.label}
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

                      <div className="mt-3.5 pt-2 border-t border-[#173F35]/10 w-full">
                        {isOccupied ? (
                          <>
                            <p className="text-xs font-bold text-[#173F35] tabular-nums">
                              Est: {money(tbl.estimatedSubtotal)}
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-[#242B2A]/70 mt-0.5">
                              <span>{tbl.orderCount} order{tbl.orderCount !== 1 ? "s" : ""}</span>
                              {hasUnserved && (
                                <span className="font-bold text-amber-700 text-[10px]">
                                  {tbl.unservedCount} cooking
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs font-medium text-stone-500">Vacant</p>
                        )}
                      </div>
                    </button>
                  );
                })}

                {!loadingOverview && filteredTables.length === 0 && (
                  <div className="col-span-full py-6">
                    <EmptyState
                      icon={GridIcon}
                      title="No Tables in Category"
                      description={`There are currently no dining tables matching the "${tableFilter}" filter status.`}
                      actionLabel="Show All Tables"
                      onAction={() => setTableFilter("all")}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ACTIVE SETTLEMENT TERMINAL & RECEIPT PREVIEW */}
        {/* ========================================================= */}
        {tab === "settle" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            {/* Left Column: Settlement Controls & Calculator */}
            <div className="space-y-6 print:hidden">
              {/* Find Table Search Bar */}
              <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#173F35]/60 mb-2 block">
                  Table Lookup
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchTable.trim()) {
                      loadBill({ table: searchTable.trim(), disc: "0" });
                    }
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchTable}
                      onChange={(e) => setSearchTable(e.target.value)}
                      placeholder="Enter Table Label (e.g. T1, T4, Outdoor-2)..."
                      className="h-12 w-full rounded-2xl border border-[#173F35]/15 bg-[#FAF7F0] px-4 text-sm font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all pl-10"
                    />
                    <SearchIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-4" />
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !searchTable.trim()}
                    className="h-12 rounded-2xl bg-[#173F35] px-6 font-bold text-xs text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {busy ? "Loading..." : "Load Bill"}
                  </button>
                </form>
              </div>

              {/* Settlement Configuration Card */}
              {currentBill && (
                <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury space-y-6">
                  {/* Table Header */}
                  <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#173F35]/60">
                        Active Dining Session
                      </span>
                      <h2 className="text-2xl font-serif font-bold text-[#173F35]">
                        Table {currentBill.table}
                      </h2>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-mono text-[#242B2A]/50 block">
                        Session: {currentBill.sessionId.slice(0, 8)}...
                      </span>
                      <span className="text-xs font-bold text-emerald-800">
                        {currentBill.lines.length} items ordered
                      </span>
                    </div>
                  </div>

                  {/* Kitchen Unserved Notice */}
                  {currentBill.notServed > 0 && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 font-semibold flex items-center gap-2.5">
                      <AlertCircleIcon className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>
                        <b>Kitchen Warning:</b> {currentBill.notServed} order(s) for this table are still marked as in-kitchen / preparing.
                      </span>
                    </div>
                  )}

                  {/* Discount Section */}
                  <div>
                    <label
                      htmlFor={discountInputId}
                      className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-2"
                    >
                      Promotional Discount
                    </label>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                      <button
                        type="button"
                        onClick={() => applyPresetDiscount(0)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                          discount === "0"
                            ? "bg-[#173F35] text-[#E8B95B] border-[#173F35]"
                            : "bg-[#FAF7F0] text-[#242B2A]/70 border-[#173F35]/15"
                        }`}
                      >
                        None (₹0)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetDiscount(50)}
                        className="rounded-xl px-3 py-1.5 text-xs font-bold bg-[#FAF7F0] text-[#242B2A]/70 border border-[#173F35]/15 hover:bg-white cursor-pointer"
                      >
                        −₹50
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetDiscount(100)}
                        className="rounded-xl px-3 py-1.5 text-xs font-bold bg-[#FAF7F0] text-[#242B2A]/70 border border-[#173F35]/15 hover:bg-white cursor-pointer"
                      >
                        −₹100
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPercentDiscount(5)}
                        className="rounded-xl px-3 py-1.5 text-xs font-bold bg-[#FAF7F0] text-[#242B2A]/70 border border-[#173F35]/15 hover:bg-white cursor-pointer"
                      >
                        5% Off
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPercentDiscount(10)}
                        className="rounded-xl px-3 py-1.5 text-xs font-bold bg-[#FAF7F0] text-[#242B2A]/70 border border-[#173F35]/15 hover:bg-white cursor-pointer"
                      >
                        10% Off
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative w-40">
                        <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#242B2A]/60">₹</span>
                        <input
                          id={discountInputId}
                          type="number"
                          min="0"
                          max={currentBill.subtotal}
                          step="1"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          className="h-11 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] pl-8 pr-3 text-right font-bold tabular-nums text-sm focus:border-[#173F35] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => loadBill({ disc: discount })}
                        className="h-11 rounded-xl border border-[#173F35]/20 bg-stone-50 px-4 text-xs font-semibold hover:bg-stone-100 cursor-pointer"
                      >
                        Recalculate
                      </button>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-2">
                      Select Payment Mode *
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {METHODS.map((m) => {
                        const Icon = m.Icon;
                        const isSelected = paymentMethod === m.id;

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(m.id);
                              if (m.id === "cash" && currentBill) {
                                setTenderCash(String(Math.ceil(currentBill.total)));
                              }
                            }}
                            className={`flex flex-col items-center justify-center rounded-2xl p-3.5 border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                              isSelected
                                ? "border-[#173F35] bg-[#173F35] text-[#E8B95B] shadow-luxury"
                                : "border-[#173F35]/15 bg-[#FAF7F0] text-[#242B2A] hover:bg-white"
                            }`}
                          >
                            <Icon
                              className={`w-6 h-6 mb-1.5 ${
                                isSelected ? "text-[#E8B95B]" : "text-[#173F35]"
                              }`}
                            />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cash Drawer Calculator (If Cash selected) */}
                  {paymentMethod === "cash" && (
                    <div className="rounded-2xl bg-[#FAF7F0] p-4 border border-[#173F35]/15 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#173F35]">
                          Cash Tender & Change
                        </span>
                        <span className="text-xs text-[#242B2A]/60">
                          Bill Total: <b>{money(currentBill.total)}</b>
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative w-40">
                          <span className="absolute left-3.5 top-2 text-sm font-bold text-[#242B2A]/60">₹</span>
                          <input
                            type="number"
                            min={currentBill.total}
                            value={tenderCash}
                            onChange={(e) => setTenderCash(e.target.value)}
                            placeholder="Cash Received"
                            className="h-10 w-full rounded-xl border border-[#173F35]/15 bg-white pl-8 pr-3 font-bold text-sm text-[#173F35] focus:outline-none focus:border-[#173F35]"
                          />
                        </div>

                        <div className="flex-1 text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#242B2A]/50 block">
                            Change to Return
                          </span>
                          <span className="text-lg font-bold font-serif text-emerald-800 tabular-nums">
                            {money(cashChange)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Primary Settlement Button */}
                  <button
                    onClick={handleSettleBill}
                    disabled={busy || !paymentMethod}
                    className="h-14 w-full rounded-2xl bg-[#173F35] text-base font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {busy ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                        Recording Settle RPC...
                      </span>
                    ) : (
                      <>
                        <CheckIcon className="w-5 h-5 text-[#E8B95B]" />
                        <span>Settle & Close Table ({money(currentBill.total)})</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Settlement Success Dialog */}
              {settledBill && (
                <div className="rounded-3xl bg-white p-8 border border-emerald-300 shadow-luxury text-center space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-800 text-3xl font-bold shadow-inner">
                    <CheckIcon className="w-8 h-8" />
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full inline-block mb-1.5">
                      Session Settled
                    </span>
                    <h3 className="text-2xl font-serif font-bold text-[#173F35]">
                      Invoice #{settledBill.billNumber} Finalized
                    </h3>
                    <p className="text-xs text-[#242B2A]/70 mt-1 max-w-sm mx-auto">
                      Table {settledBill.table} has been successfully closed. Customer receipt is generated and ready for thermal printing.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 h-11 rounded-2xl bg-[#173F35] px-6 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] cursor-pointer transition-colors"
                    >
                      <PrinterIcon className="w-4 h-4" />
                      <span>Print Customer Receipt</span>
                    </button>

                    <button
                      onClick={resetToOverview}
                      className="inline-flex items-center gap-1.5 h-11 rounded-2xl border border-[#173F35]/20 bg-[#FAF7F0] px-6 text-xs font-bold text-[#173F35] hover:bg-white cursor-pointer transition-colors"
                    >
                      <span>Settle Next Table</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {!currentBill && !settledBill && (
                <div className="rounded-3xl border border-dashed border-[#173F35]/20 bg-white/50 p-12 text-center text-sm text-[#242B2A]/50 shadow-luxury">
                  <ReceiptIcon className="w-10 h-10 text-[#173F35]/30 mx-auto mb-2" />
                  <p className="font-serif font-bold text-[#173F35]">No Table Selected</p>
                  <p className="text-xs text-[#242B2A]/60 mt-1">
                    Select an occupied table from Floor Overview or enter a table label above.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Thermal Receipt Preview */}
            <div>
              {activeDisplayBill ? (
                <ReceiptPreview
                  bill={activeDisplayBill}
                  onPrint={() => window.print()}
                  isSettled={!!settledBill}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-[#173F35]/20 bg-white/40 p-12 text-center text-xs text-[#242B2A]/50 shadow-luxury print:hidden">
                  <SparklesIcon className="w-8 h-8 text-[#E8B95B] mx-auto mb-2 opacity-50" />
                  <p className="font-serif font-semibold text-[#173F35]">Interactive Invoice Preview</p>
                  <p className="mt-1 text-[11px] text-[#242B2A]/60">
                    Live 80mm thermal receipt will render here once a table is selected.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: BILL SETTLEMENT HISTORY & AUDIT LOG */}
        {/* ========================================================= */}
        {tab === "history" && (
          <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury print:hidden space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#173F35]">
                  Today&apos;s Settled Bills ({overview?.recentBills.length ?? 0})
                </h2>
                <p className="text-xs text-[#242B2A]/60 mt-0.5">
                  Complete authoritative audit ledger of finalized dining settlements
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Bill # or Table..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="h-10 rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-xs font-semibold focus:border-[#173F35] focus:outline-none w-56 pl-8"
                  />
                  <SearchIcon className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3.5" />
                </div>

                <button
                  onClick={() => loadOverview()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 py-2 text-xs font-semibold hover:bg-white cursor-pointer transition-colors"
                >
                  <RefreshCwIcon className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={ReceiptIcon}
                  title="No Invoices Found"
                  description={
                    historySearch
                      ? `No settled bills matched your search for "${historySearch}".`
                      : "No completed billing records have been settled yet today."
                  }
                  actionLabel={historySearch ? "Clear Filter" : undefined}
                  onAction={historySearch ? () => setHistorySearch("") : undefined}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#173F35]/15 bg-[#FAF7F0] text-[#242B2A]/60 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Table</th>
                      <th className="py-3 px-4">Settled At</th>
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-right">Discount</th>
                      <th className="py-3 px-4 text-right">GST</th>
                      <th className="py-3 px-4 text-right">Final Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#173F35]/10 font-medium">
                    {filteredHistory.map((b) => (
                      <tr key={b.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#173F35]">
                          #{b.billNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold">Table {b.table}</td>
                        <td className="py-3 px-4 text-[#242B2A]/70 text-[11px]">
                          {new Date(b.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="rounded-md bg-[#173F35]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#173F35]">
                            {b.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {money(b.subtotal)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-emerald-800">
                          {b.discount > 0 ? `−${money(b.discount)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {money(b.tax)}
                        </td>
                        <td className="py-3 px-4 text-right font-serif font-bold tabular-nums text-[#173F35] text-sm">
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
