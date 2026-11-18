import React from "react";

export type ButtonVariant = "primary" | "gold" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[#173F35] text-[#FAF7F0] hover:bg-[#102e26] border border-[#173F35] shadow-luxury",
    gold: "bg-[#E8B95B] text-[#173F35] hover:bg-[#d8a84b] border border-[#E8B95B] shadow-gold font-bold",
    secondary: "bg-[#FAF7F0] text-[#173F35] hover:bg-[#F0EAE1] border border-[#173F35]/15",
    outline: "bg-transparent text-[#173F35] border border-[#173F35]/20 hover:bg-[#173F35]/5",
    ghost: "bg-transparent text-[#242B2A] hover:bg-[#173F35]/5 border border-transparent",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-xs gap-1.5",
    md: "h-11 px-4 text-sm gap-2",
    lg: "h-12 px-6 text-base gap-2.5",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
