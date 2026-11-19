"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabaseManager as supabase } from "@/lib/supabaseManager";
import {
  formatAuthError,
  hasRequiredRole,
  getSessionRole,
  signOutStaff,
} from "@/lib/authHelper";
import { LockIcon, LogOutIcon, ChefHatIcon, AlertCircleIcon, CheckCircleIcon } from "@/components/ui/icons";

export default function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Load active session from persistent storage
    supabase.auth.getSession().then(({ data, error: sessionErr }) => {
      if (!isMounted) return;
      if (sessionErr) {
        console.warn("[AdminGate] Session initialization notice:", sessionErr.message);
      }
      setSession(data.session);
      setReady(true);
    });

    // Subscribe to auth state changes across tabs and windows
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!isMounted) return;
      setSession(s);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError("");

    try {
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        setError("Please enter both email and password.");
        return;
      }

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInErr) {
        setError(formatAuthError(signInErr));
        return;
      }

      if (data?.session) {
        setSession(data.session);
        setPassword("");
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError("");
    setResetSuccess(false);

    try {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setError("Please enter your registered manager email.");
        return;
      }

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "http://localhost:3000/update-password",
      });

      if (resetErr) {
        setError(formatAuthError(resetErr));
        return;
      }

      setResetSuccess(true);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    await signOutStaff();
    setSession(null);
    setBusy(false);
  };

  const shell = "min-h-screen bg-[#FAF7F0] p-6 text-[#242B2A]";

  if (!ready) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <div className="text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#173F35] border-t-transparent mb-3" />
          <p className="text-sm font-serif font-semibold text-[#173F35]">
            Connecting to Restaurant Administration...
          </p>
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
          <h1 className="text-2xl font-serif font-bold text-[#173F35]">
            {forgotMode ? "Reset Password" : "Restaurant Admin"}
          </h1>
          <p className="text-xs text-[#242B2A]/70 mt-1 mb-6">
            {forgotMode
              ? "Enter your registered manager email to receive a secure recovery link."
              : "Manager credentials required to configure menu, tables, QR codes and reports"}
          </p>

          {forgotMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1">
                  Manager Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  disabled={busy || resetSuccess}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. manager@greenembassy.com"
                  className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-medium focus:border-[#173F35] focus:bg-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 border border-rose-200 flex items-start gap-2.5"
                >
                  <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {resetSuccess && (
                <div
                  role="status"
                  className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-start gap-2.5"
                >
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Password recovery link has been sent to <strong>{email}</strong>. Check your inbox and click the link to set a new password.
                  </span>
                </div>
              )}

              {!resetSuccess ? (
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-60 disabled:cursor-wait transition-all mt-2 cursor-pointer"
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                      <span>Sending Recovery Link...</span>
                    </>
                  ) : (
                    <span>Send Recovery Link</span>
                  )}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError("");
                  setResetSuccess(false);
                }}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-[#173F35]/20 font-semibold text-xs text-[#173F35] hover:bg-[#173F35]/5 cursor-pointer transition-colors"
              >
                <span>Back to Sign In</span>
              </button>
            </form>
          ) : (
            <form onSubmit={login} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1">
                  Manager Email
                </label>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  disabled={busy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. manager@greenembassy.com"
                  className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-medium focus:border-[#173F35] focus:bg-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError("");
                      setResetSuccess(false);
                    }}
                    className="text-xs font-semibold text-[#173F35]/80 hover:text-[#173F35] underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-medium focus:border-[#173F35] focus:bg-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 border border-rose-200 flex items-start gap-2.5"
                >
                  <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-60 disabled:cursor-wait transition-all mt-2 cursor-pointer"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <LockIcon className="w-4 h-4" />
                    <span>Access Admin Console</span>
                  </>
                )}
              </button>
            </form>
          )}
        </main>
      </div>
    );
  }

  const role = getSessionRole(session);
  const isAuthorized = hasRequiredRole(session, ["manager", "platform_admin"]);

  if (!isAuthorized) {
    const isStaff = role === "staff";

    return (
      <div className={`${shell} flex items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-luxury-lg border border-amber-300 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <LockIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif font-bold text-[#173F35] mb-2">
            Manager Authorization Required
          </h2>
          <p className="text-sm text-[#242B2A]/80 mb-4 leading-relaxed">
            You are signed in as <span className="font-semibold">{session.user.email}</span>.
            {isStaff ? (
              <> This account is assigned the <span className="font-bold text-[#173F35]">Staff</span> role and does not have access to the Executive Admin Console.</>
            ) : (
              <> No restaurant manager role has been assigned to this account in Supabase metadata.</>
            )}
          </p>

          <div className="space-y-2.5">
            {isStaff && (
              <Link
                href="/kitchen"
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all"
              >
                <ChefHatIcon className="w-4 h-4" />
                <span>Go to Kitchen Display System</span>
              </Link>
            )}

            <button
              onClick={handleSignOut}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-[#173F35]/20 font-semibold text-sm text-[#173F35] hover:bg-[#173F35]/5 cursor-pointer transition-colors"
            >
              <LogOutIcon className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
