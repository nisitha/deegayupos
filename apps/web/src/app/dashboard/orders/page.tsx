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
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
  PackagePlus,
  Layers,
} from 'lucide-react';
import type { SaleDto, SalePaymentMethod, SaleStatus } from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { useRealtimePosSync } from '../../../hooks/use-realtime-pos-sync';
import { posApi, type SalesSummaryKPI, getColomboDateBounds, formatShiftLabel, getColomboDateStr } from '../../../lib/api-client';
import { supabase } from '../../../lib/supabase';
import { ReceiptModal } from '../../../components/pos/receipt-modal';
import { formatReceiptColomboDateTime } from '../../../lib/date-utils';

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'all' | 'custom';
type SortField = 'created_at' | 'total_amount' | 'invoice_number' | 'cashier_name';
type TransactionTab = 'ALL' | 'POS' | 'SPECIAL';

interface CashierOption {
  id: string;
  fullName: string;
  role: string;
  assignedBranches?: string[];
}

// Exactly the 3 active operating branches for Deegayu Weda Madhura (NO Main Store)
export const ACTIVE_BRANCHES = [
  { id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54', name: 'Alawwa', code: 'ALW' },
  { id: 'fa68e4a0-a515-44c8-a082-5b5590366658', name: 'Dambadeniya', code: 'DAM' },
  { id: '197693d6-4247-48df-b614-6fcde9e34f7d', name: 'Giriulla', code: 'GIR' },
];

export const ACTIVE_BRANCH_IDS = ACTIVE_BRANCHES.map((b) => b.id);

export const BRANCH_MAP: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': 'Alawwa',
  'fa68e4a0-a515-44c8-a082-5b5590366658': 'Dambadeniya',
  '197693d6-4247-48df-b614-6fcde9e34f7d': 'Giriulla',
};

export interface SpecialStockSalesEntry {
  id: string;
  shiftId: string;
  shiftDate: string;
  shiftNumber: number;
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  productId: string;
  productName: string;
  productSku: string;
  soldQty: number;
  appliedRate: number;
  totalAmount: number;
  createdAt: string;
  shiftStatus: 'open' | 'closed';
}

