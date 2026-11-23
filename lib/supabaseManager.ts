import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Manager client for Admin and Billing portals.
 * Shared between Admin and Billing so the Manager account can access both desks.
 */
export const supabaseManager = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "ge_manager_auth_session",
  },
});

/**
 * Dedicated Kitchen client for the Kitchen station.
 * Uses an isolated storage key to prevent Kitchen staff sessions from granting
 * access to Admin or Billing, and to prevent Manager logins from auto-authenticating Kitchen.
 */
export const supabaseKitchen = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "ge_kitchen_auth_session",
  },
});

export const supabase = supabaseManager;
