import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// The login is kept in memory only, so a page refresh returns to the login form
export const supabaseManager = createClient(
  supabaseUrl,
  supabaseAnonKey,
  { auth: { persistSession: false, autoRefreshToken: true } }
);
