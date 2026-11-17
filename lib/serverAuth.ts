import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { AuthenticatedStaff, StaffRole } from "./types";

// Server-only Supabase admin client using service-role key
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Standard safe error response that never leaks internal database or server details
 */
export function apiError(
  message: string,
  status = 400,
  internalError?: unknown
) {
  if (internalError) {
    console.error(`[API Error ${status}]:`, message, internalError);
  }
  return NextResponse.json({ error: message, success: false }, { status });
}

/**
 * Standard successful JSON response
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Validates staff authentication from Authorization header
 */
export async function getAuthenticatedStaff(
  req: Request
): Promise<AuthenticatedStaff | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    const role = data.user.app_metadata?.role as StaffRole | undefined;
    if (role !== "manager" && role !== "staff") {
      return null;
    }

    const restaurantId = (data.user.app_metadata?.restaurant_id ||
      data.user.user_metadata?.restaurant_id) as string | undefined;

    return {
      userId: data.user.id,
      email: data.user.email ?? "",
      role,
      restaurantId,
    };
  } catch (err) {
    console.error("[getAuthenticatedStaff] Error verifying token:", err);
    return null;
  }
}

/**
 * Guard that requires any authorized staff (staff or manager)
 */
export async function requireStaff(req: Request) {
  const staff = await getAuthenticatedStaff(req);
  if (!staff) {
    return {
      staff: null,
      errorResponse: apiError("Unauthorized: Staff authentication required", 401),
    };
  }
  return { staff, errorResponse: null };
}

/**
 * Guard that requires manager role specifically
 */
export async function requireManager(req: Request) {
  const staff = await getAuthenticatedStaff(req);
  if (!staff) {
    return {
      manager: null,
      errorResponse: apiError("Unauthorized: Manager authentication required", 401),
    };
  }

  if (staff.role !== "manager") {
    return {
      manager: null,
      errorResponse: apiError("Forbidden: Manager permissions required", 403),
    };
  }

  return { manager: staff, errorResponse: null };
}
