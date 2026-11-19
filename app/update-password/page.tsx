"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabaseManager as supabase } from "@/lib/supabaseManager";
import { formatAuthError } from "@/lib/authHelper";
import {
  LockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CheckIcon,
} from "@/components/ui/icons";

function UpdatePasswordContent() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Check if a recovery session is already established
    supabase.auth.getSession().then(({ data: { session }, error: sessionErr }) => {
      if (!mounted) return;
      if (sessionErr) {
        console.warn("[UpdatePassword] Session error:", sessionErr.message);
      }
      if (session) {
        setHasSession(true);
      }
      setLoading(false);
    });

    // Subscribe to auth state changes (e.g. PASSWORD_RECOVERY or SIGNED_IN event from URL token)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY" || session) {
          setHasSession(true);
          setLoading(false);
        }
      }
    );

    // Safety timeout in case URL token detection finishes
    const timer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2500);

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");

    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword || !trimmedConfirm) {
      setError("Please fill in both password fields.");
      return;
    }

    if (trimmedPassword.length < 8) {
      setError("Password must be at least 8 characters long for security.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError("Passwords do not match. Please verify and re-enter.");
      return;
    }

    setBusy(true);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });

      if (updateErr) {
        setError(formatAuthError(updateErr));
        return;
      }

      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const shell = "min-h-screen bg-[#FAF7F0] p-6 text-[#242B2A] flex flex-col items-center justify-center selection:bg-[#E8B95B] selection:text-[#173F35]";

  if (loading) {
    return (
      <div className={shell}>
        <div className="text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#173F35] border-t-transparent mb-3" />
          <p className="text-sm font-serif font-semibold text-[#173F35]">
            Verifying password recovery session...
          </p>
        </div>
      </div>
    );
  }

  // If no recovery session is active or the link has expired
  if (!hasSession && !success) {
    return (
      <div className={shell}>
        <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-luxury-lg border border-amber-300 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <AlertCircleIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-serif font-bold text-[#173F35] mb-2">
            Recovery Link Expired or Invalid
          </h1>
          <p className="text-xs text-[#242B2A]/75 mb-6 leading-relaxed">
            This password reset link is invalid, has already been used, or has expired. For your account security, password recovery links are single-use.
          </p>

          <div className="space-y-2.5">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl bg-[#173F35] font-bold text-xs text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all"
            >
              <LockIcon className="w-4 h-4" />
              <span>Return to Restaurant Admin</span>
            </Link>

            <Link
              href="/kitchen"
              className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-[#173F35]/20 font-semibold text-xs text-[#173F35] hover:bg-[#173F35]/5 transition-colors"
            >
              <span>Return to Kitchen Station</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={shell}>
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
          Account Security
        </span>
        <h1 className="text-2xl font-serif font-bold text-[#173F35]">
          Update Password
        </h1>
        <p className="text-xs text-[#242B2A]/70 mt-1 mb-6">
          Create a new, strong password for your Green Embassy staff or manager account
        </p>

        {success ? (
          <div className="space-y-5 animate-fade-in text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm border border-emerald-300">
              <CheckCircleIcon className="w-8 h-8 text-emerald-700" />
            </div>

            <div>
              <h2 className="text-lg font-serif font-bold text-emerald-900 mb-1">
                Password Updated!
              </h2>
              <p className="text-xs text-[#242B2A]/75 leading-relaxed">
                Your new password has been saved securely in Supabase Authentication. You can now access your restaurant operational consoles.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl bg-[#173F35] font-bold text-xs text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all"
              >
                <LockIcon className="w-4 h-4" />
                <span>Go to Restaurant Admin</span>
              </Link>

              <Link
                href="/kitchen"
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-[#173F35]/20 font-semibold text-xs text-[#173F35] hover:bg-[#173F35]/5 transition-colors"
              >
                <span>Go to Kitchen Station</span>
              </Link>

              <Link
                href="/billing"
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-xl border border-[#173F35]/20 font-semibold text-xs text-[#173F35] hover:bg-[#173F35]/5 transition-colors"
              >
                <span>Go to Billing Desk</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={busy}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 pr-12 text-sm font-medium focus:border-[#173F35] focus:bg-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#173F35]/60 hover:text-[#173F35] cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                disabled={busy}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
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
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4 text-[#E8B95B]" />
                  <span>Save New Password</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#173F35] border-t-transparent" />
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
