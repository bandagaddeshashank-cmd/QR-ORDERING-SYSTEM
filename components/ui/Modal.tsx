"use client";

import React, { useEffect, useId } from "react";
import { CloseIcon } from "@/components/ui/icons";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "md",
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
    >
      <div
        className={`relative w-full ${maxWidthClasses} rounded-3xl bg-white p-6 sm:p-7 shadow-luxury-lg border border-[#173F35]/10 animate-scale-in my-8 max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-4 mb-5 shrink-0">
            <div>
              <h2 id={titleId} className="text-xl font-serif font-bold text-[#173F35]">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-[#242B2A]/60 mt-0.5">{subtitle}</p>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF7F0] text-[#242B2A]/70 hover:bg-[#173F35] hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
