"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { supabaseManager as supabase } from "@/lib/supabaseManager";
import { LockIcon, LogOutIcon } from "@/components/ui/icons";

export default function AdminGate({ children }: { children: ReactNode }) {
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

  const shell = "min-h-screen bg-[#FAF7F0] p-6 text-[#242B2A]";

  if (!ready) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <div className="text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#173F35] border-t-transparent mb-3" />
          <p className="text-sm font-serif font-semibold text-[#173F35]">Connecting to Restaurant Administration...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`${shell} flex flex-col items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-luxury-lg border border-[#173F35]/10 text-center">
          <Image
            src="/logo.png"
            alt="Green Embassy Logo"
            width={100}
            height={60}
            className="mx-auto mb-4 h-16 w-auto object-contain"
            priority
          />
          <span className="inline-block rounded-full bg-[#173F35]/10 px-3 py-1 text-[11px] font-bold text-[#173F35] uppercase tracking-wider mb-2">
            Operations Management
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#173F35]">Restaurant Admin</h1>
          <p className="text-xs text-[#242B2A]/70 mt-1 mb-6">
            Manager credentials required to configure menu, tables, QR codes and reports
          </p>

          <form onSubmit={login} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1">
                Manager Email
              </label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@greenembassy.com"
                className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-medium focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-medium focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-800 border border-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-50 transition-all mt-2 cursor-pointer"
            >
              <LockIcon className="w-4 h-4" />
              <span>{busy ? "Authenticating..." : "Access Admin Console"}</span>
            </button>
          </form>
        </main>
      </div>
    );
  }

  const role = session.user.app_metadata?.role;
  if (role !== "manager" && role !== "platform_admin") {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-luxury-lg border border-rose-200 text-center">
          <h2 className="text-xl font-serif font-bold text-rose-800 mb-2">Manager Authorization Required</h2>
          <p className="text-sm text-[#242B2A]/70 mb-6 leading-relaxed">
            The logged in account ({session.user.email}) does not have manager privileges.
          </p>
          <button
            onClick={() => supabase.auth.signOut({ scope: "local" })}
            className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-[#173F35]/20 font-semibold text-sm text-[#173F35] hover:bg-[#173F35]/5 cursor-pointer transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
