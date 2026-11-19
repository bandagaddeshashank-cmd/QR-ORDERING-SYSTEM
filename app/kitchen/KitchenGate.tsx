"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { supabaseManager as supabase } from "@/lib/supabaseManager";
import { LockIcon, LogOutIcon } from "@/components/ui/icons";

export default function KitchenGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInErr) {
      setError("Invalid staff email or password.");
    }
    setBusy(false);
  };

  const shell = "min-h-screen bg-[#101514] p-6 text-white";

  if (!ready) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <div className="text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#E8B95B] border-t-transparent mb-3" />
          <p className="text-sm font-serif font-semibold text-[#E8B95B]">
            Connecting to Kitchen Station...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`${shell} flex flex-col items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-[#161E1C] p-8 shadow-2xl border border-white/10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173F35] border border-[#E8B95B]/40 shadow-inner">
            <Image
              src="/logo.png"
              alt="Green Embassy Logo"
              width={64}
              height={40}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-serif font-extrabold text-white">
            Kitchen Display Station
          </h1>
          <p className="text-xs text-stone-400 mt-1 mb-6">
            Authorized culinary &amp; service staff access only
          </p>

          <form onSubmit={login} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
                Staff Email
              </label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@greenembassy.com"
                className="h-12 w-full rounded-xl border border-white/15 bg-[#1C2523] px-3.5 text-sm font-medium text-white placeholder:text-stone-500 focus:border-[#E8B95B] focus:bg-[#202b28] focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
                Station Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-white/15 bg-[#1C2523] px-3.5 text-sm font-medium text-white placeholder:text-stone-500 focus:border-[#E8B95B] focus:bg-[#202b28] focus:outline-none transition-all"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-rose-950/80 p-2.5 text-xs font-semibold text-rose-300 border border-rose-500/80">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] border border-[#E8B95B]/40 disabled:opacity-50 transition-all mt-2 cursor-pointer"
            >
              <LockIcon className="w-4 h-4 text-[#E8B95B]" />
              <span>{busy ? "Authenticating..." : "Access Kitchen Station"}</span>
            </button>
          </form>
        </main>
      </div>
    );
  }

  const role = session.user.app_metadata?.role;
  if (role !== "manager" && role !== "staff" && role !== "platform_admin") {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-[#161E1C] p-8 shadow-2xl border border-rose-500/50 text-center">
          <h2 className="text-xl font-serif font-bold text-rose-400 mb-2">
            Access Restricted
          </h2>
          <p className="text-sm text-stone-300 mb-6 leading-relaxed">
            This account ({session.user.email}) is not assigned as kitchen staff or manager.
          </p>
          <button
            onClick={() => supabase.auth.signOut({ scope: "local" })}
            className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-white/20 bg-white/5 font-semibold text-sm text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-[#131918] px-5 py-2.5 text-xs text-[#FAF7F0] border-b border-white/10 shadow-lg print:hidden">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold tracking-wider uppercase text-[#E8B95B]">
            KDS Operational Station
          </span>
          <span className="hidden sm:inline text-white/30">|</span>
          <span className="hidden sm:inline text-white/70">{session.user.email}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => supabase.auth.signOut({ scope: "local" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1 font-semibold text-white/90 hover:bg-white/20 transition-all text-[11px] cursor-pointer"
          >
            <LogOutIcon className="w-3.5 h-3.5" />
            <span>Exit KDS</span>
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
