'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Store,
  DollarSign,
  ShoppingCart,
  RotateCcw,
  TrendingUp,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Clock,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileSpreadsheet,
  Building2,
  User,
  Award,
} from 'lucide-react';
import type { SaleDto, SalePaymentMethod, SaleStatus } from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi, type SalesSummaryKPI } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'all' | 'custom';
type SortField = 'created_at' | 'total_amount' | 'invoice_number' | 'cashier_name';

interface CashierOption {
  id: string;
  fullName: string;
  role: string;
}

const BRANCH_MAP: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': 'Alawwa',
  'fa68e4a0-a515-44c8-a082-5b5590366658': 'Dambadeniya',
  '197693d6-4247-48df-b614-6fcde9e34f7d': 'Giriulla',
  '133eeaec-5726-4702-a819-8423750db203': 'Main Store',
  '85d48a94-b6a3-4b9f-a746-0ac2ff61355c': 'Main Branch',
};

// Asia/Colombo (+05:30) today's date in YYYY-MM-DD
function getColomboTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function SalesOrdersPage() {
  const { currency, selectedBranchId, branches, isOwnerOrAdmin } = useTenantBranch();

  // Primary Data State
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const fetchIdRef = useRef(0);

  // Filters State
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(getColomboTodayDateString());
  const [customEndDate, setCustomEndDate] = useState(getColomboTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedCashier, setSelectedCashier] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');

  // Sorting State
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Cashiers List from API
  const [cashiers, setCashiers] = useState<CashierOption[]>([]);

  // Accurate Backend Aggregated KPI Summary across ALL matching rows
  const [kpiSummary, setKpiSummary] = useState<SalesSummaryKPI>({
    totalGross: 0,
    completedCount: 0,
    voidedCount: 0,
    totalVoidedAmount: 0,
    avgTicket: 0,
    totalBills: 0,
  });

  // UI Interactive Helpers
  const [copiedInvoice, setCopiedInvoice] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Active Receipt Modal (Hardware reprints)
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState<string | null>(null);

  // Void Bill Modal State
  const [voidModalSale, setVoidModalSale] = useState<SaleDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Cashier & Sales Performance Audit Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSales, setReportSales] = useState<SaleDto[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync initial branch from context: only lock for staff, keep Owner on ALL
  useEffect(() => {
    if (!isOwnerOrAdmin && selectedBranchId && selectedBranchId !== 'ALL') {
      setSelectedBranch(selectedBranchId);
    }
  }, [isOwnerOrAdmin, selectedBranchId]);

  // Load Cashiers List
  useEffect(() => {
    posApi.getCashiers().then((list) => {
      if (list && list.length > 0) {
        setCashiers(list);
      }
    });
  }, []);

  // Fetch Sales Data reactively based on active filters with Request Sequence Guard
  const fetchSales = useCallback(
    async (isManualRefresh = false) => {
      const fetchId = ++fetchIdRef.current;
      try {
        if (isManualRefresh) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await posApi.getSales({
          page: currentPage,
          limit: 50,
          period,
          startDate: period === 'custom' ? customStartDate : undefined,
          endDate: period === 'custom' ? customEndDate : undefined,
          search: searchQuery.trim() || undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          paymentMethod: selectedMethod !== 'ALL' ? selectedMethod : undefined,
          branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
          cashierName: selectedCashier !== 'ALL' ? selectedCashier : undefined,
          sortBy,
          sortOrder,
        });

        // Guard against stale response overwrites
        if (fetchId !== fetchIdRef.current) return;

        if (res.data) {
          setSales(res.data.items || []);
          setTotalCount(res.data.total || 0);
          setTotalPages(res.data.totalPages || 1);
          if (res.data.summary) {
            setKpiSummary(res.data.summary);
          }
        }
      } catch (err) {
        if (fetchId === fetchIdRef.current) {
          console.error('Failed to load sales register:', err);
        }
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      currentPage,
      period,
      customStartDate,
      customEndDate,
      searchQuery,
      selectedStatus,
      selectedMethod,
      selectedBranch,
      selectedCashier,
      sortBy,
      sortOrder,
    ],
  );

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Instant 0ms Filter Handlers
  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    if (period === newPeriod) return;
    setLoading(true);
    setPeriod(newPeriod);
    setCurrentPage(1);
  };

  const handleBranchChange = (newBranch: string) => {
    setLoading(true);
    setSelectedBranch(newBranch);
    setCurrentPage(1);
  };

  const handleCashierChange = (newCashier: string) => {
    setLoading(true);
    setSelectedCashier(newCashier);
    setCurrentPage(1);
  };

  const handleStatusChange = (newStatus: string) => {
    setLoading(true);
    setSelectedStatus(newStatus);
    setCurrentPage(1);
  };

  const handleMethodChange = (newMethod: string) => {
    setLoading(true);
    setSelectedMethod(newMethod);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setLoading(true);
    setCurrentPage(newPage);
  };

  // Handle Void Bill Submission
  const handleConfirmVoid = async () => {
    if (!voidModalSale) return;
    if (!voidReason.trim()) {
      setVoidError('Please provide a specific reason for voiding this transaction.');
      return;
    }

    try {
      setVoiding(true);
      setVoidError(null);
      await posApi.voidSale(voidModalSale.id, voidReason.trim());

      setFeedbackMessage({
        type: 'success',
        text: `Bill ${voidModalSale.invoiceNumber} has been successfully VOIDED. Inventory restored to stock.`,
      });

      setVoidModalSale(null);
      setVoidReason('');
      fetchSales(true);
    } catch (err: unknown) {
      console.error('Void failed:', err);
      setVoidError(err instanceof Error ? err.message : 'Failed to void bill. Please try again.');
    } finally {
      setVoiding(false);
    }
  };

  // Copy Invoice Number
  const copyToClipboard = (inv: string) => {
    navigator.clipboard?.writeText(inv);
    setCopiedInvoice(inv);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  // Toggle Column Header Sorting
  const handleHeaderSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'cashier_name' || field === 'invoice_number' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  // Full CSV Export across ALL matching rows
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      const allMatching = await posApi.getAllSales({
        period,
        startDate: period === 'custom' ? customStartDate : undefined,
        endDate: period === 'custom' ? customEndDate : undefined,
        search: searchQuery.trim() || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        paymentMethod: selectedMethod !== 'ALL' ? selectedMethod : undefined,
        branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
        cashierName: selectedCashier !== 'ALL' ? selectedCashier : undefined,
        sortBy,
        sortOrder,
      });

      if (!allMatching || allMatching.length === 0) {
        alert('No sales records found for the active filter selection.');
        return;
      }

      const headers = [
        'Invoice #',
        'Date Time (Asia/Colombo)',
        'Branch',
        'Cashier',
        'Customer',
        'Payment Method',
        'Status',
        'Subtotal (LKR)',
        'Discount (LKR)',
        'Tax (LKR)',
        'Grand Total (LKR)',
      ];

      const rows = allMatching.map((s) => {
        const bName = BRANCH_MAP[s.branchId] || branches.find((b) => b.id === s.branchId)?.name || 'Main Store';
        const cName = s.cashier?.fullName || s.cashierName || 'Staff';
        const custName = s.customerName || 'Walk-in Customer';
        const dt = new Date(s.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });
        const pm = s.payments?.[0]?.paymentMethod || 'CASH';

        return [
          `"${s.invoiceNumber}"`,
          `"${dt}"`,
          `"${bName.replace(/"/g, '""')}"`,
          `"${cName.replace(/"/g, '""')}"`,
          `"${custName.replace(/"/g, '""')}"`,
          `"${pm}"`,
          `"${s.status}"`,
          Number(s.subtotal || 0).toFixed(2),
          Number(s.discountAmount || 0).toFixed(2),
          Number(s.taxAmount || 0).toFixed(2),
          Number(s.totalAmount || 0).toFixed(2),
        ].join(',');
      });

      // UTF-8 BOM for Microsoft Excel compatibility
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cashierSlug = selectedCashier !== 'ALL' ? `_${selectedCashier.replace(/\s+/g, '_')}` : '';
      link.download = `deegayu-sales-report-${period}${cashierSlug}-${getColomboTodayDateString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export failed:', err);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Open Cashier Performance & Sales Audit Report Modal
  const handleOpenReportModal = async () => {
    setIsReportModalOpen(true);
    setReportLoading(true);
    try {
      const allMatching = await posApi.getAllSales({
        period,
        startDate: period === 'custom' ? customStartDate : undefined,
        endDate: period === 'custom' ? customEndDate : undefined,
        search: searchQuery.trim() || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        paymentMethod: selectedMethod !== 'ALL' ? selectedMethod : undefined,
        branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
        cashierName: selectedCashier !== 'ALL' ? selectedCashier : undefined,
        sortBy,
        sortOrder,
      });
      setReportSales(allMatching);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // Format Currency (LKR)
  const formatCurrency = (val: number) => {
    return `${currency} ${Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Badge Renders
  const getMethodBadge = (method?: SalePaymentMethod | string) => {
    switch (method) {
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Banknote className="w-3 h-3" /> Cash
          </span>
        );
      case 'CARD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard className="w-3 h-3" /> Card
          </span>
        );
      case 'QR_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <QrCode className="w-3 h-3" /> LankaQR
          </span>
        );
      case 'CUSTOMER_CREDIT':
      case 'STORE_CREDIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <UserCheck className="w-3 h-3" /> Khata Credit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {method || 'CASH'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: SaleStatus | string) => {
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    }
    if (status === 'VOIDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" /> Voided
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        {status}
      </span>
    );
  };

  // Group Cashiers: Active Staff vs Legacy / Historical
  const activeStaff = useMemo(
    () => cashiers.filter((c) => c.role === 'OWNER' || c.role === 'STAFF'),
    [cashiers],
  );
  const legacyCashiers = useMemo(
    () => cashiers.filter((c) => c.role !== 'OWNER' && c.role !== 'STAFF'),
    [cashiers],
  );

  // Computed Report Aggregates for Audit Modal
  const reportCompleted = useMemo(
    () => reportSales.filter((s) => s.status === 'COMPLETED'),
    [reportSales],
  );
  const reportVoided = useMemo(
    () => reportSales.filter((s) => s.status === 'VOIDED'),
    [reportSales],
  );
  const reportGross = useMemo(
    () => reportCompleted.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0),
    [reportCompleted],
  );
  const reportVoidedAmt = useMemo(
    () => reportVoided.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0),
    [reportVoided],
  );
  const reportCashTotal = useMemo(() => {
    return reportCompleted.reduce((sum, s) => {
      const pCash = s.payments?.filter((p) => p.paymentMethod === 'CASH').reduce((ps, p) => ps + Number(p.amount || 0), 0);
      return sum + (pCash !== undefined && pCash > 0 ? pCash : (!s.payments || s.payments.length === 0 ? Number(s.totalAmount || 0) : 0));
    }, 0);
  }, [reportCompleted]);

  const reportCardTotal = useMemo(() => {
    return reportCompleted.reduce((sum, s) => {
      return sum + (s.payments?.filter((p) => p.paymentMethod === 'CARD').reduce((ps, p) => ps + Number(p.amount || 0), 0) || 0);
    }, 0);
  }, [reportCompleted]);

  const reportQrTotal = useMemo(() => {
    return reportCompleted.reduce((sum, s) => {
      return sum + (s.payments?.filter((p) => p.paymentMethod === 'QR_PAYMENT').reduce((ps, p) => ps + Number(p.amount || 0), 0) || 0);
    }, 0);
  }, [reportCompleted]);

  const reportCreditTotal = useMemo(() => {
    return reportCompleted.reduce((sum, s) => {
      return sum + (s.payments?.filter((p) => p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT').reduce((ps, p) => ps + Number(p.amount || 0), 0) || 0);
    }, 0);
  }, [reportCompleted]);

  const cashierAuditBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        cashierName: string;
        branchName: string;
        branchId: string;
        count: number;
        gross: number;
        cash: number;
        card: number;
        voidCount: number;
      }
    >();
    for (const s of reportSales) {
      const cName = s.cashier?.fullName || s.cashierName || 'Staff';
      const bId = s.branchId || '';
      const bName =
        s.branchName ||
        (bId ? BRANCH_MAP[bId] || branches.find((b) => b.id === bId)?.name || 'Main Store' : 'Main Store');
      const key = `${cName}__${bId}`;
      const entry = map.get(key) || {
        cashierName: cName,
        branchName: bName,
        branchId: bId,
        count: 0,
        gross: 0,
        cash: 0,
        card: 0,
        voidCount: 0,
      };
      if (s.status === 'COMPLETED') {
        entry.count++;
        entry.gross += Number(s.totalAmount || 0);
        entry.cash +=
          s.payments
            ?.filter((p) => p.paymentMethod === 'CASH')
            .reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;
        entry.card +=
          s.payments
            ?.filter((p) => p.paymentMethod === 'CARD')
            .reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;
      } else if (s.status === 'VOIDED') {
        entry.voidCount++;
      }
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [reportSales, branches]);

  // Active Branch Label Helper
  const getBranchLabel = (id?: string) => {
    if (!id) return 'Main Store';
    return BRANCH_MAP[id] || branches.find((b) => b.id === id)?.name || id.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      {/* Global Print Styles for Report Modal */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #cashier-audit-report-printable,
          #cashier-audit-report-printable * {
            visibility: visible !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #cashier-audit-report-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Feedback Alert Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales & Bills Register</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
              Live Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-branch transaction register, cashier audit reports, 80mm/58mm reprints, and stock-restoring void management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Printable Cashier Report Button */}
          <button
            onClick={handleOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all"
            title="Generate executive printable cashier & sales audit report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Generate Report (Print / PDF)</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={isExportingCsv || sales.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
            title="Export all matching records across database to Excel CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isExportingCsv ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchSales(true)}
            disabled={loading || isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Open POS Terminal */}
          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-pos-btn transition-all group"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold text-white/90">
              F1
            </kbd>
          </Link>
        </div>
      </div>

      {/* Period Quick Switcher Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
          <button
            onClick={() => handlePeriodChange('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'today'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            Today&apos;s Bills
          </button>
          <button
            onClick={() => handlePeriodChange('yesterday')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'yesterday'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => handlePeriodChange('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'week'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => handlePeriodChange('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'month'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handlePeriodChange('last_month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'last_month'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => handlePeriodChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            All Bills
          </button>
          <button
            onClick={() => handlePeriodChange('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              period === 'custom'
                ? 'bg-[#005BD3] text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Custom Range</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Colombo Timezone (UTC+05:30)</span>
        </div>
      </div>

      {/* Interactive Custom Date Range Bar */}
      {period === 'custom' && (
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/70 flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <Calendar className="w-4 h-4 text-blue-700" />
            <span>Select Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">From:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3]"
            />
          </div>

          <button
            onClick={() => fetchSales(true)}
            className="px-3 py-1.5 rounded-lg bg-[#005BD3] text-white text-xs font-bold shadow-2xs hover:bg-[#004bb5] transition-colors"
          >
            Apply Range
          </button>

          <span className="text-[11px] text-slate-500 italic">
            Querying all transactions between {customStartDate} 00:00:00 and {customEndDate} 23:59:59
          </span>
        </div>
      )}

      {/* KPI Cards Row — Accurate Aggregates across ALL matching database records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Sales</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-36 bg-slate-200 animate-pulse rounded-lg my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(kpiSummary.totalGross)}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              Settled payments across {kpiSummary.completedCount.toLocaleString()} bill(s)
            </div>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Bills</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-20 bg-slate-200 animate-pulse rounded-lg my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {kpiSummary.completedCount.toLocaleString()}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">Fulfilled retail transactions</div>
          </div>
        </div>

        {/* Average Ticket */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Ticket</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-28 bg-slate-200 animate-pulse rounded-lg my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(kpiSummary.avgTicket)}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">Per customer checkout</div>
          </div>
        </div>

        {/* Voided Orders */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Voided Bills</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded-lg my-0.5" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {kpiSummary.voidedCount.toLocaleString()}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              {formatCurrency(kpiSummary.totalVoidedAmount)} reversed
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Shimmer loading progress bar */}
        <div className="h-1 w-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-300 ${
              loading ? 'w-full animate-pulse' : 'w-0'
            }`}
          />
        </div>

        {/* Table Filters & Search Bar */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 bg-slate-50/50">
          {/* Keyword Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setLoading(true);
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by invoice #, customer, or cashier..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setLoading(true);
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Branch Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Branch:</span>
              <select
                value={selectedBranch}
                disabled={!isOwnerOrAdmin}
                onChange={(e) => handleBranchChange(e.target.value)}
                className={`bg-white border text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3] ${
                  !isOwnerOrAdmin ? 'opacity-70 bg-slate-100 cursor-not-allowed' : 'border-slate-200'
                }`}
              >
                {isOwnerOrAdmin && <option value="ALL">All Branches</option>}
                <option value="00f4cdcb-7d1c-4026-b57a-6e66c33b0c54">Alawwa</option>
                <option value="fa68e4a0-a515-44c8-a082-5b5590366658">Dambadeniya</option>
                <option value="197693d6-4247-48df-b614-6fcde9e34f7d">Giriulla</option>
                <option value="133eeaec-5726-4702-a819-8423750db203">Main Store</option>
              </select>
              {!isOwnerOrAdmin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  Locked (Staff)
                </span>
              )}
            </div>

            {/* Cashier Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Cashier:</span>
              <div className="relative flex items-center">
                <select
                  value={selectedCashier}
                  onChange={(e) => handleCashierChange(e.target.value)}
                  className={`bg-white border text-xs rounded-lg pl-2.5 pr-7 py-1.5 font-medium focus:outline-none focus:border-[#005BD3] ${
                    selectedCashier !== 'ALL'
                      ? 'border-blue-400 text-blue-700 bg-blue-50/50 font-bold'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="ALL">All Cashiers</option>

                  {/* Active Staff */}
                  {activeStaff.length > 0 && (
                    <optgroup label="Active Staff">
                      {activeStaff.map((c) => (
                        <option key={c.id} value={c.fullName}>
                          {c.fullName} {c.role === 'OWNER' ? '★ (Owner)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Legacy Cashiers */}
                  {legacyCashiers.length > 0 && (
                    <optgroup label="Historical Cashiers">
                      {legacyCashiers.map((c) => (
                        <option key={c.id} value={c.fullName}>
                          {c.fullName}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {selectedCashier !== 'ALL' && (
                  <button
                    onClick={() => handleCashierChange('ALL')}
                    title="Clear Cashier Filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Method:</span>
              <select
                value={selectedMethod}
                onChange={(e) => handleMethodChange(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="QR_PAYMENT">LankaQR</option>
                <option value="CUSTOMER_CREDIT">Khata Credit</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort:</span>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('-') as [SortField, 'asc' | 'desc'];
                  setLoading(true);
                  setSortBy(f);
                  setSortOrder(o);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="total_amount-desc">Highest Amount</option>
                <option value="total_amount-asc">Lowest Amount</option>
                <option value="cashier_name-asc">Cashier A-Z</option>
                <option value="invoice_number-desc">Invoice #</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                {/* Invoice / Time Header with Sort */}
                <th
                  onClick={() => handleHeaderSort('created_at')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Invoice / Time</span>
                    {sortBy === 'created_at' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-[#005BD3]" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-[#005BD3]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Customer</th>

                {/* Cashier Header with Sort */}
                <th
                  onClick={() => handleHeaderSort('cashier_name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cashier</span>
                    {sortBy === 'cashier_name' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-[#005BD3]" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-[#005BD3]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>

                {/* Grand Total Header with Sort */}
                <th
                  onClick={() => handleHeaderSort('total_amount')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Grand Total</span>
                    {sortBy === 'total_amount' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-[#005BD3]" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-[#005BD3]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-slate-200 rounded mb-1.5" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-12 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-16 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="h-6 w-14 bg-slate-200 rounded mx-auto" />
                    </td>
                  </tr>
                ))
              ) : sales.length > 0 ? (
                sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className={`hover:bg-slate-50/70 transition-colors group ${
                      sale.status === 'VOIDED' ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* Invoice & Time */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                          {sale.invoiceNumber}
                        </span>
                        <button
                          onClick={() => copyToClipboard(sale.invoiceNumber)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5"
                          title="Copy Invoice #"
                        >
                          {copiedInvoice === sale.invoiceNumber ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {isMounted
                          ? new Date(sale.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }) +
                            ' ' +
                            new Date(sale.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {getBranchLabel(sale.branchId)}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <div>{sale.customerName || 'Walk-in Customer'}</div>
                    </td>

                    {/* Cashier with 1-Click Quick Filter & Branch Badge */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex flex-col gap-1 items-start">
                        <button
                          type="button"
                          onClick={() => {
                            const cName = sale.cashier?.fullName || sale.cashierName || 'Staff';
                            handleCashierChange(cName);
                          }}
                          title={`Click to filter only bills by ${sale.cashier?.fullName || sale.cashierName || 'Staff'}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#005BD3] border border-transparent hover:border-blue-200 text-[11px] font-semibold transition-all group/cashier"
                        >
                          <User className="w-3 h-3 text-slate-400 group-hover/cashier:text-[#005BD3]" />
                          <span>{sale.cashier?.fullName || sale.cashierName || 'Staff'}</span>
                        </button>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded">
                          {getBranchLabel(sale.branchId)}
                        </span>
                      </div>
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-bold text-slate-900">
                        {sale.items && sale.items.length > 0
                          ? sale.items.reduce((cnt, it) => cnt + Number(it.quantity || 1), 0)
                          : '—'}
                      </span>{' '}
                      item(s)
                    </td>

                    {/* Payment Method */}
                    <td className="py-3.5 px-4">
                      {getMethodBadge(sale.payments?.[0]?.paymentMethod)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(sale.status)}
                    </td>

                    {/* Grand Total */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      <span className={sale.status === 'VOIDED' ? 'line-through text-slate-400' : ''}>
                        {formatCurrency(Number(sale.totalAmount))}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View & Print Hardware Receipt */}
                        <button
                          onClick={() => setActiveReceiptSaleId(sale.id)}
                          title="View & Reprint 80mm/58mm Slip"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#005BD3] hover:border-[#005BD3]/50 hover:bg-blue-50/60 transition-all shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Void Bill Action */}
                        {sale.status === 'COMPLETED' ? (
                          <button
                            onClick={() => {
                              setVoidModalSale(sale);
                              setVoidReason('');
                              setVoidError(null);
                            }}
                            title="Void Bill & Restore Inventory"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/60 transition-all shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Bill has already been voided"
                            className="p-1.5 rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600 text-sm">No sales records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No transactions matched the active filters for {period === 'today' ? "today's register" : 'selected period'}.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Accurate Multi-Page Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/30">
          <div>
            Showing <span className="font-semibold text-slate-700">{sales.length}</span> bills on this page •{' '}
            <span className="font-semibold text-slate-700">{totalCount.toLocaleString()}</span> total matching transactions across database
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="font-mono text-[11px] text-slate-400">
            Encrypted Audit Logs • Colombo +05:30
          </div>
        </div>
      </div>

      {/* Hardware-Ready Thermal Receipt Modal */}
      {activeReceiptSaleId && (
        <ReceiptModal
          saleId={activeReceiptSaleId}
          isOpen={!!activeReceiptSaleId}
          onClose={() => setActiveReceiptSaleId(null)}
          currency={currency}
        />
      )}

      {/* Stock-Restoring Void Bill Confirmation Dialog */}
      {voidModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-600 font-bold text-base">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Void Sale Transaction</span>
              </div>
              <button
                onClick={() => setVoidModalSale(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold">Inventory & Ledger Reversal Warning:</div>
              <div>
                Voiding invoice <span className="font-mono font-bold">{voidModalSale.invoiceNumber}</span> will
                immediately restore all sold items back to branch stock levels and record an audit log entry.
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono font-bold text-slate-900">{voidModalSale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branch:</span>
                <span className="font-medium text-slate-800">{getBranchLabel(voidModalSale.branchId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cashier:</span>
                <span className="font-medium text-slate-800">{voidModalSale.cashier?.fullName || voidModalSale.cashierName || 'Staff'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-medium text-slate-800">{voidModalSale.customerName || 'Walk-in Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Refund:</span>
                <span className="font-mono font-bold text-rose-600">{formatCurrency(Number(voidModalSale.totalAmount))}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Voiding <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer returned items, cashier punched wrong SKU, duplicate transaction..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {voidError && (
              <div className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {voidError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVoidModalSale(null)}
                disabled={voiding}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voiding || !voidReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {voiding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Voiding...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Void & Restore Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Printable Cashier & Sales Audit Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Non-Print Action Header */}
            <div className="no-print p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#005BD3]" />
                <h2 className="text-sm font-bold text-slate-900">
                  Cashier & Sales Performance Audit Report
                </h2>
                <span className="text-[11px] font-medium text-slate-500">
                  ({reportSales.length} records matching current filter)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={reportLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#005BD3] hover:bg-[#004bb5] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Report Canvas */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6" id="cashier-audit-report-printable">
              {reportLoading ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 text-blue-600 animate-spin" />
                  <p className="font-semibold text-slate-700 text-sm">Generating comprehensive audit report...</p>
                  <p className="text-xs text-slate-400 mt-1">Aggregating tender records across branch database</p>
                </div>
              ) : (
                <>
                  {/* Executive Letterhead Header */}
                  <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Award className="w-6 h-6 text-[#005BD3]" />
                        <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                          Deegayu Weda Madura
                        </h1>
                      </div>
                      <p className="text-xs text-slate-700 font-bold mt-0.5">
                        Ayurvedic Healthcare & Pharmaceutical Services
                      </p>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        Executive Sales & Cashier Settlement Ledger • Official Financial Audit
                      </p>
                    </div>

                    <div className="text-left sm:text-right text-xs space-y-1">
                      <div className="inline-block px-2.5 py-1 rounded-md bg-slate-100 font-mono font-bold text-slate-800 text-[11px]">
                        AUDIT-REP-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Generated: {new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} (SLST)
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Branch: <span className="font-bold text-slate-800">{selectedBranch !== 'ALL' ? getBranchLabel(selectedBranch) : 'All Branches (Consolidated)'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter Metadata Context Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Report Period</span>
                      <span className="font-bold text-slate-900 capitalize">
                        {period === 'custom' ? `${customStartDate} to ${customEndDate}` : period.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cashier Scope</span>
                      <span className="font-bold text-slate-900">
                        {selectedCashier !== 'ALL' ? selectedCashier : 'All Cashiers'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Method</span>
                      <span className="font-bold text-slate-900">{selectedMethod}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Scope</span>
                      <span className="font-bold text-slate-900">{selectedStatus}</span>
                    </div>
                  </div>

                  {/* Executive Tender Summary Cards */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Executive Settlement Summary
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 block">Total Gross</span>
                        <span className="text-base font-extrabold text-emerald-950 block mt-0.5">
                          {formatCurrency(reportGross)}
                        </span>
                        <span className="text-[10px] text-emerald-700 mt-0.5 block">
                          {reportCompleted.length} Completed
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                        <span className="text-[10px] font-bold uppercase text-blue-800 block">Physical Cash</span>
                        <span className="text-base font-extrabold text-blue-950 block mt-0.5">
                          {formatCurrency(reportCashTotal)}
                        </span>
                        <span className="text-[10px] text-blue-700 mt-0.5 block">Drawer Cash</span>
                      </div>

                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                        <span className="text-[10px] font-bold uppercase text-indigo-800 block">Card & QR</span>
                        <span className="text-base font-extrabold text-indigo-950 block mt-0.5">
                          {formatCurrency(reportCardTotal + reportQrTotal)}
                        </span>
                        <span className="text-[10px] text-indigo-700 mt-0.5 block">Bank Settlement</span>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-[10px] font-bold uppercase text-amber-800 block">Khata Credit</span>
                        <span className="text-base font-extrabold text-amber-950 block mt-0.5">
                          {formatCurrency(reportCreditTotal)}
                        </span>
                        <span className="text-[10px] text-amber-700 mt-0.5 block">Customer Credit</span>
                      </div>

                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                        <span className="text-[10px] font-bold uppercase text-rose-800 block">Voided Bills</span>
                        <span className="text-base font-extrabold text-rose-950 block mt-0.5">
                          {formatCurrency(reportVoidedAmt)}
                        </span>
                        <span className="text-[10px] text-rose-700 mt-0.5 block">
                          {reportVoided.length} Voided
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cashier Performance Breakdown (if multiple cashiers or all) */}
                  {cashierAuditBreakdown.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Cashier Performance Breakdown
                      </h3>
                      <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Cashier</th>
                            <th className="py-2 px-3">Branch</th>
                            <th className="py-2 px-3 text-center">Bills Count</th>
                            <th className="py-2 px-3 text-right">Cash Total</th>
                            <th className="py-2 px-3 text-right">Card Total</th>
                            <th className="py-2 px-3 text-right">Gross Total (LKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cashierAuditBreakdown.map((row) => (
                            <tr key={`${row.cashierName}__${row.branchId}`} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{row.cashierName}</td>
                              <td className="py-2 px-3 font-medium text-slate-700">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {row.branchName}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-mono">{row.count}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(row.cash)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(row.card)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(row.gross)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Itemized Transactions Table */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Itemized Audit Records ({reportSales.length} Bills)
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="py-2 px-3">Invoice #</th>
                            <th className="py-2 px-3">Date & Time</th>
                            <th className="py-2 px-3">Branch</th>
                            <th className="py-2 px-3">Cashier</th>
                            <th className="py-2 px-3">Customer</th>
                            <th className="py-2 px-3">Method</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Net Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {reportSales.slice(0, 300).map((sale) => (
                            <tr key={sale.id} className={sale.status === 'VOIDED' ? 'bg-rose-50/30' : ''}>
                              <td className="py-1.5 px-3 font-mono font-bold">{sale.invoiceNumber}</td>
                              <td className="py-1.5 px-3 font-mono text-slate-500">
                                {new Date(sale.createdAt).toLocaleString('en-GB', {
                                  month: 'short',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Colombo',
                                })}
                              </td>
                              <td className="py-1.5 px-3 text-slate-700">{getBranchLabel(sale.branchId)}</td>
                              <td className="py-1.5 px-3 text-slate-700">{sale.cashier?.fullName || sale.cashierName || 'Staff'}</td>
                              <td className="py-1.5 px-3 text-slate-700">{sale.customerName || 'Walk-in'}</td>
                              <td className="py-1.5 px-3">{sale.payments?.[0]?.paymentMethod || 'CASH'}</td>
                              <td className="py-1.5 px-3 font-bold">
                                <span className={sale.status === 'COMPLETED' ? 'text-emerald-700' : 'text-rose-700'}>
                                  {sale.status}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold">
                                <span className={sale.status === 'VOIDED' ? 'line-through text-slate-400' : 'text-slate-900'}>
                                  {formatCurrency(Number(sale.totalAmount))}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan={7} className="py-2 px-3 text-right uppercase text-[11px] text-slate-600">
                              Grand Settled Total:
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs text-slate-950">
                              {formatCurrency(reportGross)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {reportSales.length > 300 && (
                      <p className="text-[10px] text-slate-500 mt-1 italic text-center">
                        * Showing first 300 itemized records for print optimization. Total verified dataset contains {reportSales.length} bills.
                      </p>
                    )}
                  </div>

                  {/* Executive Sign-off Signatures */}
                  <div className="pt-8 grid grid-cols-2 gap-12 text-xs border-t border-slate-200">
                    <div className="space-y-12">
                      <div className="border-b border-slate-400 pb-1 font-mono text-center text-slate-400">
                        Signature of Dispenser / Cashier
                      </div>
                      <div className="text-center text-slate-600">
                        <span className="font-bold text-slate-800">
                          {selectedCashier !== 'ALL' ? selectedCashier : 'Authorized Cashier'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Cash Register Settlement Officer</p>
                      </div>
                    </div>

                    <div className="space-y-12">
                      <div className="border-b border-slate-400 pb-1 font-mono text-center text-slate-400">
                        Signature of Owner / Managing Director
                      </div>
                      <div className="text-center text-slate-600">
                        <span className="font-bold text-slate-800">Dr. Deegayu (Managing Director)</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Deegayu Weda Madura Financial Governance</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-slate-400 pt-4 font-mono">
                    Official Audit Certificate • PixelCraft POS Enterprise Ledger • All Rights Reserved © {new Date().getFullYear()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
