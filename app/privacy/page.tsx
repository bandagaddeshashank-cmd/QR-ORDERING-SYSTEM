import Link from "next/link";
import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon, ShieldCheckIcon, LockIcon, CheckIcon } from "@/components/ui/icons";

export const metadata = {
  title: "Privacy & Security Governance — Green Embassy",
  description: "Enterprise data privacy, zero-credential customer ordering, and PostgreSQL tenant isolation standards.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#242B2A] selection:bg-[#E8B95B] selection:text-[#173F35]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[#173F35]/10 bg-[#FAF7F0]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="rounded-xl bg-[#173F35] p-1.5 shadow-luxury transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="Green Embassy Logo"
                width={70}
                height={40}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>
            <div>
              <span className="font-serif text-lg tracking-wider font-bold text-[#173F35]">
                GREEN EMBASSY
              </span>
              <span className="block text-[9px] font-sans font-semibold uppercase tracking-widest text-[#E8B95B] -mt-0.5">
                Privacy &bull; Trust &bull; Governance
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#173F35]/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#173F35] shadow-xs hover:bg-stone-50 transition-colors"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Return to Station Portals</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-12 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8B95B]/40 bg-[#E8B95B]/10 px-3.5 py-1 text-xs font-semibold text-[#173F35] uppercase tracking-wider mb-3">
            <ShieldCheckIcon className="w-4 h-4 text-[#E8B95B]" />
            <span>Platform Privacy &amp; Data Security Standards</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#173F35] tracking-tight">
            Enterprise Hospitality Privacy Policy
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#242B2A]/70 max-w-3xl leading-relaxed">
            Green Embassy is engineered from the ground up on zero-credential guest interactions, cryptographic tokenization, and strict database multi-tenant isolation.
          </p>
        </div>

        <div className="space-y-8 font-sans">
          {/* Section 1: Zero-Credential Guest Ordering */}
          <section className="rounded-3xl bg-white p-6 sm:p-8 border border-[#173F35]/10 shadow-luxury">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173F35] text-[#E8B95B]">
                <LockIcon className="w-5 h-5 text-[#E8B95B]" />
              </div>
              <h2 className="font-serif text-xl font-bold text-[#173F35]">
                1. Zero-Credential Guest Ordering Architecture
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#242B2A]/75 leading-relaxed">
              Unlike consumer dining applications that demand phone numbers, email registration, mobile app downloads, or intrusive location permissions, Green Embassy operates completely anonymously for guests:
            </p>
            <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-[#242B2A]/80">
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>No Personal Information Required:</strong> Guests are never required to provide names, phone numbers, or passwords to view menus or place orders.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>No Persistent Trackers or Advertising Cookies:</strong> We do not track guest browsing across third-party websites or deploy tracking ad-pixels.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>Cryptographic Table Tokens:</strong> Table stands utilize cryptographically randomized, non-sequential 32-character hex tokens to isolate orders strictly to the physical dining session.</span>
              </li>
            </ul>
          </section>

          {/* Section 2: Multi-Tenant Data Isolation */}
          <section className="rounded-3xl bg-white p-6 sm:p-8 border border-[#173F35]/10 shadow-luxury">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173F35] text-[#E8B95B]">
                <ShieldCheckIcon className="w-5 h-5 text-[#E8B95B]" />
              </div>
              <h2 className="font-serif text-xl font-bold text-[#173F35]">
                2. Multi-Tenant Row Level Security (RLS) Isolation
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#242B2A]/75 leading-relaxed">
              Every restaurant operating on Green Embassy resides within an isolated tenant partition enforced at the PostgreSQL database kernel level:
            </p>
            <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-[#242B2A]/80">
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>Staff and manager accounts are bound to a verified <code>restaurant_id</code> stored in cryptographic JWT claims.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>PostgreSQL RLS policies automatically prevent any query from inspecting, aggregating, or altering records from another dining establishment.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>Sensitive financial settlements and order modifications are executed strictly through atomic stored procedures that verify tenant bounds before recording data.</span>
              </li>
            </ul>
          </section>

          {/* Section 3: Financial Integrity & GST Invoicing */}
          <section className="rounded-3xl bg-white p-6 sm:p-8 border border-[#173F35]/10 shadow-luxury">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173F35] text-[#E8B95B]">
                <ShieldCheckIcon className="w-5 h-5 text-[#E8B95B]" />
              </div>
              <h2 className="font-serif text-xl font-bold text-[#173F35]">
                3. Financial Integrity &amp; Regulatory Compliance
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#242B2A]/75 leading-relaxed">
              Green Embassy complies with legal accounting standards for Indian hospitality billing:
            </p>
            <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-[#242B2A]/80">
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>Itemized invoice records maintain mathematical snapshot consistency (subtotal, approved discounts, CGST/SGST breakdown, and final totals).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>Atomic transaction locks guarantee that no dining session can ever be double-settled or have conflicting receipts generated.</span>
              </li>
            </ul>
          </section>

          {/* Contact & Support Section */}
          <section className="rounded-3xl bg-[#173F35] p-6 sm:p-8 text-[#FAF7F0] shadow-luxury-lg border border-[#E8B95B]/30">
            <h2 className="font-serif text-xl font-bold text-white mb-2">
              Questions Regarding Governance &amp; Security?
            </h2>
            <p className="text-xs sm:text-sm text-[#FAF7F0]/80 leading-relaxed max-w-2xl">
              For technical inquiries regarding tenant separation, Supabase authentication, or POS audit trails, please contact your restaurant platform administrator.
            </p>
            <div className="mt-5">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-[#E8B95B] px-5 py-2.5 text-xs font-bold text-[#173F35] shadow-luxury hover:bg-[#d8a84b] active:scale-95 transition-all"
              >
                <span>Back to Station Selector</span>
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#173F35]/10 bg-[#173F35] text-[#FAF7F0] py-8 text-center text-xs text-[#FAF7F0]/60">
        <p>&copy; 2026 Green Embassy Restaurant Technology Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
