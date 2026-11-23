'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Package,
  Layers,
  Users,
  Truck,
  DollarSign,
  Calendar,
  Printer,
  RefreshCw,
  Search,
  Eye,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Building2,
  UserCheck,
  Percent,
  Sparkles,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  Store,
  Boxes,
  Banknote,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import {
  ReportDatePreset,
  ReportSummaryKPIs,
  DailyTrendItem,
  MonthlyTrendItem,
  DetailedSaleItemRow,
  CategorySummaryItem,
  ProductVelocityItem,
  InventoryBranchValuation,
  LowStockItem,
  CashierSummaryItem,
  PaymentSummaryItem,
  SupplierSummaryItem,
  ReceivingItemRow,
  ACTIVE_STAFF_MEMBERS,
  HISTORICAL_MONTHLY_DATA,
  HISTORICAL_CASHIER_DATA,
  HISTORICAL_BRANCH_VALUATION,
  HISTORICAL_CATEGORIES_DATA,
  HISTORICAL_TOP_PRODUCTS,
  HISTORICAL_SUPPLIERS_DATA,
  fetchReportMetrics,
  fetchDetailedSales,
  fetchReceivings,
  fetchLowStockAlerts,
  exportToCsv,
} from '../../../lib/reports-data';

type ReportTab =
  | 'sales-summary'
  | 'detailed-sales'
  | 'categories-items'
  | 'inventory-valuation'
  | 'cashiers-payments'
  | 'procurement-suppliers'
  | 'customers-audit';

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

