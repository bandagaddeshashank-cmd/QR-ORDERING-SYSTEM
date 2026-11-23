/**
 * Centralized Session Manager for Green Embassy Staff Portals
 * 
 * Enforces:
 * 1. Daily Authentication Requirement: Sessions expire at 12:00 AM Asia/Kolkata (IST).
 *    Subsequent days require fresh email/password authentication.
 * 2. Inactivity-Based Auto-Logout: Automatically terminates session after 30 minutes
 *    of user inactivity.
 * 3. Multi-Tab Synchronization: Broadcasts activity and session state across open tabs
 *    within the same portal scope (Manager vs Kitchen).
 * 4. Cross-Portal Isolation: Separates Manager (Admin & Billing) session from Kitchen
 *    staff session so logging into one never auto-authenticates the other.
 * 5. Safe Storage: Never stores passwords or credentials in any browser storage.
 */

import { supabaseManager, supabaseKitchen } from "./supabaseManager";

export type PortalScope = "manager" | "kitchen";

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ACTIVITY_THROTTLE_MS = 10 * 1000; // 10 seconds
export const HEARTBEAT_INTERVAL_MS = 15 * 1000; // 15 seconds

export const INACTIVITY_MESSAGE =
  "Your session has expired due to inactivity. Please log in again.";
export const DAILY_EXPIRY_MESSAGE =
  "Your daily session has expired. Please log in again for today.";

export function getMetaKey(scope: PortalScope = "manager"): string {
  return scope === "kitchen" ? "ge_kitchen_session_meta" : "ge_manager_session_meta";
}

export function getNoticeKey(scope: PortalScope = "manager"): string {
  return scope === "kitchen" ? "ge_kitchen_expiry_notice" : "ge_manager_expiry_notice";
}

export function getSupabaseKey(scope: PortalScope = "manager"): string {
  return scope === "kitchen" ? "ge_kitchen_auth_session" : "ge_manager_auth_session";
}

export function getChannelName(scope: PortalScope = "manager"): string {
  return scope === "kitchen" ? "ge_kitchen_session_channel" : "ge_manager_session_channel";
}

export function getSupabaseClient(scope: PortalScope = "manager") {
  return scope === "kitchen" ? supabaseKitchen : supabaseManager;
}

export interface StaffSessionMeta {
  sessionDateIST: string; // "YYYY-MM-DD" in Asia/Kolkata
  lastActiveAt: number;   // Unix timestamp in ms
  userId: string;
  scope?: PortalScope;
}

export type SessionExpiryReason =
  | "inactivity"
  | "daily_expired"
  | "manual"
  | "no_session";

export interface SessionValidityResult {
  valid: boolean;
  reason?: SessionExpiryReason;
  message?: string;
}

type BroadcastPayload =
  | { type: "ACTIVITY_PING"; timestamp: number; scope: PortalScope }
  | { type: "SESSION_LOGIN"; userId: string; timestamp: number; scope: PortalScope }
  | {
      type: "SESSION_LOGOUT";
      reason: SessionExpiryReason;
      message?: string;
      timestamp: number;
      scope: PortalScope;
    };

/**
 * Returns the current calendar date string ("YYYY-MM-DD") in Asia/Kolkata (IST, UTC+05:30).
 */
export function getISTDateString(timestamp: number = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    // Robust fallback for environments without complete timezone data
    // IST is fixed at UTC+05:30 with no daylight saving time
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(timestamp + istOffsetMs);
    const y = istDate.getUTCFullYear();
    const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(istDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Reads staff session metadata from localStorage for the given portal scope.
 */
export function getStaffSessionMeta(scope: PortalScope = "manager"): StaffSessionMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getMetaKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.sessionDateIST === "string" &&
      typeof parsed.lastActiveAt === "number" &&
      typeof parsed.userId === "string"
    ) {
      return parsed as StaffSessionMeta;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists staff session metadata to localStorage for the given portal scope.
 */
export function saveStaffSessionMeta(meta: StaffSessionMeta, scope: PortalScope = "manager"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getMetaKey(scope), JSON.stringify({ ...meta, scope }));
  } catch (err) {
    console.warn(`[sessionManager:${scope}] Could not save session metadata:`, err);
  }
}

/**
 * Clears staff session metadata from localStorage for the given portal scope.
 */
export function clearStaffSessionMeta(scope: PortalScope = "manager"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getMetaKey(scope));
  } catch {}
}

