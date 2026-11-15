"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseManager as supabase } from "../../lib/supabaseManager";

const shell = "min-h-screen bg-[#F2F4F1] p-5 text-[#1C2333]";

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
    const { data } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setError("Wrong email or password.");
    setBusy(false);
  };

  if (!ready) return <div className={`${shell} text-center`}>Loading.</div>;

  if (!session)
    return (
      <div className={shell}>
        <main className="mx-auto max-w-sm pt-10">
          <img
            src="/logo.png"
            alt="Restaurant logo"
            className="mx-auto mb-6 h-20 w-auto"
          />
          <h1 className="mb-4 text-2xl font-bold">Manager login</h1>
          <form onSubmit={login} className="space-y-3">
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="h-12 w-full rounded-lg border-2 border-[#1C2333] bg-white px-3 text-lg"
            />
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-12 w-full rounded-lg border-2 border-[#1C2333] bg-white px-3 text-lg"
            />
            {error && <p className="font-medium text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-lg bg-[#1C2333] font-bold text-white disabled:opacity-50"
            >
              {busy ? "Logging in" : "Log in"}
            </button>
          </form>
        </main>
      </div>
    );

  if (session.user.app_metadata?.role !== "manager")
    return (
      <div className={shell}>
        <main className="mx-auto max-w-sm pt-10">
          <p className="mb-4">This account isn&apos;t set up as a manager.</p>
          <button
            onClick={() => supabase.auth.signOut({ scope: "local" })}
            className="h-12 w-full rounded-lg border-2 border-[#1C2333] font-bold"
          >
            Log out
          </button>
        </main>
      </div>
    );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-[#1C2333] px-5 py-2 text-sm text-white print:hidden">
        <span className="truncate">Manager: {session.user.email}</span>
        <button
          onClick={() => supabase.auth.signOut({ scope: "local" })}
          className="ml-3 shrink-0 rounded border border-white/60 px-3 py-1 font-semibold"
        >
          Log out
        </button>
      </div>
      {children}
    </>
  );
}