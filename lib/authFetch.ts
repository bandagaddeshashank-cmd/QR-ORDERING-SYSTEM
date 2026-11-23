import {
  checkStaffSessionValidity,
  terminateStaffSession,
  getSupabaseClient,
  type PortalScope,
} from "./sessionManager";

/**
 * Custom error class for authenticated fetch operations
 */
export class AuthFetchError extends Error {
  status?: number;
  isNetworkError: boolean;
  isAuthError: boolean;

  constructor(
    message: string,
    opts?: { status?: number; isNetworkError?: boolean; isAuthError?: boolean; cause?: unknown }
  ) {
    super(message);
    this.name = "AuthFetchError";
    this.status = opts?.status;
    this.isNetworkError = opts?.isNetworkError ?? false;
    this.isAuthError = opts?.isAuthError ?? false;
    if (opts?.cause) {
      this.cause = opts?.cause;
    }
  }
}

function resolveScope(input: string, explicitScope?: PortalScope): PortalScope {
  if (explicitScope) return explicitScope;
  if (input.includes("/api/kitchen")) return "kitchen";
  if (input.includes("/api/admin") || input.includes("/api/billing")) return "manager";
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/kitchen")) {
    return "kitchen";
  }
  return "manager";
}

/**
 * Proactively verifies that the Supabase session is valid and not expired for the resolved scope.
 * Refreshes the session if the token is within 45 seconds of expiration.
 */
async function getValidAccessToken(scope: PortalScope): Promise<string | null> {
  const client = getSupabaseClient(scope);
  try {
    const { data } = await client.auth.getSession();
    let session = data.session;

    if (session) {
      // Validate staff session against midnight IST and 30-min inactivity limits
      if (typeof window !== "undefined") {
        const validity = checkStaffSessionValidity(session.user.id, Date.now(), scope);
        if (!validity.valid) {
          if (validity.reason && validity.reason !== "no_session") {
            await terminateStaffSession(scope, validity.reason, validity.message);
          }
          return null;
        }
      }

      const now = Math.floor(Date.now() / 1000);
      // If token expires in less than 45 seconds or is already expired, refresh it proactively
      if (session.expires_at && session.expires_at - now < 45) {
        const { data: refreshed, error: refreshErr } =
          await client.auth.refreshSession();
        if (!refreshErr && refreshed.session) {
          session = refreshed.session;
        }
      }
      return session.access_token;
    }
    return null;
  } catch (err) {
    console.warn(`[authFetch:${scope}] Failed to check or refresh auth session:`, err);
    return null;
  }
}

export interface AuthFetchOptions extends RequestInit {
  scope?: PortalScope;
}

/**
 * Like fetch, but sends the logged-in manager or kitchen authorization token with the request.
 * Automatically resolves the appropriate client scope (manager vs kitchen), manages token refreshing,
 * handles expired sessions, and handles transient network failures gracefully.
 */
export async function authFetch(
  input: string,
  init: AuthFetchOptions = {}
): Promise<Response> {
  const scope = resolveScope(input, init.scope);
  const client = getSupabaseClient(scope);
  let token = await getValidAccessToken(scope);

  if (!token && typeof window !== "undefined") {
    const validity = checkStaffSessionValidity(undefined, Date.now(), scope);
    if (!validity.valid && validity.reason && validity.reason !== "no_session") {
      throw new AuthFetchError(
        validity.message || "Your session has expired. Please log in again.",
        { isAuthError: true }
      );
    }
  }
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isIdempotent =
    !init.method ||
    init.method.toUpperCase() === "GET" ||
    init.method.toUpperCase() === "HEAD";

  let res: Response;
  try {
    res = await fetch(input, { ...init, headers });
  } catch (err) {
    // If request was aborted by caller's AbortController, let it throw cleanly
    if (init.signal?.aborted) {
      throw err;
    }

    // For safe GET/HEAD requests, retry once after a short 300ms pause
    if (isIdempotent) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        token = await getValidAccessToken(scope);
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        res = await fetch(input, { ...init, headers });
        return res;
      } catch (retryErr) {
        if (init.signal?.aborted) throw retryErr;
        throw new AuthFetchError(
          "Network connection failed. Unable to reach server.",
          { isNetworkError: true, cause: retryErr }
        );
      }
    }

    throw new AuthFetchError(
      "Network connection failed. Unable to reach server.",
      { isNetworkError: true, cause: err }
    );
  }

  // If response indicates token was rejected (401), attempt a single session refresh and retry
  if (res.status === 401 && token) {
    try {
      const { data: refreshed, error: refreshErr } =
        await client.auth.refreshSession();
      if (!refreshErr && refreshed.session) {
        headers.set("Authorization", `Bearer ${refreshed.session.access_token}`);
        res = await fetch(input, { ...init, headers });
      }
    } catch {
      // Refresh failed; return original 401 response for caller to handle
    }
  }

  return res;
}
