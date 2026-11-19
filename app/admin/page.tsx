"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import AdminGate from "./AdminGate";
import AdminSidebar from "./AdminSidebar";
import MenuThumbnail from "./MenuThumbnail";
import {
  PaymentBreakdownChart,
  CategorySalesBarChart,
  TableRevenueMatrixChart,
} from "./AdminCharts";
import {
  DishModal,
  TableModal,
  QrModal,
  ConfirmDialog,
  PrintSheetModal,
  type ConfirmState,
} from "./AdminModals";
import { authFetch } from "@/lib/authFetch";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Restaurant, MenuItem } from "@/lib/types";
import type { AdminTab, TableData, ReportData, DishFormData, ToastNotification } from "./types";
import QRCode from "qrcode";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PrinterIcon,
  DownloadIcon,
  CheckIcon,
  AlertCircleIcon,
  QrCodeIcon,
  MenuBarsIcon,
  RefreshCwIcon,
  CopyIcon,
  ExternalLinkIcon,
  SparklesIcon,
  TrendingUpIcon,
  ReceiptIcon,
  CloseIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { DietaryBadge } from "@/components/ui/Badge";

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  // Navigation & Layout State
  const [tab, setTab] = useState<AdminTab>("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastNotification | null>(null);

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
  const [isPendingSettings, startTransitionSettings] = useTransition();

  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDishSubmitting, setIsDishSubmitting] = useState(false);
  const [dishForm, setDishForm] = useState<DishFormData>({
    name: "",
    category: "Main Course",
    price: 150,
    is_veg: true,
    description: "",
    sort_order: 0,
  });

  // Tables & QR State
  const [tables, setTables] = useState<TableData[]>([]);
  const [tableFilter, setTableFilter] = useState<"all" | "occupied" | "vacant">("all");
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [isTableSubmitting, setIsTableSubmitting] = useState(false);
  const [selectedTableForQr, setSelectedTableForQr] = useState<TableData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isPrintAllMode, setIsPrintAllMode] = useState(false);
  const [allQrUrls, setAllQrUrls] = useState<{ label: string; qrUrl: string; dataUrl: string }[]>([]);

  // Reports & Analytics State
  const [reportRange, setReportRange] = useState("today");
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Custom Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    isDanger: false,
    onConfirm: () => {},
  });

  // Helper for Toast Notifications
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = String(Date.now());
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  }, []);

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string = "URL") => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard!`, "success");
    }
  };

  // -----------------------------------------------------------
  // Data Loaders
  // -----------------------------------------------------------
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

  // Initial Full Load
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
        console.error("Failed to load initial admin data:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  // Handle Tab Navigation Switch
  const switchTab = (t: AdminTab) => {
    setTab(t);
    if (t === "overview") loadOverview();
    if (t === "menu") loadMenu();
    if (t === "tables") loadTables();
    if (t === "reports") loadReports(reportRange);
  };

  // Refresh current view data
  const handleRefreshCurrent = () => {
    if (tab === "overview") {
      loadOverview();
      loadReports(reportRange);
    } else if (tab === "menu") {
      loadMenu();
    } else if (tab === "tables") {
      loadTables();
    } else if (tab === "reports") {
      loadReports(reportRange);
    }
    showToast("Dashboard refreshed with latest authoritative data.", "info");
  };

  // -----------------------------------------------------------
  // Action Handlers
  // -----------------------------------------------------------

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    startTransitionSettings(async () => {
      try {
        const res = await authFetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsForm),
        });
        const json = await res.json();
        if (res.ok) {
          setRestaurant(json.restaurant);
          showToast("Restaurant configuration saved successfully.", "success");
        } else {
          showToast(json.error || "Failed to update settings.", "error");
        }
      } catch {
        showToast("Network error updating settings.", "error");
      }
    });
  };

  // Add / Edit Dish
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDishSubmitting(true);

    try {
      if (editingItem) {
        const res = await authFetch("/api/admin/menu", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingItem.id,
            ...dishForm,
          }),
        });
        if (res.ok) {
          loadMenu();
          setIsAddMenuModalOpen(false);
          setEditingItem(null);
          showToast(`Dish "${dishForm.name}" updated successfully.`, "success");
        } else {
          const err = await res.json();
          showToast(err.error || "Failed to update dish.", "error");
        }
      } else {
        const res = await authFetch("/api/admin/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dishForm),
        });
        if (res.ok) {
          loadMenu();
          setIsAddMenuModalOpen(false);
          setDishForm({
            name: "",
            category: "Main Course",
            price: 150,
            is_veg: true,
            description: "",
            sort_order: 0,
          });
          showToast(`Dish "${dishForm.name}" added to menu catalog.`, "success");
        } else {
          const err = await res.json();
          showToast(err.error || "Failed to add dish.", "error");
        }
      }
    } catch {
      showToast("Network error saving dish.", "error");
    } finally {
      setIsDishSubmitting(false);
    }
  };

  // Toggle Dish Availability
  const handleToggleDishActive = async (item: MenuItem) => {
    try {
      const res = await authFetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          is_active: !item.is_active,
        }),
      });
      if (res.ok) {
        loadMenu();
        showToast(
          `Dish "${item.name}" is now ${!item.is_active ? "Available on QR menu" : "Hidden from QR menu"}.`,
          "info"
        );
      }
    } catch (e) {
      console.error("Error toggling active status:", e);
    }
  };

  // Delete Dish (with confirmation dialog)
  const triggerDeleteDish = (item: MenuItem) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Culinary Item",
      message: `Are you sure you want to permanently delete "${item.name}" from your menu catalog? This cannot be undone.`,
      confirmLabel: "Delete Dish",
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/admin/menu?id=${encodeURIComponent(item.id)}`, {
            method: "DELETE",
          });
          if (res.ok) {
            loadMenu();
            showToast(`"${item.name}" has been removed.`, "success");
          } else {
            const err = await res.json();
            showToast(err.error || "Failed to delete dish.", "error");
          }
        } catch {
          showToast("Network error deleting dish.", "error");
        }
      },
    });
  };

  // Add Table
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) return;
    setIsTableSubmitting(true);

    try {
      const res = await authFetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newTableLabel.trim() }),
      });
      if (res.ok) {
        loadTables();
        setIsAddTableModalOpen(false);
        setNewTableLabel("");
        showToast(`Table "${newTableLabel.trim()}" created successfully.`, "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to add table.", "error");
      }
    } catch {
      showToast("Network error creating table.", "error");
    } finally {
      setIsTableSubmitting(false);
    }
  };

  // Regenerate Token (with confirmation dialog)
  const triggerRegenerateToken = (table: TableData) => {
    setConfirmState({
      isOpen: true,
      title: `Regenerate QR for Table ${table.label}`,
      message: `Regenerating the QR token will immediately revoke and invalidate the existing physical QR sticker on Table ${table.label}. Any customer scanning the old code will be blocked.`,
      confirmLabel: "Revoke & Regenerate",
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await authFetch("/api/admin/tables", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tableId: table.id, regenerateToken: true }),
          });
          if (res.ok) {
            loadTables();
            showToast(`QR token for Table ${table.label} regenerated.`, "success");
          }
        } catch (err) {
          console.error("Error regenerating token:", err);
        }
      },
    });
  };

  // Delete Table (with confirmation dialog)
  const triggerDeleteTable = (table: TableData) => {
    setConfirmState({
      isOpen: true,
      title: `Delete Table ${table.label}`,
      message: `Are you sure you want to delete Table ${table.label}? Only tables with zero open sessions or billing records can be removed.`,
      confirmLabel: "Delete Table",
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/admin/tables?id=${encodeURIComponent(table.id)}`, {
            method: "DELETE",
          });
          const json = await res.json();
          if (res.ok) {
            loadTables();
            showToast(`Table ${table.label} deleted.`, "success");
          } else {
            showToast(json.error || "Cannot delete table.", "error");
          }
        } catch {
          showToast("Network error deleting table.", "error");
        }
      },
    });
  };

  // Open Single Table QR Modal
  const handleOpenQr = async (t: TableData) => {
    setSelectedTableForQr(t);
    try {
      const url = await QRCode.toDataURL(t.qrUrl, {
        width: 400,
        margin: 2,
        color: { dark: "#173F35", light: "#FFFFFF" },
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
          width: 350,
          margin: 2,
          color: { dark: "#173F35", light: "#FFFFFF" },
        });
        list.push({ label: t.label, qrUrl: t.qrUrl, dataUrl: d });
      } catch (e) {
        console.error(e);
      }
    }
    setAllQrUrls(list);
  };

  // Filter Categories
  const categories = ["All", ...Array.from(new Set(menuItems.map((m) => m.category)))];

  const filteredMenuItems = menuItems.filter((m) => {
    const matchesCat = categoryFilter === "All" || m.category === categoryFilter;
    const matchesSearch =
      m.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchesVeg = vegFilter === "all" || (vegFilter === "veg" ? m.is_veg : !m.is_veg);
    return matchesCat && matchesSearch && matchesVeg;
  });

  const occupiedTables = tables.filter((t) => t.hasOpenSession);
  const vacantTables = tables.filter((t) => !t.hasOpenSession);

  const filteredTables = tables.filter((t) => {
    if (tableFilter === "occupied") return t.hasOpenSession;
    if (tableFilter === "vacant") return !t.hasOpenSession;
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0]">
        <div className="text-center">
          <span className="inline-block h-10 w-10 animate-spin rounded-full border-3 border-[#173F35] border-t-transparent mb-4" />
          <p className="font-serif font-bold text-lg text-[#173F35]">Green Embassy Restaurant SaaS</p>
          <p className="text-xs text-[#242B2A]/60 mt-1">Connecting to authenticated operations workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#242B2A] flex flex-col md:flex-row">
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <AdminSidebar
        currentTab={tab}
        onSelectTab={switchTab}
        restaurantName={restaurant?.name || "Green Embassy"}
        tableCount={tables.length}
        activeSessionsCount={occupiedTables.length}
        menuItemCount={menuItems.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. MAIN WORKSPACE */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          isSidebarCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        {/* Sticky Dashboard Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#173F35]/10 bg-white/95 px-5 py-3.5 backdrop-blur-md shadow-xs print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl bg-[#FAF7F0] text-[#173F35] hover:bg-[#173F35]/10 transition-colors cursor-pointer shrink-0"
              title="Open Navigation"
              aria-label="Open navigation sidebar"
            >
              <MenuBarsIcon className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base sm:text-lg text-[#173F35] truncate">
                  {tab === "overview" && "Executive Dashboard"}
                  {tab === "tables" && "Table Occupancy & QR Center"}
                  {tab === "menu" && "Menu Catalog & Engineering"}
                  {tab === "reports" && "Sales Analytics & Ledger"}
                  {tab === "settings" && "Restaurant Configuration"}
                </span>

                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live System
                </span>
              </div>
              <p className="text-[11px] text-[#242B2A]/60 hidden sm:block truncate">
                {restaurant?.name || "Green Embassy"} &bull; Luxury Tech Dining Architecture
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefreshCurrent}
              title="Refresh Data"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] text-[#173F35] hover:bg-white hover:border-[#173F35]/40 transition-all cursor-pointer"
              aria-label="Refresh dashboard data"
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>

            {tab === "menu" && (
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
                className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#173F35] px-3.5 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all cursor-pointer border border-[#E8B95B]/30"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Dish</span>
              </button>
            )}

            {tab === "tables" && (
              <>
                <button
                  onClick={handlePreparePrintSheet}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-[#173F35] bg-white px-3 text-xs font-bold text-[#173F35] shadow-xs hover:bg-[#173F35]/5 transition-all cursor-pointer"
                >
                  <PrinterIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print Sheet</span>
                </button>
                <button
                  onClick={() => {
                    setNewTableLabel("");
                    setIsAddTableModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-[#173F35] px-3.5 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all cursor-pointer border border-[#E8B95B]/30"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Table</span>
                </button>
              </>
            )}

            {tab === "reports" && (
              <a
                href={`/api/admin/reports?range=${reportRange}&format=csv`}
                download
                className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-[#173F35] bg-white px-3 text-xs font-bold text-[#173F35] shadow-xs hover:bg-[#173F35]/5 transition-all"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </a>
            )}
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toast && (
          <div className="px-6 pt-4 print:hidden animate-slide-up">
            <div
              className={`flex items-center justify-between rounded-2xl p-3.5 text-xs font-semibold shadow-luxury border ${
                toast.type === "error"
                  ? "bg-rose-50 text-rose-900 border-rose-200"
                  : toast.type === "info"
                  ? "bg-sky-50 text-sky-900 border-sky-200"
                  : "bg-emerald-50 text-emerald-950 border-emerald-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === "error" && <AlertCircleIcon className="w-4 h-4 text-rose-700 shrink-0" />}
                {toast.type === "success" && <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0" />}
                {toast.type === "info" && <SparklesIcon className="w-4 h-4 text-sky-700 shrink-0" />}
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
                aria-label="Dismiss toast notification"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Views */}
        <main className="p-6 md:p-8 space-y-8 flex-1">
          {/* ========================================================= */}
          {/* TAB 1: EXECUTIVE DASHBOARD OVERVIEW */}
          {/* ========================================================= */}
          {tab === "overview" && (
            <div className="space-y-8">
              {/* 4 PRIMARY KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Revenue Today */}
                <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                      Gross Revenue Today
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    ₹{stats?.salesToday.toLocaleString("en-IN") ?? 0}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#242B2A]/60">
                    <span>{stats?.billsToday ?? 0} settled invoices</span>
                    <span className="font-semibold text-emerald-800">Verified</span>
                  </div>
                </div>

                {/* Total Orders / Bills */}
                <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                      Settled Invoices
                    </span>
                    <ReceiptIcon className="w-4 h-4 text-[#173F35]/40" />
                  </div>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    {stats?.billsToday ?? 0}
                  </p>
                  <p className="mt-2 text-[11px] text-[#242B2A]/60">
                    Transactions audited through cashier desk
                  </p>
                </div>

                {/* Average Bill Value */}
                <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                      Average Order Value
                    </span>
                    <TrendingUpIcon className="w-4 h-4 text-[#E8B95B]" />
                  </div>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    ₹{reportData?.summary.averageBillValue ?? 0}
                  </p>
                  <p className="mt-2 text-[11px] text-[#242B2A]/60">
                    Average guest spend per dining session
                  </p>
                </div>

                {/* Table Occupancy Rate */}
                <div className="rounded-3xl bg-white p-5 border border-[#173F35]/10 shadow-luxury hover:shadow-luxury-lg transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                      Table Occupancy
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        occupiedTables.length > 0
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "bg-stone-50 text-stone-600"
                      }`}
                    >
                      {tables.length > 0
                        ? `${Math.round((occupiedTables.length / tables.length) * 100)}% Occ.`
                        : "0%"}
                    </span>
                  </div>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    {occupiedTables.length}{" "}
                    <span className="text-sm font-sans font-medium text-[#242B2A]/50">
                      / {tables.length} Active
                    </span>
                  </p>
                  <p className="mt-2 text-[11px] text-[#242B2A]/60">
                    {vacantTables.length} tables vacant &amp; ready
                  </p>
                </div>
              </div>

              {/* VISUAL TABLE OCCUPANCY MAP SNAPSHOT */}
              <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#173F35]">
                      Floor Plan &amp; Live Table Occupancy
                    </h3>
                    <p className="text-[11px] text-[#242B2A]/60 mt-0.5">
                      Visual overview of real-time dining sessions across the floor
                    </p>
                  </div>

                  <button
                    onClick={() => switchTab("tables")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#173F35] hover:text-[#E8B95B] transition-colors cursor-pointer"
                  >
                    <span>Full QR Center</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {tables.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => switchTab("tables")}
                      className={`cursor-pointer rounded-2xl p-3 border transition-all hover:scale-[1.02] shadow-xs ${
                        t.hasOpenSession
                          ? "border-[#E8B95B] bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40"
                          : "border-[#173F35]/15 bg-[#FAF7F0] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-sm text-[#173F35]">
                          Table {t.label}
                        </span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            t.hasOpenSession ? "bg-[#E8B95B] animate-pulse" : "bg-emerald-600"
                          }`}
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#242B2A]/60">
                        {t.hasOpenSession ? "Dining Active" : "Vacant"}
                      </p>
                    </div>
                  ))}

                  {tables.length === 0 && (
                    <p className="col-span-full py-6 text-center text-xs text-[#242B2A]/50 font-serif">
                      No tables registered yet. Add tables in the Tables tab.
                    </p>
                  )}
                </div>
              </div>

              {/* SPLIT ANALYTICS: PAYMENT BREAKDOWN & POPULAR ITEMS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Payment Breakdown Donut */}
                <div className="lg:col-span-6">
                  {reportData && (
                    <PaymentBreakdownChart
                      breakdown={reportData.paymentBreakdown}
                      totalSales={reportData.summary.totalSales}
                    />
                  )}
                </div>

                {/* Popular Menu Items */}
                <div className="lg:col-span-6 rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-serif font-bold text-base text-[#173F35]">
                        Top Performing Dishes
                      </h3>
                      <p className="text-[11px] text-[#242B2A]/60 mt-0.5">
                        Highest revenue generators ordered via customer QR
                      </p>
                    </div>
                    <button
                      onClick={() => switchTab("menu")}
                      className="text-xs font-bold text-[#173F35] hover:text-[#E8B95B] transition-colors cursor-pointer"
                    >
                      View Menu ({menuItems.length})
                    </button>
                  </div>

                  <div className="divide-y divide-[#173F35]/5 space-y-1">
                    {reportData?.popularItems.slice(0, 5).map((dish, idx) => (
                      <div
                        key={dish.name}
                        className="py-2.5 flex items-center justify-between text-xs first:pt-0"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold ${
                              idx === 0
                                ? "bg-[#E8B95B] text-[#173F35] shadow-xs"
                                : "bg-[#FAF7F0] text-[#173F35]"
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="font-serif font-bold text-sm text-[#173F35]">
                              {dish.name}
                            </span>
                            <p className="text-[10px] text-[#242B2A]/50">
                              {dish.quantity} orders fulfilled
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-[#173F35] tabular-nums">
                            ₹{dish.revenue.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    ))}

                    {(!reportData || reportData.popularItems.length === 0) && (
                      <div className="py-8 text-center text-xs text-[#242B2A]/50 font-serif">
                        No customer orders recorded in this reporting period.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RECENT SETTLED BILLS LEDGER */}
              <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#173F35]">
                      Recent Settled Invoices
                    </h3>
                    <p className="text-[11px] text-[#242B2A]/60 mt-0.5">
                      Audited transactions closed at cashier desk
                    </p>
                  </div>
                  <button
                    onClick={() => switchTab("reports")}
                    className="text-xs font-bold text-[#173F35] hover:text-[#E8B95B] transition-colors cursor-pointer"
                  >
                    Full Ledger
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#173F35]/10 bg-[#FAF7F0] text-[10px] font-bold uppercase tracking-wider text-[#242B2A]/60">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Payment Method</th>
                        <th className="px-4 py-3 text-right">Tax (GST)</th>
                        <th className="px-4 py-3 text-right">Total Amount</th>
                        <th className="px-4 py-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#173F35]/5 font-medium">
                      {reportData?.recentBills.slice(0, 5).map((bill) => (
                        <tr key={bill.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-[#173F35]">
                            #{bill.billNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-lg bg-[#173F35]/10 px-2.5 py-0.5 font-bold text-[#173F35]">
                              Table {bill.tableLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 uppercase text-[11px] font-semibold text-[#242B2A]">
                            {bill.paymentMethod}
                          </td>
                          <td className="px-4 py-3 text-right text-[#242B2A]/60 tabular-nums">
                            ₹{bill.tax}
                          </td>
                          <td className="px-4 py-3 text-right font-serif font-bold text-sm text-[#173F35] tabular-nums">
                            ₹{bill.total.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-[#242B2A]/50 font-mono">
                            {new Date(bill.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}

                      {(!reportData || reportData.recentBills.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[#242B2A]/50 font-serif">
                            No billing settlements recorded yet today.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: TABLES & QR CODE CENTER */}
          {/* ========================================================= */}
          {tab === "tables" && (
            <div className="space-y-6">
              {/* Tables Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between rounded-3xl bg-white p-4 border border-[#173F35]/10 shadow-luxury">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#173F35] uppercase tracking-wider">
                    Filter Floor:
                  </span>
                  <div className="flex rounded-xl bg-[#FAF7F0] p-1 border border-[#173F35]/10 text-xs font-bold">
                    <button
                      onClick={() => setTableFilter("all")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        tableFilter === "all" ? "bg-[#173F35] text-[#E8B95B]" : "text-[#242B2A]/70"
                      }`}
                    >
                      All Tables ({tables.length})
                    </button>
                    <button
                      onClick={() => setTableFilter("occupied")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        tableFilter === "occupied" ? "bg-[#E8B95B] text-[#173F35]" : "text-[#242B2A]/70"
                      }`}
                    >
                      Dining Active ({occupiedTables.length})
                    </button>
                    <button
                      onClick={() => setTableFilter("vacant")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        tableFilter === "vacant" ? "bg-emerald-800 text-white" : "text-[#242B2A]/70"
                      }`}
                    >
                      Vacant ({vacantTables.length})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePreparePrintSheet}
                    className="inline-flex items-center gap-1.5 h-10 rounded-xl border border-[#173F35] bg-white px-4 text-xs font-bold text-[#173F35] shadow-xs hover:bg-[#173F35]/5 cursor-pointer transition-colors"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" />
                    <span>Print All Table Tents</span>
                  </button>

                  <button
                    onClick={() => {
                      setNewTableLabel("");
                      setIsAddTableModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#173F35] px-4 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] cursor-pointer transition-colors border border-[#E8B95B]/30"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add New Table</span>
                  </button>
                </div>
              </div>

              {/* Tables Occupancy Grid */}
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredTables.map((t) => (
                  <div
                    key={t.id}
                    className={`flex flex-col justify-between rounded-3xl p-6 border transition-all shadow-luxury hover:shadow-luxury-lg ${
                      t.hasOpenSession
                        ? "bg-gradient-to-b from-amber-50/40 to-white border-[#E8B95B]"
                        : "bg-white border-[#173F35]/10"
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-serif font-bold text-[#173F35]">
                          Table {t.label}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            t.hasOpenSession
                              ? "bg-amber-100 text-amber-950 border border-amber-300"
                              : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          }`}
                        >
                          {t.hasOpenSession ? "● Dining Active" : "○ Vacant / Ready"}
                        </span>
                      </div>

                      {/* Token Preview */}
                      <div className="flex items-center justify-between rounded-xl bg-[#FAF7F0] px-2.5 py-1.5 border border-[#173F35]/10 mb-4 text-[10px] font-mono text-[#242B2A]/60">
                        <span className="truncate">Token: {t.qr_token.slice(0, 10)}...</span>
                        <button
                          onClick={() => handleCopy(t.qrUrl, `Table ${t.label} Link`)}
                          title="Copy QR Order Link"
                          className="text-[#173F35] hover:text-[#E8B95B] font-bold ml-1 cursor-pointer"
                        >
                          <CopyIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Table Actions */}
                    <div className="space-y-2 pt-4 border-t border-[#173F35]/10">
                      <button
                        onClick={() => handleOpenQr(t)}
                        className="w-full h-10 rounded-xl bg-[#173F35] text-xs font-bold text-[#E8B95B] hover:bg-[#102e26] shadow-luxury transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#E8B95B]/30"
                      >
                        <QrCodeIcon className="w-4 h-4" />
                        <span>View &amp; Print QR</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => triggerRegenerateToken(t)}
                          className="h-8 rounded-xl border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-900 hover:bg-amber-100 transition-all cursor-pointer"
                        >
                          Revoke Token
                        </button>
                        <button
                          onClick={() => triggerDeleteTable(t)}
                          className="h-8 rounded-xl border border-rose-200 bg-rose-50 text-[10px] font-bold text-rose-800 hover:bg-rose-100 transition-all cursor-pointer"
                        >
                          Delete Table
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredTables.length === 0 && (
                  <div className="col-span-full py-6">
                    <EmptyState
                      icon={QrCodeIcon}
                      title="No Tables Found"
                      description={`There are currently no dining tables matching the "${tableFilter}" filter status.`}
                      actionLabel="Show All Tables"
                      onAction={() => setTableFilter("all")}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: MENU MANAGEMENT & CATALOG */}
          {/* ========================================================= */}
          {tab === "menu" && (
            <div className="space-y-6">
              {/* Menu Filter Strip */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between rounded-3xl bg-white p-4 border border-[#173F35]/10 shadow-luxury">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search dishes by name or ingredients..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] pl-9 pr-8 text-xs font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all shadow-xs"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#242B2A]/40">
                    <SearchIcon className="w-3.5 h-3.5" />
                  </span>
                  {menuSearch && (
                    <button
                      onClick={() => setMenuSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#242B2A]/40 hover:text-[#242B2A] cursor-pointer"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-10 rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3 text-xs font-semibold focus:border-[#173F35] focus:outline-none transition-all cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        Category: {c}
                      </option>
                    ))}
                  </select>

                  <div className="flex rounded-xl bg-[#FAF7F0] p-1 border border-[#173F35]/10 text-xs font-bold">
                    <button
                      onClick={() => setVegFilter("all")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        vegFilter === "all" ? "bg-[#173F35] text-[#E8B95B]" : "text-[#242B2A]/70"
                      }`}
                    >
                      All Dishes
                    </button>
                    <button
                      onClick={() => setVegFilter("veg")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        vegFilter === "veg" ? "bg-emerald-800 text-white" : "text-[#242B2A]/70"
                      }`}
                    >
                      Veg
                    </button>
                    <button
                      onClick={() => setVegFilter("non-veg")}
                      className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                        vegFilter === "non-veg" ? "bg-rose-800 text-white" : "text-[#242B2A]/70"
                      }`}
                    >
                      Non-Veg
                    </button>
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
                    className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#173F35] px-4 text-xs font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] transition-all cursor-pointer ml-auto border border-[#E8B95B]/30"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add Dish</span>
                  </button>
                </div>
              </div>

              {/* Menu Catalog Table with Thumbnails */}
              <div className="overflow-hidden rounded-3xl bg-white border border-[#173F35]/10 shadow-luxury">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#173F35]/10 bg-[#FAF7F0] text-[10px] font-bold uppercase tracking-wider text-[#242B2A]/60">
                      <tr>
                        <th className="px-6 py-4">Item &amp; Photography</th>
                        <th className="px-4 py-4">Category</th>
                        <th className="px-4 py-4">Price</th>
                        <th className="px-4 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#173F35]/5 font-medium">
                      {filteredMenuItems.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAF7F0]/60 transition-colors group">
                          {/* Item with Thumbnail */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5">
                              <MenuThumbnail
                                name={item.name}
                                category={item.category}
                                isVeg={item.is_veg}
                                size="md"
                              />
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <DietaryBadge isVeg={item.is_veg} />
                                  <span className="font-serif font-bold text-sm text-[#173F35]">
                                    {item.name}
                                  </span>
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-[#242B2A]/60 line-clamp-1 max-w-sm">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="px-4 py-4">
                            <span className="rounded-lg bg-[#173F35]/10 px-2.5 py-1 text-[11px] font-bold text-[#173F35]">
                              {item.category}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="px-4 py-4 font-serif font-bold text-sm text-[#173F35] tabular-nums">
                            ₹{Number(item.price).toFixed(2)}
                          </td>

                          {/* Availability Toggle */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => handleToggleDishActive(item)}
                              className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                                item.is_active
                                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                                  : "bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200"
                              }`}
                            >
                              {item.is_active ? "● Live on QR" : "○ Paused"}
                            </button>
                          </td>

                          {/* Action Buttons */}
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
                                setIsAddMenuModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-[#173F35]/20 bg-white px-3 py-1.5 text-[11px] font-bold text-[#173F35] hover:bg-[#173F35]/5 transition-colors cursor-pointer"
                            >
                              <PencilIcon className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => triggerDeleteDish(item)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              <TrashIcon className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredMenuItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-xs text-[#242B2A]/50 font-serif">
                            No menu items matched your active filter or search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: REPORTS & SALES ANALYTICS */}
          {/* ========================================================= */}
          {tab === "reports" && (
            <div className="space-y-8">
              {/* Range Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between rounded-3xl bg-white p-4 border border-[#173F35]/10 shadow-luxury">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#173F35] uppercase tracking-wider">
                    Reporting Window:
                  </span>
                  <div className="flex rounded-xl bg-[#FAF7F0] p-1 border border-[#173F35]/10 text-xs font-bold">
                    {["today", "7d", "30d", "all"].map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setReportRange(r);
                          loadReports(r);
                        }}
                        className={`rounded-lg px-3.5 py-1.5 uppercase transition-all cursor-pointer ${
                          reportRange === r ? "bg-[#173F35] text-[#E8B95B]" : "text-[#242B2A]/70"
                        }`}
                      >
                        {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r}
                      </button>
                    ))}
                  </div>
                </div>

                <a
                  href={`/api/admin/reports?range=${reportRange}&format=csv`}
                  download
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-[#173F35] bg-white px-5 text-xs font-bold text-[#173F35] shadow-xs hover:bg-[#173F35]/5 transition-all"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  <span>Export Financial CSV</span>
                </a>
              </div>

              {/* 4 Financial Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                    Gross Invoiced Revenue
                  </span>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    ₹{reportData?.summary.totalSales.toLocaleString("en-IN") ?? 0}
                  </p>
                  <span className="text-[11px] font-semibold text-emerald-800 mt-1 inline-block">
                    {reportData?.summary.billsCount ?? 0} settled transactions
                  </span>
                </div>

                <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                    Average Bill Value (AOV)
                  </span>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    ₹{reportData?.summary.averageBillValue ?? 0}
                  </p>
                  <span className="text-[11px] font-medium text-[#242B2A]/60 mt-1 inline-block">
                    Per seated dining party
                  </span>
                </div>

                <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                    GST Tax Collected
                  </span>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    ₹{reportData?.summary.totalTax.toLocaleString("en-IN") ?? 0}
                  </p>
                  <span className="text-[11px] font-semibold text-emerald-800 mt-1 inline-block">
                    Govt tax liability ledger
                  </span>
                </div>

                <div className="rounded-3xl bg-white p-6 border border-[#173F35]/10 shadow-luxury">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#242B2A]/50">
                    Cancelled Orders
                  </span>
                  <p className="mt-2 text-3xl font-serif font-bold text-[#173F35] tabular-nums">
                    {reportData?.summary.cancelledOrdersCount ?? 0}
                  </p>
                  <span className="text-[11px] font-medium text-[#242B2A]/60 mt-1 inline-block">
                    Within guest lock window
                  </span>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6">
                  {reportData && (
                    <PaymentBreakdownChart
                      breakdown={reportData.paymentBreakdown}
                      totalSales={reportData.summary.totalSales}
                    />
                  )}
                </div>

                <div className="lg:col-span-6">
                  {reportData && (
                    <CategorySalesBarChart
                      categories={reportData.categorySales}
                      totalSales={reportData.summary.totalSales}
                    />
                  )}
                </div>
              </div>

              {/* Table Revenue Matrix */}
              {reportData && <TableRevenueMatrixChart tables={reportData.tableUtilization} />}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: RESTAURANT CONFIGURATION / SETTINGS */}
          {/* ========================================================= */}
          {tab === "settings" && (
            <div className="space-y-6 max-w-4xl">
              <div className="rounded-3xl bg-white p-8 border border-[#173F35]/10 shadow-luxury">
                <div className="flex items-center justify-between border-b border-[#173F35]/10 pb-4 mb-6">
                  <div>
                    <h2 className="text-xl font-serif font-bold text-[#173F35]">
                      Restaurant Configuration &amp; Tax Profile
                    </h2>
                    <p className="text-xs text-[#242B2A]/60 mt-0.5">
                      Configure official restaurant identity, GSTIN, billing tax rules, and guest cancellation window.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    Production Ready
                  </span>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                        Restaurant Brand Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={settingsForm.name}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, name: e.target.value })
                        }
                        className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                        GSTIN Registration Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.gstin}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, gstin: e.target.value })
                        }
                        placeholder="e.g. 29AAAAA0000A1Z5"
                        className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-semibold uppercase focus:border-[#173F35] focus:bg-white focus:outline-none transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                        GST / VAT Percentage (%) *
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
                        className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all tabular-nums"
                      />
                      <p className="text-[11px] text-[#242B2A]/60 mt-1">
                        Authoritative rate applied to customer billing invoices.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                        Service Charge (%) *
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
                        className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all tabular-nums"
                      />
                      <p className="text-[11px] text-[#242B2A]/60 mt-1">
                        Optional hospitality service charge (0% if not levied).
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#242B2A]/70 mb-1.5">
                        Customer Order Modification &amp; Cancellation Window (Seconds) *
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
                        className="h-12 w-full rounded-xl border border-[#173F35]/15 bg-[#FAF7F0] px-3.5 text-sm font-semibold focus:border-[#173F35] focus:bg-white focus:outline-none transition-all tabular-nums"
                      />
                      <p className="text-[11px] text-[#242B2A]/60 mt-1">
                        During this grace countdown, guests can edit items or cancel orders without kitchen friction. Recommended: 120 seconds.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#173F35]/10 flex justify-end">
                    <button
                      type="submit"
                      disabled={isPendingSettings}
                      className="inline-flex h-12 items-center justify-center rounded-xl bg-[#173F35] px-8 text-sm font-bold text-[#E8B95B] shadow-luxury hover:bg-[#102e26] disabled:opacity-50 transition-all cursor-pointer border border-[#E8B95B]/30"
                    >
                      {isPendingSettings ? "Saving Settings..." : "Save Configuration"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. MODALS & OVERLAYS */}
      {/* Add / Edit Dish Modal */}
      <DishModal
        isOpen={isAddMenuModalOpen}
        onClose={() => {
          setIsAddMenuModalOpen(false);
          setEditingItem(null);
        }}
        isEditing={!!editingItem}
        dishForm={dishForm}
        onChangeDishForm={setDishForm}
        onSubmit={handleSaveDish}
        isSubmitting={isDishSubmitting}
        categories={categories}
      />

      {/* Add Table Modal */}
      <TableModal
        isOpen={isAddTableModalOpen}
        onClose={() => setIsAddTableModalOpen(false)}
        label={newTableLabel}
        onChangeLabel={setNewTableLabel}
        onSubmit={handleAddTable}
        isSubmitting={isTableSubmitting}
      />

      {/* Single Table QR Code Modal */}
      <QrModal
        table={selectedTableForQr}
        qrDataUrl={qrDataUrl}
        onClose={() => {
          setSelectedTableForQr(null);
          setQrDataUrl("");
        }}
        onCopyLink={(url) => handleCopy(url, "Table QR Link")}
      />

      {/* Printable Multi-Table Tent Sheet Modal */}
      <PrintSheetModal
        isOpen={isPrintAllMode}
        onClose={() => setIsPrintAllMode(false)}
        allQrUrls={allQrUrls}
      />

      {/* Custom Confirmation Dialog */}
      <ConfirmDialog
        state={confirmState}
        onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
      />
    </div>
  );
}
