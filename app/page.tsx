"use client";

import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8F5EF] text-[#252D38] selection:bg-[#E7B94F] selection:text-[#193A2D]">
      {/* Top Brand Bar */}
      <header className="border-b border-[#252D38]/10 bg-[#193A2D] px-6 py-4 text-[#F8F5EF] shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Green Embassy Logo"
              width={80}
              height={48}
              className="h-10 w-auto rounded bg-white/10 p-1"
              priority
            />
            <div>
              <span className="text-base font-black tracking-wide text-[#E7B94F]">
                GREEN EMBASSY
              </span>
              <p className="text-[11px] font-semibold text-white/70">
                Enterprise Restaurant Operations Platform
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white/80">
              System Operational
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <span className="inline-block rounded-full bg-[#193A2D]/10 px-3.5 py-1 text-xs font-bold text-[#193A2D] uppercase tracking-wider mb-3">
            Multi-Restaurant Ready Platform
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-[#193A2D] tracking-tight">
            Seamless Dining, Fast Kitchen, Accurate Billing
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#252D38]/70 leading-relaxed">
            Modern mobile QR ordering for guests, real-time ticket display for chefs, and automated billing with full audit trails for restaurant managers.
          </p>
        </div>

        {/* Portal Stations Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          {/* Card 1: Customer QR Ordering */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm hover:shadow-xl hover:border-[#193A2D]/40 transition-all">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193A2D] text-2xl text-[#E7B94F] mb-4">
                📱
              </div>
              <h2 className="text-lg font-black text-[#193A2D]">Table QR Menu</h2>
              <p className="mt-2 text-xs text-[#252D38]/70 leading-relaxed">
                Guest interface. Category tabs, veg/non-veg tags, preparation notes, countdown window and waiter calling.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#252D38]/10">
              <Link
                href="/table?t=b61bd809b5cce05fa43190684d18e8df"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21] active:scale-95 transition-all"
              >
                Launch Table T1 →
              </Link>
            </div>
          </div>

          {/* Card 2: Kitchen Display System (KDS) */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm hover:shadow-xl hover:border-[#193A2D]/40 transition-all">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193A2D] text-2xl text-[#E7B94F] mb-4">
                👨‍🍳
              </div>
              <h2 className="text-lg font-black text-[#193A2D]">Kitchen Display</h2>
              <p className="mt-2 text-xs text-[#252D38]/70 leading-relaxed">
                Chef operations. 3-stage visual pipeline, edit lock countdown, arrival chime, and urgent waiter call alerts.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#252D38]/10">
              <Link
                href="/kitchen"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21] active:scale-95 transition-all"
              >
                Open Kitchen KDS →
              </Link>
            </div>
          </div>

          {/* Card 3: Manager Billing Desk */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm hover:shadow-xl hover:border-[#193A2D]/40 transition-all">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193A2D] text-2xl text-[#E7B94F] mb-4">
                💼
              </div>
              <h2 className="text-lg font-black text-[#193A2D]">Manager Billing</h2>
              <p className="mt-2 text-xs text-[#252D38]/70 leading-relaxed">
                Cashier settlement. Table occupancy grid, dish aggregation, discount calculation, and printable receipts.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#252D38]/10">
              <Link
                href="/billing"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21] active:scale-95 transition-all"
              >
                Access Billing Desk →
              </Link>
            </div>
          </div>

          {/* Card 4: Restaurant Admin Console */}
          <div className="flex flex-col justify-between rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm hover:shadow-xl hover:border-[#193A2D]/40 transition-all">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193A2D] text-2xl text-[#E7B94F] mb-4">
                ⚙️
              </div>
              <h2 className="text-lg font-black text-[#193A2D]">Restaurant Admin</h2>
              <p className="mt-2 text-xs text-[#252D38]/70 leading-relaxed">
                Management console. Menu catalog, dish pricing, table QR generation, print stand sheets, and sales reports.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#252D38]/10">
              <Link
                href="/admin"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21] active:scale-95 transition-all"
              >
                Open Admin Console →
              </Link>
            </div>
          </div>
        </div>

        {/* Security & Reliability Highlights */}
        <section className="rounded-3xl bg-[#193A2D] p-8 text-[#F8F5EF] shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E7B94F]">
                Security & Isolation Architecture
              </span>
              <h3 className="text-2xl font-bold mt-1 text-white">
                Engineered for Real-World Hospitality
              </h3>
              <p className="mt-2 text-xs text-white/80 max-w-xl leading-relaxed">
                Strict server-side validation on every request. Browser-submitted prices are never trusted. All kitchen and waiter endpoints enforce staff authentication. Table sessions and bills are settled atomically.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <div className="rounded-2xl bg-white/10 p-3 text-center border border-white/10">
                <span className="text-lg font-bold text-[#E7B94F]">100%</span>
                <p className="text-[11px] text-white/70">Server Pricing</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center border border-white/10">
                <span className="text-lg font-bold text-[#E7B94F]">Atomic</span>
                <p className="text-[11px] text-white/70">Bill Settlement</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 text-center border border-white/10">
                <span className="text-lg font-bold text-[#E7B94F]">Multi-Tenant</span>
                <p className="text-[11px] text-white/70">Data Isolation</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#252D38]/10 py-6 text-center text-xs text-[#252D38]/50">
        © 2026 Green Embassy QR Ordering Platform. All rights reserved.
      </footer>
    </div>
  );
}