/**
 * Reads a pending session expiry notice for the given portal scope.
 */
export function getStoredExpiryNotice(scope: PortalScope = "manager"): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(getNoticeKey(scope));
  } catch {
    return null;
  }
}

/**
 * Sets an expiry notice to be displayed on the login screen for the given portal scope.
 */
export function setStoredExpiryNotice(notice: string, scope: PortalScope = "manager"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getNoticeKey(scope), notice);
  } catch {}
}

/**
 * Clears the stored expiry notice for the given portal scope.
 */
export function clearStoredExpiryNotice(scope: PortalScope = "manager"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getNoticeKey(scope));
  } catch {}
}

// Singleton BroadcastChannel references per scope
const sessionChannels: Record<PortalScope, BroadcastChannel | null> = {
  manager: null,
  kitchen: null,
};

function getBroadcastChannel(scope: PortalScope = "manager"): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!sessionChannels[scope]) {
    try {
      sessionChannels[scope] = new BroadcastChannel(getChannelName(scope));
    } catch {
      sessionChannels[scope] = null;
    }
  }
  return sessionChannels[scope];
}

function broadcastSessionEvent(payload: BroadcastPayload): void {
  const ch = getBroadcastChannel(payload.scope);
  if (ch) {
    try {
      ch.postMessage(payload);
    } catch {}
  }
}

/**
 * Validates the staff session against:
 * 1. Existence of session metadata
 * 2. Daily midnight IST boundary
 * 3. 30-minute inactivity limit
 */
export function checkStaffSessionValidity(
  currentUserId?: string,
  currentTime: number = Date.now(),
  scope: PortalScope = "manager"
): SessionValidityResult {
  if (typeof window === "undefined") {
    return { valid: true };
  }

  const meta = getStaffSessionMeta(scope);
  if (!meta) {
    return { valid: false, reason: "no_session" };
  }

  if (currentUserId && meta.userId && meta.userId !== currentUserId) {
    return { valid: false, reason: "no_session" };
  }

  // Check 1: Midnight Asia/Kolkata (IST) daily expiration
  const todayIST = getISTDateString(currentTime);
  if (meta.sessionDateIST !== todayIST) {
    return {
      valid: false,
      reason: "daily_expired",
      message: DAILY_EXPIRY_MESSAGE,
    };
  }

  // Check 2: Inactivity timeout (30 minutes)
  const elapsed = currentTime - meta.lastActiveAt;
  if (elapsed > INACTIVITY_TIMEOUT_MS) {
    return {
      valid: false,
      reason: "inactivity",
      message: INACTIVITY_MESSAGE,
    };
  }

  return { valid: true };
}

/**
 * Initializes a new staff session upon successful login for the given portal scope.
 */
export function initializeStaffSession(userId: string, scope: PortalScope = "manager"): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const todayIST = getISTDateString(now);

  const meta: StaffSessionMeta = {
    sessionDateIST: todayIST,
    lastActiveAt: now,
    userId,
    scope,
  };

  saveStaffSessionMeta(meta, scope);
  clearStoredExpiryNotice(scope);

  broadcastSessionEvent({
    type: "SESSION_LOGIN",
    userId,
    timestamp: now,
    scope,
  });
}

// In-memory throttling tracker for user activity per scope
const lastActivityWrites: Record<PortalScope, number> = {
  manager: 0,
  kitchen: 0,
};

/**
 * Records genuine user activity, throttled to once per ACTIVITY_THROTTLE_MS.
 */
export function recordUserActivity(scope: PortalScope = "manager"): void {
  if (typeof window === "undefined") return;
  const now = Date.now();

  if (now - lastActivityWrites[scope] < ACTIVITY_THROTTLE_MS) {
    return;
  }
  lastActivityWrites[scope] = now;

  const meta = getStaffSessionMeta(scope);
  if (!meta) return;

  // Never update activity if already expired
  const validity = checkStaffSessionValidity(meta.userId, now, scope);
  if (!validity.valid) return;

  meta.lastActiveAt = now;
  saveStaffSessionMeta(meta, scope);

  broadcastSessionEvent({
    type: "ACTIVITY_PING",
    timestamp: now,
    scope,
  });
}

/**
 * Completely terminates the staff session for the given scope, cleans up local storage,
 * and notifies all open tabs within the same portal scope.
 */