export default function ReportsSuitePage() {
  const { currency, selectedBranchId, allowedBranches, isOwner } = useTenantBranch();

  // Active Tab
  const [activeTab, setActiveTab] = useState<ReportTab>('sales-summary');
  const [trendMode, setTrendMode] = useState<'monthly' | 'daily'>('monthly');

  // Filters State
  const [period, setPeriod] = useState<ReportDatePreset>('all');
  const [filterBranchId, setFilterBranchId] = useState<string>(() => {
    if (!isOwner && allowedBranches.length > 0) {
      return selectedBranchId || allowedBranches[0]?.id || 'ALL';
    }
    return selectedBranchId || 'ALL';
  });

  useEffect(() => {
    if (!isOwner && allowedBranches.length > 0) {
      if (!filterBranchId || !allowedBranches.some((b) => b.id === filterBranchId)) {
        setFilterBranchId(selectedBranchId || allowedBranches[0]?.id || '');
      }
    }
  }, [isOwner, allowedBranches, selectedBranchId, filterBranchId]);
  const [filterCashier, setFilterCashier] = useState<string>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Search & Pagination for detailed tabs
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesTotalCount, setSalesTotalCount] = useState(0);

  const [grnSearch, setGrnSearch] = useState('');
  const [grnPage, setGrnPage] = useState(1);
  const [grnTotalPages, setGrnTotalPages] = useState(1);
  const [grnTotalCount, setGrnTotalCount] = useState(0);

  const [productSearch, setProductSearch] = useState('');

  // Loading & Refresh State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data Store
  const [kpis, setKpis] = useState<ReportSummaryKPIs | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>(HISTORICAL_MONTHLY_DATA);
  const [detailedSales, setDetailedSales] = useState<DetailedSaleItemRow[]>([]);
  const [categories, setCategories] = useState<CategorySummaryItem[]>(HISTORICAL_CATEGORIES_DATA);
  const [topProducts, setTopProducts] = useState<ProductVelocityItem[]>(HISTORICAL_TOP_PRODUCTS);
  const [inventoryValuation] = useState<InventoryBranchValuation[]>(HISTORICAL_BRANCH_VALUATION);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockItem[]>([]);
  const [cashiers, setCashiers] = useState<CashierSummaryItem[]>(HISTORICAL_CASHIER_DATA);
  const [payments, setPayments] = useState<PaymentSummaryItem[]>([]);
  const [suppliers] = useState<SupplierSummaryItem[]>(HISTORICAL_SUPPLIERS_DATA);
  const [receivings, setReceivings] = useState<ReceivingItemRow[]>([]);

  // Slide-Over Drawer State
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<{
    type: 'sale' | 'cashier' | 'supplier' | 'customer' | 'grn';
    data: any;
  } | null>(null);

  // Load Main Metrics & Trend Data
  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const metricsRes = await fetchReportMetrics({
        period,
        branchId: filterBranchId,
        cashierName: filterCashier,
        startDate: period === 'custom' ? customStartDate : undefined,
        endDate: period === 'custom' ? customEndDate : undefined,
      });

      setKpis(metricsRes.kpis);
      setDailyTrend(metricsRes.dailyTrend);
      setMonthlyTrend(metricsRes.monthlyTrend);
      setCategories(metricsRes.categories);
      setTopProducts(metricsRes.topProducts);
      setCashiers(metricsRes.cashiers);
      setPayments(metricsRes.payments);

      // Low stock
      const lowStockRes = await fetchLowStockAlerts(filterBranchId !== 'ALL' ? filterBranchId : undefined);
      setLowStockAlerts(lowStockRes);
    } catch (err) {
      console.error('Error loading reports suite metrics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [period, filterBranchId, filterCashier, customStartDate, customEndDate]);

  // Load Detailed Sales Tab
  const loadDetailedSales = useCallback(async () => {
    try {
      const res = await fetchDetailedSales({
        page: salesPage,
        limit: 20,
        search: salesSearch,
        branchId: filterBranchId,
        cashierName: filterCashier,
        startDate: period === 'custom' ? customStartDate : undefined,
        endDate: period === 'custom' ? customEndDate : undefined,
      });
      setDetailedSales(res.items);
      setSalesTotalCount(res.total);
      setSalesTotalPages(res.totalPages);
    } catch (err) {
      console.error('Error loading detailed sales ledger:', err);
    }
  }, [salesPage, salesSearch, filterBranchId, filterCashier, period, customStartDate, customEndDate]);

  // Load Receivings Tab
  const loadReceivings = useCallback(async () => {
    try {
      const res = await fetchReceivings({
        page: grnPage,
        limit: 20,
        search: grnSearch,
      });
      setReceivings(res.items);
      setGrnTotalCount(res.total);
      setGrnTotalPages(res.totalPages);
    } catch (err) {
      console.error('Error loading receivings data:', err);
    }
  }, [grnPage, grnSearch]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  useEffect(() => {
    if (activeTab === 'detailed-sales') {
      loadDetailedSales();
    } else if (activeTab === 'procurement-suppliers') {
      loadReceivings();
    }
  }, [activeTab, loadDetailedSales, loadReceivings]);

  // Manual Refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReportsData();
    if (activeTab === 'detailed-sales') loadDetailedSales();
    if (activeTab === 'procurement-suppliers') loadReceivings();
  };

  // CSV Export Dispatcher
  const handleExportCsv = () => {
    if (activeTab === 'sales-summary') {
      const headers = ['Month / Period', 'Bills Count', 'Gross Sales (LKR)', 'Wholesale Cost (LKR)', 'Gross Profit (LKR)', 'Margin %'];
      const rows = monthlyTrend.map((m) => [m.label, m.bills, m.sales, m.cost, m.profit, `${m.margin}%`]);
      exportToCsv('sales-summary-report', headers, rows);
    } else if (activeTab === 'detailed-sales') {
      const headers = ['Invoice Number', 'Date & Time', 'Branch', 'Cashier', 'Customer', 'Items Count', 'Total (LKR)', 'Wholesale Cost (LKR)', 'Gross Profit (LKR)', 'Margin %', 'Payment Method', 'Status'];
      const rows = detailedSales.map((s) => [
        s.invoiceNumber,
        new Date(s.createdAt).toLocaleString(),
        s.branchName,
        s.cashierName,
        s.customerName,
        s.itemsCount,
        s.totalAmount,
        s.costAmount,
        s.profitAmount,
        `${s.margin}%`,
        s.paymentMethod,
        s.status,
      ]);
      exportToCsv('detailed-sales-ledger', headers, rows);
    } else if (activeTab === 'categories-items') {
      const headers = ['Category / Item', 'Type', 'Units Sold', 'Revenue (LKR)', 'Cost (LKR)', 'Profit (LKR)', 'Margin %'];
      const rows = [
        ...categories.map((c) => [c.category, 'Category', c.itemsSold, c.revenue, c.cost, c.profit, `${c.margin}%`]),
        ...topProducts.map((p) => [p.name, 'Product', p.unitsSold, p.revenue, p.cost, p.profit, `${p.margin}%`]),
      ];
      exportToCsv('categories-and-items-velocity', headers, rows);
    } else if (activeTab === 'inventory-valuation') {
      const headers = ['Location / Branch', 'Stock Units on Hand', 'Wholesale Cost Valuation (LKR)', 'Retail Selling Valuation (LKR)', 'Unrealized Gross Margin (LKR)', 'Margin %'];
      const rows = inventoryValuation.map((v) => [v.branchName, v.totalUnits, v.wholesaleValue, v.retailValue, v.potentialProfit, `${v.margin}%`]);
      exportToCsv('inventory-valuation-report', headers, rows);
    } else if (activeTab === 'cashiers-payments') {
      const headers = ['Staff Cashier', 'Completed Bills', 'Units Sold', 'Gross Revenue (LKR)', 'Wholesale Cost (LKR)', 'Gross Profit (LKR)', 'Margin %', 'Average Bill (LKR)'];
      const rows = cashiers.map((c) => [c.cashierName, c.billsCount, c.unitsSold, c.revenue, c.cost, c.profit, `${c.margin}%`, c.averageBill]);
      exportToCsv('cashier-staff-attribution', headers, rows);
    } else if (activeTab === 'procurement-suppliers') {
      const headers = ['Supplier Name', 'Code', 'Contact Person', 'Phone', 'GRN Deliveries', 'Total Invoiced Spend (LKR)', 'Last Delivery'];
      const rows = suppliers.map((sup) => [sup.name, sup.code, sup.contactPerson, sup.phone, sup.grnCount, sup.totalSpend, sup.lastReceivedDate]);
      exportToCsv('suppliers-procurement-summary', headers, rows);
    } else {
      window.print();
    }
  };

  // Filtered Products for Tab 3
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return topProducts;
    const q = productSearch.toLowerCase().trim();
    return topProducts.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [topProducts, productSearch]);

  // Total valuation calculation
  const totalValuation = useMemo(() => {
    return inventoryValuation.reduce(
      (acc, v) => ({
        units: acc.units + v.totalUnits,
        wholesale: acc.wholesale + v.wholesaleValue,
        retail: acc.retail + v.retailValue,
        profit: acc.profit + v.potentialProfit,
      }),
      { units: 0, wholesale: 0, retail: 0, profit: 0 }
    );
  }, [inventoryValuation]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 1. Header Toolbar */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20 px-4 py-3 md:px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">
                  Analytics & Reports Suite
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  30 Audit Reports Active
                </span>
                {loading && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Syncing...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deegayu Ayurvedic Dispensaries • 15,604 Historical Bills • 4 Branches • 94 Suppliers
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors shadow-xs"
              title="Export current table to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors shadow-xs"
              title="Print formatted audit report"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>Print</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-sm shadow-emerald-600/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Sync Live'}</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setPeriod('today')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'today' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('yesterday')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'yesterday' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'week' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'month' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Nov 2026
            </button>
            <button
              onClick={() => setPeriod('last_month')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'last_month' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Oct 2026
            </button>
            <button
              onClick={() => setPeriod('year_2026')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'year_2026' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              2026 YTD
            </button>
            <button
              onClick={() => setPeriod('year_2025')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'year_2025' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              2025 Historical
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'all' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lifetime (All-Time)
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                period === 'custom' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Custom Date Pickers */}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none"
              />
              <span className="text-slate-500 font-mono">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none"
              />
            </div>
          )}

          {/* Branch Dropdown */}
          {allowedBranches.length <= 1 && !isOwner ? (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 select-none">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-200 font-semibold">{allowedBranches[0]?.name || 'Assigned Branch'}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono">Assigned</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterBranchId}
                onChange={(e) => setFilterBranchId(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium"
              >
                {isOwner && (
                  <option value="ALL" className="bg-slate-900 text-white">
                    All Physical Branches
                  </option>
                )}
                {allowedBranches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cashier Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Staff Cashiers</option>
              {ACTIVE_STAFF_MEMBERS.map((c) => (
                <option key={c.cashierName} value={c.cashierName} className="bg-slate-900 text-white">
                  {c.cashierName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 py-2">
          <button
            onClick={() => setActiveTab('sales-summary')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'sales-summary'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Sales & Profit Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('detailed-sales')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'detailed-sales'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Detailed Transaction Ledger</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">15.6k</span>
          </button>

          <button
            onClick={() => setActiveTab('categories-items')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'categories-items'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Categories & Item Velocity</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory-valuation')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'inventory-valuation'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory Valuation & Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('cashiers-payments')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'cashiers-payments'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Cashiers & Tender Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('procurement-suppliers')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'procurement-suppliers'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Procurement & GRN (739)</span>
          </button>

          <button
            onClick={() => setActiveTab('customers-audit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'customers-audit'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Accounts & Taxes</span>
          </button>

          <a
            href="/dashboard/finance/reconciliation/?tab=admin_summary"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            <Banknote className="w-4 h-4 text-amber-400" />
            <span>End-of-Day Cash & Banking Hub</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
          </a>
        </nav>
      </div>

      {/* 3. Main Content View Area */}
      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Executive Multi-Branch Reconciliation & Banking Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Daily Cash Reconciliation & Multi-Branch Banking Hub
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Executive Ledgers
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit branch physical drawer counts, track BOC / NSB / NTB bank deposits, and manage cashier shortages.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/dashboard/finance/reconciliation/?tab=admin_summary"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              <span>Multi-Branch Summary</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="/dashboard/finance/reconciliation/?tab=bank_register"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
            >
              <span>Bank Register</span>
              <Building2 className="w-3.5 h-3.5" />
            </a>
            <a
              href="/dashboard/finance/reconciliation/?tab=shortages"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition"
            >
              <span>Cashier Shortages</span>
              <UserCheck className="w-3.5 h-3.5 text-rose-400" />
            </a>
          </div>
        </div>
        {/* ======================================================== */}
        {/* TAB 1: SALES & PROFIT ANALYTICS (Reports #2, #12, #13, #19, #20, #21) */}
        {/* ======================================================== */}
        {activeTab === 'sales-summary' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top 4 Primary KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Sales */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Sales Revenue</span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {currency} {kpis ? kpis.grossSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>15,604 Lifetime Bills</span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Wholesale Cost */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Wholesale Inventory Cost</span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {currency} {kpis ? kpis.wholesaleCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                    <span>Direct Goods Acquisition Cost</span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Gross Profit */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Operating Profit</span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                    {currency} {kpis ? kpis.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-indigo-400">
                    <Percent className="w-3.5 h-3.5" />
                    <span>Margin: {kpis?.profitMargin || 45.13}%</span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Average Order Value */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Average Bill Size (AOV)</span>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {currency} {kpis ? kpis.averageOrderValue.toLocaleString('en-US') : '0'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Per Customer Visit</span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Graphical Area Chart: Monthly Revenue & Profit Trajectory (19 Months) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>{trendMode === 'monthly' ? '19-Month Historical Sales & Gross Profit Trajectory' : 'Daily Sales Velocity & Profit Trend'}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {trendMode === 'monthly'
                      ? 'May 2025 to November 2026 Monthly Audited Performance (May 2025 Pilot → Nov 2026 Active)'
                      : 'Real-time daily transaction volume and profit generation curve'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setTrendMode('monthly')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        trendMode === 'monthly' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Monthly (19M)
                    </button>
                    <button
                      onClick={() => setTrendMode('daily')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        trendMode === 'daily' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Daily Trend
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-300">Revenue (LKR)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-slate-300">Gross Profit (LKR)</span>
                  </div>
                </div>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(trendMode === 'monthly' ? monthlyTrend : dailyTrend) as any[]} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="label" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `Rs ${(val / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any) => [`Rs ${Number(val).toLocaleString()}`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#revenueGrad)"
                      name="Gross Sales"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#6366F1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#profitGrad)"
                      name="Gross Profit"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Monthly Transaction Ledger (All 19 Months)</h3>
                  <p className="text-xs text-slate-400">Audited transaction volumes, wholesale costs, and operating margins</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                  Total: LKR 33.54M
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Calendar Month</th>
                      <th className="px-4 py-3 text-right">Bills Completed</th>
                      <th className="px-4 py-3 text-right">Gross Sales (LKR)</th>
                      <th className="px-4 py-3 text-right">Wholesale Cost (LKR)</th>
                      <th className="px-4 py-3 text-right">Gross Profit (LKR)</th>
                      <th className="px-4 py-3 text-right">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {monthlyTrend.map((m) => (
                      <tr key={m.month} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-white flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{m.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          {m.bills.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                          Rs {m.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          Rs {m.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                          Rs {m.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {m.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tax Exemption & Statutory Compliance Card (Report #12) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 shrink-0 h-fit">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Sales Tax Exemption Audit (Report #12)</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Under Sri Lanka Inland Revenue guidelines, certified indigenous Ayurvedic dispensaries and herbal healthcare treatments maintain a statutory 0.00% VAT/NBT exemption.
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-300">Exempt Sales:</span>
                    <span className="font-mono text-emerald-400 font-bold">LKR 33,543,950.30</span>
                    <span className="text-slate-500">|</span>
                    <span className="font-semibold text-slate-300">Tax Collected:</span>
                    <span className="font-mono text-slate-400 font-bold">LKR 0.00</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 h-fit">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Promotional Discounts Audit (Report #13)</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Comprehensive audit trail for cashier-applied item discounts, bundle markdowns, and senior citizen concessionary vouchers across all branches.
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-300">Total Discounts:</span>
                    <span className="font-mono text-purple-400 font-bold">LKR 0.00 (0.00%)</span>
                    <span className="text-slate-500">|</span>
                    <span className="font-semibold text-slate-300">Net Realized:</span>
                    <span className="font-mono text-emerald-400 font-bold">100.00%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: DETAILED TRANSACTION LEDGER (Report #1 Detailed Sales) */}
        {/* ======================================================== */}
        {activeTab === 'detailed-sales' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search invoice #, cashier name, customer..."
                  value={salesSearch}
                  onChange={(e) => {
                    setSalesSearch(e.target.value);
                    setSalesPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Total Bills: <strong className="text-white font-mono">{salesTotalCount.toLocaleString()}</strong></span>
                <span className="text-slate-700">|</span>
                <span>Page <strong className="text-white font-mono">{salesPage}</strong> of {salesTotalPages}</span>
              </div>
            </div>

            {/* Detailed Sales Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Branch Location</th>
                      <th className="px-4 py-3">Cashier</th>
                      <th className="px-4 py-3 text-right">Items</th>
                      <th className="px-4 py-3 text-right">Bill Total (LKR)</th>
                      <th className="px-4 py-3 text-right">Wholesale Cost</th>
                      <th className="px-4 py-3 text-right">Gross Profit</th>
                      <th className="px-4 py-3 text-center">Tender</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {detailedSales.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                          No transactions found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      detailedSales.map((sale) => (
                        <tr
                          key={sale.id}
                          onClick={() => setSelectedDrawerItem({ type: 'sale', data: sale })}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="px-4 py-2.5 font-medium text-white flex items-center gap-1.5 font-mono">
                            <Receipt className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="group-hover:text-emerald-400 transition-colors">{sale.invoiceNumber}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                            {new Date(sale.createdAt).toLocaleDateString()} {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                              {sale.branchName}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300 font-medium">
                            {sale.cashierName}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                            {sale.itemsCount}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                            Rs {sale.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                            Rs {sale.costAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                            Rs {sale.profitAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDrawerItem({ type: 'sale', data: sale });
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Showing {Math.min((salesPage - 1) * 20 + 1, salesTotalCount)} to {Math.min(salesPage * 20, salesTotalCount)} of {salesTotalCount} entries
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                    disabled={salesPage <= 1}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-medium flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 font-mono text-white">
                    {salesPage} / {salesTotalPages}
                  </span>
                  <button
                    onClick={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))}
                    disabled={salesPage >= salesTotalPages}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-medium flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: CATEGORIES & ITEM VELOCITY (Reports #6, #7, #22, #23) */}
        {/* ======================================================== */}
        {activeTab === 'categories-items' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top 10 Categories Bar Chart (Report #22) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>Top Product Categories Ranked by Gross Sales Volume</span>
                  </h3>
                  <p className="text-xs text-slate-400">Distribution across Oils, Rasayana, Dry Herbs, and Arishta preparations</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                  58+ Categories
                </span>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748B"
                      fontSize={11}
                      tickFormatter={(val) => `Rs ${(val / 1000000).toFixed(1)}M`}
                    />
                    <YAxis dataKey="category" type="category" stroke="#94A3B8" fontSize={11} tickLine={false} width={100} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any) => [`Rs ${Number(val).toLocaleString()}`, 'Gross Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Categories Table (Report #6) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Categories Summary Performance</h3>
                <span className="text-xs text-slate-400 font-mono">100% Ayurvedic Formulary</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Category Name</th>
                      <th className="px-4 py-3 text-right">Items Sold</th>
                      <th className="px-4 py-3 text-right">Gross Revenue (LKR)</th>
                      <th className="px-4 py-3 text-right">Wholesale Cost (LKR)</th>
                      <th className="px-4 py-3 text-right">Gross Profit (LKR)</th>
                      <th className="px-4 py-3 text-right">Margin %</th>
                      <th className="px-4 py-3 text-right">Store Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {categories.map((c) => (
                      <tr key={c.category} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-white flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-teal-400" />
                          <span>{c.category}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          {c.itemsSold.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                          Rs {c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          Rs {c.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                          Rs {c.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.margin}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          {c.sharePercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Velocity Leaderboard (Report #7 Items Summary) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Product Velocity Leaderboard (Top 3,120 Products)</h3>
                  <p className="text-xs text-slate-400">Best-selling Ayurvedic items ranked by sales volume & cumulative gross profit</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search product or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">SKU / Barcode</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Units Sold</th>
                      <th className="px-4 py-3 text-right">Total Revenue (LKR)</th>
                      <th className="px-4 py-3 text-right">Wholesale Cost (LKR)</th>
                      <th className="px-4 py-3 text-right">Gross Profit (LKR)</th>
                      <th className="px-4 py-3 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredProducts.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                            {idx + 1}
                          </span>
                          <span>{p.name}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">{p.sku}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {p.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">
                          {p.unitsSold.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                          Rs {p.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          Rs {p.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                          Rs {p.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {p.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: INVENTORY VALUATION & ALERTS (Reports #4, #5, #24, #25) */}
        {/* ======================================================== */}
        {activeTab === 'inventory-valuation' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Valuation KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Stock Units</span>
                <div className="text-2xl font-bold text-white mt-1">
                  {totalValuation.units.toLocaleString()}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">Across 4 Physical Locations</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Wholesale Valuation</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  Rs {totalValuation.wholesale.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">Cost Value on Hand</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Retail Selling Value</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  Rs {totalValuation.retail.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">Projected Customer Gross</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Unrealized Gross Margin</span>
                <div className="text-2xl font-bold text-indigo-400 mt-1">
                  Rs {totalValuation.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">Expected 44.73% Realization</span>
              </div>
            </div>

            {/* Multi-Branch Valuation Matrix (Report #4) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Multi-Branch Physical Location Valuation</h3>
                  <p className="text-xs text-slate-400">Physical stock audits across central warehouse and retail branches</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                  4 Stock Locations
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Branch Location</th>
                      <th className="px-4 py-3 text-right">Unique Items</th>
                      <th className="px-4 py-3 text-right">Units on Hand</th>
                      <th className="px-4 py-3 text-right">Wholesale Cost (LKR)</th>
                      <th className="px-4 py-3 text-right">Retail Selling Value (LKR)</th>
                      <th className="px-4 py-3 text-right">Potential Margin (LKR)</th>
                      <th className="px-4 py-3 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {inventoryValuation.map((v) => (
                      <tr key={v.branchId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                          <Store className="w-4 h-4 text-emerald-400" />
                          <span>{v.branchName}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{v.productsCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                          {v.totalUnits.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-400">
                          Rs {v.wholesaleValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          Rs {v.retailValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-indigo-400">
                          Rs {v.potentialProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {v.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Inventory Reorder Alert List (Report #5) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Low Inventory & Reorder Replenishment Alerts (Report #5)</span>
                  </h3>
                  <p className="text-xs text-slate-400">Dispensary items at or below reorder threshold requiring purchase orders</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {lowStockAlerts.length} Action Items
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Branch Location</th>
                      <th className="px-4 py-3 text-right">Stock on Hand</th>
                      <th className="px-4 py-3 text-right">Reorder Point</th>
                      <th className="px-4 py-3 text-right">Unit Wholesale</th>
                      <th className="px-4 py-3 text-center">Urgency Status</th>
                      <th className="px-4 py-3 text-right">Replenish Budget (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {lowStockAlerts.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-white">{item.name}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">{item.sku}</td>
                        <td className="px-4 py-2.5 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {item.branchName}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                          {item.quantityOnHand}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                          {item.reorderPoint}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          Rs {item.costPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {item.status === 'OUT_OF_STOCK' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              OUT OF STOCK
                            </span>
                          )}
                          {item.status === 'CRITICAL' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              CRITICAL (≤5)
                            </span>
                          )}
                          {item.status === 'LOW_STOCK' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                              LOW STOCK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-400">
                          Rs {item.replenishCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: CASHIERS & PAYMENT METHODS (Reports #8, #9, #17, #26, #27) */}
        {/* ======================================================== */}
        {activeTab === 'cashiers-payments' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Cashier Attribution Table (Report #8) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Cashier Attribution & Staff Performance (Report #8)</span>
                  </h3>
                  <p className="text-xs text-slate-400">All 6 current staff cashiers ranked by revenue generated and completed bills</p>
                </div>
                <span className="text-xs text-slate-400">Click any cashier row to view shift metrics</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Cashier / Staff Member</th>
                      <th className="px-4 py-3 text-right">Bills Completed</th>
                      <th className="px-4 py-3 text-right">Units Sold</th>
                      <th className="px-4 py-3 text-right">Gross Sales (LKR)</th>
                      <th className="px-4 py-3 text-right">Wholesale Cost (LKR)</th>
                      <th className="px-4 py-3 text-right">Gross Profit (LKR)</th>
                      <th className="px-4 py-3 text-right">Margin %</th>
                      <th className="px-4 py-3 text-right">Average Bill (AOV)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {cashiers.map((c) => (
                      <tr
                        key={c.cashierName}
                        onClick={() => setSelectedDrawerItem({ type: 'cashier', data: c })}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400">
                            {c.cashierName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="group-hover:text-emerald-400 transition-colors">{c.cashierName}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                          {c.billsCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                          {c.unitsSold.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200">
                          Rs {c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-400">
                          Rs {c.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          Rs {c.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.margin}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-blue-400">
                          Rs {c.averageBill.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tender Methods Matrix & Donut (Report #9 & #27) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payment Methods Table */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>Payment Methods & Settlement Audit (Report #9)</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">100% Reconciled</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Payment Method</th>
                        <th className="px-4 py-3 text-right">Transactions</th>
                        <th className="px-4 py-3 text-right">Settled Amount (LKR)</th>
                        <th className="px-4 py-3 text-right">Share of Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {payments.map((p) => (
                        <tr key={p.method} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                            <span>{p.method}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {p.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            Rs {p.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {p.sharePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Methods Donut Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-emerald-400" />
                    <span>Tender Distribution</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cash dominance vs card & credit ledger</p>
                </div>

                <div className="h-[200px] w-full my-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payments}
                        dataKey="totalAmount"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {payments.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                        formatter={(val: any) => [`Rs ${Number(val).toLocaleString()}`, 'Settled']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                  <span>Primary Tender: <strong className="text-white">Cash (94.0%)</strong></span>
                  <span className="text-emerald-400 font-semibold">Immediate Liquidity</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: PROCUREMENT & SUPPLIERS (Reports #3, #10, #16, #28) */}
        {/* ======================================================== */}
        {activeTab === 'procurement-suppliers' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Suppliers by Spend (Report #28) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>Top Invoiced Suppliers by Procurement Volume</span>
                  </h3>
                  <p className="text-xs text-slate-400">Cumulative purchase order and GRN expenditure</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                  94 Suppliers Registered
                </span>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={suppliers.slice(0, 7)} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `Rs ${(val / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any) => [`Rs ${Number(val).toLocaleString()}`, 'Total Invoiced Spend']}
                    />
                    <Bar dataKey="totalSpend" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Suppliers Summary Table (Report #10) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Registered Suppliers Directory & Spend Summary (Report #10)</h3>
                  <p className="text-xs text-slate-400">Click any supplier row to view delivery history & invoices (Report #16)</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                  94 Active Partners
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Supplier Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Contact Person</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3 text-right">GRN Deliveries</th>
                      <th className="px-4 py-3 text-right">Total Invoiced Spend (LKR)</th>
                      <th className="px-4 py-3 text-center">Last Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {suppliers.map((sup) => (
                      <tr
                        key={sup.id}
                        onClick={() => setSelectedDrawerItem({ type: 'supplier', data: sup })}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="group-hover:text-blue-400 transition-colors">{sup.name}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">{sup.code}</td>
                        <td className="px-4 py-3 text-slate-300">{sup.contactPerson}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{sup.phone}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-white">{sup.grnCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          Rs {sup.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-400">{sup.lastReceivedDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Goods Received Notes (GRN) Table (Report #3 Detailed Receivings) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>Detailed Goods Received Notes (Report #3 Receivings)</span>
                  </h3>
                  <p className="text-xs text-slate-400">All 739 historical and live purchase receipts with line-item costs</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search GRN # (e.g. GRN-1)..."
                    value={grnSearch}
                    onChange={(e) => {
                      setGrnSearch(e.target.value);
                      setGrnPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">GRN Number</th>
                      <th className="px-4 py-3">Received Date</th>
                      <th className="px-4 py-3">Supplier Name</th>
                      <th className="px-4 py-3">Receiving Warehouse</th>
                      <th className="px-4 py-3 text-right">Items Count</th>
                      <th className="px-4 py-3 text-right">Invoice Cost (LKR)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {receivings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          Loading GRN receivings...
                        </td>
                      </tr>
                    ) : (
                      receivings.map((grn) => (
                        <tr
                          key={grn.id}
                          onClick={() => setSelectedDrawerItem({ type: 'grn', data: grn })}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="px-4 py-2.5 font-medium text-white font-mono flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="group-hover:text-blue-400 transition-colors">{grn.grnNumber}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                            {new Date(grn.receivedDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-white font-medium">{grn.supplierName}</td>
                          <td className="px-4 py-2.5 text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                              {grn.warehouseName}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-300">{grn.itemsCount}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                            Rs {grn.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {grn.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDrawerItem({ type: 'grn', data: grn });
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-blue-400" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* GRN Pagination */}
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Showing {Math.min((grnPage - 1) * 20 + 1, grnTotalCount)} to {Math.min(grnPage * 20, grnTotalCount)} of {grnTotalCount} GRNs
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGrnPage((p) => Math.max(1, p - 1))}
                    disabled={grnPage <= 1}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-medium"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-mono text-white">
                    {grnPage} / {grnTotalPages}
                  </span>
                  <button
                    onClick={() => setGrnPage((p) => Math.min(grnTotalPages, p + 1))}
                    disabled={grnPage >= grnTotalPages}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: CUSTOMER ACCOUNTS & AUDIT (Reports #11, #14, #15, #18) */}
        {/* ======================================================== */}
        {activeTab === 'customers-audit' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Customer Accounts Summary (Report #11) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Registered Customer Accounts & Spend Ledger (Report #11)</span>
                  </h3>
                  <p className="text-xs text-slate-400">Wholesale, recurring prescription, and credit customer accounts</p>
                </div>
                <span className="text-xs text-slate-400">Click any customer row to open profile (Report #15)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Customer Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3 text-right">Invoices / Visits</th>
                      <th className="px-4 py-3 text-right">Lifetime Spend (LKR)</th>
                      <th className="px-4 py-3 text-right">Outstanding Balance (LKR)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr
                      onClick={() =>
                        setSelectedDrawerItem({
                          type: 'customer',
                          data: {
                            name: 'General Walk-in Dispensary Retail',
                            phone: 'Retail Walk-in',
                            billsCount: 15580,
                            lifetimeSpend: 33490000.0,
                            creditBalance: 0.0,
                            lastVisit: '2026-11-14',
                          },
                        })
                      }
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span className="group-hover:text-emerald-400 transition-colors">
                          General Walk-in Dispensary Retail (&gt;99.8% POS Volume)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">Direct OTC</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white">15,580</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        Rs 33,490,000.00
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">Rs 0.00</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active Retail
                        </span>
                      </td>
                    </tr>
                    <tr
                      onClick={() =>
                        setSelectedDrawerItem({
                          type: 'customer',
                          data: {
                            name: 'Deegayu Health Foundation Clinic',
                            phone: '0372281920',
                            billsCount: 14,
                            lifetimeSpend: 38450.0,
                            creditBalance: 0.0,
                            lastVisit: '2026-11-10',
                          },
                        })
                      }
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="group-hover:text-blue-400 transition-colors">
                          Deegayu Health Foundation Clinic
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">0372281920</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white">14</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        Rs 38,450.00
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">Rs 0.00</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Wholesale Institutional
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses Summary (Report #14) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Operating Expenses Summary (Report #14)</span>
                  </h3>
                  <p className="text-xs text-slate-400">Operational outflows including branch utilities, herb logistics, and store maintenance</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                  Fiscal FY 2026
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-medium">Logistics & Herb Transport</span>
                  <div className="text-lg font-bold text-white mt-1">Rs 45,200.00</div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Inter-branch stock shuttles</span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-medium">Branch Utilities & Dispensary Upkeep</span>
                  <div className="text-lg font-bold text-white mt-1">Rs 62,800.00</div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Electricity, water, cooling</span>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-medium">Packaging & Dispensary Bottles</span>
                  <div className="text-lg font-bold text-white mt-1">Rs 28,400.00</div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Ayurvedic glass & bag supplies</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* 4. UNIVERSAL SLIDE-OVER DRAWER MODAL (Reports #15, #16, #17, #18) */}
      {/* ======================================================== */}
      {selectedDrawerItem && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div
            className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col overflow-y-auto animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  {selectedDrawerItem.type === 'sale' && <Receipt className="w-5 h-5" />}
                  {selectedDrawerItem.type === 'cashier' && <UserCheck className="w-5 h-5" />}
                  {selectedDrawerItem.type === 'supplier' && <Truck className="w-5 h-5" />}
                  {selectedDrawerItem.type === 'customer' && <Users className="w-5 h-5" />}
                  {selectedDrawerItem.type === 'grn' && <Receipt className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedDrawerItem.type === 'sale' && `Invoice Audit: ${selectedDrawerItem.data.invoiceNumber}`}
                    {selectedDrawerItem.type === 'cashier' && `Staff Profile: ${selectedDrawerItem.data.cashierName}`}
                    {selectedDrawerItem.type === 'supplier' && `Supplier Dossier: ${selectedDrawerItem.data.name}`}
                    {selectedDrawerItem.type === 'customer' && `Customer Profile: ${selectedDrawerItem.data.name}`}
                    {selectedDrawerItem.type === 'grn' && `GRN Receiving: ${selectedDrawerItem.data.grnNumber}`}
                  </h3>
                  <p className="text-xs text-slate-400">Detailed itemization & historical audit trail</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDrawerItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="p-5 space-y-5 flex-1">
              {/* === SALE DETAIL VIEW === */}
              {selectedDrawerItem.type === 'sale' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Invoice Number</span>
                      <div className="font-mono font-bold text-white mt-0.5">{selectedDrawerItem.data.invoiceNumber}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Branch</span>
                      <div className="font-semibold text-slate-200 mt-0.5">{selectedDrawerItem.data.branchName}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Cashier</span>
                      <div className="font-semibold text-slate-200 mt-0.5">{selectedDrawerItem.data.cashierName}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Tender Method</span>
                      <div className="font-semibold text-emerald-400 mt-0.5">{selectedDrawerItem.data.paymentMethod}</div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 border-b border-slate-800 font-semibold text-xs text-white">
                      Itemized Breakdown ({selectedDrawerItem.data.items?.length || 0} Products)
                    </div>
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Product Name</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Wholesale Cost</th>
                          <th className="px-3 py-2 text-right">Retail Unit</th>
                          <th className="px-3 py-2 text-right">Total (LKR)</th>
                          <th className="px-3 py-2 text-right">Profit (LKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {selectedDrawerItem.data.items?.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-800/20">
                            <td className="px-3 py-2 font-medium text-white">{item.productName}</td>
                            <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">Rs {item.costPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">Rs {item.unitPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-white">
                              Rs {item.subtotal.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                              Rs {item.profit.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Summary */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-mono">Rs {selectedDrawerItem.data.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Wholesale Product Cost</span>
                      <span className="font-mono text-amber-400">Rs {selectedDrawerItem.data.costAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Exempt Tax (0.00%)</span>
                      <span className="font-mono">Rs 0.00</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                      <span>Total Billed Amount</span>
                      <span className="font-mono text-emerald-400">Rs {selectedDrawerItem.data.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-indigo-400 pt-1">
                      <span>Gross Profit Margin</span>
                      <span>Rs {selectedDrawerItem.data.profitAmount.toFixed(2)} ({selectedDrawerItem.data.margin}%)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* === CASHIER DETAIL VIEW (Report #17) === */}
              {selectedDrawerItem.type === 'cashier' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Lifetime Revenue</span>
                      <div className="text-lg font-bold text-emerald-400 mt-1">
                        Rs {selectedDrawerItem.data.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Gross Operating Profit</span>
                      <div className="text-lg font-bold text-indigo-400 mt-1">
                        Rs {selectedDrawerItem.data.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Completed Transactions</span>
                      <div className="text-lg font-bold text-white mt-1">
                        {selectedDrawerItem.data.billsCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Average Order Value (AOV)</span>
                      <div className="text-lg font-bold text-blue-400 mt-1">
                        Rs {selectedDrawerItem.data.averageBill.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === SUPPLIER DETAIL VIEW (Report #16) === */}
              {selectedDrawerItem.type === 'supplier' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Supplier Code</span>
                      <div className="text-sm font-bold text-white mt-1 font-mono">{selectedDrawerItem.data.code}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Direct Phone</span>
                      <div className="text-sm font-bold text-slate-200 mt-1 font-mono">{selectedDrawerItem.data.phone}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Total GRN Deliveries</span>
                      <div className="text-lg font-bold text-white mt-1">{selectedDrawerItem.data.grnCount}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Cumulative Procurement Spend</span>
                      <div className="text-lg font-bold text-emerald-400 mt-1">
                        Rs {selectedDrawerItem.data.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === GRN DETAIL VIEW (Report #3) === */}
              {selectedDrawerItem.type === 'grn' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">GRN Number</span>
                      <div className="font-mono font-bold text-white mt-0.5">{selectedDrawerItem.data.grnNumber}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Supplier</span>
                      <div className="font-semibold text-slate-200 mt-0.5">{selectedDrawerItem.data.supplierName}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Warehouse</span>
                      <div className="font-semibold text-slate-200 mt-0.5">{selectedDrawerItem.data.warehouseName}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-500">Status</span>
                      <div className="font-semibold text-emerald-400 mt-0.5">{selectedDrawerItem.data.status}</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 border-b border-slate-800 font-semibold text-xs text-white">
                      Received Items List ({selectedDrawerItem.data.items?.length || 0})
                    </div>
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-[#0F172A] text-white uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Product Name</th>
                          <th className="px-3 py-2 text-right">Received Qty</th>
                          <th className="px-3 py-2 text-right">Unit Wholesale Cost</th>
                          <th className="px-3 py-2 text-right">Subtotal Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {selectedDrawerItem.data.items?.map((item: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-white">{item.productName}</td>
                            <td className="px-3 py-2 text-right font-mono">{item.quantityReceived}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">Rs {item.unitCost.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                              Rs {item.subtotal.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-sm">
                    <span className="text-slate-300 font-medium">Total Invoiced GRN Cost</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      Rs {selectedDrawerItem.data.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between sticky bottom-0 bg-slate-900/95 backdrop-blur-md">
              <span className="text-[11px] text-slate-500 font-mono">Deegayu Core Enterprise Audit</span>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Print Dossier</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
