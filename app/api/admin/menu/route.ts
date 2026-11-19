import { connection } from "next/server";
import { supabaseAdmin, requireManager, apiError, apiSuccess } from "@/lib/serverAuth";
import { roundMoney } from "@/lib/dbHelpers";

export async function GET(req: Request) {
  await connection();
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const { data: menuItems, error } = await supabaseAdmin
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", manager.restaurantId)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[GET /api/admin/menu] Error fetching menu:", error);
      return apiError("Failed to retrieve menu items.", 500);
    }

    return apiSuccess(menuItems ?? []);
  } catch (err) {
    console.error("[GET /api/admin/menu] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid menu item payload.", 400);
    }

    const { name, category, price, is_veg, description, is_active, sort_order } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return apiError("Dish name is required.", 400);
    }
    if (!category || typeof category !== "string" || category.trim().length === 0) {
      return apiError("Category is required.", 400);
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0 || numericPrice > 100000) {
      return apiError("Price must be a valid positive amount.", 400);
    }

    const { data: newItem, error } = await supabaseAdmin
      .from("menu_items")
      .insert({
        restaurant_id: manager.restaurantId,
        name: name.trim().slice(0, 100),
        category: category.trim().slice(0, 50),
        price: roundMoney(numericPrice),
        is_veg: typeof is_veg === "boolean" ? is_veg : true,
        description: typeof description === "string" ? description.trim().slice(0, 500) : null,
        is_active: typeof is_active === "boolean" ? is_active : true,
        sort_order: Number.isInteger(Number(sort_order)) ? Number(sort_order) : 0,
      })
      .select("*")
      .single();

    if (error || !newItem) {
      console.error("[POST /api/admin/menu] Insert error:", error);
      return apiError("Failed to create menu item.", 500);
    }

    return apiSuccess({ success: true, item: newItem }, 201);
  } catch (err) {
    console.error("[POST /api/admin/menu] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => null);
    if (!body || !body.id) {
      return apiError("Missing menu item ID.", 400);
    }

    const { id, name, category, price, is_veg, description, is_active, sort_order } = body;

    // Verify item ownership
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("menu_items")
      .select("id, restaurant_id")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !existing) {
      return apiError("Menu item not found.", 404);
    }

    if (manager.role !== "platform_admin" && existing.restaurant_id !== manager.restaurantId) {
      return apiError("Forbidden: Dish belongs to another restaurant.", 403);
    }

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return apiError("Dish name cannot be empty.", 400);
      }
      updates.name = name.trim().slice(0, 100);
    }

    if (category !== undefined) {
      if (typeof category !== "string" || category.trim().length === 0) {
        return apiError("Category cannot be empty.", 400);
      }
      updates.category = category.trim().slice(0, 50);
    }

    if (price !== undefined) {
      const p = Number(price);
      if (isNaN(p) || p < 0 || p > 100000) {
        return apiError("Invalid price.", 400);
      }
      updates.price = roundMoney(p);
    }

    if (is_veg !== undefined) {
      updates.is_veg = Boolean(is_veg);
    }

    if (description !== undefined) {
      updates.description = typeof description === "string" ? description.trim().slice(0, 500) : null;
    }

    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active);
    }

    if (sort_order !== undefined) {
      updates.sort_order = Number.isInteger(Number(sort_order)) ? Number(sort_order) : 0;
    }

    const { data: updatedItem, error: updateErr } = await supabaseAdmin
      .from("menu_items")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr || !updatedItem) {
      console.error("[PATCH /api/admin/menu] Update error:", updateErr);
      return apiError("Failed to update menu item.", 500);
    }

    return apiSuccess({ success: true, item: updatedItem });
  } catch (err) {
    console.error("[PATCH /api/admin/menu] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const { manager, errorResponse } = await requireManager(req);
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return apiError("Missing menu item ID.", 400);

    // Verify item ownership
    const { data: existing, error: findErr } = await supabaseAdmin
      .from("menu_items")
      .select("id, restaurant_id, name")
      .eq("id", id)
      .maybeSingle();

    if (findErr || !existing) {
      return apiError("Menu item not found.", 404);
    }

    if (manager.role !== "platform_admin" && existing.restaurant_id !== manager.restaurantId) {
      return apiError("Forbidden: Dish belongs to another restaurant.", 403);
    }

    // Check if this menu item has been ordered historically in order_items
    const { count: orderItemsCount } = await supabaseAdmin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("menu_item_id", id);

    if (orderItemsCount && orderItemsCount > 0) {
      // Soft-deactivate to protect historical invoices & order audit trails
      await supabaseAdmin
        .from("menu_items")
        .update({ is_active: false })
        .eq("id", id);

      return apiSuccess({
        success: true,
        deactivated: true,
        message: "Dish deactivated to protect historical order records.",
      });
    }

    // Hard-delete if never ordered
    const { error: deleteErr } = await supabaseAdmin
      .from("menu_items")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      console.error("[DELETE /api/admin/menu] Delete error:", deleteErr);
      return apiError("Failed to delete menu item.", 500);
    }

    return apiSuccess({
      success: true,
      deleted: true,
      message: "Menu item deleted.",
    });
  } catch (err) {
    console.error("[DELETE /api/admin/menu] Unhandled error:", err);
    return apiError("An unexpected server error occurred.", 500);
  }
}