export interface SpecialStockSummaryKPI {
  totalGross: number;
  totalUnits: number;
  entryCount: number;
}

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
  const { currency, selectedBranchId, setSelectedBranchId, branches, isOwnerOrAdmin } = useTenantBranch();

  // Primary Data State (POS Catalog Bills)
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const fetchIdRef = useRef(0);

  // Active Transaction Tab (All Transactions | POS Catalog Bills | Special Stock Sales)
  const [activeTransactionTab, setActiveTransactionTab] = useState<TransactionTab>('ALL');

  // Special Stock Sales State
  const [specialStockEntries, setSpecialStockEntries] = useState<SpecialStockSalesEntry[]>([]);
  const [specialStockSummary, setSpecialStockSummary] = useState<SpecialStockSummaryKPI>({
    totalGross: 0,
    totalUnits: 0,
    entryCount: 0,
  });
  const [selectedSpecialDetail, setSelectedSpecialDetail] = useState<SpecialStockSalesEntry | null>(null);

  // Filters State
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(getColomboTodayDateString());
  const [customEndDate, setCustomEndDate] = useState(getColomboTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    if (selectedBranchId && ACTIVE_BRANCH_IDS.includes(selectedBranchId)) {
      return selectedBranchId;
    }
    return 'ALL';
  });
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

  // Backend Aggregated KPI Summary for POS bills
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

  // Bi-directionally sync from global header branch selector
  useEffect(() => {
    if (!isMounted) return;
    const target = selectedBranchId && ACTIVE_BRANCH_IDS.includes(selectedBranchId) ? selectedBranchId : 'ALL';
    setSelectedBranch((prev) => (prev !== target ? target : prev));
  }, [selectedBranchId, isMounted]);

  // Load Cashiers List with assigned branch mappings
  useEffect(() => {
    async function loadCashiers() {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, role, assigned_branches')
          .eq('is_active', true)
          .neq('role', 'ARCHIVED')
          .order('full_name');

        if (usersData && usersData.length > 0) {
          const mapped: CashierOption[] = usersData.map((u: any) => ({
            id: u.id,
            fullName: u.full_name || 'Staff',
            role: u.role || 'STAFF',
            assignedBranches: u.assigned_branches || [],
          }));
          setCashiers(mapped);
          return;
        }
      } catch (e) {
        console.warn('[Orders] users query fallback:', e);
      }

      posApi.getCashiers().then((list) => {
        if (list && list.length > 0) {
          setCashiers(list);
        }
      });
    }

    loadCashiers();
  }, []);

  // Filter Active Staff dynamically to current branch selection (Owner is always available)
  const activeStaff = useMemo(() => {
    return cashiers.filter((c) => {
      const name = (c.fullName || '').toLowerCase();
      if (
        name.startsWith('sale ') ||
        name.startsWith('cashier ') ||
        name.startsWith('user ') ||
        name.startsWith('system ')
      ) {
        return false;
      }
      const isOwnerRole = c.role === 'OWNER' || name.includes('owner') || name.includes('dr. deegayu');
      if (isOwnerRole) return true;
      if (selectedBranch === 'ALL') return true;
      if (c.assignedBranches && c.assignedBranches.length > 0) {
        return c.assignedBranches.includes(selectedBranch);
      }
      return true;
    });
  }, [cashiers, selectedBranch]);

  // If branch switches and the selected cashier is no longer in that branch's staff, reset to ALL
  useEffect(() => {
    if (selectedCashier !== 'ALL') {
      const exists = activeStaff.some((c) => c.fullName === selectedCashier);
      if (!exists) {
        setSelectedCashier('ALL');
      }
    }
  }, [selectedBranch, activeStaff, selectedCashier]);

  // Active Branch Label Helper
  const getBranchLabel = useCallback((id?: string) => {
    if (!id || id === 'ALL') return 'All Branches';
    return BRANCH_MAP[id] || branches.find((b) => b.id === id)?.name || 'Branch';
  }, [branches]);

  // Special Stock / Modaka Sales Fetcher across All 3 Branches (Alawwa, Dambadeniya, Giriulla)
  const fetchSpecialStockSales = useCallback(
    async (
      currentPeriod: PeriodFilter,
      startDate?: string,
      endDate?: string,
      branchId?: string,
      cashierNameFilter?: string
    ) => {
      try {
        const bounds = getColomboDateBounds(currentPeriod, startDate, endDate);
        const startDateStr = bounds.from ? bounds.from.slice(0, 10) : undefined;
        const endDateStr = bounds.to ? bounds.to.slice(0, 10) : undefined;

        // 1. Fetch cashier shifts using pagination beyond 1,000-row limit
        let allShifts: any[] = [];
        let shiftOffset = 0;
        const shiftChunkSize = 1000;

        while (true) {
          let shiftsQuery = supabase
            .from('cashier_shifts')
            .select(`
              id,
              tenant_id,
              branch_id,
              cashier_id,
              shift_date,
              shift_number,
              status,
              started_at,
              ended_at,
              modaka_total_sold_qty,
              modaka_total_amount,
              users (id, full_name)
            `)
            .order('shift_date', { ascending: false })
            .order('shift_number', { ascending: true })
            .range(shiftOffset, shiftOffset + shiftChunkSize - 1);

          if (startDateStr && endDateStr) {
            if (startDateStr === endDateStr) {
              shiftsQuery = shiftsQuery.eq('shift_date', startDateStr);
            } else {
              shiftsQuery = shiftsQuery.gte('shift_date', startDateStr).lte('shift_date', endDateStr);
            }
          } else if (startDateStr) {
            shiftsQuery = shiftsQuery.gte('shift_date', startDateStr);
          } else if (endDateStr) {
            shiftsQuery = shiftsQuery.lte('shift_date', endDateStr);
          }

          if (branchId && branchId !== 'ALL') {
            shiftsQuery = shiftsQuery.eq('branch_id', branchId);
          } else {
            shiftsQuery = shiftsQuery.in('branch_id', ACTIVE_BRANCH_IDS);
          }

          const { data: sData, error: sErr } = await shiftsQuery;
          if (sErr || !sData || sData.length === 0) break;
          allShifts.push(...sData);
          if (sData.length < shiftChunkSize) break;
          shiftOffset += shiftChunkSize;
          if (shiftOffset >= 5000) break;
        }

        // Also fetch closed shifts whose ended_at falls within Colombo date bounds
        if (bounds.from && bounds.to) {
          let endedShiftsQuery = supabase
            .from('cashier_shifts')
            .select(`
              id,
              tenant_id,
              branch_id,
              cashier_id,
              shift_date,
              shift_number,
              status,
              started_at,
              ended_at,
              modaka_total_sold_qty,
              modaka_total_amount,
              users (id, full_name)
            `)
            .gte('ended_at', bounds.from)
            .lte('ended_at', bounds.to)
            .order('ended_at', { ascending: false })
            .range(0, 999);

          if (branchId && branchId !== 'ALL') {
            endedShiftsQuery = endedShiftsQuery.eq('branch_id', branchId);
          } else {
            endedShiftsQuery = endedShiftsQuery.in('branch_id', ACTIVE_BRANCH_IDS);
          }

          const { data: endedData } = await endedShiftsQuery;
          if (endedData && endedData.length > 0) {
            allShifts.push(...endedData);
          }
        }

        // Deduplicate by shift id and attribute closed shifts to Colombo closing date
        const shiftDedupMap = new Map<string, any>();
        allShifts.forEach((s: any) => {
          if (s.status === 'closed' && s.ended_at) {
            const closingDate = getColomboDateStr(new Date(s.ended_at));
            if (closingDate) {
              s.shift_date = closingDate;
            }
          }
          shiftDedupMap.set(s.id, s);
        });
        allShifts = Array.from(shiftDedupMap.values());

        // Apply Cashier filter if specified
        if (cashierNameFilter && cashierNameFilter !== 'ALL') {
          allShifts = allShifts.filter((s: any) => {
            const cName = s.users?.full_name || '';
            return cName === cashierNameFilter;
          });
        }

        if (allShifts.length === 0) {
          setSpecialStockEntries([]);
          setSpecialStockSummary({ totalGross: 0, totalUnits: 0, entryCount: 0 });
          return;
        }

        const shiftMap = new Map<string, any>();
        allShifts.forEach((s) => shiftMap.set(s.id, s));
        const shiftIds = allShifts.map((s) => s.id);

        // 2. Fetch shift_modaka_entries in safe chunks of 500 shift IDs
        const rawEntries: any[] = [];
        for (let i = 0; i < shiftIds.length; i += 500) {
          const chunk = shiftIds.slice(i, i + 500);
          const { data: smeData } = await supabase
            .from('shift_modaka_entries')
            .select('*, products(id, name, sku)')
            .in('shift_id', chunk);

          if (smeData) {
            rawEntries.push(...smeData);
          }
        }

        // Build structured SpecialStockSalesEntry records
        const formattedEntries: SpecialStockSalesEntry[] = [];
        const accountedShiftIds = new Set<string>();

        rawEntries.forEach((e) => {
          const sold = Number(e.sold_qty || 0);
          if (sold <= 0) return;
          const shift = shiftMap.get(e.shift_id);
          if (!shift) return;

          accountedShiftIds.add(shift.id);
          const rate = Number(e.applied_rate || 250);
          const amt = Number(e.total_amount || sold * rate);
          const cName = shift.users?.full_name || 'Staff Cashier';
          const bName = BRANCH_MAP[shift.branch_id] || 'Branch';

          formattedEntries.push({
            id: e.id,
            shiftId: shift.id,
            shiftDate: shift.shift_date,
            shiftNumber: shift.shift_number || 1,
            branchId: shift.branch_id,
            branchName: bName,
            cashierId: shift.cashier_id,
            cashierName: cName,
            productId: e.product_id,
            productName: e.products?.name || 'Special Stock Item',
            productSku: e.products?.sku || '',
            soldQty: sold,
            appliedRate: rate,
            totalAmount: amt,
            createdAt: e.created_at || `${shift.shift_date}T12:00:00.000+05:30`,
            shiftStatus: shift.status || 'open',
          });
        });

        // Catch shifts that recorded shift-level modaka sales without itemized child rows
        allShifts.forEach((shift) => {
          const shiftSpecialAmt = Number(shift.modaka_total_amount || 0);
          const shiftSpecialQty = Number(shift.modaka_total_sold_qty || 0);
          if (shiftSpecialAmt > 0 && !accountedShiftIds.has(shift.id)) {
            const cName = shift.users?.full_name || 'Staff Cashier';
            const bName = BRANCH_MAP[shift.branch_id] || 'Branch';

            formattedEntries.push({
              id: `shift-modaka-${shift.id}`,
              shiftId: shift.id,
              shiftDate: shift.shift_date,
              shiftNumber: shift.shift_number || 1,
              branchId: shift.branch_id,
              branchName: bName,
              cashierId: shift.cashier_id,
              cashierName: cName,
              productId: 'special-stock-aggregate',
              productName: 'Special Stock (Shift Inflow)',
              productSku: 'SPEC-SHIFT',
              soldQty: shiftSpecialQty || 1,
              appliedRate: shiftSpecialQty > 0 ? Math.round((shiftSpecialAmt / shiftSpecialQty) * 100) / 100 : shiftSpecialAmt,
              totalAmount: shiftSpecialAmt,
              createdAt: shift.started_at || `${shift.shift_date}T12:00:00.000+05:30`,
              shiftStatus: shift.status || 'open',
            });
          }
        });

        // Sort entries by createdAt descending
        formattedEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const totalGross = formattedEntries.reduce((sum, e) => sum + e.totalAmount, 0);
        const totalUnits = formattedEntries.reduce((sum, e) => sum + e.soldQty, 0);

        setSpecialStockEntries(formattedEntries);
        setSpecialStockSummary({
          totalGross,
          totalUnits,
          entryCount: formattedEntries.length,
        });
      } catch (err) {
        console.error('[Orders] Failed to load Special Stock sales:', err);
      }
    },
    []
  );

  // Fetch Sales Data reactively based on active filters with Request Sequence Guard
  const fetchSales = useCallback(
    async (mode?: 'manual' | 'background' | boolean) => {
      const isBackground = mode === 'background' || mode === true;
      const isManualRefresh = mode === 'manual';
      const fetchId = ++fetchIdRef.current;
      try {
        if (isManualRefresh) {
          setIsRefreshing(true);
        } else if (!isBackground) {
          setLoading(true);
        }

        // In parallel, fetch POS sales and Special Stock sales
        const [res] = await Promise.all([
          posApi.getSales({
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
          }),
          fetchSpecialStockSales(
            period,
            customStartDate,
            customEndDate,
            selectedBranch,
            selectedCashier
          ),
        ]);

        // Guard against stale response overwrites
        if (fetchId !== fetchIdRef.current) return;

        if (res.data) {
          setSales((prev) => {
            const newItems = res.data.items || [];
            if (
              prev.length === newItems.length &&
              prev[0]?.id === newItems[0]?.id &&
              prev[0]?.updatedAt === newItems[0]?.updatedAt &&
              prev[prev.length - 1]?.id === newItems[newItems.length - 1]?.id
            ) {
              return prev;
            }
            return newItems;
          });
          setTotalCount((prev) => (prev !== (res.data.total || 0) ? res.data.total || 0 : prev));
          setTotalPages((prev) => (prev !== (res.data.totalPages || 1) ? res.data.totalPages || 1 : prev));
          const newSummary = res.data.summary;
          if (newSummary) {
            setKpiSummary((prev) =>
              JSON.stringify(prev) !== JSON.stringify(newSummary) ? newSummary : prev
            );
          }
        }
      } catch (err) {
        if (fetchId === fetchIdRef.current) {
          console.error('Failed to load sales register:', err);
        }
      } finally {
        if (fetchId === fetchIdRef.current) {
          if (isManualRefresh) {
            setIsRefreshing(false);
          } else if (!isBackground) {
            setLoading(false);
          }
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
      fetchSpecialStockSales,
    ],
  );

  useEffect(() => {
    fetchSales(false);
  }, [fetchSales]);

  // Wire Real-time sync for live bill & shift events silently in the background
  useRealtimePosSync((isBg) => fetchSales(isBg ?? true));

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
    // Bi-directionally sync with global header
    if (isOwnerOrAdmin) {
      setSelectedBranchId(newBranch === 'ALL' ? null : newBranch);
    }
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

  // Full CSV Export across ALL matching rows (Including Special Stock Sales)
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

      if ((!allMatching || allMatching.length === 0) && specialStockEntries.length === 0) {
        alert('No sales records found for the active filter selection.');
        return;
      }

      const headers = [
        'Transaction Type',
        'Invoice / Ref #',
        'Date Time (Asia/Colombo)',
        'Branch',
        'Cashier',
        'Customer / Product Details',
        'Quantity',
        'Payment Method',
        'Status',
        'Subtotal (LKR)',
        'Discount (LKR)',
        'Tax (LKR)',
        'Grand Total (LKR)',
      ];

      const rows: string[] = [];

      // Append POS Bills
      if (activeTransactionTab !== 'SPECIAL') {
        allMatching.forEach((s) => {
          const bName = getBranchLabel(s.branchId);
          const cName = s.cashier?.fullName || s.cashierName || 'Staff';
          const custName = s.customerName || 'Walk-in Customer';
          const dt = formatReceiptColomboDateTime(s.createdAt);
          const pm = s.payments?.[0]?.paymentMethod || 'CASH';

          rows.push([
            '"POS Bill"',
            `"${s.invoiceNumber}"`,
            `"${dt}"`,
            `"${bName.replace(/"/g, '""')}"`,
            `"${cName.replace(/"/g, '""')}"`,
            `"${custName.replace(/"/g, '""')}"`,
            `"${s.items?.length || 1}"`,
            `"${pm}"`,
            `"${s.status}"`,
            Number(s.subtotal || 0).toFixed(2),
            Number(s.discountAmount || 0).toFixed(2),
            Number(s.taxAmount || 0).toFixed(2),
            Number(s.totalAmount || 0).toFixed(2),
          ].join(','));
        });
      }

      // Append Special Stock Sales
      if (activeTransactionTab !== 'POS' && specialStockEntries.length > 0) {
        specialStockEntries.forEach((e) => {
          const dt = formatReceiptColomboDateTime(e.createdAt);
          rows.push([
            '"Special Stock Sales"',
            `"SPEC-${e.shiftDate.replace(/-/g, '')}-S${e.shiftNumber}-${e.productSku || 'ITEM'}"`,
            `"${dt}"`,
            `"${e.branchName.replace(/"/g, '""')}"`,
            `"${e.cashierName.replace(/"/g, '""')}"`,
            `"${e.productName.replace(/"/g, '""')} (${e.soldQty} units @ LKR ${e.appliedRate.toFixed(2)})"`,
            `"${e.soldQty}"`,
            '"CASH (Drawer)"',
            '"COMPLETED"',
            Number(e.totalAmount || 0).toFixed(2),
            '0.00',
            '0.00',
            Number(e.totalAmount || 0).toFixed(2),
          ].join(','));
        });
      }

      // UTF-8 BOM for Microsoft Excel compatibility
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cashierSlug = selectedCashier !== 'ALL' ? `_${selectedCashier.replace(/\s+/g, '_')}` : '';
      const branchSlug = selectedBranch !== 'ALL' ? `_${getBranchLabel(selectedBranch).replace(/\s+/g, '_')}` : '';
      link.download = `deegayu-combined-sales${branchSlug}-${period}${cashierSlug}-${getColomboTodayDateString()}.csv`;
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
            Khata Credit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            {method || 'CASH'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: SaleStatus | string) => {
    if (status === 'COMPLETED' || status === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    }
    if (status === 'VOIDED' || status === 'CANCELLED') {
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
      const bName = getBranchLabel(bId);
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

    // Incorporate Special Stock Sales into Cashier Performance Breakdown
    specialStockEntries.forEach((e) => {
      const key = `${e.cashierName}__${e.branchId}`;
      const entry = map.get(key) || {
        cashierName: e.cashierName,
        branchName: e.branchName,
        branchId: e.branchId,
        count: 0,
        gross: 0,
        cash: 0,
        card: 0,
        voidCount: 0,
      };
      entry.count++;
      entry.gross += e.totalAmount;
      entry.cash += e.totalAmount;
      map.set(key, entry);
    });

    return Array.from(map.values());
  }, [reportSales, specialStockEntries, getBranchLabel]);

  // Unified Table Rows (combining POS Bills and Special Stock Sales)
  const displayRows = useMemo(() => {
    if (activeTransactionTab === 'POS') {
      return sales.map((s) => ({
        type: 'POS' as const,
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        createdAt: s.createdAt,
        branchId: s.branchId,
        branchName: getBranchLabel(s.branchId),
        customerName: s.customerName || 'Walk-in Customer',
        cashierName: s.cashier?.fullName || s.cashierName || 'Staff',
        itemsCount: s.items && s.items.length > 0 ? s.items.reduce((cnt, it) => cnt + Number(it.quantity || 1), 0) : 1,
        itemsSummary: s.items && s.items.length > 0 ? `${s.items.length} product(s)` : 'General Items',
        paymentMethod: s.payments?.[0]?.paymentMethod || 'CASH',
        status: s.status,
        totalAmount: Number(s.totalAmount || 0),
        rawSale: s,
      }));
    }

    if (activeTransactionTab === 'SPECIAL') {
      return specialStockEntries.map((e) => ({
        type: 'SPECIAL' as const,
        id: e.id,
        invoiceNumber: `SPEC-${e.shiftDate.replace(/-/g, '')}-S${e.shiftNumber}-${e.productSku || e.id.slice(0, 4).toUpperCase()}`,
        createdAt: e.createdAt,
        branchId: e.branchId,
        branchName: e.branchName,
        customerName: `${e.productName} (${e.soldQty} units)`,
        cashierName: e.cashierName,
        itemsCount: e.soldQty,
        itemsSummary: `${e.productName} @ LKR ${e.appliedRate.toFixed(2)}`,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        totalAmount: e.totalAmount,
        specialStockEntry: e,
      }));
    }

    // ALL: Combine active page POS sales and Special Stock entries sorted by createdAt desc
    const posRows = sales.map((s) => ({
      type: 'POS' as const,
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      createdAt: s.createdAt,
      branchId: s.branchId,
      branchName: getBranchLabel(s.branchId),
      customerName: s.customerName || 'Walk-in Customer',
      cashierName: s.cashier?.fullName || s.cashierName || 'Staff',
      itemsCount: s.items && s.items.length > 0 ? s.items.reduce((cnt, it) => cnt + Number(it.quantity || 1), 0) : 1,
      itemsSummary: s.items && s.items.length > 0 ? `${s.items.length} product(s)` : 'General Items',
      paymentMethod: s.payments?.[0]?.paymentMethod || 'CASH',
      status: s.status,
      totalAmount: Number(s.totalAmount || 0),
      rawSale: s,
    }));

    const specialRows = specialStockEntries.map((e) => ({
      type: 'SPECIAL' as const,
      id: e.id,
      invoiceNumber: `SPEC-${e.shiftDate.replace(/-/g, '')}-S${e.shiftNumber}-${e.productSku || e.id.slice(0, 4).toUpperCase()}`,
      createdAt: e.createdAt,
      branchId: e.branchId,
      branchName: e.branchName,
      customerName: `${e.productName} (${e.soldQty} units)`,
      cashierName: e.cashierName,
      itemsCount: e.soldQty,
      itemsSummary: `${e.productName} @ LKR ${e.appliedRate.toFixed(2)}`,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      totalAmount: e.totalAmount,
      specialStockEntry: e,
    }));

    return [...posRows, ...specialRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeTransactionTab, sales, specialStockEntries, getBranchLabel]);

  // Combined Gross Calculation across active branch & date filters
  const combinedGrossSales = kpiSummary.totalGross + specialStockSummary.totalGross;

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
            Real-time multi-branch transaction register, Special Stock sales tracking, cashier audit reports, reprints, and stock restoration.
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
            disabled={isExportingCsv || (sales.length === 0 && specialStockEntries.length === 0)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
            title="Export all matching records across database to Excel CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isExportingCsv ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchSales('manual')}
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
          <span>Colombo Timezone (UTC+05:30) • Operating Branches: Alawwa, Dambadeniya, Giriulla</span>
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

      {/* KPI Cards Row — Accurate Combined Aggregates across POS Catalog & Special Stock Sales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Combined Total Gross Sales */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-lg shadow-blue-500/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider">Total Gross Sales</span>
              <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-md shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-36 bg-white/20 animate-pulse rounded-lg my-0.5" />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {formatCurrency(combinedGrossSales)}
                </div>
              )}
              <div
                className="mt-2 text-xs font-medium text-blue-100 truncate flex items-center gap-1.5 flex-wrap"
                title={`POS Bills: ${formatCurrency(kpiSummary.totalGross)} + Special Stock: ${formatCurrency(specialStockSummary.totalGross)}`}
              >
                <span className="bg-white/20 border border-white/30 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white">
                  POS: {formatCurrency(kpiSummary.totalGross)}
                </span>
                <span className="bg-purple-900/40 border border-purple-400/40 px-2 py-0.5 rounded-full text-[11px] font-semibold text-purple-100">
                  Special: {formatCurrency(specialStockSummary.totalGross)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: POS Catalog Bills */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-lg shadow-emerald-500/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">POS Catalog Bills</span>
              <div className="w-10 h-10 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-md shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-20 bg-white/20 animate-pulse rounded-lg my-0.5" />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {kpiSummary.completedCount.toLocaleString()} <span className="text-xs font-normal text-emerald-100">Bills</span>
                </div>
              )}
              <div className="mt-2 text-xs text-emerald-100">
                Subtotal: <span className="font-bold text-white">{formatCurrency(kpiSummary.totalGross)}</span> • Fulfilled retail checkouts
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Special Stock Sales */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#4338CA] text-white shadow-lg shadow-indigo-500/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">Special Stock Sales</span>
              <div className="w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-md shrink-0">
                <PackagePlus className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-28 bg-white/20 animate-pulse rounded-lg my-0.5" />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {formatCurrency(specialStockSummary.totalGross)}
                </div>
              )}
              <div className="mt-2 text-xs text-indigo-100">
                <span className="font-bold text-white">{specialStockSummary.totalUnits.toLocaleString()}</span> units across <span className="font-bold text-white">{specialStockSummary.entryCount}</span> shift item(s)
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Voided Bills / Average Ticket */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white shadow-lg shadow-amber-500/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider">Voided Bills / Avg Ticket</span>
              <div className="w-10 h-10 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-md shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-16 bg-white/20 animate-pulse rounded-lg my-0.5" />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                  <span>{kpiSummary.voidedCount.toLocaleString()}</span>
                  <span className="text-xs font-normal text-amber-200">Voided</span>
                  <span className="text-sm font-semibold text-amber-300">|</span>
                  <span className="text-base sm:text-xl font-bold text-white">{formatCurrency(kpiSummary.avgTicket)}</span>
                  <span className="text-xs font-normal text-amber-200">Avg</span>
                </div>
              )}
              <div className="mt-2 text-xs text-amber-100">
                {formatCurrency(kpiSummary.totalVoidedAmount)} reversed • Per POS ticket
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Shimmer loading progress bar */}
        <div className="h-1 w-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 transition-all duration-300 ${
              loading ? 'w-full animate-pulse' : 'w-0'
            }`}
          />
        </div>

        {/* Filter Tab Switcher (All Transactions | POS Catalog Bills | Special Stock Sales) */}
        <div className="flex items-center gap-2 px-4 pt-3.5 border-b border-slate-200/80 bg-white">
          <button
            type="button"
            onClick={() => setActiveTransactionTab('ALL')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTransactionTab === 'ALL'
                ? 'border-[#005BD3] text-[#005BD3]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Transactions</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTransactionTab === 'ALL' ? 'bg-blue-100 text-[#005BD3]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalCount + specialStockEntries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTransactionTab('POS')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTransactionTab === 'POS'
                ? 'border-[#005BD3] text-[#005BD3]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>POS Catalog Bills</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTransactionTab === 'POS' ? 'bg-blue-100 text-[#005BD3]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTransactionTab('SPECIAL')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTransactionTab === 'SPECIAL'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5 text-rose-600" />
            <span>Special Stock Sales</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTransactionTab === 'SPECIAL' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {specialStockEntries.length}
            </span>
          </button>
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
            {/* Branch Filter — Strictly the 3 Active Branches (Alawwa, Dambadeniya, Giriulla), Zero Main Store */}
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
                {isOwnerOrAdmin && <option value="ALL">All Branches (Consolidated)</option>}
                <option value="00f4cdcb-7d1c-4026-b57a-6e66c33b0c54">Alawwa</option>
                <option value="fa68e4a0-a515-44c8-a082-5b5590366658">Dambadeniya</option>
                <option value="197693d6-4247-48df-b614-6fcde9e34f7d">Giriulla</option>
              </select>
              {!isOwnerOrAdmin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                  Locked (Staff)
                </span>
              )}
            </div>

            {/* Cashier Filter — Dynamically Filtered to Selected Branch Staff */}
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
                  {activeStaff.map((c) => {
                    const label = c.fullName.includes('(Owner)')
                      ? c.fullName
                      : c.role === 'OWNER'
                        ? `${c.fullName} (Owner)`
                        : c.fullName;
                    return (
                      <option key={c.id} value={c.fullName}>
                        {label}
                      </option>
                    );
                  })}
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
            <thead className="bg-[#0F172A] text-white font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                {/* Invoice / Ref / Time Header with Sort */}
                <th
                  onClick={() => handleHeaderSort('created_at')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Invoice / Ref / Time</span>
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
                <th className="py-3 px-4">Customer / Product Details</th>

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

                <th className="py-3 px-4">Quantity / Items</th>
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
              ) : displayRows.length > 0 ? (
                displayRows.map((row) => {
                  if (row.type === 'SPECIAL') {
                    const entry = row.specialStockEntry!;
                    return (
                      <tr
                        key={`special-${row.id}`}
                        className="hover:bg-rose-50/40 bg-rose-50/15 transition-colors group select-none"
                      >
                        {/* Reference & Shift / Date */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-rose-900 group-hover:text-rose-700 transition-colors">
                              {row.invoiceNumber}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Special Stock
                            </span>
                            <button
                              onClick={() => copyToClipboard(row.invoiceNumber)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5"
                              title="Copy Reference #"
                            >
                              {copiedInvoice === row.invoiceNumber ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-rose-500" />
                            <span>
                              {entry.shiftDate} • {entry.cashierName ? `Cashier: ${entry.cashierName}` : formatShiftLabel(entry.shiftNumber, entry.cashierName)}
                            </span>
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100/70 text-rose-800 border border-rose-200/60">
                            {entry.branchName}
                          </span>
                        </td>

                        {/* Customer / Product Details */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{entry.productName}</span>
                            {entry.productSku && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {entry.productSku}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Unit Price: {formatCurrency(entry.appliedRate)}
                          </div>
                        </td>

                        {/* Cashier with 1-Click Quick Filter */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              onClick={() => handleCashierChange(entry.cashierName)}
                              title={`Click to filter only records by ${entry.cashierName}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[11px] font-semibold transition-all group/cashier"
                            >
                              <User className="w-3 h-3 text-slate-400 group-hover/cashier:text-rose-600" />
                              <span>{entry.cashierName}</span>
                            </button>
                            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                              {entry.branchName}
                            </span>
                          </div>
                        </td>

                        {/* Units Sold */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          <span className="font-bold text-rose-700 text-sm">
                            {entry.soldQty}
                          </span>{' '}
                          unit(s)
                        </td>

                        {/* Payment Method */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Banknote className="w-3 h-3" /> Cash (Drawer)
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        </td>

                        {/* Grand Total */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700 text-sm">
                          {formatCurrency(entry.totalAmount)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedSpecialDetail(entry)}
                            title="View Special Stock Sales Audit Voucher"
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:text-white hover:bg-rose-600 transition-all shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Regular POS Bill Row
                  const sale = row.rawSale!;
                  return (
                    <tr
                      key={`pos-${sale.id}`}
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
                          {isMounted ? formatReceiptColomboDateTime(sale.createdAt) : '--:--'}
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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600 text-sm">No transaction records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No records matched the active filters for {period === 'today' ? "today's register" : 'the selected period'}.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Multi-Page Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/30">
          <div>
            Showing <span className="font-semibold text-slate-700">{displayRows.length}</span> transaction(s)
            {activeTransactionTab === 'ALL' && (
              <span> ({sales.length} POS Bills + {specialStockEntries.length} Special Stock)</span>
            )}{' '}
            • <span className="font-semibold text-slate-700">{(totalCount + (activeTransactionTab !== 'POS' ? specialStockEntries.length : 0)).toLocaleString()}</span> total matching across database
          </div>

          {activeTransactionTab !== 'SPECIAL' && totalPages > 1 && (
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
            Encrypted Multi-Branch Audit Trail • Asia/Colombo +05:30
          </div>
        </div>
      </div>

      {/* Special Stock Sales Audit Detail Modal */}
      {selectedSpecialDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Special Stock Sales Audit Voucher</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Shift {selectedSpecialDetail.shiftNumber === 1 ? 'A (Morning)' : selectedSpecialDetail.shiftNumber === 2 ? 'B (Evening)' : selectedSpecialDetail.shiftNumber} • {selectedSpecialDetail.shiftDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpecialDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operating Branch</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedSpecialDetail.branchName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shift Cashier</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedSpecialDetail.cashierName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shift Lifecycle</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                      selectedSpecialDetail.shiftStatus === 'closed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedSpecialDetail.shiftStatus === 'closed' ? 'Closed & Handed Over' : 'Active / Open Shift'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Flow</span>
                  <span className="font-bold text-emerald-700 text-xs mt-0.5 block">Cash Inflow to Drawer Float</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Special Stock Item Details</span>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{selectedSpecialDetail.productName}</span>
                  <span className="font-mono text-slate-500 text-[11px]">{selectedSpecialDetail.productSku || 'SPEC-SKU'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-medium">Quantity Sold</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{selectedSpecialDetail.soldQty} units</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-medium">Applied Rate</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{formatCurrency(selectedSpecialDetail.appliedRate)}</span>
                  </div>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-[10px] text-emerald-700 block font-bold">Total Inflow</span>
                    <span className="font-mono font-extrabold text-emerald-800 text-xs">{formatCurrency(selectedSpecialDetail.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedSpecialDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Audit Voucher
              </button>
            </div>
          </div>
        </div>
      )}

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
                <AlertTriangle className="w-5 h-5" />
                <span>Void Transaction & Restore Inventory</span>
              </div>
              <button
                type="button"
                onClick={() => setVoidModalSale(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 space-y-1">
              <p className="font-bold">
                Are you sure you want to void bill #{voidModalSale.invoiceNumber}?
              </p>
              <p className="text-[11px] text-rose-600">
                Total bill value of {formatCurrency(Number(voidModalSale.totalAmount))} will be reversed, and all items will be automatically returned to live stock inventory.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Voiding <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Specify the reason (e.g., Cashier billing error, customer return, exchange)..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              />
              {voidError && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{voidError}</p>
              )}
            </div>

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
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {voiding && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Restore Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Cashier Audit & Multi-Branch Reconciliation Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Header controls (No print) */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Executive Cashier & Multi-Branch Sales Audit Report
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#005BD3] hover:bg-[#004bb5] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4 / Save PDF</span>
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="cashier-audit-report-printable" className="p-8 space-y-6 bg-white text-slate-900">
              {/* Document Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                    Deegayu Weda Madhura
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    Ayurvedic Pharmacy & Healthcare Store • Financial Audit Department
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Branch Scope: {getBranchLabel(selectedBranch)} • Colombo (UTC+05:30)
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded bg-slate-100 font-mono text-xs font-bold text-slate-900 border border-slate-300">
                    AUDIT REPORT
                  </span>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Generated: {new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Filter Scope: {period.toUpperCase()}
                  </div>
                </div>
              </div>

              {reportLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#005BD3] mx-auto" />
                  <p className="text-xs text-slate-500">Compiling executive audit statements across database...</p>
                </div>
              ) : (
                <>
                  {/* Parameter Snapshot Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Selected Branch</span>
                      <span className="font-bold text-slate-900">{getBranchLabel(selectedBranch)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Audited Staff</span>
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

                  {/* Executive Settlement Summary Cards */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Executive Settlement Summary (POS Catalog + Special Stock Sales)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 block">Total Combined Gross</span>
                        <span className="text-base font-extrabold text-emerald-950 block mt-0.5">
                          {formatCurrency(reportGross + specialStockSummary.totalGross)}
                        </span>
                        <span className="text-[10px] text-emerald-700 mt-0.5 block">
                          {reportCompleted.length} POS + {specialStockSummary.entryCount} Special
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                        <span className="text-[10px] font-bold uppercase text-blue-800 block">Drawer Cash Total</span>
                        <span className="text-base font-extrabold text-blue-950 block mt-0.5">
                          {formatCurrency(reportCashTotal + specialStockSummary.totalGross)}
                        </span>
                        <span className="text-[10px] text-blue-700 mt-0.5 block">
                          Physical Drawer Settlement
                        </span>
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

                  {/* Cashier Performance Breakdown */}
                  {cashierAuditBreakdown.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Cashier Performance Breakdown (POS + Special Stock Combined)
                      </h3>
                      <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Cashier</th>
                            <th className="py-2 px-3">Branch</th>
                            <th className="py-2 px-3 text-center">Transactions</th>
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
                      Itemized Audit Records ({reportSales.length} POS Bills)
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
                                {formatReceiptColomboDateTime(sale.createdAt)}
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
                              Grand Settled POS Total:
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
                        <p className="text-[10px] text-slate-400 mt-0.5">Deegayu Weda Madhura Financial Governance</p>
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
