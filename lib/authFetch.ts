import { supabaseManager } from "./supabaseManager";

// Like fetch, but sends the logged-in manager's pass with the request
export async function authFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabaseManager.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}