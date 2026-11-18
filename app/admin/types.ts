import type { PaymentMethod } from "@/lib/types";

export type AdminTab = "overview" | "menu" | "tables" | "reports" | "settings";

export type TableData = {
  id: string;
  label: string;
  qr_token: string;
  hasOpenSession: boolean;
  sessionId: string | null;
  qrUrl: string;
};

export type ReportData = {
  range: string;
  summary: {
    totalSales: number;
    billsCount: number;
    averageBillValue: number;
    totalTax: number;
    totalDiscount: number;
    totalService: number;
    cancelledOrdersCount: number;
  };
  paymentBreakdown: Record<PaymentMethod, number>;
  popularItems: { name: string; quantity: number; revenue: number }[];
  categorySales: { category: string; quantity: number; revenue: number }[];
  tableUtilization: { label: string; count: number; total: number }[];
  recentBills: {
    id: string;
    billNumber: number;
    total: number;
    discount: number;
    tax: number;
    paymentMethod: string;
    tableLabel: string;
    createdAt: string;
  }[];
};

export type DishFormData = {
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  description: string;
  sort_order: number;
};

export type ToastNotification = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};
