import React from "react";
import { UtensilsIcon } from "@/components/ui/icons";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = UtensilsIcon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-3xl border border-dashed border-[#173F35]/20 bg-white/60 p-8 sm:p-12 text-center shadow-luxury animate-fade-in ${className}`}
    >
      <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173F35]/10 text-[#173F35] shadow-inner">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="font-serif font-bold text-lg text-[#173F35] mb-1">
        {title}
      </h3>

      <p className="mx-auto max-w-sm text-xs text-[#242B2A]/65 leading-relaxed mb-5">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#173F35] px-6 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all cursor-pointer active:scale-98"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
