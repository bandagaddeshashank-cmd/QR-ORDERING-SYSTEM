"use client";

import React from "react";
import Image from "next/image";
import {
  CloseIcon,
  DownloadIcon,
  PrinterIcon,
  CopyIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import { DietaryBadge } from "@/components/ui/Badge";
import MenuThumbnail from "./MenuThumbnail";
import type { TableData, DishFormData } from "./types";

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isDanger?: boolean;
  onConfirm: () => void;
}

// -------------------------------------------------------------
// 1. ADD / EDIT DISH MODAL
// -------------------------------------------------------------
interface DishModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  dishForm: DishFormData;
  onChangeDishForm: (data: DishFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  categories: string[];
}

export function DishModal({
  isOpen,
  onClose,
  isEditing,
  dishForm,
  onChangeDishForm,
  onSubmit,
  isSubmitting,
  categories,
}: DishModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Edit Culinary Item" : "Add New Dish to Catalog"}
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-luxury-lg border border-[#173F35]/10 my-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-4 mb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#173F35]/60">
              Menu Engineering &amp; Operations
            </span>
            <h3 className="text-xl font-serif font-bold text-[#173F35]">
              {isEditing ? "Edit Culinary Item" : "Add New Dish to Catalog"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAF7F0] text-[#242B2A]/70 hover:bg-[#173F35] hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Form Inputs */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Truffle Paneer"
                  value={dishForm.name}
                  onChange={(e) => onChangeDishForm({ ...dishForm, name: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-xs font-bold text-[#173F35] focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Course"
                    list="category-suggestions"
                    value={dishForm.category}
                    onChange={(e) => onChangeDishForm({ ...dishForm, category: e.target.value })}
                    className="h-11 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-xs font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
                  />
                  <datalist id="category-suggestions">
                    {categories.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c} />
                    ))}
                    <option value="Starters" />
                    <option value="Main Course" />
                    <option value="Biryani & Rice" />
                    <option value="Breads" />
                    <option value="Desserts" />
                    <option value="Beverages" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="250"
                    value={dishForm.price}
                    onChange={(e) =>
                      onChangeDishForm({ ...dishForm, price: parseFloat(e.target.value) || 0 })
                    }
                    className="h-11 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-xs font-bold tabular-nums text-[#173F35] focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                  Dietary Classification *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onChangeDishForm({ ...dishForm, is_veg: true })}
                    className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold border transition-all cursor-pointer ${
                      dishForm.is_veg
                        ? "border-emerald-700 bg-emerald-50 text-emerald-900 shadow-xs"
                        : "border-[#173F35]/10 bg-[#FAF7F0] text-[#242B2A]/60 hover:bg-stone-50"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span>Vegetarian</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeDishForm({ ...dishForm, is_veg: false })}
                    className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold border transition-all cursor-pointer ${
                      !dishForm.is_veg
                        ? "border-rose-700 bg-rose-50 text-rose-900 shadow-xs"
                        : "border-[#173F35]/10 bg-[#FAF7F0] text-[#242B2A]/60 hover:bg-stone-50"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    <span>Non-Vegetarian</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                  Culinary Description &amp; Ingredients
                </label>
                <textarea
                  rows={3}
                  value={dishForm.description}
                  onChange={(e) => onChangeDishForm({ ...dishForm, description: e.target.value })}
                  placeholder="Rich cashew cream sauce, slow-simmered cottage cheese with aromatic spices..."
                  className="w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] p-3 text-xs font-medium focus:border-[#173F35] focus:bg-white focus:outline-none transition-all leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                  Menu Display Sort Priority (0 = Default)
                </label>
                <input
                  type="number"
                  value={dishForm.sort_order}
                  onChange={(e) =>
                    onChangeDishForm({ ...dishForm, sort_order: parseInt(e.target.value, 10) || 0 })
                  }
                  className="h-10 w-32 rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3 text-xs font-semibold focus:border-[#173F35] focus:outline-none"
                />
              </div>
            </div>

            {/* Live Guest Preview Card */}
            <div className="md:col-span-5 flex flex-col justify-between rounded-2xl bg-[#FAF7F0] p-4 border border-[#173F35]/15">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#173F35]/60 mb-2 block">
                  Live Guest Menu Preview
                </span>

                <div className="rounded-2xl bg-white p-4 shadow-luxury border border-[#173F35]/10">
                  <div className="flex gap-3">
                    <MenuThumbnail
                      name={dishForm.name || "Dish"}
                      category={dishForm.category || "Main"}
                      isVeg={dishForm.is_veg}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <DietaryBadge isVeg={dishForm.is_veg} />
                        <span className="text-[10px] uppercase font-bold text-[#173F35]/60 truncate">
                          {dishForm.category || "Category"}
                        </span>
                      </div>

                      <h4 className="font-serif font-bold text-sm text-[#173F35] truncate">
                        {dishForm.name || "Untitled Dish"}
                      </h4>

                      <p className="text-[11px] text-[#242B2A]/60 line-clamp-2 mt-1">
                        {dishForm.description || "Flavor notes and description will appear here..."}
                      </p>

                      <p className="mt-2 text-sm font-serif font-bold text-[#173F35] tabular-nums">
                        ₹{Number(dishForm.price || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white/70 p-3 border border-[#173F35]/10 text-[11px] text-[#242B2A]/70 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-[#E8B95B] shrink-0" />
                <span>Changes save instantly to the cloud and reflect on customer table QR menus.</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#173F35]/10">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-[#173F35]/20 px-5 text-xs font-semibold text-[#242B2A]/70 hover:bg-[#FAF7F0] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#173F35] px-7 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-50 transition-all cursor-pointer border border-[#E8B95B]/30"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                  <span>Saving Dish...</span>
                </span>
              ) : isEditing ? (
                "Update Dish"
              ) : (
                "Create Dish"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. ADD TABLE MODAL
// -------------------------------------------------------------
interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  onChangeLabel: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export function TableModal({
  isOpen,
  onClose,
  label,
  onChangeLabel,
  onSubmit,
  isSubmitting,
}: TableModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Add Dining Table"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-luxury-lg border border-[#173F35]/10 animate-slide-up">
        <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-3 mb-4">
          <h3 className="text-lg font-serif font-bold text-[#173F35]">Add Dining Table</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF7F0] text-[#242B2A]/70 hover:bg-[#173F35] hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#242B2A]/70 mb-4 leading-relaxed">
          Create a new dining station. A cryptographically random QR token is generated automatically.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
              Table Identifier / Label *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. T7, Patio-3, VIP-1"
              value={label}
              onChange={(e) => onChangeLabel(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-xs font-bold text-[#173F35] focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#173F35]/20 px-4 text-xs font-semibold text-[#242B2A]/70 hover:bg-[#FAF7F0] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !label.trim()}
              className="h-10 rounded-xl bg-[#173F35] px-5 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-50 cursor-pointer transition-all border border-[#E8B95B]/30"
            >
              {isSubmitting ? "Generating..." : "Create Table"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. SINGLE TABLE QR MODAL
// -------------------------------------------------------------
interface QrModalProps {
  table: TableData | null;
  qrDataUrl: string;
  onClose: () => void;
  onCopyLink: (url: string) => void;
}

export function QrModal({ table, qrDataUrl, onClose, onCopyLink }: QrModalProps) {
  if (!table) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Official QR Code for Table ${table.label}`}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-luxury-lg border border-[#173F35]/10 text-center animate-slide-up">
        {/* Brand Crest */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8B95B] bg-[#173F35] px-3 py-0.5 rounded-full inline-block mb-2 shadow-xs">
          GREEN EMBASSY
        </span>

        <h3 className="text-2xl font-serif font-bold text-[#173F35]">
          Table {table.label}
        </h3>
        <p className="text-xs text-[#242B2A]/60 mt-0.5 mb-4 font-sans">
          Official Dine-in Tableside QR Code
        </p>

        {/* QR Card Container */}
        <div className="rounded-2xl border border-[#173F35]/15 bg-[#FAF7F0] p-4 mb-4 shadow-inner">
          <div className="mx-auto h-48 w-48 rounded-xl bg-white p-2.5 shadow-luxury flex items-center justify-center border border-[#173F35]/10">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`QR code for Table ${table.label}`}
                width={175}
                height={175}
                unoptimized
                className="h-auto w-auto"
              />
            ) : (
              <span className="text-xs text-[#173F35] animate-pulse">Rendering QR...</span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between bg-white rounded-xl px-2.5 py-1.5 border border-[#173F35]/10 text-[10px] font-mono text-[#242B2A]/60">
            <span className="truncate max-w-[190px]">{table.qrUrl}</span>
            <button
              onClick={() => onCopyLink(table.qrUrl)}
              className="text-[#173F35] hover:text-[#E8B95B] font-bold shrink-0 ml-2 cursor-pointer flex items-center gap-1"
              title="Copy URL"
            >
              <CopyIcon className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={qrDataUrl}
              download={`GreenEmbassy_Table_${table.label}_QR.png`}
              className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-colors cursor-pointer border border-[#E8B95B]/30"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </a>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-[#173F35] text-xs font-bold text-[#173F35] hover:bg-[#173F35]/5 transition-colors cursor-pointer"
            >
              <PrinterIcon className="w-3.5 h-3.5" />
              <span>Print Tent</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={table.qrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1 h-9 rounded-xl border border-[#173F35]/20 text-[11px] font-semibold text-[#173F35] hover:bg-[#FAF7F0] transition-colors cursor-pointer"
            >
              <ExternalLinkIcon className="w-3 h-3" />
              <span>Test Live QR</span>
            </a>

            <button
              onClick={onClose}
              className="h-9 rounded-xl border border-[#173F35]/20 text-[11px] font-semibold text-[#242B2A]/70 hover:bg-[#FAF7F0] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 4. CUSTOM CONFIRMATION DIALOG
// -------------------------------------------------------------
interface ConfirmDialogProps {
  state: ConfirmState;
  onCancel: () => void;
}

export function ConfirmDialog({ state, onCancel }: ConfirmDialogProps) {
  if (!state.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-luxury-lg border border-[#173F35]/10 text-center animate-slide-up">
        <div
          className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${
            state.isDanger ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <AlertCircleIcon className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-serif font-bold text-[#173F35] mb-2">{state.title}</h3>
        <p className="text-xs text-[#242B2A]/70 leading-relaxed mb-6 font-sans">{state.message}</p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-[#173F35]/20 text-xs font-semibold text-[#242B2A]/70 hover:bg-[#FAF7F0] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              state.onConfirm();
              onCancel();
            }}
            className={`flex-1 h-10 rounded-xl text-xs font-bold text-white shadow-luxury cursor-pointer transition-colors ${
              state.isDanger
                ? "bg-rose-700 hover:bg-rose-800"
                : "bg-[#173F35] text-[#E8B95B] hover:bg-[#102e26]"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 5. PRINTABLE MULTI-TABLE SHEET MODAL
// -------------------------------------------------------------
interface PrintSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  allQrUrls: { label: string; qrUrl: string; dataUrl: string }[];
}

export function PrintSheetModal({ isOpen, onClose, allQrUrls }: PrintSheetModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-white p-8 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Printable Table Tent Sheets"
    >
      <div className="flex justify-between items-center mb-6 print:hidden border-b border-[#173F35]/10 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#173F35]/60">
            Official Production Print Center
          </span>
          <h3 className="text-xl font-serif font-bold text-[#173F35]">
            Printable Table Tent Sheets ({allQrUrls.length} Dining Tables)
          </h3>
          <p className="text-xs text-[#242B2A]/60 mt-0.5">
            Optimized for standard A4 cardstock printing with cut guidelines.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] cursor-pointer transition-colors border border-[#E8B95B]/30"
          >
            <PrinterIcon className="w-3.5 h-3.5" />
            <span>Send to Printer</span>
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-[#173F35]/20 text-xs font-semibold text-[#242B2A]/70 hover:bg-stone-50 cursor-pointer transition-colors"
          >
            Exit Preview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {allQrUrls.map((t) => (
          <div
            key={t.label}
            className="rounded-3xl border-2 border-dashed border-[#173F35]/30 p-6 text-center bg-[#FAF7F0] page-break-inside-avoid shadow-luxury"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8B95B] bg-[#173F35] px-3 py-0.5 rounded-full inline-block mb-2 shadow-xs">
              GREEN EMBASSY
            </span>
            <h4 className="text-3xl font-serif font-bold text-[#173F35] mb-1">
              Table {t.label}
            </h4>
            <p className="text-xs text-[#242B2A]/70 mb-4 font-sans">
              Scan with your smartphone camera to view menu &amp; order
            </p>

            <div className="mx-auto h-44 w-44 rounded-2xl bg-white p-3 shadow-luxury border border-[#173F35]/10 flex items-center justify-center">
              <Image
                src={t.dataUrl}
                alt={`QR ${t.label}`}
                width={160}
                height={160}
                unoptimized
                className="h-auto w-auto"
              />
            </div>

            <p className="mt-3 text-[10px] font-mono text-[#242B2A]/60">
              No app download required &bull; Instant live ordering
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
