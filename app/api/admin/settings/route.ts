import { supabaseAdmin, requireManager, apiError, apiSuccess } from "@/lib/serverAuth";
import { roundMoney } from "@/lib/dbHelpers";

export async function PATCH(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid settings payload.", 400);
    }

    const {
      name,
      gstin,
      tax_percent,
      service_charge_percent,
      cancel_window_seconds,
    } = body;

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return apiError("Restaurant name must be between 2 and 100 characters.", 400);
      }
      updates.name = name.trim();
    }

    if (gstin !== undefined) {
      if (gstin === null || gstin === "") {
        updates.gstin = null;
      } else if (typeof gstin === "string") {
        const cleanedGstin = gstin.trim().toUpperCase();
        if (cleanedGstin.length > 20) {
          return apiError("GSTIN must not exceed 20 characters.", 400);
        }
        updates.gstin = cleanedGstin;
      } else {
        return apiError("Invalid GSTIN format.", 400);
      }
    }

    if (tax_percent !== undefined) {
      const tax = Number(tax_percent);
      if (isNaN(tax) || tax < 0 || tax > 50) {
        return apiError("Tax percentage must be between 0% and 50%.", 400);
      }
      updates.tax_percent = roundMoney(tax);
    }

    if (service_charge_percent !== undefined) {
      const sc = Number(service_charge_percent);
      if (isNaN(sc) || sc < 0 || sc > 30) {
        return apiError("Service charge percentage must be between 0% and 30%.", 400);
      }
      updates.service_charge_percent = roundMoney(sc);
    }

    if (cancel_window_seconds !== undefined) {
      const windowSec = Number(cancel_window_seconds);
      if (!Number.isInteger(windowSec) || windowSec < 0 || windowSec > 600) {
        return apiError("Order edit window must be an integer between 0 and 600 seconds.", 400);
      }
      updates.cancel_window_seconds = windowSec;
    }

    if (Object.keys(updates).length === 0) {
      return apiError("No valid settings fields provided for update.", 400);
    }

    const restaurantId = manager.restaurantId;
    if (!restaurantId && manager.role !== "platform_admin") {
      return apiError("Unauthorized: No restaurant assignment found.", 403);
    }

    const { data: updatedRestaurant, error } = await supabaseAdmin
      .from("restaurants")
      .update(updates)
      .eq("id", restaurantId)
      .select("*")
      .single();

    if (error || !updatedRestaurant) {
      console.error("[PATCH /api/admin/settings] Update error:", error);
      return apiError("Failed to update restaurant settings.", 500);
    }

    return apiSuccess({
      success: true,
      restaurant: updatedRestaurant,
    });
  } catch (err) {
    console.error("[PATCH /api/admin/settings] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
