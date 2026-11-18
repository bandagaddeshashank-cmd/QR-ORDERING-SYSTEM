import React from "react";

export type BadgeVariant = "forest" | "gold" | "ivory" | "neutral" | "success" | "warning" | "danger";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  children,
  variant = "ivory",
  size = "md",
  dot = false,
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    forest: "bg-[#173F35] text-[#FAF7F0] border-[#173F35]",
    gold: "bg-[#E8B95B]/15 text-[#173F35] border-[#E8B95B]/40 font-semibold",
    ivory: "bg-[#FAF7F0] text-[#242B2A] border-[#173F35]/15",
    neutral: "bg-stone-100 text-[#242B2A]/80 border-stone-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-rose-50 text-rose-900 border-rose-200",
  };

  const dotColors: Record<BadgeVariant, string> = {
    forest: "bg-[#E8B95B]",
    gold: "bg-[#E8B95B]",
    ivory: "bg-[#173F35]",
    neutral: "bg-stone-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 rounded-full border",
    md: "text-xs px-2.5 py-1 rounded-full border",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

export function DietaryBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
      aria-label={isVeg ? "Vegetarian" : "Non-Vegetarian"}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border transition-colors ${
        isVeg ? "border-emerald-700 bg-emerald-50/50" : "border-rose-700 bg-rose-50/50"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isVeg ? "bg-emerald-700" : "bg-rose-700"
        }`}
      />
    </span>
  );
}
