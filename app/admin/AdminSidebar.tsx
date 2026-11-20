"use client";

import React from "react";
import Link from "next/link";
import {
  GridIcon,
  UtensilsIcon,
  QrCodeIcon,
  TrendingUpIcon,
  SettingsIcon,
  ChefHatIcon,
  ReceiptIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
  CloseIcon,
  SmartphoneIcon,
} from "@/components/ui/icons";
import { supabaseManager as supabase } from "@/lib/supabaseManager";

export type AdminTab = "overview" | "menu" | "tables" | "reports" | "settings";

interface AdminSidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  restaurantName: string;
  tableCount: number;
  activeSessionsCount: number;
  menuItemCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  userEmail?: string;
}

export default function AdminSidebar({
  currentTab,
  onSelectTab,
  restaurantName,
  tableCount,
  activeSessionsCount,
  menuItemCount,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  userEmail,
}: AdminSidebarProps) {
  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: "overview",
      label: "Executive Dashboard",
      icon: GridIcon,
    },
    {
      id: "tables",
      label: "Tables & QR Center",
      icon: QrCodeIcon,
      badge: activeSessionsCount > 0 ? `${activeSessionsCount} Active` : `${tableCount}`,
      badgeColor:
        activeSessionsCount > 0
          ? "bg-[#E8B95B] text-[#173F35]"
          : "bg-white/10 text-white/70",
    },
    {
      id: "menu",
      label: "Menu Catalog",
      icon: UtensilsIcon,
      badge: menuItemCount,
      badgeColor: "bg-white/10 text-white/70",
    },
    {
      id: "reports",
      label: "Sales & Analytics",
      icon: TrendingUpIcon,
    },
    {
      id: "settings",
      label: "Configuration",
      icon: SettingsIcon,
    },
  ];

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[AdminSidebar] Sign out error:", err);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#173F35] text-[#FAF7F0] transition-all duration-300 ease-in-out border-r border-white/10 shadow-luxury-lg select-none ${
          isCollapsed ? "w-20" : "w-64"
        } ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 py-4.5 border-b border-white/10 relative">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Monogram Crest */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E8B95B] via-[#dfad4c] to-[#c99b44] text-[#173F35] font-serif font-black text-base shadow-luxury border border-white/20">
              GE
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <span className="block font-serif font-bold text-sm tracking-wide text-[#E8B95B] truncate">
                  {restaurantName || "GREEN EMBASSY"}
                </span>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            aria-label="Close navigation sidebar"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
                Core Operations
              </p>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-white/15 to-white/5 text-[#E8B95B] border border-[#E8B95B]/40 shadow-xs font-bold"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? "text-[#E8B95B]" : "text-white/60"
                    }`}
                  />

                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}

                  {!isCollapsed && item.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                        item.badgeColor || "bg-white/10 text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#E8B95B]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Portal Switcher */}
          <div className="space-y-1 border-t border-white/10 pt-4">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
                Operational Portals
              </p>
            )}

            <Link
              href="/kitchen"
              className="flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/8 hover:text-white transition-all group"
              title="Kitchen Display System"
            >
              <ChefHatIcon className="h-4.5 w-4.5 shrink-0 text-amber-300 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span className="truncate">Kitchen KDS</span>}
            </Link>

            <Link
              href="/billing"
              className="flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/8 hover:text-white transition-all group"
              title="Cashier & Billing Desk"
            >
              <ReceiptIcon className="h-4.5 w-4.5 shrink-0 text-emerald-300 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span className="truncate">Billing Desk</span>}
            </Link>

            <Link
              href="/"
              className="flex items-center gap-3 rounded-2xl px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/8 hover:text-white transition-all group"
              title="Public Brand Showcase"
            >
              <SmartphoneIcon className="h-4.5 w-4.5 shrink-0 text-sky-300 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span className="truncate">Public Portal</span>}
            </Link>
          </div>
        </div>

        {/* Footer / Account / Collapse Toggle */}
        <div className="border-t border-white/10 p-3 bg-black/10">
          {!isCollapsed && (
            <div className="mb-3 px-2 flex items-center justify-between">
              <div className="min-w-0">
                <span className="block text-[11px] font-bold text-white truncate">
                  {userEmail || "Restaurant Manager"}
                </span>
                <span className="flex items-center gap-1.5 text-[9px] text-[#E8B95B] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Authenticated Role
                </span>
              </div>

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-rose-900/60 hover:text-rose-200 transition-colors cursor-pointer"
                aria-label="Sign out"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isCollapsed && (
            <div className="flex flex-col items-center gap-2 mb-2">
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-rose-900/60 hover:text-rose-200 transition-colors cursor-pointer"
                aria-label="Sign out"
              >
                <LogOutIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Desktop Collapse Toggle Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
