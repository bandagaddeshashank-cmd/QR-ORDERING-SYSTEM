"use client";

import React, { useEffect } from "react";
import {
  CheckIcon,
  AlertCircleIcon,
  SparklesIcon,
  CloseIcon,
} from "@/components/ui/icons";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ toast, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;

  const typeConfig: Record<
    ToastType,
    { bg: string; border: string; text: string; icon: React.ReactNode }
  > = {
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-950",
      icon: <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0" />,
    },
    error: {
      bg: "bg-rose-50",
      border: "border-rose-200",
      text: "text-rose-950",
      icon: <AlertCircleIcon className="w-4 h-4 text-rose-700 shrink-0" />,
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-950",
      icon: <AlertCircleIcon className="w-4 h-4 text-amber-700 shrink-0" />,
    },
    info: {
      bg: "bg-sky-50",
      border: "border-sky-200",
      text: "text-sky-950",
      icon: <SparklesIcon className="w-4 h-4 text-sky-700 shrink-0" />,
    },
  };

  const current = typeConfig[toast.type];

  return (
    <aside
      aria-label="Notification"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-md animate-slide-up"
    >
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-luxury-lg ${current.bg} ${current.border} ${current.text}`}
      >
        <div className="flex items-center gap-2.5">
          {current.icon}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>

        <button
          onClick={onDismiss}
          className="rounded-lg p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          title="Dismiss notification"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
