"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { supabaseKitchen as supabase } from "@/lib/supabaseManager";
import {
  formatAuthError,
  hasRequiredRole,
  getSessionRole,
  signOutStaff,
} from "@/lib/authHelper";
import {
  checkStaffSessionValidity,
  initializeStaffSession,
  getStoredExpiryNotice,
  subscribeToSessionLifecycle,
  recordUserActivity,
  terminateStaffSession,
} from "@/lib/sessionManager";
import { LockIcon, LogOutIcon, AlertCircleIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icons";

export default function KitchenGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [expiryNotice, setExpiryNotice] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredExpiryNotice("kitchen") || "" : ""
  );
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Load active session from persistent storage
    supabase.auth.getSession().then(async ({ data, error: sessionErr }) => {
      if (!isMounted) return;
      if (sessionErr) {
        console.warn("[KitchenGate] Session initialization notice:", sessionErr.message);
      }

      if (data.session) {
        // Enforce role: staff or platform_admin ONLY
        const role = getSessionRole(data.session);
        if (role !== "staff" && role !== "platform_admin") {
          await terminateStaffSession("kitchen", "no_session");
          setSession(null);
          setReady(true);
          return;
        }

        const validity = checkStaffSessionValidity(data.session.user.id, Date.now(), "kitchen");
        if (!validity.valid) {
          if (validity.message) {
            setExpiryNotice(validity.message);
          }
          await terminateStaffSession("kitchen", validity.reason || "no_session", validity.message);
          setSession(null);
        } else {
          recordUserActivity("kitchen");
          setSession(data.session);
        }
      } else {
        setSession(null);
      }
      setReady(true);
    });

    // Subscribe to auth state changes across tabs and windows
    const { data: authListener } = supabase.auth.onAuthStateChange((event, s) => {
      if (!isMounted) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else if (event === "SIGNED_IN" && s) {
        const role = getSessionRole(s);
        if (role !== "staff" && role !== "platform_admin") {
          setSession(null);
          return;
        }
        const validity = checkStaffSessionValidity(s.user.id, Date.now(), "kitchen");
        if (validity.valid) {
          setSession(s);
        } else {
          setSession(null);
        }
      } else {
        const role = getSessionRole(s);
        if (role && role !== "staff" && role !== "platform_admin") {
          setSession(null);
        } else {
          setSession(s);
        }
      }
    });

    // Subscribe to session lifecycle (activity monitoring, inactivity timeout, midnight IST, multi-tab sync)
    const unsubscribeLifecycle = subscribeToSessionLifecycle(
      {
        onExpired: (reason, message) => {
          if (!isMounted) return;
          setSession(null);
          if (message) {
            setExpiryNotice(message);
          } else if (reason === "inactivity") {
            setExpiryNotice("Your session has expired due to inactivity. Please log in again.");
          } else if (reason === "daily_expired") {
            setExpiryNotice("Your daily session has expired. Please log in again for today.");
          }
        },
      },
      "kitchen"
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      unsubscribeLifecycle();
    };
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError("");
    setExpiryNotice("");

    try {
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        setError("Please enter both staff email and station password.");
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
        const role = getSessionRole(data.session);
        if (role !== "staff" && role !== "platform_admin") {
          await signOutStaff("kitchen");
          setError("Access restricted: This station requires Kitchen staff credentials.");
          return;
        }
        initializeStaffSession(data.session.user.id, "kitchen");
        setSession(data.session);
        setPassword("");
        setExpiryNotice("");
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
        setError("Please enter your registered staff or manager email.");
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
    await signOutStaff("kitchen");
    setSession(null);
    setExpiryNotice("");
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
            {forgotMode ? "Reset Station Password" : "Kitchen Display Station"}
          </h1>
          <p className="text-xs text-stone-400 mt-1 mb-6">
            {forgotMode
              ? "Enter your staff email to receive a password recovery link."
              : "Authorized culinary & service staff access only"}
          </p>

          {expiryNotice && !forgotMode && (
            <div
              role="alert"
              className="rounded-xl bg-amber-950/80 p-3 text-xs font-semibold text-amber-200 border border-amber-500/50 flex items-start gap-2.5 mb-4 text-left"
            >
              <AlertCircleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{expiryNotice}</span>
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
                  Staff Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  disabled={busy || resetSuccess}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. chef@greenembassy.com"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#1C2523] px-3.5 text-sm font-medium text-white placeholder:text-stone-500 focus:border-[#E8B95B] focus:bg-[#202b28] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-950/80 p-3 text-xs font-semibold text-rose-300 border border-rose-500/80 flex items-start gap-2.5"
                >
                  <AlertCircleIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {resetSuccess && (
                <div
                  role="status"
                  className="rounded-xl bg-emerald-950/80 p-3 text-xs font-semibold text-emerald-300 border border-emerald-500/80 flex items-start gap-2.5"
                >
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Password recovery link has been sent to <strong>{email}</strong>. Check your inbox and click the link to reset your password.
                  </span>
                </div>
              )}

              {!resetSuccess ? (
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] border border-[#E8B95B]/40 disabled:opacity-60 disabled:cursor-wait transition-all mt-2 cursor-pointer"
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
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-white/20 font-semibold text-xs text-stone-300 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span>Back to Sign In</span>
              </button>
            </form>
          ) : (
            <form onSubmit={login} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 mb-1">
                  Staff Email
                </label>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  disabled={busy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. chef@greenembassy.com"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#1C2523] px-3.5 text-sm font-medium text-white placeholder:text-stone-500 focus:border-[#E8B95B] focus:bg-[#202b28] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300">
                    Station Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError("");
                      setResetSuccess(false);
                    }}
                    className="text-xs font-semibold text-[#E8B95B]/80 hover:text-[#E8B95B] underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-xl border border-white/15 bg-[#1C2523] pl-3.5 pr-11 text-sm font-medium text-white placeholder:text-stone-500 focus:border-[#E8B95B] focus:bg-[#202b28] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-[#E8B95B] focus:outline-none transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-950/80 p-3 text-xs font-semibold text-rose-300 border border-rose-500/80 flex items-start gap-2.5"
                >
                  <AlertCircleIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-[#173F35] font-bold text-sm text-[#E8B95B] shadow-luxury hover:bg-[#102e26] border border-[#E8B95B]/40 disabled:opacity-60 disabled:cursor-wait transition-all mt-2 cursor-pointer"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B95B] border-t-transparent" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <LockIcon className="w-4 h-4 text-[#E8B95B]" />
                    <span>Access Kitchen Station</span>
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
  const isAuthorized = hasRequiredRole(session, ["staff", "platform_admin"]);

  if (!isAuthorized) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <main className="w-full max-w-sm rounded-3xl bg-[#161E1C] p-8 shadow-2xl border border-rose-500/50 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-950/60 text-rose-400 border border-rose-500/40">
            <LockIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif font-bold text-rose-400 mb-2">
            Access Restricted
          </h2>
          <p className="text-sm text-stone-300 mb-6 leading-relaxed">
            This account (<span className="text-white font-medium">{session.user.email}</span>) is not assigned the Kitchen Staff role in Supabase metadata.
          </p>
          <button
            onClick={handleSignOut}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-white/20 bg-white/5 font-semibold text-sm text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </main>
      </div>
    );
  }

  const displayRoleLabel =
    role === "platform_admin"
      ? "Platform Admin"
      : "Kitchen Staff";

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
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-[#E8B95B] border border-white/10">
            {displayRoleLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSignOut}
            disabled={busy}
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