export async function terminateStaffSession(
  scope: PortalScope = "manager",
  reason: SessionExpiryReason = "manual",
  customNotice?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  clearStaffSessionMeta(scope);

  // Explicitly wipe the portal's Supabase storage session
  try {
    localStorage.removeItem(getSupabaseKey(scope));
    // Also clean legacy key if any
    localStorage.removeItem("ge_auth_session");
  } catch {}

  const noticeMessage =
    customNotice ||
    (reason === "inactivity"
      ? INACTIVITY_MESSAGE
      : reason === "daily_expired"
      ? DAILY_EXPIRY_MESSAGE
      : undefined);

  if (noticeMessage) {
    setStoredExpiryNotice(noticeMessage, scope);
  } else if (reason === "manual") {
    clearStoredExpiryNotice(scope);
  }

  // Broadcast logout event across tabs in the same scope
  broadcastSessionEvent({
    type: "SESSION_LOGOUT",
    reason,
    message: noticeMessage,
    timestamp: Date.now(),
    scope,
  });

  // Sign out from the scope's client
  try {
    const client = getSupabaseClient(scope);
    await client.auth.signOut();
  } catch (err) {
    console.warn(`[sessionManager:${scope}] Supabase signOut warning:`, err);
  }
}

/**
 * Subscribes to the staff session lifecycle for a specific portal scope:
 * - Listens for genuine user activity (mouse, keyboard, scroll, touch)
 * - Sets up a heartbeat interval checking inactivity and midnight IST
 * - Handles tab focus and visibility changes
 * - Synchronizes across multiple browser tabs via BroadcastChannel & storage events
 */
export function subscribeToSessionLifecycle(
  handlers: {
    onExpired: (reason: SessionExpiryReason, message?: string) => void;
    onActivity?: () => void;
  },
  scope: PortalScope = "manager"
): () => void {
  if (typeof window === "undefined") return () => {};

  // 1. Genuine user interaction listeners
  const activityEvents = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "pointerdown",
  ];

  const handleUserEvent = () => {
    recordUserActivity(scope);
    handlers.onActivity?.();
  };

  activityEvents.forEach((evt) => {
    window.addEventListener(evt, handleUserEvent, { passive: true });
  });

  // 2. Visibility change & window focus
  const handleVisibilityOrFocus = () => {
    if (document.visibilityState === "visible") {
      const validity = checkStaffSessionValidity(undefined, Date.now(), scope);
      if (!validity.valid && validity.reason && validity.reason !== "no_session") {
        terminateStaffSession(scope, validity.reason, validity.message);
        handlers.onExpired(validity.reason, validity.message);
      } else if (validity.valid) {
        recordUserActivity(scope);
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityOrFocus);
  window.addEventListener("focus", handleVisibilityOrFocus);

  // 3. Periodic heartbeat interval
  const intervalId = window.setInterval(() => {
    const meta = getStaffSessionMeta(scope);
    if (!meta) return;

    const validity = checkStaffSessionValidity(undefined, Date.now(), scope);
    if (!validity.valid && validity.reason && validity.reason !== "no_session") {
      terminateStaffSession(scope, validity.reason, validity.message);
      handlers.onExpired(validity.reason, validity.message);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // 4. Cross-tab synchronization via BroadcastChannel
  const ch = getBroadcastChannel(scope);
  const handleChannelMessage = (ev: MessageEvent<BroadcastPayload>) => {
    const data = ev.data;
    if (!data || !data.type || data.scope !== scope) return;

    if (data.type === "ACTIVITY_PING") {
      lastActivityWrites[scope] = data.timestamp;
      handlers.onActivity?.();
    } else if (data.type === "SESSION_LOGOUT") {
      handlers.onExpired(data.reason, data.message);
    }
  };

  if (ch) {
    ch.addEventListener("message", handleChannelMessage);
  }

  // 5. Fallback cross-tab synchronization via StorageEvent
  const metaKey = getMetaKey(scope);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === metaKey) {
      if (!e.newValue) {
        handlers.onExpired("manual");
      } else {
        handlers.onActivity?.();
      }
    }
  };
  window.addEventListener("storage", handleStorage);

  // Cleanup function
  return () => {
    activityEvents.forEach((evt) => {
      window.removeEventListener(evt, handleUserEvent);
    });
    document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    window.removeEventListener("focus", handleVisibilityOrFocus);
    window.clearInterval(intervalId);
    if (ch) {
      ch.removeEventListener("message", handleChannelMessage);
    }
    window.removeEventListener("storage", handleStorage);
  };
}
