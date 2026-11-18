"use client";

import React, { useEffect, useId } from "react";
import { AlertCircleIcon } from "@/components/ui/icons";

interface ConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDanger = false,
  isLoading = false,
}: ConfirmModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-luxury-lg border border-[#173F35]/10 text-center animate-scale-in">
        <div
          className={`mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl ${
            isDanger ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <AlertCircleIcon className="w-6 h-6" />
        </div>

        <h3 id={titleId} className="text-lg font-serif font-bold text-[#173F35] mb-2">
          {title}
        </h3>

        <p className="text-xs text-[#242B2A]/70 leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-[#173F35]/20 text-xs font-semibold text-[#242B2A]/70 hover:bg-[#FAF7F0] transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 h-11 rounded-xl text-xs font-bold text-white shadow-luxury transition-all cursor-pointer active:scale-98 disabled:opacity-50 ${
              isDanger
                ? "bg-rose-700 hover:bg-rose-800"
                : "bg-[#173F35] text-[#E8B95B] hover:bg-[#102e26]"
            }`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
