import { createClient } from "@supabase/supabase-js";

// The login is kept in memory only, so a page refresh returns to the login form
export const supabaseManager = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: true } }
);