"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Image from "next/image";
import AdminGate from "./AdminGate";
import { authFetch } from "@/lib/authFetch";
import type { Restaurant, MenuItem, PaymentMethod } from "@/lib/types";
import QRCode from "qrcode";

type AdminTab = "overview" | "menu" | "tables" | "reports";

type TableData = {
  id: string;
  label: string;
  qr_token: string;
  hasOpenSession: boolean;
  sessionId: string | null;
  qrUrl: string;
};

type ReportData = {
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

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminContent />
    </AdminGate>
  );
}

function AdminContent() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overview / Settings State
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [stats, setStats] = useState<{
    totalTables: number;
    activeMenuItems: number;
    openSessions: number;
    billsToday: number;
    salesToday: number;
  } | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    gstin: "",
    tax_percent: 5,
    service_charge_percent: 0,
    cancel_window_seconds: 120,
  });
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [dishForm, setDishForm] = useState({
    name: "",
    category: "Main Course",
    price: 150,
    is_veg: true,
    description: "",
    sort_order: 0,
  });

  // Tables State
  const [tables, setTables] = useState<TableData[]>([]);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [selectedTableForQr, setSelectedTableForQr] = useState<TableData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isPrintAllMode, setIsPrintAllMode] = useState(false);
  const [allQrUrls, setAllQrUrls] = useState<{ label: string; qrUrl: string; dataUrl: string }[]>([]);

  // Reports State
  const [reportRange, setReportRange] = useState("today");
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/overview");
      if (res.ok) {
        const json = await res.json();
        setRestaurant(json.restaurant);
        setStats(json.stats);
        setSettingsForm({
          name: json.restaurant.name || "",
          gstin: json.restaurant.gstin || "",
          tax_percent: Number(json.restaurant.tax_percent) || 5,
          service_charge_percent: Number(json.restaurant.service_charge_percent) || 0,
          cancel_window_seconds: Number(json.restaurant.cancel_window_seconds) || 120,
        });
      }
    } catch (e) {
      console.error("Failed to load overview:", e);
    }
  }, []);

  // Load Menu Data
  const loadMenu = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/menu");
      if (res.ok) {
        const json = await res.json();
        setMenuItems(json);
      }
    } catch (e) {
      console.error("Failed to load menu:", e);
    }
  }, []);

  // Load Tables Data
  const loadTables = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/tables");
      if (res.ok) {
        const json = await res.json();
        setTables(json);
      }
    } catch (e) {
      console.error("Failed to load tables:", e);
    }
  }, []);

  // Load Reports Data
  const loadReports = useCallback(async (r: string) => {
    try {
      const res = await authFetch(`/api/admin/reports?range=${r}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json);
      }
    } catch (e) {
      console.error("Failed to load reports:", e);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const [overviewRes, menuRes, tablesRes, reportsRes] = await Promise.all([
          authFetch("/api/admin/overview"),
          authFetch("/api/admin/menu"),
          authFetch("/api/admin/tables"),
          authFetch("/api/admin/reports?range=today"),
        ]);

        if (!active) return;

        if (overviewRes.ok) {
          const ov = await overviewRes.json();
          setRestaurant(ov.restaurant);
          setStats(ov.stats);
          setSettingsForm({
            name: ov.restaurant.name || "",
            gstin: ov.restaurant.gstin || "",
            tax_percent: Number(ov.restaurant.tax_percent) || 5,
            service_charge_percent: Number(ov.restaurant.service_charge_percent) || 0,
            cancel_window_seconds: Number(ov.restaurant.cancel_window_seconds) || 120,
          });
        }

        if (menuRes.ok) {
          setMenuItems(await menuRes.json());
        }

        if (tablesRes.ok) {
          setTables(await tablesRes.json());
        }

        if (reportsRes.ok) {
          setReportData(await reportsRes.json());
        }
      } catch (err) {
        console.error("Failed to load admin initial data:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  // Handle Tab Switch
  const switchTab = (t: AdminTab) => {
    setTab(t);
    setError(null);
    setSettingsFeedback(null);
    if (t === "overview") loadOverview();
    if (t === "menu") loadMenu();
    if (t === "tables") loadTables();
    if (t === "reports") loadReports(reportRange);
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsFeedback(null);
    setError(null);

    startTransition(async () => {
      try {
        const res = await authFetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsForm),
        });
        const json = await res.json();
        if (res.ok) {
          setRestaurant(json.restaurant);
          setSettingsFeedback("Settings saved successfully.");
        } else {
          setError(json.error || "Failed to update settings.");
        }
      } catch {
        setError("Network error updating settings.");
      }
    });
  };

  // Add / Edit Dish
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const res = await authFetch("/api/admin/menu", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...dishForm }),
        });
        if (res.ok) {
          setEditingItem(null);
          loadMenu();
        }
      } else {
        const res = await authFetch("/api/admin/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dishForm),
        });
        if (res.ok) {
          setIsAddMenuModalOpen(false);
          loadMenu();
        }
      }
    } catch (err) {
      console.error("Error saving dish:", err);
    }
  };

  // Toggle Dish Availability
  const handleToggleDishActive = async (item: MenuItem) => {
    try {
      const res = await authFetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, is_active: !m.is_active } : m))
        );
      }
    } catch (err) {
      console.error("Error toggling item status:", err);
    }
  };

  // Delete Dish (Soft-deactivate if in orders)
  const handleDeleteDish = async (id: string) => {
    if (!confirm("Are you sure you want to remove or deactivate this dish?")) return;
    try {
      const res = await authFetch(`/api/admin/menu?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadMenu();
      }
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  };

  // Add Table
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) return;
    try {
      const res = await authFetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newTableLabel.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setNewTableLabel("");
        setIsAddTableModalOpen(false);
        loadTables();
      } else {
        alert(json.error || "Failed to add table.");
      }
    } catch (err) {
      console.error("Error adding table:", err);
    }
  };

  // Regenerate Table Token
  const handleRegenerateToken = async (tableId: string, label: string) => {
    if (
      !confirm(
        `Regenerate QR token for Table ${label}? This will immediately revoke the existing QR code sticker.`
      )
    )
      return;

    try {
      const res = await authFetch("/api/admin/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, regenerateToken: true }),
      });
      if (res.ok) {
        loadTables();
      }
    } catch (err) {
      console.error("Error regenerating token:", err);
    }
  };

  // View & Generate QR for a single table
  const handleOpenQr = async (t: TableData) => {
    setSelectedTableForQr(t);
    try {
      const url = await QRCode.toDataURL(t.qrUrl, {
        width: 350,
        margin: 2,
        color: { dark: "#193A2D", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error("QR generation failed:", e);
    }
  };

  // Generate All QR Codes for Printing Sheet
  const handlePreparePrintSheet = async () => {
    setIsPrintAllMode(true);
    const list: { label: string; qrUrl: string; dataUrl: string }[] = [];
    for (const t of tables) {
      try {
        const d = await QRCode.toDataURL(t.qrUrl, {
          width: 300,
          margin: 2,
          color: { dark: "#193A2D", light: "#FFFFFF" },
        });
        list.push({ label: t.label, qrUrl: t.qrUrl, dataUrl: d });
      } catch (e) {
        console.error(e);
      }
    }
    setAllQrUrls(list);
  };

  // Categories list
  const categories = ["All", ...Array.from(new Set(menuItems.map((m) => m.category)))];

  const filteredMenuItems = menuItems.filter((m) => {
    const matchesCat = categoryFilter === "All" || m.category === categoryFilter;
    const matchesSearch =
      m.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchesVeg =
      vegFilter === "all" || (vegFilter === "veg" ? m.is_veg : !m.is_veg);
    return matchesCat && matchesSearch && matchesVeg;
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#193A2D] border-t-transparent mb-3" />
          <p className="text-sm font-semibold text-[#193A2D]">Loading Admin Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5EF] text-[#252D38]">
      {/* Sub Header & Navigation Tabs */}
      <div className="border-b border-[#252D38]/10 bg-white px-6 py-4 shadow-sm print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#193A2D]/60">
              Restaurant Management
            </span>
            <h1 className="text-2xl font-black text-[#193A2D]">
              {restaurant?.name || "Green Embassy"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F8F5EF] p-1.5 border border-[#252D38]/10">
            <button
              onClick={() => switchTab("overview")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tab === "overview"
                  ? "bg-[#193A2D] text-[#E7B94F] shadow-sm"
                  : "text-[#252D38]/70 hover:text-[#193A2D]"
              }`}
            >
              Overview & Settings
            </button>
            <button
              onClick={() => switchTab("menu")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tab === "menu"
                  ? "bg-[#193A2D] text-[#E7B94F] shadow-sm"
                  : "text-[#252D38]/70 hover:text-[#193A2D]"
              }`}
            >
              Menu ({menuItems.length})
            </button>
            <button
              onClick={() => switchTab("tables")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tab === "tables"
                  ? "bg-[#193A2D] text-[#E7B94F] shadow-sm"
                  : "text-[#252D38]/70 hover:text-[#193A2D]"
              }`}
            >
              Tables & QR ({tables.length})
            </button>
            <button
              onClick={() => switchTab("reports")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                tab === "reports"
                  ? "bg-[#193A2D] text-[#E7B94F] shadow-sm"
                  : "text-[#252D38]/70 hover:text-[#193A2D]"
              }`}
            >
              Reports & Sales
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 border border-red-200 text-xs font-bold text-red-800">
            {error}
          </div>
        )}

        {/* TAB 1: OVERVIEW & SETTINGS */}
        {tab === "overview" && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-3xl bg-white p-5 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Total Tables
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">{stats?.totalTables ?? 0}</p>
                <span className="text-[11px] font-medium text-emerald-600 mt-1 inline-block">
                  {stats?.openSessions ?? 0} active dining sessions
                </span>
              </div>

              <div className="rounded-3xl bg-white p-5 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Active Menu Items
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">
                  {stats?.activeMenuItems ?? 0}
                </p>
                <span className="text-[11px] font-medium text-[#252D38]/60 mt-1 inline-block">
                  Live on QR Menu
                </span>
              </div>

              <div className="rounded-3xl bg-white p-5 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Invoices Today
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">{stats?.billsToday ?? 0}</p>
                <span className="text-[11px] font-medium text-[#252D38]/60 mt-1 inline-block">
                  Settled transactions
                </span>
              </div>

              <div className="rounded-3xl bg-white p-5 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Sales Today
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">
                  ₹{stats?.salesToday.toLocaleString("en-IN") ?? 0}
                </p>
                <span className="text-[11px] font-medium text-emerald-600 mt-1 inline-block">
                  Real database records
                </span>
              </div>
            </div>

            {/* Restaurant Profile Form */}
            <div className="rounded-3xl bg-white p-8 border border-[#252D38]/10 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#252D38]/10 pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-[#193A2D]">Restaurant Configuration</h2>
                  <p className="text-xs text-[#252D38]/60 mt-0.5">
                    Configure billing parameters, taxes, order cancellation window and business details.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Restaurant
                </span>
              </div>

              {settingsFeedback && (
                <div className="mb-6 rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-xs font-bold text-emerald-800">
                  {settingsFeedback}
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1.5">
                      Restaurant Name
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.name}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, name: e.target.value })
                      }
                      className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1.5">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.gstin}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, gstin: e.target.value })
                      }
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-semibold uppercase focus:border-[#193A2D] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1.5">
                      GST / VAT Tax Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="50"
                      required
                      value={settingsForm.tax_percent}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          tax_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                    />
                    <p className="text-[11px] text-[#252D38]/60 mt-1">
                      Applied to customer invoices automatically during billing.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1.5">
                      Service Charge Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="30"
                      required
                      value={settingsForm.service_charge_percent}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          service_charge_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                    />
                    <p className="text-[11px] text-[#252D38]/60 mt-1">
                      Set to 0% if optional or voluntary.
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1.5">
                      Customer Order Modification & Cancellation Window (Seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      required
                      value={settingsForm.cancel_window_seconds}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          cancel_window_seconds: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="h-12 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-sm font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                    />
                    <p className="text-[11px] text-[#252D38]/60 mt-1">
                      During this countdown, guests can edit items or cancel without kitchen friction. Recommended: 120 seconds.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#252D38]/10 flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[#193A2D] px-8 text-sm font-bold text-[#E7B94F] shadow-md hover:bg-[#122b21] disabled:opacity-50 transition-all"
                  >
                    {isPending ? "Saving Configuration..." : "Save Settings"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: MENU MANAGEMENT */}
        {tab === "menu" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#193A2D]">Menu Catalog</h2>
                <p className="text-xs text-[#252D38]/60 mt-0.5">
                  Add, edit, deactivate dishes, adjust pricing, and organize menu categories.
                </p>
              </div>

              <button
                onClick={() => {
                  setDishForm({
                    name: "",
                    category: "Main Course",
                    price: 150,
                    is_veg: true,
                    description: "",
                    sort_order: 0,
                  });
                  setEditingItem(null);
                  setIsAddMenuModalOpen(true);
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#193A2D] px-5 text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21] transition-all"
              >
                + Add New Dish
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between rounded-2xl bg-white p-4 border border-[#252D38]/10 shadow-sm">
              <input
                type="text"
                placeholder="Search dish by name or description..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="h-10 w-full md:w-72 rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-xs font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-10 rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3 text-xs font-semibold focus:border-[#193A2D] focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      Category: {c}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-xl bg-[#F8F5EF] p-1 border border-[#252D38]/10 text-xs">
                  <button
                    onClick={() => setVegFilter("all")}
                    className={`rounded-lg px-3 py-1 font-bold ${
                      vegFilter === "all" ? "bg-[#193A2D] text-[#E7B94F]" : "text-[#252D38]/70"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVegFilter("veg")}
                    className={`rounded-lg px-3 py-1 font-bold ${
                      vegFilter === "veg" ? "bg-emerald-600 text-white" : "text-[#252D38]/70"
                    }`}
                  >
                    Veg
                  </button>
                  <button
                    onClick={() => setVegFilter("non-veg")}
                    className={`rounded-lg px-3 py-1 font-bold ${
                      vegFilter === "non-veg" ? "bg-red-600 text-white" : "text-[#252D38]/70"
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Items Table */}
            <div className="overflow-hidden rounded-3xl bg-white border border-[#252D38]/10 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#252D38]/10 bg-[#F8F5EF] text-[11px] font-bold uppercase tracking-wider text-[#252D38]/70">
                    <tr>
                      <th className="px-6 py-4">Item Details</th>
                      <th className="px-4 py-4">Category</th>
                      <th className="px-4 py-4">Price</th>
                      <th className="px-4 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252D38]/5 font-medium">
                    {filteredMenuItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8F5EF]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-4 w-4 shrink-0 rounded-sm border p-0.5 flex items-center justify-center ${
                                item.is_veg ? "border-emerald-600" : "border-red-600"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  item.is_veg ? "bg-emerald-600" : "bg-red-600"
                                }`}
                              />
                            </span>
                            <div>
                              <p className="font-bold text-[#193A2D] text-sm">{item.name}</p>
                              {item.description && (
                                <p className="text-[11px] text-[#252D38]/60 line-clamp-1 max-w-xs mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-lg bg-[#193A2D]/10 px-2.5 py-1 text-[11px] font-bold text-[#193A2D]">
                            {item.category}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-black text-sm text-[#193A2D]">
                          ₹{Number(item.price).toFixed(2)}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleToggleDishActive(item)}
                            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                              item.is_active
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                            }`}
                          >
                            {item.is_active ? "● Available" : "○ Inactive"}
                          </button>
                        </td>

                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setDishForm({
                                name: item.name,
                                category: item.category,
                                price: Number(item.price),
                                is_veg: item.is_veg,
                                description: item.description || "",
                                sort_order: item.sort_order || 0,
                              });
                            }}
                            className="rounded-lg border border-[#252D38]/20 bg-white px-3 py-1.5 text-[11px] font-bold text-[#193A2D] hover:bg-[#193A2D]/10 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDish(item.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredMenuItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[#252D38]/50">
                          No menu items matched your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add / Edit Dish Modal */}
            {(isAddMenuModalOpen || editingItem) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-[#252D38]/10 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-[#252D38]/10 pb-3 mb-4">
                    <h3 className="text-lg font-black text-[#193A2D]">
                      {editingItem ? "Edit Dish" : "Add New Dish"}
                    </h3>
                    <button
                      onClick={() => {
                        setIsAddMenuModalOpen(false);
                        setEditingItem(null);
                      }}
                      className="h-8 w-8 rounded-full bg-[#F8F5EF] font-bold text-[#252D38]/70 hover:bg-[#193A2D] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveDish} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                        Dish Name
                      </label>
                      <input
                        type="text"
                        required
                        value={dishForm.name}
                        onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })}
                        placeholder="e.g. Paneer Butter Masala"
                        className="h-11 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-xs font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                          Category
                        </label>
                        <input
                          type="text"
                          required
                          value={dishForm.category}
                          onChange={(e) => setDishForm({ ...dishForm, category: e.target.value })}
                          placeholder="e.g. Starters, Main Course"
                          className="h-11 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-xs font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          required
                          value={dishForm.price}
                          onChange={(e) =>
                            setDishForm({ ...dishForm, price: parseFloat(e.target.value) || 0 })
                          }
                          className="h-11 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-xs font-semibold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                        Dietary Type
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 cursor-pointer">
                          <input
                            type="radio"
                            name="dietary"
                            checked={dishForm.is_veg}
                            onChange={() => setDishForm({ ...dishForm, is_veg: true })}
                            className="accent-emerald-700"
                          />
                          Vegetarian (Green mark)
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-red-800 cursor-pointer">
                          <input
                            type="radio"
                            name="dietary"
                            checked={!dishForm.is_veg}
                            onChange={() => setDishForm({ ...dishForm, is_veg: false })}
                            className="accent-red-700"
                          />
                          Non-Vegetarian (Red mark)
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                        Description (Ingredients & Allergens)
                      </label>
                      <textarea
                        rows={3}
                        value={dishForm.description}
                        onChange={(e) =>
                          setDishForm({ ...dishForm, description: e.target.value })
                        }
                        placeholder="Description displayed on customer mobile menu..."
                        className="w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] p-3 text-xs font-medium focus:border-[#193A2D] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-[#252D38]/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuModalOpen(false);
                          setEditingItem(null);
                        }}
                        className="h-10 rounded-xl border border-[#252D38]/20 px-4 text-xs font-bold text-[#252D38]/70 hover:bg-[#F8F5EF]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="h-10 rounded-xl bg-[#193A2D] px-6 text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21]"
                      >
                        {editingItem ? "Update Dish" : "Save Dish"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TABLES & QR CODE MANAGEMENT */}
        {tab === "tables" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#193A2D]">Tables & QR Code Center</h2>
                <p className="text-xs text-[#252D38]/60 mt-0.5">
                  Generate table tokens, print QR stickers, and regenerate revoked QR codes.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreparePrintSheet}
                  className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-[#193A2D] bg-white px-4 text-xs font-bold text-[#193A2D] shadow-sm hover:bg-[#193A2D]/5 transition-all"
                >
                  🖨️ Printable QR Sheet
                </button>
                <button
                  onClick={() => {
                    setNewTableLabel("");
                    setIsAddTableModalOpen(true);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#193A2D] px-5 text-xs font-bold text-[#E7B94F] shadow-sm hover:bg-[#122b21] transition-all"
                >
                  + Add Table
                </button>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col justify-between rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-black text-[#193A2D]">
                        Table {t.label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          t.hasOpenSession
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        }`}
                      >
                        {t.hasOpenSession ? "● Dining" : "○ Vacant"}
                      </span>
                    </div>

                    <p className="text-[11px] font-mono text-[#252D38]/50 break-all mb-4">
                      Token: {t.qr_token.slice(0, 12)}...
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[#252D38]/10">
                    <button
                      onClick={() => handleOpenQr(t)}
                      className="w-full h-10 rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] hover:bg-[#122b21] transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>📱 View & Print QR</span>
                    </button>

                    <button
                      onClick={() => handleRegenerateToken(t.id, t.label)}
                      className="w-full h-9 rounded-xl border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition-all"
                    >
                      Regenerate Token
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Table Modal */}
            {isAddTableModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#252D38]/10">
                  <h3 className="text-lg font-black text-[#193A2D] mb-1">Add New Table</h3>
                  <p className="text-xs text-[#252D38]/60 mb-4">
                    Create a dining table. A unique secure QR token will be generated automatically.
                  </p>

                  <form onSubmit={handleAddTable} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#252D38]/70 mb-1">
                        Table Label
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. T6 or Garden-2"
                        value={newTableLabel}
                        onChange={(e) => setNewTableLabel(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#252D38]/20 bg-[#F8F5EF] px-3.5 text-xs font-bold focus:border-[#193A2D] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-[#252D38]/10">
                      <button
                        type="button"
                        onClick={() => setIsAddTableModalOpen(false)}
                        className="h-10 rounded-xl border border-[#252D38]/20 px-4 text-xs font-bold text-[#252D38]/70 hover:bg-[#F8F5EF]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="h-10 rounded-xl bg-[#193A2D] px-5 text-xs font-bold text-[#E7B94F]"
                      >
                        Create Table
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* View Single QR Code Modal */}
            {selectedTableForQr && qrDataUrl && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-[#252D38]/10 text-center">
                  <div className="rounded-2xl border border-[#252D38]/10 p-4 bg-[#F8F5EF] mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#E7B94F] bg-[#193A2D] px-3 py-1 rounded-full inline-block mb-3">
                      GREEN EMBASSY
                    </span>
                    <h4 className="text-2xl font-black text-[#193A2D] mb-1">
                      Table {selectedTableForQr.label}
                    </h4>
                    <p className="text-[11px] text-[#252D38]/60 mb-4">
                      Scan to view live menu & order from your phone
                    </p>

                    {/* QR Image */}
                    <div className="mx-auto h-48 w-48 rounded-xl bg-white p-2 shadow-inner border border-[#252D38]/10 flex items-center justify-center">
                      <Image
                        src={qrDataUrl}
                        alt={`QR code for Table ${selectedTableForQr.label}`}
                        width={180}
                        height={180}
                        unoptimized
                        className="h-auto w-auto"
                      />
                    </div>

                    <p className="mt-3 text-[10px] text-[#252D38]/50 break-all font-mono">
                      {selectedTableForQr.qrUrl}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={qrDataUrl}
                      download={`table_${selectedTableForQr.label}_qr.png`}
                      className="h-11 flex-1 rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F] flex items-center justify-center shadow-sm hover:bg-[#122b21]"
                    >
                      💾 Download PNG
                    </a>
                    <button
                      onClick={() => window.print()}
                      className="h-11 px-4 rounded-xl border border-[#193A2D] text-xs font-bold text-[#193A2D] hover:bg-[#193A2D]/5"
                    >
                      Print
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTableForQr(null);
                        setQrDataUrl("");
                      }}
                      className="h-11 px-4 rounded-xl border border-[#252D38]/20 text-xs font-bold text-[#252D38]/70 hover:bg-[#F8F5EF]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Printable Multi-Table Sheet */}
            {isPrintAllMode && (
              <div className="fixed inset-0 z-50 bg-white p-8 overflow-y-auto">
                <div className="flex justify-between items-center mb-6 print:hidden">
                  <div>
                    <h3 className="text-xl font-bold text-[#193A2D]">
                      Printable Table Tent Sheet ({allQrUrls.length} Tables)
                    </h3>
                    <p className="text-xs text-[#252D38]/60">
                      Standard layout ready for printing on A4 cardstock or table stands.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => window.print()}
                      className="h-10 px-5 rounded-xl bg-[#193A2D] text-xs font-bold text-[#E7B94F]"
                    >
                      Print Sheet
                    </button>
                    <button
                      onClick={() => setIsPrintAllMode(false)}
                      className="h-10 px-4 rounded-xl border border-[#252D38]/20 text-xs font-bold text-[#252D38]/70"
                    >
                      Exit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {allQrUrls.map((t) => (
                    <div
                      key={t.label}
                      className="rounded-2xl border-2 border-dashed border-[#193A2D]/40 p-6 text-center bg-[#F8F5EF] page-break-inside-avoid"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E7B94F] bg-[#193A2D] px-3 py-0.5 rounded-full inline-block mb-2">
                        GREEN EMBASSY
                      </span>
                      <h4 className="text-3xl font-black text-[#193A2D] mb-1">
                        Table {t.label}
                      </h4>
                      <p className="text-xs text-[#252D38]/70 mb-4">
                        Scan with your smartphone camera to order
                      </p>

                      <div className="mx-auto h-40 w-40 rounded-xl bg-white p-2 shadow-sm border border-[#252D38]/10 flex items-center justify-center">
                        <Image
                          src={t.dataUrl}
                          alt={`QR ${t.label}`}
                          width={150}
                          height={150}
                          unoptimized
                          className="h-auto w-auto"
                        />
                      </div>
                      <p className="mt-3 text-[9px] font-mono text-[#252D38]/50">
                        No app download required • Instant ordering
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REPORTS & ANALYTICS */}
        {tab === "reports" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#193A2D]">Reports & Sales Analytics</h2>
                <p className="text-xs text-[#252D38]/60 mt-0.5">
                  Audit sales records, payment method breakdowns, item popularity, and tax collections.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex rounded-xl bg-white p-1 border border-[#252D38]/10 text-xs shadow-sm">
                  {["today", "7d", "30d", "all"].map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setReportRange(r);
                        loadReports(r);
                      }}
                      className={`rounded-lg px-3 py-1.5 font-bold uppercase ${
                        reportRange === r ? "bg-[#193A2D] text-[#E7B94F]" : "text-[#252D38]/70"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <a
                  href={`/api/admin/reports?range=${reportRange}&format=csv`}
                  download
                  className="h-10 rounded-xl border border-[#193A2D] bg-white px-4 text-xs font-bold text-[#193A2D] flex items-center gap-1.5 shadow-sm hover:bg-[#193A2D]/5"
                >
                  📥 Export CSV
                </a>
              </div>
            </div>

            {/* Report Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Gross Revenue
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">
                  ₹{reportData?.summary.totalSales.toLocaleString("en-IN") ?? 0}
                </p>
                <span className="text-[11px] font-medium text-emerald-600 mt-1 inline-block">
                  Verified invoices
                </span>
              </div>

              <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Completed Bills
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">
                  {reportData?.summary.billsCount ?? 0}
                </p>
                <span className="text-[11px] font-medium text-[#252D38]/60 mt-1 inline-block">
                  Tables settled
                </span>
              </div>

              <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  Average Order Value
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">
                  ₹{reportData?.summary.averageBillValue ?? 0}
                </p>
                <span className="text-[11px] font-medium text-[#252D38]/60 mt-1 inline-block">
                  Per completed table
                </span>
              </div>

              <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#252D38]/60">
                  GST Collected
                </span>
                <p className="mt-2 text-3xl font-black text-[#193A2D]">
                  ₹{reportData?.summary.totalTax ?? 0}
                </p>
                <span className="text-[11px] font-medium text-emerald-600 mt-1 inline-block">
                  5% Tax audit ledger
                </span>
              </div>
            </div>

            {/* Split Grid: Payment Breakdown & Popular Dishes */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Payment Methods */}
              <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
                <h3 className="text-base font-black text-[#193A2D] mb-4">Payment Methods</h3>
                <div className="space-y-4">
                  {(["upi", "cash", "card", "other"] as PaymentMethod[]).map((m) => {
                    const amount = reportData?.paymentBreakdown[m] ?? 0;
                    const tot = reportData?.summary.totalSales || 1;
                    const pct = Math.round((amount / tot) * 100);

                    return (
                      <div key={m}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="uppercase text-[#252D38]">{m}</span>
                          <span className="text-[#193A2D]">
                            ₹{amount.toLocaleString("en-IN")} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#F8F5EF] overflow-hidden">
                          <div
                            className="h-full bg-[#193A2D] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Popular Dishes */}
              <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
                <h3 className="text-base font-black text-[#193A2D] mb-4">Top Selling Dishes</h3>
                <div className="divide-y divide-[#252D38]/5">
                  {reportData?.popularItems.slice(0, 5).map((dish, idx) => (
                    <div key={dish.name} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-[#193A2D]/10 font-bold text-[#193A2D] flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-[#193A2D]">{dish.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-[#193A2D]">
                          ₹{dish.revenue.toLocaleString("en-IN")}
                        </span>
                        <p className="text-[10px] text-[#252D38]/60">{dish.quantity} sold</p>
                      </div>
                    </div>
                  ))}
                  {(!reportData || reportData.popularItems.length === 0) && (
                    <p className="py-6 text-center text-xs text-[#252D38]/50">
                      No order items recorded in this time range.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Table Utilization Ranking */}
            <div className="rounded-3xl bg-white p-6 border border-[#252D38]/10 shadow-sm">
              <h3 className="text-base font-black text-[#193A2D] mb-4">Table Revenue Matrix</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {reportData?.tableUtilization.map((t) => (
                  <div
                    key={t.label}
                    className="rounded-2xl bg-[#F8F5EF] p-3 text-center border border-[#252D38]/10"
                  >
                    <span className="text-xs font-black text-[#193A2D]">Table {t.label}</span>
                    <p className="text-sm font-black text-emerald-800 mt-1">₹{t.total}</p>
                    <span className="text-[10px] text-[#252D38]/60">{t.count} bills</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
