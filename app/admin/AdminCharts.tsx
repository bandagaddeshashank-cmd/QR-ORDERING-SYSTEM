"use client";

import React from "react";
import type { PaymentMethod } from "@/lib/types";

interface CategorySale {
  category: string;
  quantity: number;
  revenue: number;
}

interface PaymentBreakdownProps {
  breakdown: Record<PaymentMethod, number>;
  totalSales: number;
}

export function PaymentBreakdownChart({ breakdown, totalSales }: PaymentBreakdownProps) {
  const safeTotal = totalSales > 0 ? totalSales : 1;

  const methods: { key: PaymentMethod; label: string; color: string; bg: string; border: string }[] = [
    { key: "upi", label: "UPI & QR", color: "#173F35", bg: "bg-[#173F35]", border: "border-[#173F35]" },
    { key: "cash", label: "Cash Desk", color: "#E8B95B", bg: "bg-[#E8B95B]", border: "border-[#E8B95B]" },
    { key: "card", label: "Credit / Debit Card", color: "#2E5A44", bg: "bg-[#2E5A44]", border: "border-[#2E5A44]" },
    { key: "other", label: "Other Methods", color: "#6B7280", bg: "bg-stone-500", border: "border-stone-500" },
  ];

  // Calculate percentages
  const segments = methods.map((m) => {
    const val = breakdown[m.key] || 0;
    const pct = Math.round((val / safeTotal) * 100);
    return { ...m, val, pct };
  });

  // Calculate SVG donut stroke offsets
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  let accumulatedPercent = 0;

  return (
    <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-[#173F35]">Payment Channel Breakdown</h3>
          <p className="text-[11px] text-[#242B2A]/60 mt-0.5">Distribution across verified settlement types</p>
        </div>
        <span className="rounded-full bg-[#173F35]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#173F35]">
          Audit Ready
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
        {/* SVG Donut Visual */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-36 h-36">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#FAF7F0"
                strokeWidth="14"
              />
              {/* Slices */}
              {segments.map((seg) => {
                if (seg.pct <= 0) return null;
                const dash = (seg.pct / 100) * circumference;
                const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                accumulatedPercent += seg.pct;

                return (
                  <circle
                    key={seg.key}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="14"
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 hover:opacity-90"
                  />
                );
              })}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                Total
              </span>
              <span className="font-serif font-bold text-sm text-[#173F35] tabular-nums">
                ₹{totalSales.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Legend & Progress Bars */}
        <div className="sm:col-span-7 space-y-3">
          {segments.map((seg) => (
            <div key={seg.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${seg.bg}`} />
                  <span className="font-semibold text-[#242B2A]">{seg.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#173F35] tabular-nums">
                    ₹{seg.val.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-[#242B2A]/60 ml-1.5 font-medium">
                    ({seg.pct}%)
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#FAF7F0] overflow-hidden">
                <div
                  className={`h-full ${seg.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${seg.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CategorySalesProps {
  categories: CategorySale[];
  totalSales: number;
}

export function CategorySalesBarChart({ categories, totalSales }: CategorySalesProps) {
  const maxRevenue = categories.length > 0
    ? Math.max(...categories.map((c) => c.revenue), 1)
    : 1;

  return (
    <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-[#173F35]">Category Sales Performance</h3>
          <p className="text-[11px] text-[#242B2A]/60 mt-0.5">Revenue and dishes ordered per culinary division</p>
        </div>
        <span className="text-xs font-serif font-bold text-[#173F35] tabular-nums">
          {categories.length} Categories
        </span>
      </div>

      <div className="space-y-3.5">
        {categories.slice(0, 6).map((cat, idx) => {
          const pct = Math.round((cat.revenue / (totalSales || 1)) * 100);
          const barWidth = Math.round((cat.revenue / maxRevenue) * 100);

          return (
            <div key={cat.category} className="group">
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#FAF7F0] border border-[#173F35]/10 text-[10px] font-bold text-[#173F35]">
                    {idx + 1}
                  </span>
                  <span className="font-serif font-semibold text-[#173F35]">{cat.category}</span>
                  <span className="text-[10px] text-[#242B2A]/50">
                    • {cat.quantity} ordered
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#173F35] tabular-nums">
                    ₹{cat.revenue.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-[#242B2A]/60 ml-1.5 font-medium">
                    ({pct}%)
                  </span>
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-[#FAF7F0] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#173F35] to-[#E8B95B] rounded-full transition-all duration-700"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="py-8 text-center text-xs text-[#242B2A]/50 font-serif">
            No culinary categories recorded in this reporting period.
          </div>
        )}
      </div>
    </div>
  );
}

interface TableUtilizationProps {
  tables: { label: string; count: number; total: number }[];
}

export function TableRevenueMatrixChart({ tables }: TableUtilizationProps) {
  const maxTableRevenue = tables.length > 0
    ? Math.max(...tables.map((t) => t.total), 1)
    : 1;

  return (
    <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-[#173F35]">Table Revenue Matrix</h3>
          <p className="text-[11px] text-[#242B2A]/60 mt-0.5">Turnover and aggregate settlement by dining table</p>
        </div>
        <span className="text-xs font-mono text-[#242B2A]/50 font-medium">
          Authoritative Session Ledger
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {tables.map((t) => {
          const ratio = Math.round((t.total / maxTableRevenue) * 100);
          return (
            <div
              key={t.label}
              className="flex flex-col justify-between rounded-2xl bg-[#FAF7F0] p-3.5 border border-[#173F35]/10 hover:border-[#173F35]/30 hover:bg-white transition-all shadow-xs"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                  Dine-in
                </span>
                <p className="font-serif font-bold text-sm text-[#173F35] mt-0.5">Table {t.label}</p>
              </div>

              <div className="mt-3">
                <p className="text-base font-bold text-[#173F35] tabular-nums">
                  ₹{t.total.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[#242B2A]/60 mt-1">
                  <span>{t.count} bills</span>
                  <span className="font-medium">{ratio}% peak</span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-black/5 overflow-hidden">
                  <div
                    className="h-full bg-[#173F35] rounded-full"
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {tables.length === 0 && (
          <div className="col-span-full py-6 text-center text-xs text-[#242B2A]/50 font-serif">
            No table session settlements recorded in this timeframe.
          </div>
        )}
      </div>
    </div>
  );
}
