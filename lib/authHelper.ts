import type { Session } from "@supabase/supabase-js";
import { supabaseManager } from "./supabaseManager";

export type StaffRole = "manager" | "staff" | "platform_admin";

/**
 * Maps Supabase authentication errors and network failures into safe,
 * distinct, user-friendly messages. Never exposes raw stack traces,
 * database details, or internal server keys.
 */
export function formatAuthError(error: unknown): string {
  if (!error) return "";

  // Check if browser is offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You appear to be offline. Please verify your internet connection.";
  }

  const errObj = error as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };

  const code = (errObj.code || "").toLowerCase();
  const msg = (errObj.message || "").toLowerCase();
  const name = errObj.name || "";
  const status = errObj.status;

  // Rate limiting (HTTP 429)
  if (
    status === 429 ||
    code.includes("rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("over_email_send_rate_limit")
  ) {
    return "Too many sign-in attempts. For security reasons, please wait a few moments before trying again.";
  }

  // Network or DNS connection failure
  if (
    name === "AuthRetryableFetchError" ||
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("failed to fetch") ||
    status === 0
  ) {
    return "Unable to connect to the authentication service. Please check your network connection and try again.";
  }

  // Unconfirmed email address
  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("unconfirmed")
  ) {
    return "Your email address has not been confirmed yet. Please check your inbox for the confirmation link or contact an administrator.";
  }

  // Invalid login credentials (wrong email or password)
  if (
    code === "invalid_credentials" ||
    code === "invalid_grant" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    status === 400
  ) {
    return "Invalid email or password. Please verify your credentials and try again.";
  }

  // Configuration or placeholder issues
  if (msg.includes("placeholder") || msg.includes("api key not found")) {
    return "The authentication service is not properly configured. Please contact the platform administrator.";
  }

  return "Authentication failed. Please verify your credentials or contact an administrator.";
}

/**
 * Checks whether the authenticated session user possesses an authorized role.
 */
export function hasRequiredRole(
  session: Session | null,
  allowedRoles: StaffRole[]
): boolean {
  if (!session?.user) return false;
  const role = session.user.app_metadata?.role as StaffRole | undefined;
  if (!role) return false;
  return allowedRoles.includes(role);
}

/**
 * Extracts the assigned role from session app_metadata.
 */
export function getSessionRole(session: Session | null): StaffRole | null {
  if (!session?.user) return null;
  return (session.user.app_metadata?.role as StaffRole) || null;
}

/**
 * Extracts the assigned restaurant_id from session app_metadata.
 */
export function getSessionRestaurantId(session: Session | null): string | null {
  if (!session?.user) return null;
  return (session.user.app_metadata?.restaurant_id as string) || null;
}

/**
 * Performs a clean sign out from Supabase across tabs and local storage.
 */
export async function signOutStaff(): Promise<void> {
  try {
    await supabaseManager.auth.signOut();
  } catch (err) {
    console.error("[signOutStaff] Error signing out:", err);
  }
}
