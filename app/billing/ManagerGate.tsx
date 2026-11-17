"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { supabaseManager as supabase } from "@/lib/supabaseManager";

export default function ManagerGate({ children }: { children: ReactNode }) {
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
      setError("Incorrect manager email or password.");
    }
    setBusy(false);
  };

  const shell = "min-h-screen bg-[#F8F5EF] p-6 text-[#252D38]";

  if (!ready) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <div className="text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#193A2D] border-t-transparent mb-3" />
          <p className="text-sm font-semibold text-[#193A2D]">Loading Management Console...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`${shell} flex flex-col items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl border border-[#252D38]/10 text-center">
          <Image
            src="/logo.png"
            alt="Restaurant Logo"
            width={100}
            height={60}
            className="mx-auto mb-4 h-16 w-auto"
            priority
          />
          <h1 className="text-2xl font-black text-[#193A2D]">Manager Console</h1>
          <p className="text-xs text-[#252D38]/70 mt-1 mb-6">
            Authorized management credentials required for billing & settlement
          </p>

          <form onSubmit={login} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                Manager Email
              </label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@restaurant.com"
                className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-medium focus:border-[#193A2D] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-medium focus:border-[#193A2D] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 p-2.5 text-xs font-bold text-red-700 border border-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#193A2D] font-bold text-sm text-[#E7B94F] shadow-md hover:bg-[#122b21] disabled:opacity-50 transition-all mt-2"
            >
              {busy ? "Authenticating..." : "Access Management Console"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (session.user.app_metadata?.role !== "manager") {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl border border-red-200 text-center">
          <h2 className="text-xl font-bold text-red-700 mb-2">Manager Role Required</h2>
          <p className="text-sm text-[#252D38]/70 mb-6">
            The logged in account ({session.user.email}) does not have manager authorization.
          </p>
          <button
            onClick={() => supabase.auth.signOut({ scope: "local" })}
            className="h-11 w-full rounded-xl border-2 border-[#193A2D] font-bold text-sm text-[#193A2D] hover:bg-[#193A2D]/10"
          >
            Log Out
          </button>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-[#193A2D] px-5 py-2.5 text-xs text-[#F8F5EF] shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#E7B94F] animate-pulse" />
          <span className="font-bold tracking-wide uppercase text-[#E7B94F]">
            Manager Portal
          </span>
          <span className="hidden sm:inline text-white/60">|</span>
          <span className="hidden sm:inline text-white/80">{session.user.email}</span>
        </div>

        <button
          onClick={() => supabase.auth.signOut({ scope: "local" })}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 font-semibold hover:bg-white/20 transition-all text-[11px]"
        >
          Sign Out
        </button>
      </div>
      {children}
    </>
  );
}
