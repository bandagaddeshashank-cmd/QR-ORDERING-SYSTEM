"use client";

import React from "react";
import type { Bill, BillLine } from "@/lib/types";
import { PrinterIcon } from "@/components/ui/icons";

interface ReceiptPreviewProps {
  bill: Bill;
  onPrint?: () => void;
  isSettled?: boolean;
}

const money = (n: number) =>
  "₹" +
  (n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ReceiptPreview({
  bill,
  onPrint,
  isSettled = false,
}: ReceiptPreviewProps) {
  const halfTax = (bill.taxPercent / 2).toFixed(1);
  const halfTaxAmount = (bill.tax / 2);

  return (
    <div className="rounded-3xl border border-[#173F35]/15 bg-white p-6 shadow-luxury-lg print:border-0 print:p-0 print:shadow-none">
      {/* Non-print toolbar */}
      <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-3 mb-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#173F35] bg-[#173F35]/10 px-2.5 py-0.5 rounded-full">
            {isSettled ? "Official Tax Invoice" : "Pro-Forma Guest Bill"}
          </span>
          {bill.billNumber && (
            <span className="font-mono font-bold text-xs text-[#173F35]">
              #{bill.billNumber}
            </span>
          )}
        </div>

        <button
          onClick={onPrint || (() => window.print())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F35] px-3.5 py-1.5 text-xs font-bold text-[#E8B95B] hover:bg-[#102e26] transition-colors cursor-pointer shadow-xs"
        >
          <PrinterIcon className="w-3.5 h-3.5" />
          <span>Print Thermal Receipt</span>
        </button>
      </div>

      {/* 80mm Standard Thermal Paper Container */}
      <div className="mx-auto max-w-[340px] font-mono text-xs text-[#242B2A] leading-tight space-y-3 p-4 border border-dashed border-[#173F35]/20 rounded-2xl bg-[#FAF7F0]/40 print:border-0 print:p-0 print:bg-white print:max-w-none">
        {/* Receipt Header */}
        <div className="text-center space-y-1">
          <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-[#173F35] text-[#E8B95B] font-serif font-extrabold text-sm">
            GE
          </div>
          <h2 className="text-base font-serif font-extrabold uppercase tracking-wider text-[#173F35]">
            {bill.restaurant || "Green Embassy"}
          </h2>
          <p className="text-[10px] text-[#242B2A]/70 uppercase tracking-widest font-semibold">
            Fine Dining & Culinary Lounge
          </p>
          {bill.gstin && (
            <p className="text-[10px] text-[#242B2A]/80 font-bold">
              GSTIN: {bill.gstin}
            </p>
          )}

          <div className="pt-2 border-t border-dashed border-[#242B2A]/30 flex justify-between text-[11px] font-bold">
            <span>TABLE: {bill.table}</span>
            <span>{bill.billNumber ? `INV #${bill.billNumber}` : "DRAFT"}</span>
          </div>

          <p className="text-[9px] text-[#242B2A]/60">
            {new Date().toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Itemized Lines */}
        <div className="border-t border-dashed border-[#242B2A]/40 pt-2 pb-1">
          <div className="flex justify-between font-bold text-[10px] uppercase text-[#242B2A]/70 mb-1.5 pb-1 border-b border-[#242B2A]/20">
            <span>ITEM & QTY</span>
            <span>AMOUNT</span>
          </div>
          <ul className="space-y-1.5">
            {bill.lines.map((l: BillLine, i: number) => (
              <li key={i} className="flex justify-between items-start text-xs">
                <div className="pr-2 truncate">
                  <span className="font-bold text-[#173F35]">{l.qty}× </span>
                  <span>{l.name}</span>
                  <span className="block text-[9px] text-[#242B2A]/50">
                    @{money(l.price)} each
                  </span>
                </div>
                <span className="shrink-0 font-bold tabular-nums">
                  {money(l.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mathematical Aggregation */}
        <div className="border-t border-dashed border-[#242B2A]/40 pt-2 space-y-1 text-xs tabular-nums">
          <div className="flex justify-between">
            <span>Item Subtotal</span>
            <span>{money(bill.subtotal)}</span>
          </div>

          {bill.discount > 0 && (
            <div className="flex justify-between text-emerald-800 font-semibold">
              <span>Promotional Discount</span>
              <span>−{money(bill.discount)}</span>
            </div>
          )}

          {bill.servicePercent > 0 && (
            <div className="flex justify-between text-[11px]">
              <span>Service Charge ({bill.servicePercent}%)</span>
              <span>{money(bill.service)}</span>
            </div>
          )}

          {bill.taxPercent > 0 && (
            <>
              <div className="flex justify-between text-[10px] text-[#242B2A]/80">
                <span>CGST ({halfTax}%)</span>
                <span>{money(halfTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-[#242B2A]/80">
                <span>SGST ({halfTax}%)</span>
                <span>{money(halfTaxAmount)}</span>
              </div>
            </>
          )}
        </div>

        {/* Grand Total */}
        <div className="border-t-2 border-[#173F35] pt-2 pb-1 flex justify-between text-base font-serif font-black tabular-nums text-[#173F35]">
          <span>GRAND TOTAL</span>
          <span>{money(bill.total)}</span>
        </div>

        {/* Payment Confirmation */}
        {bill.paymentMethod && (
          <div className="border-t border-dashed border-[#242B2A]/40 pt-2 text-center text-xs font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50/60 py-1 rounded-lg">
            PAID IN FULL VIA: {bill.paymentMethod}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-3 text-[10px] text-[#242B2A]/60 border-t border-dashed border-[#242B2A]/40 space-y-0.5">
          <p className="font-semibold text-[#173F35]">
            Thank you for dining with Green Embassy!
          </p>
          <p>GST Inclusive Price • Have a wonderful day</p>
          <p className="text-[8px] font-mono text-[#242B2A]/40 pt-1">
            POWERED BY GREEN EMBASSY RESTAURANT-TECH
          </p>
        </div>
      </div>
    </div>
  );
}
