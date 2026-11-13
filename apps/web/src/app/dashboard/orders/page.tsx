'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Filter,
  Download,
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
} from 'lucide-react';
import type { SaleDto, SalePaymentMethod, SaleStatus } from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

export default function SalesOrdersPage() {
  const { currency, selectedBranchId, branches, business } = useTenantBranch();
  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const branchName = currentBranch?.name || business?.name || 'Deegayu Main Store';
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [copiedInvoice, setCopiedInvoice] = useState<string | null>(null);

  // Active Receipt Modal
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState<string | null>(null);

  // Void Bill Modal State
  const [voidModalSale, setVoidModalSale] = useState<SaleDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch Sales Data
  const fetchSales = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await posApi.getSales({
          page: currentPage,
          limit: 25,
          period,
          search: searchQuery.trim() || undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          paymentMethod: selectedMethod !== 'ALL' ? selectedMethod : undefined,
          branchId: selectedBranchId && selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        });

        if (res.data) {
          setSales(res.data.items || []);
          setTotalCount(res.data.total || 0);
          setTotalPages(res.data.totalPages || 1);
        }
      } catch (err) {
        console.error('Failed to load sales register:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentPage, period, searchQuery, selectedStatus, selectedMethod, selectedBranchId],
  );

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

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

  // Export Sales to CSV
  const handleExportCsv = () => {
    if (sales.length === 0) return;

    const headers = [
      'Invoice #',
      'Date Time',
      'Customer',
      'Cashier',
      'Payment Method',
      'Status',
      'Items Count',
      'Subtotal (LKR)',
      'Discount (LKR)',
      'Tax (LKR)',
      'Total Amount (LKR)',
    ];

    const rows = sales.map((s) => [
      s.invoiceNumber,
      new Date(s.createdAt).toISOString(),
      `"${(s.customerName || 'Walk-in Customer').replace(/"/g, '""')}"`,
      `"${(s.cashier?.fullName || s.cashierName || 'Staff').replace(/"/g, '""')}"`,
      s.payments?.[0]?.paymentMethod || 'UNKNOWN',
      s.status,
      s.items?.reduce((cnt, it) => cnt + it.quantity, 0) || 0,
      Number(s.subtotal || 0).toFixed(2),
      Number(s.discountAmount || 0).toFixed(2),
      Number(s.taxAmount || 0).toFixed(2),
      Number(s.totalAmount || 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pixelcraft-sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic Metrics Summary from loaded sales
  const completedSales = useMemo(() => sales.filter((s) => s.status === 'COMPLETED'), [sales]);
  const voidedSales = useMemo(() => sales.filter((s) => s.status === 'VOIDED'), [sales]);

  const totalGross = useMemo(
    () => completedSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
    [completedSales],
  );

  const totalVoidedAmount = useMemo(
    () => voidedSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
    [voidedSales],
  );

  const avgTicket = useMemo(() => {
    return completedSales.length > 0 ? totalGross / completedSales.length : 0;
  }, [totalGross, completedSales]);

  const formatCurrency = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', {
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
            {method || 'N/A'}
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

  return (
    <div className="space-y-6">
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
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 font-sinhala">
              විකුණුම් සහ බිල්පත්
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
              Live Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time transaction registers, customer receipts, 80mm/58mm reprints, and inventory-restoring void management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            disabled={sales.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => fetchSales(true)}
            disabled={loading || isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

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
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
          <button
            onClick={() => {
              setPeriod('today');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'today'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            Today&apos;s Bills
          </button>
          <button
            onClick={() => {
              setPeriod('week');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'week'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => {
              setPeriod('month');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'month'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => {
              setPeriod('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            All Bills
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Active Branch:</span>
          <span className="font-bold text-slate-800">{branchName || 'Deegayu Main Store'}</span>
        </div>
      </div>

      {/* KPI Cards Row */}
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
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalGross)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Settled payments across {completedSales.length} bill(s)
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
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {completedSales.length}
            </div>
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
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(avgTicket)}
            </div>
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
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {voidedSales.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {formatCurrency(totalVoidedAmount)} reversed
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by invoice #, customer name, or cashier..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setSelectedMethod(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="QR_PAYMENT">LankaQR</option>
                <option value="CUSTOMER_CREDIT">Khata Credit</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice / Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 text-blue-600 animate-spin" />
                    <p className="font-medium text-slate-600 text-xs">Loading sales transactions...</p>
                  </td>
                </tr>
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
                            }) +
                            ' ' +
                            new Date(sale.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <div>{sale.customerName || 'Walk-in Customer'}</div>
                    </td>

                    {/* Cashier */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {sale.cashier?.fullName || sale.cashierName || 'Staff'}
                      </span>
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-bold text-slate-900">
                        {sale.items?.reduce((cnt, it) => cnt + it.quantity, 0) || 0}
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
                        {/* View & Print Receipt */}
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
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600 text-sm">No sales records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/30">
          <div>
            Showing <span className="font-semibold text-slate-700">{sales.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span> total recorded orders
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="font-mono text-[11px] text-slate-400">
            Encrypted Audit Logs • RLS Isolated
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
    </div>
  );
}
