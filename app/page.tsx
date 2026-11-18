"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  SmartphoneIcon,
  ChefHatIcon,
  ReceiptIcon,
  BuildingIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  QrCodeIcon,
  ClockIcon,
  BellIcon,
  UtensilsIcon,
  CheckIcon,
} from "@/components/ui/icons";

export default function Home() {
  const [heroStation, setHeroStation] = useState<"guest" | "kitchen" | "billing">("guest");
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#242B2A] selection:bg-[#E8B95B] selection:text-[#173F35]">
      {/* 1. ELEGANT BRAND NAVIGATION */}
      <header className="sticky top-0 z-50 border-b border-[#173F35]/10 bg-[#FAF7F0]/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          {/* Logo & Brand Identity */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="rounded-xl bg-[#173F35] p-1.5 shadow-luxury transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="Green Embassy Logo"
                width={80}
                height={48}
                className="h-9 w-auto object-contain"
                priority
              />
            </div>
            <div>
              <span className="font-serif text-lg tracking-wider font-bold text-[#173F35] sm:text-xl">
                GREEN EMBASSY
              </span>
              <span className="block text-[10px] font-sans font-semibold uppercase tracking-widest text-[#E8B95B] -mt-0.5">
                Luxury Restaurant Tech &bull; Operations
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-[#242B2A]/80">
            <a href="#portals" className="hover:text-[#173F35] transition-colors">
              Portal Stations
            </a>
            <a href="#experience" className="hover:text-[#173F35] transition-colors">
              Guest Experience
            </a>
            <a href="#workflow" className="hover:text-[#173F35] transition-colors">
              Workflow
            </a>
            <a href="#architecture" className="hover:text-[#173F35] transition-colors">
              Architecture
            </a>
          </nav>

          {/* Status Badge & Enter CTA */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#173F35]/15 bg-white px-3 py-1 shadow-luxury">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-[11px] font-semibold text-[#173F35]">
                Platform Active
              </span>
            </div>
            <a
              href="#portals"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#173F35] px-4 py-2 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-95 transition-all cursor-pointer"
            >
              <span>Explore Portals</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. PREMIUM HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-[#173F35]/10">
        {/* Subtle Luxury Ambient Background Accents */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
          <div className="h-[500px] w-[500px] rounded-full bg-radial from-[#E8B95B]/15 via-transparent to-transparent blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5 sm:px-8 relative z-10">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Left Column: Headline & Value Proposition */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E8B95B]/40 bg-[#E8B95B]/10 px-4 py-1.5 text-xs font-semibold text-[#173F35] uppercase tracking-wider shadow-xs">
                <ShieldCheckIcon className="w-4 h-4 text-[#E8B95B]" />
                <span>Next-Gen QR Hospitality Platform</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#173F35] tracking-tight leading-[1.12]">
                Haute Cuisine Grace Meets Precision Restaurant Technology
              </h1>

              <p className="text-base sm:text-lg text-[#242B2A]/75 leading-relaxed font-sans max-w-2xl">
                Green Embassy synchronizes every facet of luxury dining. From instant contactless table-side QR ordering and live kitchen orchestration to atomic bill settlement and multi-tenant operational intelligence.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="#portals"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-7 font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-98 transition-all cursor-pointer"
                >
                  <span>Launch Station Portals</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </a>

                <Link
                  href="/table?t=b61bd809b5cce05fa43190684d18e8df"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#173F35]/25 bg-white px-6 font-semibold text-sm text-[#173F35] shadow-luxury hover:bg-stone-50 active:scale-98 transition-all"
                >
                  <SmartphoneIcon className="w-4 h-4 text-[#173F35]" />
                  <span>Interactive Guest Demo</span>
                </Link>
              </div>

              {/* Trust & Architecture Pill Highlights */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#173F35]/10 max-w-lg">
                <div>
                  <p className="font-serif text-2xl font-bold text-[#173F35]">&lt; 100ms</p>
                  <p className="text-xs text-[#242B2A]/60 font-medium">Order Latency</p>
                </div>
                <div>
                  <p className="font-serif text-2xl font-bold text-[#173F35]">100%</p>
                  <p className="text-xs text-[#242B2A]/60 font-medium">Server Validated</p>
                </div>
                <div>
                  <p className="font-serif text-2xl font-bold text-[#173F35]">Zero App</p>
                  <p className="text-xs text-[#242B2A]/60 font-medium">Camera QR Scan</p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Restaurant Tech Station Preview */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md rounded-3xl bg-[#173F35] p-6 text-white shadow-luxury-lg border border-[#E8B95B]/30">
                {/* Station Switcher Tabs */}
                <div className="mb-4 flex rounded-2xl bg-white/10 p-1 text-[11px] font-bold">
                  <button
                    onClick={() => setHeroStation("guest")}
                    className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                      heroStation === "guest"
                        ? "bg-[#E8B95B] text-[#173F35] shadow-sm"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    1. Guest QR
                  </button>
                  <button
                    onClick={() => setHeroStation("kitchen")}
                    className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                      heroStation === "kitchen"
                        ? "bg-[#E8B95B] text-[#173F35] shadow-sm"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    2. Kitchen KDS
                  </button>
                  <button
                    onClick={() => setHeroStation("billing")}
                    className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                      heroStation === "billing"
                        ? "bg-[#E8B95B] text-[#173F35] shadow-sm"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    3. POS Billing
                  </button>
                </div>

                {/* STATION 1: GUEST TABLE QR VIEW */}
                {heroStation === "guest" && (
                  <div className="space-y-3 font-sans animate-fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-[#E8B95B] animate-ping" />
                        <div>
                          <p className="text-xs font-serif font-bold text-[#E8B95B] uppercase tracking-wide">
                            Table 4 • Dine In
                          </p>
                          <p className="text-[10px] text-white/60">Session Active • Contactless Ordering</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                        Live Sync
                      </span>
                    </div>

                    {/* Dish 1 */}
                    <div className="rounded-2xl bg-white/5 p-3 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-xs border border-emerald-400 bg-emerald-950 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        <div>
                          <p className="text-xs font-serif font-semibold text-white">Truffle Wild Mushroom Risotto</p>
                          <p className="text-[10px] text-white/60">Arborio rice, porcini, parmesan crisp</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-serif text-[#E8B95B]">₹540</span>
                    </div>

                    {/* Dish 2 */}
                    <div className="rounded-2xl bg-white/5 p-3 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-xs border border-emerald-400 bg-emerald-950 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        <div>
                          <p className="text-xs font-serif font-semibold text-white">Saffron Dum Biryani</p>
                          <p className="text-[10px] text-white/60">Fragrant basmati, fried shallots, burani</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-serif text-[#E8B95B]">₹480</span>
                    </div>

                    {/* Status Badge */}
                    <div className="rounded-xl bg-[#E8B95B]/15 border border-[#E8B95B]/40 p-2.5 text-xs text-[#E8B95B] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ChefHatIcon className="w-3.5 h-3.5 text-[#E8B95B]" />
                        <span className="font-semibold text-[11px]">Ticket #T4-02 Sent to Line</span>
                      </div>
                      <span className="font-bold tabular-nums text-[10px]">Preparing</span>
                    </div>

                    {/* Footer */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-white/60">Session Subtotal (2 items)</p>
                        <p className="text-sm font-serif font-bold text-[#E8B95B]">₹1,020.00</p>
                      </div>
                      <span className="rounded-xl bg-[#E8B95B] px-3.5 py-1.5 font-bold text-[#173F35] text-xs shadow-luxury">
                        Order Confirmed
                      </span>
                    </div>
                  </div>
                )}

                {/* STATION 2: KITCHEN DISPLAY KDS VIEW */}
                {heroStation === "kitchen" && (
                  <div className="space-y-3 font-sans animate-fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <span className="text-2xl font-serif font-black text-[#E8B95B] block leading-none">
                          TABLE 4
                        </span>
                        <span className="text-[10px] font-mono text-stone-300">
                          TICKET #T4-02 • 04m 12s elapsed
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-bold text-amber-300 border border-amber-400/40 animate-pulse">
                        Cooking On Line
                      </span>
                    </div>

                    {/* Ticket Items */}
                    <div className="space-y-2 text-xs">
                      <div className="rounded-xl bg-white/5 p-2.5 border border-white/10">
                        <div className="flex justify-between font-bold text-white">
                          <span>1× Truffle Wild Mushroom Risotto</span>
                          <span className="text-[#E8B95B]">Line 1</span>
                        </div>
                        <p className="text-[10px] text-amber-200/80 italic mt-0.5">Note: Light on parmesan</p>
                      </div>

                      <div className="rounded-xl bg-white/5 p-2.5 border border-white/10">
                        <div className="flex justify-between font-bold text-white">
                          <span>1× Saffron Dum Biryani</span>
                          <span className="text-[#E8B95B]">Line 2</span>
                        </div>
                        <p className="text-[10px] text-amber-200/80 italic mt-0.5">Note: Mild spice for guest</p>
                      </div>
                    </div>

                    {/* KDS Progression CTA */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-white/60">Cust. Lock: 00:00 (Expired)</span>
                      <span className="rounded-xl bg-emerald-700 px-3.5 py-1.5 font-bold text-white text-xs shadow-luxury flex items-center gap-1.5">
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>Ready For Runner</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* STATION 3: POS CASHIER BILLING VIEW */}
                {heroStation === "billing" && (
                  <div className="space-y-3 font-sans animate-fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#E8B95B] block">
                          Checkout • Table 4
                        </span>
                        <span className="text-[10px] text-white/60">Invoice Draft #INV-1048</span>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                        All Items Served
                      </span>
                    </div>

                    {/* Financial Breakdown */}
                    <div className="rounded-2xl bg-white/5 p-3 border border-white/10 space-y-1.5 text-xs">
                      <div className="flex justify-between text-white/80">
                        <span>Items Subtotal</span>
                        <span className="font-bold tabular-nums">₹1,020.00</span>
                      </div>
                      <div className="flex justify-between text-white/80 text-[11px]">
                        <span>CGST (2.5%)</span>
                        <span className="tabular-nums">₹25.50</span>
                      </div>
                      <div className="flex justify-between text-white/80 text-[11px]">
                        <span>SGST (2.5%)</span>
                        <span className="tabular-nums">₹25.50</span>
                      </div>
                      <div className="pt-1.5 border-t border-white/10 flex justify-between font-serif font-bold text-sm text-[#E8B95B]">
                        <span>Grand Total</span>
                        <span className="tabular-nums text-base">₹1,071.00</span>
                      </div>
                    </div>

                    {/* Settlement CTA */}
                    <div className="pt-1 border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-white/70">Payment: Cash / UPI / Card</span>
                      <span className="rounded-xl bg-[#E8B95B] px-3.5 py-1.5 font-bold text-[#173F35] text-xs shadow-luxury flex items-center gap-1">
                        <ReceiptIcon className="w-3.5 h-3.5" />
                        <span>Settle Session</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTRODUCTION TO THE QR ORDERING PLATFORM */}
      <section id="experience" className="py-20 bg-white border-b border-[#173F35]/10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8B95B] bg-[#173F35] px-3.5 py-1 rounded-full inline-block mb-3">
              Hospitality Reimagined
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#173F35]">
              Seamless Dining Without The Friction
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#242B2A]/70 leading-relaxed font-sans">
              Designed specifically for high-end restaurants, boutique bistros, and hotel dining rooms seeking discreet, elegant technology that complements attentive hospitality rather than replacing it.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury hover:border-[#173F35]/30 hover:shadow-luxury-lg transition-all">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B] mb-5">
                <QrCodeIcon className="w-6 h-6 text-[#E8B95B]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#173F35]">
                Zero-App Camera Scanning
              </h3>
              <p className="mt-2.5 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                Guests simply scan the bespoke table tent sticker with their phone camera. No apps, downloads, or registration hurdles required.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury hover:border-[#173F35]/30 hover:shadow-luxury-lg transition-all">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B] mb-5">
                <UtensilsIcon className="w-6 h-6 text-[#E8B95B]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#173F35]">
                Authoritative Server Menu
              </h3>
              <p className="mt-2.5 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                Menu prices, veg/non-veg tags, and item availability are verified against the database. Client-side price manipulation is strictly prevented.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury hover:border-[#173F35]/30 hover:shadow-luxury-lg transition-all">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B] mb-5">
                <ClockIcon className="w-6 h-6 text-[#E8B95B]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#173F35]">
                Dynamic Grace Window
              </h3>
              <p className="mt-2.5 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                A 120-second countdown allows guests to modify quantities or cancel items before kitchen preparation commences.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury hover:border-[#173F35]/30 hover:shadow-luxury-lg transition-all">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B] mb-5">
                <BellIcon className="w-6 h-6 text-[#E8B95B]" />
              </div>
              <h3 className="font-serif text-lg font-bold text-[#173F35]">
                Instant Staff Assistance
              </h3>
              <p className="mt-2.5 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                One-tap waiter summons alert service staff in real-time with anti-spam protections and single-click table acknowledgement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOUR INTERACTIVE PORTAL CARDS */}
      <section id="portals" className="py-24 bg-[#FAF7F0] border-b border-[#173F35]/10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-[#173F35]/60 mb-2 block">
              Unified Operating Stations
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#173F35]">
              Interactive Operations Portals
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#242B2A]/70 leading-relaxed font-sans">
              Select any role below to experience the real-time workflows powering Green Embassy restaurant operations.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* PORTAL CARD 1: Customer Table Ordering */}
            <div className="flex flex-col justify-between rounded-3xl bg-white p-7 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg hover:border-[#173F35]/30 hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B]">
                    <SmartphoneIcon className="w-6 h-6 text-[#E8B95B]" />
                  </div>
                  <span className="rounded-full bg-[#173F35]/5 border border-[#173F35]/15 px-3 py-1 text-[11px] font-semibold text-[#173F35]">
                    Dine-in Guest
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-[#173F35]">
                  Customer QR Ordering
                </h3>
                <p className="mt-3 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                  The guest ordering interface. Features interactive category filters, veg/non-veg tags, chef notes, live order status, and instant waiter summons.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-[#173F35]/10 space-y-2">
                <Link
                  href="/table?t=b61bd809b5cce05fa43190684d18e8df"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-98 transition-all"
                >
                  <span>Launch Demo Table T1</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/table"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#173F35]/15 text-[11px] font-semibold text-[#242B2A]/80 hover:bg-stone-50 transition-colors"
                >
                  <QrCodeIcon className="w-3.5 h-3.5" />
                  <span>Scan Screen View</span>
                </Link>
              </div>
            </div>

            {/* PORTAL CARD 2: Kitchen Display System (KDS) */}
            <div className="flex flex-col justify-between rounded-3xl bg-white p-7 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg hover:border-[#173F35]/30 hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B]">
                    <ChefHatIcon className="w-6 h-6 text-[#E8B95B]" />
                  </div>
                  <span className="rounded-full bg-[#173F35]/5 border border-[#173F35]/15 px-3 py-1 text-[11px] font-semibold text-[#173F35]">
                    Culinary Line
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-[#173F35]">
                  Kitchen Display System
                </h3>
                <p className="mt-3 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                  Real-time kitchen display. 3-column ticket pipeline (New Orders &rarr; Preparing &rarr; Ready &rarr; Served), audio synthesizer chime, customer modification locks, and waiter calls.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-[#173F35]/10">
                <Link
                  href="/kitchen"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-98 transition-all"
                >
                  <span>Open Kitchen KDS</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* PORTAL CARD 3: Manager Billing Desk */}
            <div className="flex flex-col justify-between rounded-3xl bg-white p-7 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg hover:border-[#173F35]/30 hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B]">
                    <ReceiptIcon className="w-6 h-6 text-[#E8B95B]" />
                  </div>
                  <span className="rounded-full bg-[#173F35]/5 border border-[#173F35]/15 px-3 py-1 text-[11px] font-semibold text-[#173F35]">
                    Cashier &amp; Floor
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-[#173F35]">
                  Manager Billing Desk
                </h3>
                <p className="mt-3 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                  Financial checkout and settlement. Live dining table cards, order item aggregation, customizable discounts, GST tax calculations, and printable 80mm thermal receipts.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-[#173F35]/10">
                <Link
                  href="/billing"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-98 transition-all"
                >
                  <span>Access Billing Desk</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* PORTAL CARD 4: Restaurant Admin Console */}
            <div className="flex flex-col justify-between rounded-3xl bg-white p-7 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg hover:border-[#173F35]/30 hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173F35] text-[#E8B95B]">
                    <BuildingIcon className="w-6 h-6 text-[#E8B95B]" />
                  </div>
                  <span className="rounded-full bg-[#173F35]/5 border border-[#173F35]/15 px-3 py-1 text-[11px] font-semibold text-[#173F35]">
                    Executive Admin
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-[#173F35]">
                  Restaurant Admin
                </h3>
                <p className="mt-3 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                  The executive cockpit. Manage menu catalog, dish pricing and availability, generate cryptographically signed table QR codes, print multi-table tent sheets, and audit sales reports.
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-[#173F35]/10">
                <Link
                  href="/admin"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] active:scale-98 transition-all"
                >
                  <span>Open Admin Console</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. WORKFLOW EXPLANATION & ARCHITECTURAL HIGHLIGHTS */}
      <section id="workflow" className="py-20 bg-white border-b border-[#173F35]/10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8B95B] bg-[#173F35] px-3.5 py-1 rounded-full inline-block mb-3">
              Flawless Execution
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#173F35]">
              The End-to-End Restaurant Lifecycle
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#242B2A]/70 leading-relaxed font-sans">
              How a dining party journeys from first scan to final settled invoice in seconds.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury">
              <span className="font-serif text-3xl font-bold text-[#173F35]/30">01</span>
              <h3 className="font-serif text-lg font-bold text-[#173F35] mt-2">
                Scan &amp; Authoritative Menu
              </h3>
              <p className="mt-2 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                Guest scans the table QR token. The menu renders instantly with live restaurant pricing, dietary indicators, and custom culinary notes.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury">
              <span className="font-serif text-3xl font-bold text-[#173F35]/30">02</span>
              <h3 className="font-serif text-lg font-bold text-[#173F35] mt-2">
                Kitchen Intake &amp; Grace Period
              </h3>
              <p className="mt-2 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                Order dispatches instantly to KDS with audio bell chime. A 120s edit window protects guests before the kitchen starts preparation.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl bg-[#FAF7F0] p-6 border border-[#173F35]/10 shadow-luxury">
              <span className="font-serif text-3xl font-bold text-[#173F35]/30">03</span>
              <h3 className="font-serif text-lg font-bold text-[#173F35] mt-2">
                Atomic Bill &amp; Session Settlement
              </h3>
              <p className="mt-2 text-xs text-[#242B2A]/70 leading-relaxed font-sans">
                Cashier selects the occupied table, reviews live orders, applies authorized discounts, logs payment, and generates GST thermal receipts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. TECHNICAL INTEGRITY & SECURITY CALLOUT */}
      <section id="architecture" className="py-20 bg-[#FAF7F0]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="rounded-3xl bg-[#173F35] p-8 sm:p-12 text-[#FAF7F0] shadow-luxury-lg border border-[#E8B95B]/30">
            <div className="grid gap-8 lg:grid-cols-12 items-center">
              <div className="lg:col-span-8 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E8B95B]">
                  Enterprise Architecture
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-snug">
                  Built on PostgreSQL Row Level Security &amp; Transaction-Safe RPCs
                </h3>
                <p className="text-xs sm:text-sm text-[#FAF7F0]/80 leading-relaxed font-sans max-w-2xl">
                  Unlike brittle consumer QR tools, Green Embassy enforces full tenant isolation at the database layer. Cross-restaurant data contamination is mathematically impossible. Privileged financial settlements are locked via atomic stored procedures.
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E8B95B]">
                    <CheckIcon className="w-4 h-4 text-[#E8B95B]" />
                    <span>PostgreSQL Tenant RLS</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E8B95B]">
                    <CheckIcon className="w-4 h-4 text-[#E8B95B]" />
                    <span>Role-Based Auth (Manager/Staff)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E8B95B]">
                    <CheckIcon className="w-4 h-4 text-[#E8B95B]" />
                    <span>Next.js 16 Partial Prerendering</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10 text-center">
                  <span className="font-serif text-2xl font-bold text-[#E8B95B]">settle_session_bill</span>
                  <p className="text-[11px] text-white/70 mt-1">Atomic settlement RPC procedure</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 border border-white/10 text-center">
                  <span className="font-serif text-2xl font-bold text-[#E8B95B]">atomic_order_change</span>
                  <p className="text-[11px] text-white/70 mt-1">Transaction-safe guest adjustments</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. ATTRACTIVE FOOTER */}
      <footer className="border-t border-[#173F35]/10 bg-[#173F35] text-[#FAF7F0] pt-14 pb-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 md:grid-cols-4 pb-12 border-b border-white/10">
            {/* Brand Column */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/10 p-1.5 shadow-sm">
                  <Image
                    src="/logo.png"
                    alt="Green Embassy Logo"
                    width={70}
                    height={40}
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <span className="font-serif text-lg font-bold text-[#E8B95B] tracking-wider">
                  GREEN EMBASSY
                </span>
              </div>
              <p className="text-xs text-[#FAF7F0]/70 leading-relaxed font-sans">
                Next-generation QR restaurant technology platform engineered for luxury hospitality, real-time culinary lines, and rigorous financial integrity.
              </p>
            </div>

            {/* Portal Stations Column */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#E8B95B]">
                Operating Stations
              </p>
              <ul className="space-y-2 text-xs font-medium text-[#FAF7F0]/80">
                <li>
                  <Link href="/table?t=b61bd809b5cce05fa43190684d18e8df" className="hover:text-[#E8B95B] transition-colors">
                    Customer Table Ordering
                  </Link>
                </li>
                <li>
                  <Link href="/kitchen" className="hover:text-[#E8B95B] transition-colors">
                    Kitchen Display System (KDS)
                  </Link>
                </li>
                <li>
                  <Link href="/billing" className="hover:text-[#E8B95B] transition-colors">
                    Manager Billing &amp; Settlement
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-[#E8B95B] transition-colors">
                    Restaurant Admin Console
                  </Link>
                </li>
              </ul>
            </div>

            {/* Features & Security Column */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#E8B95B]">
                Security &amp; Core
              </p>
              <ul className="space-y-2 text-xs font-medium text-[#FAF7F0]/80">
                <li>PostgreSQL Row Level Security (RLS)</li>
                <li>Authoritative Server-Side Pricing</li>
                <li>Customer Order Lock Countdown</li>
                <li>Web Audio API Kitchen Bell</li>
                <li>Thermal 80mm GST Invoice Receipts</li>
              </ul>
            </div>

            {/* Platform Tech Column */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#E8B95B]">
                Technology Architecture
              </p>
              <ul className="space-y-2 text-xs font-medium text-[#FAF7F0]/80">
                <li>Next.js 16 (App Router)</li>
                <li>React 19 &bull; TypeScript 5</li>
                <li>Tailwind CSS v4 Design Tokens</li>
                <li>Supabase Database &amp; Auth Engine</li>
                <li>Zero External Icon Dependencies</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FAF7F0]/60">
            <p>&copy; 2026 Green Embassy Hospitality Platform. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-[#E8B95B] transition-colors">
                Privacy Policy
              </Link>
              <span>&bull;</span>
              <span>Enterprise SaaS Multi-Tenant Isolation</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
