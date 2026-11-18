"use client";

import React from "react";
import { UtensilsIcon, FlameIcon, SparklesIcon } from "@/components/ui/icons";

interface MenuThumbnailProps {
  name: string;
  category: string;
  isVeg: boolean;
  size?: "sm" | "md" | "lg";
}

export default function MenuThumbnail({
  name,
  category,
  isVeg,
  size = "md",
}: MenuThumbnailProps) {
  const sizeClasses = {
    sm: "w-10 h-10 rounded-xl text-xs",
    md: "w-14 h-14 rounded-2xl text-sm",
    lg: "w-20 h-20 rounded-3xl text-base",
  }[size];

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }[size];

  // Pick category styling
  const lowerCat = category.toLowerCase();
  const isStarter = lowerCat.includes("starter") || lowerCat.includes("appetizer") || lowerCat.includes("snack");
  const isDessert = lowerCat.includes("dessert") || lowerCat.includes("sweet") || lowerCat.includes("ice");
  const isBeverage = lowerCat.includes("drink") || lowerCat.includes("beverage") || lowerCat.includes("juice") || lowerCat.includes("mocktail");

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center border overflow-hidden shadow-xs transition-transform group-hover:scale-105 ${sizeClasses} ${
        isVeg
          ? "border-emerald-600/30 bg-gradient-to-br from-[#173F35]/15 via-emerald-950/10 to-[#FAF7F0]"
          : "border-amber-700/30 bg-gradient-to-br from-[#173F35]/20 via-amber-950/10 to-[#FAF7F0]"
      }`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#173F35_1px,transparent_1px)] [background-size:6px_6px]" />

      {/* Culinary Icon */}
      <div className="relative z-10 text-[#173F35]">
        {isStarter && <FlameIcon className={`${iconSizes} text-amber-700`} />}
        {isDessert && <SparklesIcon className={`${iconSizes} text-[#E8B95B]`} />}
        {isBeverage && <SparklesIcon className={`${iconSizes} text-cyan-800`} />}
        {!isStarter && !isDessert && !isBeverage && (
          <UtensilsIcon className={`${iconSizes} text-[#173F35]`} />
        )}
      </div>

      {/* Tiny dietary tag indicator on top corner */}
      <div
        className={`absolute top-1 right-1 h-2 w-2 rounded-full border border-white shadow-xs ${
          isVeg ? "bg-emerald-600" : "bg-rose-700"
        }`}
        title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
      />

      {/* Subtle bottom letter badge */}
      <span className="absolute bottom-0.5 inset-x-0 text-center text-[8px] font-bold tracking-tight text-[#173F35]/70 uppercase truncate px-0.5">
        {name.slice(0, 3)}
      </span>
    </div>
  );
}
