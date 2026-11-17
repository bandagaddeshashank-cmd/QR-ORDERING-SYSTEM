export type Restaurant = {
  id: string;
  name: string;
  gstin: string | null;
  tax_percent: number;
  service_charge_percent: number;
  cancel_window_seconds: number;
  created_at: string;
};

export type Table = {
  id: string;
  restaurant_id: string;
  label: string;
  qr_token: string;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  is_veg: boolean;
  is_active: boolean;
  sort_order: number;
};

export type TableSession = {
  id: string;
  table_id: string;
  status: "open" | "closed";
  session_token: string | null;
  opened_at: string;
  closed_at: string | null;
};

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "cancelled";

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  note: string | null;
  status?: string;
};

export type Order = {
  id: string;
  session_id: string;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  edited_at: string | null;
  order_items: OrderItem[];
  edit_seconds_left?: number;
  lock_seconds_left?: number;
  table_sessions?: {
    tables?: {
      id?: string;
      label?: string;
      restaurant_id?: string;
      restaurants?: {
        name?: string;
        cancel_window_seconds?: number;
      } | null;
    } | null;
  } | null;
};

export type WaiterCall = {
  id: string;
  table_id: string;
  status: "open" | "done";
  created_at: string;
  done_at: string | null;
  tables?: {
    label: string;
    restaurant_id?: string;
  } | null;
};

export type PaymentMethod = "cash" | "upi" | "card" | "other";

export type BillLine = {
  name: string;
  price: number;
  qty: number;
  total: number;
};

export type Bill = {
  id?: string;
  sessionId: string;
  table: string;
  restaurant: string;
  gstin?: string | null;
  lines: BillLine[];
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
  taxPercent: number;
  servicePercent: number;
  notServed: number;
  billNumber?: number;
  paymentMethod?: PaymentMethod;
  createdAt?: string;
};

export type StaffRole = "manager" | "staff";

export type AuthenticatedStaff = {
  userId: string;
  email: string;
  role: StaffRole;
  restaurantId?: string;
};
