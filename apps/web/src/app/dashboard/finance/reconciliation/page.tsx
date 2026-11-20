'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  Printer,
  RefreshCw,
  Lock,
  Unlock,
  Coins,
  FileText,
  TrendingUp,
  UserCheck,
  Eye,
  Download,
  Search,
  X,
  ShieldCheck,
  Wallet,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  User,
  Clock,
  Layers,
  Scale,
} from 'lucide-react';
import { useTenantBranch } from '../../../../context/tenant-branch-context';
import { shiftsApi, formatShiftLabel, type ShiftFinancialAdjustmentDto } from '../../../../lib/api-client';
import { useRealtimePosSync } from '../../../../hooks/use-realtime-pos-sync';
import {
  reconciliationApi,
  SRI_LANKA_DENOMINATIONS,
  SRI_LANKA_BANKS,
  type BankDepositItem,
  type CashierSalesSummary,
  type CompanyBankAccountRecord,
  type DailyCashReconciliationRecord,
  type ConsolidatedReconciliationRow,
  type ConsolidatedBankDepositRow,
  type CashierShortageRow,
  type ConsolidatedLedgerRow,
  type ReconciliationWorksheetData,
  type ShiftHandoverSummary,
} from '../../../../lib/reconciliation-api';

type TabView =
  | 'shift_tally'
  | 'admin_summary'
  | 'bank_register'
  | 'shortages'
  | 'ledger'
  | 'worksheet'
  | 'bank_accounts';

export default function CashReconciliationPage() {
  const { business, branches, allowedBranches, selectedBranchId, setSelectedBranchId, user, activeCashier, isOwner } = useTenantBranch();

  const loggedInCashierName =
    activeCashier?.fullName ||
    user?.fullName ||
    (user?.email ? user.email.split('@')[0] : 'Branch Cashier');
  const loggedInCashierId = activeCashier?.id || user?.id;

  const tenantId = business?.id || '0fef1423-5d89-4147-8af8-17c7e641c88a';

  // Active branch selector synced with global top navigation bar
  const activeBranchFilter = isOwner
    ? (selectedBranchId || 'ALL')
    : (selectedBranchId || (allowedBranches.length > 0 && allowedBranches[0] ? allowedBranches[0].id : (branches.length > 0 && branches[0] ? branches[0].id : '')));

  const effectiveBranchId =
    activeBranchFilter !== 'ALL'
      ? activeBranchFilter
      : (allowedBranches.length > 0 && allowedBranches[0] ? allowedBranches[0].id : (branches.length > 0 && branches[0] ? branches[0].id : ''));

  // Get current date in Sri Lanka (UTC+5:30)
  const getTodaySriLanka = (): string => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const getYesterdaySriLanka = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const getDaysAgoSriLanka = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const getFirstDayOfMonthSriLanka = (): string => {
    const today = getTodaySriLanka();
    const [y, m] = today.split('-');
    return `${y}-${m}-01`;
  };

  // Set default tab based on role and URL params (Strictly locked to worksheet for Staff, Shift Tally for Owner)
  const [activeTab, setActiveTab] = useState<TabView>(() => {
    if (!isOwner) return 'worksheet';
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p && ['shift_tally', 'admin_summary', 'bank_register', 'shortages', 'ledger', 'worksheet', 'bank_accounts'].includes(p)) {
        return p as TabView;
      }
    }
    return 'shift_tally';
  });

  useEffect(() => {
    if (!isOwner) {
      setActiveTab('worksheet');
      return;
    }
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p && ['shift_tally', 'admin_summary', 'bank_register', 'shortages', 'ledger', 'worksheet', 'bank_accounts'].includes(p)) {
        setActiveTab(p as TabView);
      }
    }
  }, [isOwner]);

  const [staffEditingSubmitted, setStaffEditingSubmitted] = useState<boolean>(false);

  // Owner Branch Opening Float Modal state
  const [showSetBranchFloatModal, setShowSetBranchFloatModal] = useState<boolean>(false);
  const [targetFloatBranchId, setTargetFloatBranchId] = useState<string>('');
  const [newOpeningFloatAmount, setNewOpeningFloatAmount] = useState<string>('');
  const [isSubmittingBranchFloat, setIsSubmittingBranchFloat] = useState<boolean>(false);
  const [branchFloatError, setBranchFloatError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(getTodaySriLanka());
  const [selectedEndDate, setSelectedEndDate] = useState<string>(getTodaySriLanka());
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom'>('today');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  // Full day breakdown across sales, shifts & historical ledger
  const [worksheetData, setWorksheetData] = useState<ReconciliationWorksheetData>({
    existingRec: null,
    existingDeposits: [],
    previousClosingF: null,
    systemCashSales: 0,
    systemCardSales: 0,
    systemQrSales: 0,
    systemCreditSales: 0,
    totalGrossSales: 0,
    totalCompletedBills: 0,
    modakaSalesTotal: 0,
    modakaUnitsTotal: 0,
    autoCashExpenses: 0,
    cashierBreakdown: [],
    shifts: [],
    isHistorical: false,
  });

  // Synced branch switcher handler (updates global layout context + all local tabs)
  const handleBranchChange = (newBranchId: string) => {
    if (!isOwner) return; // Strict lock for staff
    setLoading(true);
    setSelectedBranchId(newBranchId === 'ALL' ? null : newBranchId);
    setSummaryBranchId(newBranchId);
    setBankFilterBranch(newBranchId);
    setShortageBranchFilter(newBranchId);
    setLedgerBranchFilter(newBranchId);
  };

  // Sync when top header branch dropdown changes
  useEffect(() => {
    if (isOwner) {
      const bId = selectedBranchId || 'ALL';
      setSummaryBranchId(bId);
      setBankFilterBranch(bId);
      setShortageBranchFilter(bId);
      setLedgerBranchFilter(bId);
    }
  }, [selectedBranchId, isOwner]);

  // Date range preset handlers with immediate 0ms loading state
  const handlePresetSelect = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom') => {
    if (!isOwner) return;
    setLoading(true);
    setDatePreset(preset);
    const today = getTodaySriLanka();
    if (preset === 'today') {
      setSelectedDate(today);
      setSelectedEndDate(today);
    } else if (preset === 'yesterday') {
      const y = getYesterdaySriLanka();
      setSelectedDate(y);
      setSelectedEndDate(y);
    } else if (preset === 'last7') {
      setSelectedDate(getDaysAgoSriLanka(6));
      setSelectedEndDate(today);
    } else if (preset === 'thisMonth') {
      setSelectedDate(getFirstDayOfMonthSriLanka());
      setSelectedEndDate(today);
    }
  };

  const handleStartDateChange = (newFrom: string) => {
    if (!isOwner) return;
    setLoading(true);
    setDatePreset('custom');
    setSelectedDate(newFrom);
    if (newFrom > selectedEndDate) {
      setSelectedEndDate(newFrom);
    }
  };

  const handleEndDateChange = (newTo: string) => {
    if (!isOwner) return;
    setLoading(true);
    setDatePreset('custom');
    setSelectedEndDate(newTo);
    if (newTo < selectedDate) {
      setSelectedDate(newTo);
    }
  };

  const handleDateChange = (newDate: string) => {
    if (!isOwner && newDate !== getTodaySriLanka()) return; // Staff locked to today
    setLoading(true);
    setDatePreset('custom');
    setSelectedDate(newDate);
    setSelectedEndDate(newDate);
  };

  const handleDateStep = (days: number) => {
    if (!isOwner) return; // Staff locked to today
    setLoading(true);
    const today = getTodaySriLanka();

    if (selectedDate === selectedEndDate) {
      const d = new Date(`${selectedDate}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      const newD = d.toISOString().split('T')[0] || selectedDate;
      if (days > 0 && newD > today) return;
      setSelectedDate(newD);
      setSelectedEndDate(newD);
    } else {
      const d1 = new Date(`${selectedDate}T12:00:00Z`);
      const d2 = new Date(`${selectedEndDate}T12:00:00Z`);
      d1.setUTCDate(d1.getUTCDate() + days);
      d2.setUTCDate(d2.getUTCDate() + days);
      const newFrom = d1.toISOString().split('T')[0] || selectedDate;
      const newTo = d2.toISOString().split('T')[0] || selectedEndDate;
      if (days > 0 && newTo > today) return;
      setSelectedDate(newFrom);
      setSelectedEndDate(newTo);
    }
    setDatePreset('custom');
  };

  // ==========================================
  // TAB 0: OWNER SHIFT TALLY & ADJUSTMENTS STATE
  // ==========================================
  const [shiftAdjustments, setShiftAdjustments] = useState<ShiftFinancialAdjustmentDto[]>([]);
  const [expandedDenomsShiftId, setExpandedDenomsShiftId] = useState<string | null>(null);
  const [adjustmentDateScope, setAdjustmentDateScope] = useState<'selected_date' | 'all'>('selected_date');

  // ==========================================
  // TAB 1: ADMIN MULTI-BRANCH SUMMARY STATE
  // ==========================================
  const [summaryPreset, setSummaryPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [summaryStartDate, setSummaryStartDate] = useState<string>('');
  const [summaryEndDate, setSummaryEndDate] = useState<string>('');
  const [summaryBranchId, setSummaryBranchId] = useState<string>(activeBranchFilter);
  const [summaryStatus, setSummaryStatus] = useState<string>('all');
  const [consolidatedSummaries, setConsolidatedSummaries] = useState<ConsolidatedReconciliationRow[]>([]);
  const [selectedRecForDenoms, setSelectedRecForDenoms] = useState<ConsolidatedReconciliationRow | null>(null);

  // ==========================================
  // TAB 2: BANK DEPOSIT REGISTER STATE
  // ==========================================
  const [bankFilterBank, setBankFilterBank] = useState<string>('ALL');
  const [bankFilterBranch, setBankFilterBranch] = useState<string>(activeBranchFilter);
  const [bankSearch, setBankSearch] = useState<string>('');
  const [consolidatedBankDeposits, setConsolidatedBankDeposits] = useState<ConsolidatedBankDepositRow[]>([]);

  // ==========================================
  // TAB 3: CASHIER SHORTAGES STATE & CONTROLS
  // ==========================================
  const ACTIVE_STAFF = ['Anusha', 'Gindika', 'Kumari', 'Shashini', 'Tharindu'];
  const [shortageCashierFilter, setShortageCashierFilter] = useState<string>('ALL');
  const [shortageBranchFilter, setShortageBranchFilter] = useState<string>(activeBranchFilter);
  const [shortageStatusFilter, setShortageStatusFilter] = useState<'all' | 'pending_payroll' | 'deducted'>('all');
  const [shortageVarianceTypeFilter, setShortageVarianceTypeFilter] = useState<'shortages' | 'excess' | 'all'>('shortages');
  const [shortageSearchQuery, setShortageSearchQuery] = useState<string>('');
  const [shortageSortField, setShortageSortField] = useState<'date' | 'cashier' | 'branch' | 'shift' | 'expected' | 'actual' | 'shortage'>('date');
  const [shortageSortDir, setShortageSortDir] = useState<'asc' | 'desc'>('desc');
  const [consolidatedShortages, setConsolidatedShortages] = useState<CashierShortageRow[]>([]);

  // ==========================================
  // TAB 4: DAILY ACCOUNTS LEDGER STATE
  // ==========================================
  const [ledgerBranchFilter, setLedgerBranchFilter] = useState<string>(activeBranchFilter);
  const [consolidatedLedger, setConsolidatedLedger] = useState<ConsolidatedLedgerRow[]>([]);

  // ==========================================
  // TAB 5: WORKSHEET STATE (Interactive Count)
  // ==========================================
  const [openingFloatA, setOpeningFloatA] = useState<number>(0);
  const [isFloatLocked, setIsFloatLocked] = useState<boolean>(true);
  const [cashExpensesB, setCashExpensesB] = useState<number>(0);

  // 11 Sri Lanka Denominations
  const [denominations, setDenominations] = useState<Record<number, number>>({
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });

  // Bank Deposits List (E)
  const [bankDeposits, setBankDeposits] = useState<BankDepositItem[]>([
    { bank_name: 'BOC', account_number: '84200192', account_name: 'Deegayu Weda Madhura (Pvt) Ltd', amount: 0 },
  ]);

  // System Cash Sales & Cashier data
  const [systemCashSales, setSystemCashSales] = useState<number>(0);
  const [cashierSummaries, setCashierSummaries] = useState<CashierSalesSummary[]>([]);
  const [shortageSplit, setShortageSplit] = useState<Record<string, number>>({});
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [existingRecord, setExistingRecord] = useState<DailyCashReconciliationRecord | null>(null);

  // Company Bank accounts catalog
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccountRecord[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [newAccountForm, setNewAccountForm] = useState({
    bank_name: 'BOC',
    account_number: '',
    account_name: '',
    branch_name: '',
  });

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // ==========================================
  // CSV EXPORT UTILITY
  // ==========================================
  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // COUNTING MODE (Already Banked vs Before Banking)
  // ==========================================
  // Option A (Default): 'after_banking' — Cashier has already banked cash today (E).
  // Denomination counter = F (cash remaining in drawer for tomorrow).
  // Total cash accounted C = F + E.
  // Option B: 'before_banking' — Cashier counts entire drawer before banking.
  // Denomination counter = C (total cash before banking).
  // Cash remaining for tomorrow F = C - E.
  const [countMode, setCountMode] = useState<'after_banking' | 'before_banking'>('after_banking');

  // ==========================================
  // CALCULATIONS (Formulas A, B, C, D, E, F, Variance)
  // ==========================================
  const countedDenominationsTotal = useMemo(() => {
    return SRI_LANKA_DENOMINATIONS.reduce((sum, denom) => {
      const count = denominations[denom] || 0;
      return sum + denom * count;
    }, 0);
  }, [denominations]);

  const totalBankDepositsE = useMemo(() => {
    return bankDeposits.reduce((sum, dep) => sum + (Number(dep.amount) || 0), 0);
  }, [bankDeposits]);

  const modakaSalesTotal = useMemo(() => {
    return Number(worksheetData.modakaSalesTotal || 0);
  }, [worksheetData.modakaSalesTotal]);

  const totalExpectedSalesCash = useMemo(() => {
    return Number((systemCashSales + modakaSalesTotal).toFixed(2));
  }, [systemCashSales, modakaSalesTotal]);

  const physicalCashC = useMemo(() => {
    if (worksheetData?.isHistorical && !existingRecord && countedDenominationsTotal === 0) {
      return totalExpectedSalesCash;
    }
    if (countMode === 'after_banking') {
      return countedDenominationsTotal + totalBankDepositsE;
    }
    return countedDenominationsTotal;
  }, [countMode, countedDenominationsTotal, totalBankDepositsE, worksheetData?.isHistorical, existingRecord, totalExpectedSalesCash]);

  const closingCashF = useMemo(() => {
    if (worksheetData?.isHistorical && !existingRecord && countedDenominationsTotal === 0) {
      return Math.max(0, totalExpectedSalesCash - totalBankDepositsE);
    }
    if (countMode === 'after_banking') {
      return countedDenominationsTotal;
    }
    return countedDenominationsTotal - totalBankDepositsE;
  }, [countMode, countedDenominationsTotal, totalBankDepositsE, worksheetData?.isHistorical, existingRecord, totalExpectedSalesCash]);

  const actualNetIncomeD = useMemo(() => {
    if (worksheetData?.isHistorical && !existingRecord && countedDenominationsTotal === 0) {
      return totalExpectedSalesCash;
    }
    return physicalCashC + (Number(cashExpensesB) || 0) - (Number(openingFloatA) || 0);
  }, [physicalCashC, cashExpensesB, openingFloatA, worksheetData?.isHistorical, existingRecord, countedDenominationsTotal, totalExpectedSalesCash]);

  const varianceAmount = useMemo(() => {
    if (worksheetData?.isHistorical && !existingRecord && countedDenominationsTotal === 0) {
      return 0;
    }
    return Number((totalExpectedSalesCash - actualNetIncomeD).toFixed(2));
  }, [totalExpectedSalesCash, actualNetIncomeD, worksheetData?.isHistorical, existingRecord, countedDenominationsTotal]);

  const varianceStatus = useMemo((): 'balanced' | 'shortage' | 'overage' => {
    if (Math.abs(varianceAmount) < 0.01) return 'balanced';
    return varianceAmount > 0 ? 'shortage' : 'overage';
  }, [varianceAmount]);

  // Branch display name helper
  const getBranchName = useCallback(
    (bId?: string | null) => {
      if (!bId) return 'Main Branch';
      const b = branches.find((item) => item.id === bId);
      return b?.name || 'Main Branch';
    },
    [branches]
  );

  // 5 Executive Shift Tally KPIs (calculated for the selected branch & date)
  const shiftTallyKPIs = useMemo(() => {
    const shifts = worksheetData.shifts || [];

    const filteredShifts =
      activeBranchFilter === 'ALL'
        ? shifts
        : shifts.filter((s) => s.branch_id === activeBranchFilter);

    // 1. Total Cash Inflow: Opening Float + POS Cash Sales + Special Stock Sales
    const totalOpeningFloat = filteredShifts.reduce((sum, s) => sum + (s.opening_float || 0), 0);
    const totalPosCash = filteredShifts.reduce((sum, s) => sum + (s.pos_cash_sales || 0), 0);
    const totalSpecialSales = filteredShifts.reduce((sum, s) => sum + (s.modaka_total_amount || 0), 0);

    const totalCashInflow =
      filteredShifts.length > 0
        ? totalOpeningFloat + totalPosCash + totalSpecialSales
        : (worksheetData.previousClosingF || 0) + worksheetData.systemCashSales + worksheetData.modakaSalesTotal;

    // 2. Banked & Paid Out: Bank Deposits + Goods Purchased Paid Out + Other Expenses
    const totalBanked = filteredShifts.reduce((sum, s) => sum + (s.banked_amount || 0), 0);
    const totalGoodsPaid = filteredShifts.reduce((sum, s) => sum + (s.goods_purchased_paid || 0), 0);
    const totalOtherExpenses = filteredShifts.reduce((sum, s) => sum + (s.other_expenses || 0), 0);
    const totalPaidOut = totalBanked + totalGoodsPaid + totalOtherExpenses;

    // 3. Counted Remaining Drawer: Physical notes counted (carried forward to next shift)
    const totalCountedRemaining = filteredShifts.reduce(
      (sum, s) => sum + (s.counted_remaining_drawer_cash || s.counted_drawer_cash || 0),
      0
    );

    // 4. Staff Salary Deductions (Shortages)
    const shortageShifts = filteredShifts.filter((s) => (s.cash_variance || 0) < -0.01);
    const totalShortageAmount = shortageShifts.reduce(
      (sum, s) => sum + Math.abs(s.salary_deduction_amount || s.cash_variance || 0),
      0
    );

    // 5. Extra Income (Cash Excess)
    const excessShifts = filteredShifts.filter((s) => (s.cash_variance || 0) > 0.01);
    const totalExcessAmount = excessShifts.reduce(
      (sum, s) => sum + (s.extra_income_amount || s.cash_variance || 0),
      0
    );

    return {
      filteredShifts,
      totalOpeningFloat,
      totalPosCash,
      totalSpecialSales,
      totalCashInflow,
      totalBanked,
      totalGoodsPaid,
      totalOtherExpenses,
      totalPaidOut,
      totalCountedRemaining,
      totalShortageAmount,
      shortageShiftsCount: shortageShifts.length,
      totalExcessAmount,
      excessShiftsCount: excessShifts.length,
    };
  }, [worksheetData, activeBranchFilter]);

  // Aggregated Salary Deductions Log
  const salaryDeductionsLog = useMemo(() => {
    // 1. From recorded shift financial adjustments
    const adjItems = shiftAdjustments
      .filter((a) => a.adjustmentType === 'salary_deduction' || (a.adjustmentType as any) === 'SHORTAGE')
      .map((a) => ({
        id: a.id,
        date: a.adjustmentDate,
        branchId: a.branchId,
        branchName: getBranchName(a.branchId),
        shiftNumber: a.shiftNumber || 1,
        employeeName: a.employeeName || 'Staff Cashier',
        amount: a.amount,
        notes: a.notes || 'Recorded via shift cash shortage',
        shiftId: a.shiftId,
      }));

    // 2. From shifts on the selected date that might not have a formal adjustment row yet
    const shiftDeductions = (worksheetData.shifts || [])
      .filter((s) => (s.cash_variance || 0) < -0.01)
      .filter((s) => !adjItems.some((a) => a.shiftId === s.id))
      .map((s) => ({
        id: `shift-${s.id}`,
        date: s.shift_date,
        branchId: s.branch_id,
        branchName: s.branch_name || getBranchName(s.branch_id),
        shiftNumber: s.shift_number,
        employeeName: s.cashier_name,
        amount: Math.abs(s.salary_deduction_amount || s.cash_variance),
        notes: s.handover_notes || 'Shift cash shortage recorded at shift handover',
        shiftId: s.id,
      }));

    const combined = [...adjItems, ...shiftDeductions];

    // Filter by branch
    const branchFiltered =
      activeBranchFilter === 'ALL'
        ? combined
        : combined.filter((i) => i.branchId === activeBranchFilter);

    // Filter by date scope
    if (adjustmentDateScope === 'selected_date') {
      return branchFiltered.filter((i) => i.date >= selectedDate && i.date <= selectedEndDate);
    }
    return branchFiltered;
  }, [shiftAdjustments, worksheetData.shifts, activeBranchFilter, adjustmentDateScope, selectedDate, selectedEndDate, getBranchName]);

  // Aggregated Extra Income Log
  const extraIncomeLog = useMemo(() => {
    // 1. From recorded shift financial adjustments
    const adjItems = shiftAdjustments
      .filter((a) => a.adjustmentType === 'extra_income' || (a.adjustmentType as any) === 'EXCESS')
      .map((a) => ({
        id: a.id,
        date: a.adjustmentDate,
        branchId: a.branchId,
        branchName: getBranchName(a.branchId),
        shiftNumber: a.shiftNumber || 1,
        employeeName: a.employeeName || 'Staff Cashier',
        amount: a.amount,
        notes: a.notes || 'Recorded via shift cash excess',
        shiftId: a.shiftId,
      }));

    // 2. From shifts on the selected date that might not have a formal adjustment row yet
    const shiftExcesses = (worksheetData.shifts || [])
      .filter((s) => (s.cash_variance || 0) > 0.01)
      .filter((s) => !adjItems.some((a) => a.shiftId === s.id))
      .map((s) => ({
        id: `shift-excess-${s.id}`,
        date: s.shift_date,
        branchId: s.branch_id,
        branchName: s.branch_name || getBranchName(s.branch_id),
        shiftNumber: s.shift_number,
        employeeName: s.cashier_name,
        amount: s.extra_income_amount || s.cash_variance,
        notes: s.handover_notes || 'Shift cash excess recorded at shift handover',
        shiftId: s.id,
      }));

    const combined = [...adjItems, ...shiftExcesses];

    // Filter by branch
    const branchFiltered =
      activeBranchFilter === 'ALL'
        ? combined
        : combined.filter((i) => i.branchId === activeBranchFilter);

    // Filter by date scope
    if (adjustmentDateScope === 'selected_date') {
      return branchFiltered.filter((i) => i.date >= selectedDate && i.date <= selectedEndDate);
    }
    return branchFiltered;
  }, [shiftAdjustments, worksheetData.shifts, activeBranchFilter, adjustmentDateScope, selectedDate, selectedEndDate, getBranchName]);

  // ==========================================
  // UNIFIED CASHIER VARIANCE & SHORTAGE LEDGER
  // ==========================================
  const shortageLedgerRows = useMemo(() => {
    const list: Array<{
      id: string;
      shiftId?: string;
      date: string;
      branchId: string;
      branchName: string;
      shiftNumber: number;
      shiftLabel: string;
      cashierName: string;
      expectedCash: number;
      actualCash: number;
      variance: number;
      shortageAmount: number;
      excessAmount: number;
      varianceType: 'shortage' | 'excess' | 'balanced';
      deductionStatus: 'pending_payroll' | 'deducted' | 'settled';
      notes: string;
      status: string;
    }> = [];

    const shifts = worksheetData.shifts || [];
    shifts.forEach((sh) => {
      const shiftInflow = (sh.opening_float || 0) + (sh.pos_cash_sales || 0) + (sh.modaka_total_amount || 0);
      const shiftOutflow = (sh.goods_purchased_paid || 0) + (sh.other_expenses || 0) + (sh.banked_amount || 0);
      const countedDrawer = Number(sh.counted_remaining_drawer_cash ?? sh.counted_drawer_cash ?? 0);
      const expectedDrawer = Number(sh.expected_remaining_drawer_cash ?? (shiftInflow - shiftOutflow));
      const variance = Number(sh.cash_variance !== undefined ? sh.cash_variance : (countedDrawer - expectedDrawer));
      const shortage = variance < -0.01 ? Math.abs(Number(sh.salary_deduction_amount) || variance) : 0;
      const excess = variance > 0.01 ? (Number(sh.extra_income_amount) || variance) : 0;
      const vType: 'shortage' | 'excess' | 'balanced' = variance < -0.01 ? 'shortage' : variance > 0.01 ? 'excess' : 'balanced';

      list.push({
        id: `shift-${sh.id}`,
        shiftId: sh.id,
        date: sh.shift_date,
        branchId: sh.branch_id,
        branchName: sh.branch_name || getBranchName(sh.branch_id),
        shiftNumber: sh.shift_number || 1,
        shiftLabel: formatShiftLabel(sh.shift_number),
        cashierName: sh.cashier_name || 'Staff Cashier',
        expectedCash: expectedDrawer,
        actualCash: countedDrawer,
        variance,
        shortageAmount: shortage,
        excessAmount: excess,
        varianceType: vType,
        deductionStatus: 'pending_payroll',
        notes: sh.handover_notes || '',
        status: sh.status,
      });
    });

    // Also include recorded adjustments if any
    shiftAdjustments.forEach((adj) => {
      if (adj.shiftId && list.some((item) => item.shiftId === adj.shiftId)) return;
      const isShortage = adj.adjustmentType === 'salary_deduction';
      list.push({
        id: `adj-${adj.id}`,
        shiftId: adj.shiftId || undefined,
        date: adj.adjustmentDate,
        branchId: adj.branchId,
        branchName: getBranchName(adj.branchId),
        shiftNumber: adj.shiftNumber || 1,
        shiftLabel: formatShiftLabel(adj.shiftNumber),
        cashierName: adj.employeeName || 'Staff Cashier',
        expectedCash: 0,
        actualCash: 0,
        variance: isShortage ? -adj.amount : adj.amount,
        shortageAmount: isShortage ? adj.amount : 0,
        excessAmount: !isShortage ? adj.amount : 0,
        varianceType: isShortage ? 'shortage' : 'excess',
        deductionStatus: 'pending_payroll',
        notes: adj.notes || '',
        status: 'closed',
      });
    });

    // 1. Filter by Variance Type
    let result = list;
    if (shortageVarianceTypeFilter === 'shortages') {
      result = result.filter((i) => i.varianceType === 'shortage' || i.shortageAmount > 0);
    } else if (shortageVarianceTypeFilter === 'excess') {
      result = result.filter((i) => i.varianceType === 'excess' || i.excessAmount > 0);
    }

    // 2. Filter by Cashier
    if (shortageCashierFilter !== 'ALL') {
      result = result.filter((i) => i.cashierName.toLowerCase().includes(shortageCashierFilter.toLowerCase()));
    }

    // 3. Filter by Branch
    if (shortageBranchFilter !== 'ALL') {
      result = result.filter((i) => i.branchId === shortageBranchFilter || i.branchName === shortageBranchFilter);
    }

    // 4. Filter by Deduction Status
    if (shortageStatusFilter !== 'all') {
      result = result.filter((i) => i.deductionStatus === shortageStatusFilter);
    }

    // 5. Search Filter
    if (shortageSearchQuery.trim()) {
      const q = shortageSearchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.cashierName.toLowerCase().includes(q) ||
          i.branchName.toLowerCase().includes(q) ||
          i.shiftLabel.toLowerCase().includes(q) ||
          i.date.includes(q) ||
          i.notes.toLowerCase().includes(q)
      );
    }

    // 6. Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (shortageSortField === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (shortageSortField === 'cashier') {
        comparison = a.cashierName.localeCompare(b.cashierName);
      } else if (shortageSortField === 'branch') {
        comparison = a.branchName.localeCompare(b.branchName);
      } else if (shortageSortField === 'shift') {
        comparison = a.shiftNumber - b.shiftNumber;
      } else if (shortageSortField === 'expected') {
        comparison = a.expectedCash - b.expectedCash;
      } else if (shortageSortField === 'actual') {
        comparison = a.actualCash - b.actualCash;
      } else if (shortageSortField === 'shortage') {
        comparison = a.shortageAmount - b.shortageAmount;
      }
      return shortageSortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [
    worksheetData.shifts,
    shiftAdjustments,
    shortageVarianceTypeFilter,
    shortageCashierFilter,
    shortageBranchFilter,
    shortageStatusFilter,
    shortageSearchQuery,
    shortageSortField,
    shortageSortDir,
    getBranchName,
  ]);

  // Per-Employee Shortage Summary for Active Staff
  const staffShortageSummary = useMemo(() => {
    const summary: Record<string, { count: number; totalShortage: number }> = {};
    ACTIVE_STAFF.forEach((name) => {
      summary[name] = { count: 0, totalShortage: 0 };
    });

    const allShifts = worksheetData.shifts || [];
    allShifts.forEach((sh) => {
      const counted = Number(sh.counted_remaining_drawer_cash ?? sh.counted_drawer_cash ?? 0);
      const shiftInflow = (sh.opening_float || 0) + (sh.pos_cash_sales || 0) + (sh.modaka_total_amount || 0);
      const shiftOutflow = (sh.goods_purchased_paid || 0) + (sh.other_expenses || 0) + (sh.banked_amount || 0);
      const expected = Number(sh.expected_remaining_drawer_cash ?? (shiftInflow - shiftOutflow));
      const variance = Number(sh.cash_variance !== undefined ? sh.cash_variance : (counted - expected));
      if (variance < -0.01) {
        const amt = Math.abs(Number(sh.salary_deduction_amount) || variance);
        const name = sh.cashier_name || '';
        const matchedStaff = ACTIVE_STAFF.find((s) => name.toLowerCase().includes(s.toLowerCase()));
        if (matchedStaff && summary[matchedStaff]) {
          summary[matchedStaff].count += 1;
          summary[matchedStaff].totalShortage += amt;
        }
      }
    });

    return summary;
  }, [worksheetData.shifts]);

  const handleSortClick = (field: 'date' | 'cashier' | 'branch' | 'shift' | 'expected' | 'actual' | 'shortage') => {
    if (shortageSortField === field) {
      setShortageSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setShortageSortField(field);
      setShortageSortDir(field === 'date' || field === 'shortage' ? 'desc' : 'asc');
    }
  };

  const renderSortIndicator = (field: 'date' | 'cashier' | 'branch' | 'shift' | 'expected' | 'actual' | 'shortage') => {
    if (shortageSortField !== field) {
      return <span className="opacity-30 ml-1 text-[10px]">↕</span>;
    }
    return <span className="text-amber-400 font-black ml-1 text-xs">{shortageSortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const exportShortagesCsv = () => {
    const filename = `deegayu-cashier-shortages-${selectedDate}-to-${selectedEndDate}`;
    const headers = [
      'Date',
      'Branch',
      'Shift',
      'Cashier Name',
      'Expected Cash (LKR)',
      'Actual Counted/Banked (LKR)',
      'Variance (LKR)',
      'Shortage Amount (LKR)',
      'Variance Type',
      'Handover Remarks',
    ];
    const rows = shortageLedgerRows.map((r) => [
      r.date,
      r.branchName,
      r.shiftLabel,
      r.cashierName,
      r.expectedCash.toFixed(2),
      r.actualCash.toFixed(2),
      r.variance.toFixed(2),
      r.shortageAmount.toFixed(2),
      r.varianceType.toUpperCase(),
      (r.notes || '').replace(/[\r\n]+/g, ' '),
    ]);
    exportCsv(filename, headers, rows);
  };

  const exportDetailedReconciliationCsv = () => {
    const branchName = activeBranchFilter === 'ALL' ? 'all-branches' : getBranchName(activeBranchFilter).toLowerCase().replace(/\s+/g, '-');
    const filename = `deegayu-reconciliation-${branchName}-${selectedDate}-to-${selectedEndDate}`;
    
    // KPI Summary Block
    const summaryLines = [
      ['DEEGAYU WEDA MADHURA - CONSOLIDATED CASH RECONCILIATION REPORT'],
      ['Generated At', new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })],
      ['Branch Scope', activeBranchFilter === 'ALL' ? 'All Branches' : getBranchName(activeBranchFilter)],
      ['Date Range', `${selectedDate} to ${selectedEndDate}`],
      ['Total Shifts Recorded', shiftTallyKPIs.filteredShifts.length],
      ['Total Cash Inflow (LKR)', shiftTallyKPIs.totalCashInflow.toFixed(2)],
      ['Total POS Cash Sales (LKR)', shiftTallyKPIs.totalPosCash.toFixed(2)],
      ['Total Special Stock Sales (LKR)', shiftTallyKPIs.totalSpecialSales.toFixed(2)],
      ['Total Bank Deposits (LKR)', shiftTallyKPIs.totalBanked.toFixed(2)],
      ['Total Goods Purchased Paid Out (LKR)', shiftTallyKPIs.totalGoodsPaid.toFixed(2)],
      ['Total Other Expenses (LKR)', shiftTallyKPIs.totalOtherExpenses.toFixed(2)],
      ['Total Cash Shortages (LKR)', shiftTallyKPIs.totalShortageAmount.toFixed(2)],
      ['Total Excess Amount (LKR)', shiftTallyKPIs.totalExcessAmount.toFixed(2)],
      [],
      ['DETAILED SHIFT-BY-SHIFT BREAKDOWN'],
    ];

    const headers = [
      'Date',
      'Branch',
      'Shift',
      'Cashier Name',
      'Opened At (Asia/Colombo)',
      'Closed At (Asia/Colombo)',
      'Status',
      'Opening Float (LKR)',
      'POS Cash Sales (LKR)',
      'Special Stock Units',
      'Special Stock Sales (LKR)',
      'Total Cash Inflow (LKR)',
      'Goods Purchased Paid Out (LKR)',
      'Other Expenses (LKR)',
      'Bank Deposit Amount (LKR)',
      'Deposit Bank Account',
      'Expected Closing Drawer (LKR)',
      'Counted / Remaining Drawer Float (LKR)',
      'Variance (LKR)',
      'Variance Type',
      'Handover Remarks',
    ];

    const rows = shiftTallyKPIs.filteredShifts.map((sh) => {
      const shiftInflow = (sh.opening_float || 0) + (sh.pos_cash_sales || 0) + (sh.modaka_total_amount || 0);
      const countedDrawer = sh.counted_remaining_drawer_cash || sh.counted_drawer_cash || 0;
      const expectedDrawer = (sh.expected_remaining_drawer_cash ?? (shiftInflow - (sh.goods_purchased_paid || 0) - (sh.other_expenses || 0) - (sh.banked_amount || 0))) || 0;
      const variance = sh.cash_variance !== undefined ? sh.cash_variance : (countedDrawer - expectedDrawer);
      const varType = variance === 0 ? 'Balanced' : variance < 0 ? 'Shortage' : 'Excess';

      const openedAtStr = sh.started_at
        ? new Date(sh.started_at).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })
        : '—';
      const closedAtStr = sh.ended_at
        ? new Date(sh.ended_at).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })
        : 'Active / Open';

      return [
        sh.shift_date,
        sh.branch_name,
        formatShiftLabel(sh.shift_number),
        sh.cashier_name,
        openedAtStr,
        closedAtStr,
        sh.status,
        (sh.opening_float || 0).toFixed(2),
        (sh.pos_cash_sales || 0).toFixed(2),
        sh.modaka_total_sold_qty || 0,
        (sh.modaka_total_amount || 0).toFixed(2),
        shiftInflow.toFixed(2),
        (sh.goods_purchased_paid || 0).toFixed(2),
        (sh.other_expenses || 0).toFixed(2),
        (sh.banked_amount || 0).toFixed(2),
        (sh as any).bank_account_details || '—',
        expectedDrawer.toFixed(2),
        countedDrawer.toFixed(2),
        variance.toFixed(2),
        varType,
        (sh.handover_notes || '').replace(/[\r\n]+/g, ' '),
      ];
    });

    const csvLines = [
      ...summaryLines.map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    ];

    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // DATA LOADING ENGINE
  // ==========================================
  const loadAllData = useCallback(async (isBackground = false) => {
    const fetchId = ++fetchIdRef.current;
    if (!isBackground) {
      setLoading(true);
      setSaveSuccessMsg(null);
    }

    try {
      // =========================================================================
      // STAFF MODE: ZERO MULTI-BRANCH DATA LEAKS
      // If role !== 'OWNER', restrict strictly to today's assigned branch worksheet
      // =========================================================================
      if (!isOwner) {
        const todayStr = getTodaySriLanka();
        setSelectedDate(todayStr);

        // Fetch company bank accounts for the deposit dropdown
        const bankAccs = await reconciliationApi.getBankAccounts(tenantId);
        if (fetchId !== fetchIdRef.current) return;
        setCompanyBankAccounts((prev) => (JSON.stringify(prev) !== JSON.stringify(bankAccs) ? bankAccs : prev));

        if (effectiveBranchId) {
          const worksheet = await reconciliationApi.loadReconciliationWorksheet(effectiveBranchId, todayStr);
          if (fetchId !== fetchIdRef.current) return;

          if (!isBackground) {
            setWorksheetData(worksheet);
            setSystemCashSales(worksheet.systemCashSales);
            setCashierSummaries(worksheet.cashierBreakdown);

            if (worksheet.existingRec) {
              const rec = worksheet.existingRec;
              setExistingRecord(rec);
              setOpeningFloatA(Number(rec.opening_float_a) || 0);
              setCashExpensesB(Number(rec.cash_expenses_b) || 0);
              setGeneralNotes(rec.notes || '');

              if (rec.denominations && typeof rec.denominations === 'object') {
                const loadedDenoms: Record<number, number> = {};
                SRI_LANKA_DENOMINATIONS.forEach((d) => {
                  loadedDenoms[d] = Number((rec.denominations as any)[d]) || 0;
                });
                setDenominations(loadedDenoms);
              }

              if (worksheet.existingDeposits.length > 0) {
                setBankDeposits(worksheet.existingDeposits);
              }
              setIsFloatLocked(true);
            } else {
              setExistingRecord(null);
              if (worksheet.previousClosingF !== null) {
                setOpeningFloatA(worksheet.previousClosingF);
                setIsFloatLocked(true);
              } else {
                setOpeningFloatA(0);
                setIsFloatLocked(false);
              }

              setCashExpensesB(worksheet.autoCashExpenses);

              const initialDenoms: Record<number, number> = {};
              SRI_LANKA_DENOMINATIONS.forEach((d) => {
                initialDenoms[d] = 0;
              });
              setDenominations(initialDenoms);

              const firstAcc = bankAccs[0];
              if (firstAcc) {
                setBankDeposits([
                  {
                    bank_name: firstAcc.bank_name,
                    account_number: firstAcc.account_number,
                    account_name: firstAcc.account_name,
                    amount: 0,
                  },
                ]);
              }
            }
          } else {
            // Background sync: silently update live register cash sales & cashier tallies without resetting user input
            setSystemCashSales((prev) => (prev !== worksheet.systemCashSales ? worksheet.systemCashSales : prev));
            setCashierSummaries((prev) =>
              JSON.stringify(prev) !== JSON.stringify(worksheet.cashierBreakdown) ? worksheet.cashierBreakdown : prev
            );
            setWorksheetData((prev) => ({
              ...prev,
              systemCashSales: worksheet.systemCashSales,
              cashierBreakdown: worksheet.cashierBreakdown,
              shifts: worksheet.shifts,
            }));
          }
        }
        return;
      }

      // Compute date filters for Admin Summary
      let sDate: string | undefined = undefined;
      let eDate: string | undefined = undefined;

      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const slTime = new Date(utcTime + 5.5 * 3600000);
      const todayStr = slTime.toISOString().split('T')[0] || '';

      if (summaryPreset === 'today') {
        sDate = todayStr;
        eDate = todayStr;
      } else if (summaryPreset === 'yesterday') {
        const y = new Date(slTime.getTime() - 86400000);
        sDate = y.toISOString().split('T')[0] || '';
        eDate = sDate;
      } else if (summaryPreset === 'week') {
        const w = new Date(slTime.getTime() - 7 * 86400000);
        sDate = w.toISOString().split('T')[0] || '';
        eDate = todayStr;
      } else if (summaryPreset === 'month') {
        const yyyy = slTime.getFullYear();
        const mm = String(slTime.getMonth() + 1).padStart(2, '0');
        sDate = `${yyyy}-${mm}-01`;
        eDate = todayStr;
      } else if (summaryPreset === 'custom') {
        sDate = summaryStartDate || undefined;
        eDate = summaryEndDate || undefined;
      }

      // 1. Fetch Company Bank Accounts
      const bankAccs = await reconciliationApi.getBankAccounts(tenantId);
      if (fetchId !== fetchIdRef.current) return;
      setCompanyBankAccounts((prev) => (JSON.stringify(prev) !== JSON.stringify(bankAccs) ? bankAccs : prev));

      // 2. Fetch Multi-Branch Reconciliations
      const recHistory = await reconciliationApi.getReconciliationHistory({
        branchId: summaryBranchId !== 'ALL' ? summaryBranchId : undefined,
        startDate: sDate,
        endDate: eDate,
        status: summaryStatus !== 'all' ? summaryStatus : undefined,
      });
      if (fetchId !== fetchIdRef.current) return;
      setConsolidatedSummaries((prev) => (JSON.stringify(prev) !== JSON.stringify(recHistory) ? recHistory : prev));

      // 3. Fetch Consolidated Bank Deposits
      const depositsReport = await reconciliationApi.getBankDepositsReport({
        branchId: bankFilterBranch !== 'ALL' ? bankFilterBranch : undefined,
        bankName: bankFilterBank !== 'ALL' ? bankFilterBank : undefined,
        startDate: sDate,
        endDate: eDate,
      });
      if (fetchId !== fetchIdRef.current) return;
      setConsolidatedBankDeposits((prev) =>
        JSON.stringify(prev) !== JSON.stringify(depositsReport) ? depositsReport : prev
      );

      // 4. Fetch Consolidated Shortages
      const shortagesReport = await reconciliationApi.getShortagesReport({
        branchId: shortageBranchFilter !== 'ALL' ? shortageBranchFilter : undefined,
        cashierName: shortageCashierFilter !== 'ALL' ? shortageCashierFilter : undefined,
        statusFilter: shortageStatusFilter,
        startDate: sDate,
        endDate: eDate,
      });
      if (fetchId !== fetchIdRef.current) return;
      setConsolidatedShortages((prev) =>
        JSON.stringify(prev) !== JSON.stringify(shortagesReport) ? shortagesReport : prev
      );

      // 5. Fetch Consolidated Ledger
      const ledgerReport = await reconciliationApi.getConsolidatedLedger({
        branchId: ledgerBranchFilter !== 'ALL' ? ledgerBranchFilter : undefined,
        startDate: sDate,
        endDate: eDate,
        limit: 50,
      });
      if (fetchId !== fetchIdRef.current) return;
      setConsolidatedLedger((prev) =>
        JSON.stringify(prev) !== JSON.stringify(ledgerReport) ? ledgerReport : prev
      );

      // 6. Load Worksheet for the selected date & branch
      const branchParam = activeBranchFilter || 'ALL';
      const worksheet = await reconciliationApi.loadReconciliationWorksheet(branchParam, selectedDate, selectedEndDate);
      if (fetchId !== fetchIdRef.current) return;

      if (!isBackground) {
        setWorksheetData(worksheet);
        setSystemCashSales(worksheet.systemCashSales);
        setCashierSummaries(worksheet.cashierBreakdown);

        if (worksheet.existingRec) {
          const rec = worksheet.existingRec;
          setExistingRecord(rec);
          setOpeningFloatA(Number(rec.opening_float_a) || 0);
          setCashExpensesB(Number(rec.cash_expenses_b) || 0);
          setGeneralNotes(rec.notes || '');

          if (rec.denominations && typeof rec.denominations === 'object') {
            const loadedDenoms: Record<number, number> = {};
            SRI_LANKA_DENOMINATIONS.forEach((d) => {
              loadedDenoms[d] = Number((rec.denominations as any)[d]) || 0;
            });
            setDenominations(loadedDenoms);
          }

          if (worksheet.existingDeposits.length > 0) {
            setBankDeposits(worksheet.existingDeposits);
          }
          setIsFloatLocked(true);
        } else {
          setExistingRecord(null);
          if (worksheet.isHistorical) {
            setOpeningFloatA(0);
            setIsFloatLocked(true);
            setCashExpensesB(worksheet.autoCashExpenses);
          } else if (worksheet.previousClosingF !== null) {
            setOpeningFloatA(worksheet.previousClosingF);
            setIsFloatLocked(true);
            setCashExpensesB(worksheet.autoCashExpenses);
          } else {
            setOpeningFloatA(0);
            setIsFloatLocked(false);
            setCashExpensesB(worksheet.autoCashExpenses);
          }

          const initialDenoms: Record<number, number> = {};
          SRI_LANKA_DENOMINATIONS.forEach((d) => {
            initialDenoms[d] = 0;
          });
          setDenominations(initialDenoms);

          if (worksheet.existingDeposits.length > 0) {
            setBankDeposits(worksheet.existingDeposits);
          } else {
            const firstAcc = bankAccs[0];
            if (firstAcc) {
              setBankDeposits([
                {
                  bank_name: firstAcc.bank_name,
                  account_number: firstAcc.account_number,
                  account_name: firstAcc.account_name,
                  amount: 0,
                },
              ]);
            }
          }
        }
      } else {
        // Background sync: update live totals without clearing form state
        setSystemCashSales((prev) => (prev !== worksheet.systemCashSales ? worksheet.systemCashSales : prev));
        setCashierSummaries((prev) =>
          JSON.stringify(prev) !== JSON.stringify(worksheet.cashierBreakdown) ? worksheet.cashierBreakdown : prev
        );
        setWorksheetData((prev) => ({
          ...prev,
          systemCashSales: worksheet.systemCashSales,
          cashierBreakdown: worksheet.cashierBreakdown,
          shifts: worksheet.shifts,
        }));
      }

      // 7. Load Shift Financial Adjustments (Shortages & Extra Income for Owner)
      try {
        const adjRes = await shiftsApi.getShiftFinancialAdjustments({
          branchId: activeBranchFilter !== 'ALL' ? activeBranchFilter : undefined,
          dateFrom: selectedDate,
          dateTo: selectedEndDate,
        });
        if (fetchId !== fetchIdRef.current) return;
        if (adjRes.success && adjRes.data) {
          setShiftAdjustments((prev) =>
            JSON.stringify(prev) !== JSON.stringify(adjRes.data) ? adjRes.data : prev
          );
        }
      } catch (e) {
        console.warn('[Reconciliation] Error loading shift financial adjustments:', e);
      }
    } catch (err) {
      console.error('Error loading consolidated reconciliation data:', err);
    } finally {
      if (!isBackground && fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    isOwner,
    tenantId,
    effectiveBranchId,
    activeBranchFilter,
    selectedDate,
    selectedEndDate,
    summaryPreset,
    summaryStartDate,
    summaryEndDate,
    summaryBranchId,
    summaryStatus,
    bankFilterBank,
    bankFilterBranch,
    shortageCashierFilter,
    shortageBranchFilter,
    shortageStatusFilter,
    ledgerBranchFilter,
  ]);

  useEffect(() => {
    loadAllData(false);
  }, [loadAllData]);

  // Wire Real-time sync for live bill & shift events silently in the background
  useRealtimePosSync((isBg) => loadAllData(isBg ?? true));

  // Shortage split calculation for worksheet
  useEffect(() => {
    if (varianceStatus === 'shortage' && varianceAmount > 0) {
      if (cashierSummaries.length === 1 && cashierSummaries[0]) {
        setShortageSplit({ [cashierSummaries[0].cashier_id]: varianceAmount });
      } else if (cashierSummaries.length > 1) {
        const totalCash = cashierSummaries.reduce((sum, c) => sum + c.cash_sales, 0);
        const split: Record<string, number> = {};
        if (totalCash > 0) {
          cashierSummaries.forEach((c) => {
            split[c.cashier_id] = Number(((c.cash_sales / totalCash) * varianceAmount).toFixed(2));
          });
        } else {
          const equal = Number((varianceAmount / cashierSummaries.length).toFixed(2));
          cashierSummaries.forEach((c) => {
            split[c.cashier_id] = equal;
          });
        }
        setShortageSplit(split);
      } else {
        const fallbackId = loggedInCashierId || 'submitting_cashier';
        setShortageSplit({ [fallbackId]: varianceAmount });
      }
    } else {
      setShortageSplit({});
    }
  }, [varianceAmount, varianceStatus, cashierSummaries, loggedInCashierId]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleDenominationChange = (denom: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setDenominations((prev) => ({
      ...prev,
      [denom]: num,
    }));
  };

  const handleAddDepositRow = () => {
    const firstAcc = companyBankAccounts[0];
    const defaultAcc = firstAcc || {
      bank_name: 'BOC',
      account_number: '84200192',
      account_name: 'Deegayu Weda Madhura (Pvt) Ltd',
    };
    setBankDeposits((prev) => [
      ...prev,
      {
        bank_name: defaultAcc.bank_name,
        account_number: defaultAcc.account_number,
        account_name: defaultAcc.account_name,
        amount: 0,
      },
    ]);
  };

  const handleDepositChange = (index: number, field: keyof BankDepositItem, value: any) => {
    setBankDeposits((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (!current) return prev;

      const nextItem: BankDepositItem = { ...current, [field]: value };

      if (field === 'bank_name') {
        const match = companyBankAccounts.find((a) => a.bank_name.toLowerCase() === String(value).toLowerCase());
        if (match) {
          nextItem.account_number = match.account_number;
          nextItem.account_name = match.account_name;
        }
      }

      if (field === 'account_number') {
        const match = companyBankAccounts.find((a) => a.account_number === value);
        if (match) {
          nextItem.bank_name = match.bank_name;
          nextItem.account_name = match.account_name;
        }
      }

      updated[index] = nextItem;
      return updated;
    });
  };

  const handleRemoveDepositRow = (index: number) => {
    setBankDeposits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveReconciliation = async () => {
    setSubmitting(true);
    try {
      const shortageAttributions: { cashier_id?: string; cashier_name: string; amount: number }[] = [];
      if (varianceStatus === 'shortage' && varianceAmount > 0) {
        Object.entries(shortageSplit).forEach(([cId, amt]) => {
          if (amt > 0) {
            const cashier = cashierSummaries.find((c) => c.cashier_id === cId);
            const isFallback = cId === 'unassigned' || cId === 'submitting_cashier' || cId === loggedInCashierId;
            const cashierName = (cashier ? cashier.cashier_name : loggedInCashierName) || 'Branch Cashier';
            const cashierId = isFallback ? loggedInCashierId : cId;
            shortageAttributions.push({
              cashier_id: cashierId,
              cashier_name: cashierName,
              amount: amt,
            });
          }
        });
      }

      const targetBranchId = activeBranchFilter !== 'ALL' ? activeBranchFilter : effectiveBranchId;
      if (!targetBranchId) {
        alert('Please select a specific branch before posting reconciliation.');
        setSubmitting(false);
        return;
      }

      await reconciliationApi.submitReconciliation({
        tenantId,
        branchId: targetBranchId,
        reconciliationDate: selectedDate,
        openingFloatA,
        cashExpensesB,
        denominations,
        physicalCashC,
        actualNetIncomeD,
        totalBankDepositsE,
        closingCashF,
        systemCashSales: totalExpectedSalesCash,
        varianceAmount,
        status: varianceStatus,
        notes: generalNotes,
        submittedBy: user?.id,
        bankDeposits,
        shortageAttributions,
      });

      setSaveSuccessMsg(`End-of-day cash reconciliation for ${selectedDate} has been posted successfully.`);
      setShowConfirmModal(false);
      setStaffEditingSubmitted(false);
      await loadAllData();
    } catch (err: any) {
      console.error('Submission error:', err);
      alert(`Error saving reconciliation: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDeducted = async (shortageId: string) => {
    if (!confirm('Confirm this cash shortage has been deducted from the staff member’s salary?')) {
      return;
    }
    const success = await reconciliationApi.markShortageDeducted(shortageId, 'Deducted via payroll settlement');
    if (success) {
      loadAllData();
    }
  };

  const handleAddCompanyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.bank_name || !newAccountForm.account_number || !newAccountForm.account_name) {
      alert('Please fill in Bank Name, Account Number, and Account Name.');
      return;
    }

    const created = await reconciliationApi.addBankAccount({
      tenant_id: tenantId,
      bank_name: newAccountForm.bank_name,
      account_number: newAccountForm.account_number,
      account_name: newAccountForm.account_name,
      branch_name: newAccountForm.branch_name,
    });

    if (created) {
      setShowAddAccountModal(false);
      setNewAccountForm({ bank_name: 'BOC', account_number: '', account_name: '', branch_name: '' });
      const accounts = await reconciliationApi.getBankAccounts(tenantId);
      setCompanyBankAccounts(accounts);
    }
  };

  const handleSetBranchOpeningFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFloatBranchId) {
      setBranchFloatError('Please select a branch.');
      return;
    }
    const amt = parseFloat(newOpeningFloatAmount);
    if (isNaN(amt) || amt < 0) {
      setBranchFloatError('Please enter a valid starting float amount.');
      return;
    }

    setIsSubmittingBranchFloat(true);
    setBranchFloatError(null);

    try {
      const res = await shiftsApi.setBranchOpeningFloat(targetFloatBranchId, amt);
      if (res.success) {
        const branchObj = branches.find((b) => b.id === targetFloatBranchId);
        setSaveSuccessMsg(`Opening Float of LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} successfully set for ${branchObj?.name || 'the branch'}.`);
        setShowSetBranchFloatModal(false);
        loadAllData();
      } else {
        setBranchFloatError(res.error?.message || 'Failed to update Branch Opening Float.');
      }
    } catch (err: any) {
      setBranchFloatError(err.message || 'Error updating Branch Opening Float.');
    } finally {
      setIsSubmittingBranchFloat(false);
    }
  };

  const currentBranchName =
    activeBranchFilter === 'ALL'
      ? 'All Outlets'
      : branches.find((b) => b.id === effectiveBranchId)?.name || 'Main Branch';

  // Bank register calculations
  const filteredBankDeposits = useMemo(() => {
    return consolidatedBankDeposits.filter((d) => {
      if (!bankSearch) return true;
      const s = bankSearch.toLowerCase();
      return (
        d.deposit_reference?.toLowerCase().includes(s) ||
        d.account_number.toLowerCase().includes(s) ||
        d.account_name.toLowerCase().includes(s) ||
        d.deposited_by?.toLowerCase().includes(s) ||
        d.branch_name.toLowerCase().includes(s)
      );
    });
  }, [consolidatedBankDeposits, bankSearch]);

  const bankDepositTotals = useMemo(() => {
    let boc = 0;
    let nsb = 0;
    let ntb = 0;
    let other = 0;
    let grandTotal = 0;

    consolidatedBankDeposits.forEach((d) => {
      const amt = Number(d.amount) || 0;
      grandTotal += amt;
      const b = d.bank_name.toUpperCase();
      if (b.includes('BOC')) boc += amt;
      else if (b.includes('NSB')) nsb += amt;
      else if (b.includes('NTB')) ntb += amt;
      else other += amt;
    });

    return { boc, nsb, ntb, other, grandTotal };
  }, [consolidatedBankDeposits]);

  // Shortage calculations
  const shortageTotals = useMemo(() => {
    let pendingAmt = 0;
    let deductedAmt = 0;
    const pendingPerCashier: Record<string, number> = {};

    consolidatedShortages.forEach((s) => {
      const amt = Number(s.amount) || 0;
      if (s.deduction_status === 'pending_payroll') {
        pendingAmt += amt;
        pendingPerCashier[s.cashier_name] = (pendingPerCashier[s.cashier_name] || 0) + amt;
      } else {
        deductedAmt += amt;
      }
    });

    return { pendingAmt, deductedAmt, pendingPerCashier };
  }, [consolidatedShortages]);

  // Multi-Branch Summary KPI Rollup
  const summaryKPIs = useMemo(() => {
    let totalC = 0;
    let totalD = 0;
    let totalE = 0;
    let totalF = 0;
    let totalVariance = 0;
    let totalSales = 0;

    consolidatedSummaries.forEach((r) => {
      totalC += r.physical_cash_c;
      totalD += r.actual_net_income_d;
      totalE += r.total_bank_deposits_e;
      totalF += r.closing_cash_f;
      totalVariance += r.variance_amount;
      totalSales += r.system_cash_sales;
    });

    return { totalC, totalD, totalE, totalF, totalVariance, totalSales };
  }, [consolidatedSummaries]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* ========================================================= */}
      {/* HEADER SECTION */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                  {isOwner ? 'Daily Cash Reconciliation & Banking Hub' : 'Daily Branch Cash Reconciliation'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isOwner ? 'Executive Admin View' : `Branch Staff • ${currentBranchName}`}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {isOwner
                  ? 'End-of-day physical drawer count, multi-branch summaries, bank deposit registers (BOC/NSB/NTB), and cashier shortages.'
                  : 'Submit your end-of-day drawer count, cash expenses, and bank deposits for your assigned branch.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Synced Branch Selector - Executive Admin Only */}
          {isOwner && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={activeBranchFilter}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">
                  All Branches
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Date Range Preset Pills - Executive Admin Only */}
          {isOwner && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last7', label: 'Last 7 Days' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetSelect(p.id as any)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Date Range Stepper & Pickers - Executive Admin Only */}
          {isOwner && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => handleDateStep(-1)}
                title="Step Backward (Previous Day/Period)"
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/60 text-slate-200 border-x border-slate-800/80">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">From</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={getTodaySriLanka()}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-transparent text-slate-200 font-mono font-semibold outline-none cursor-pointer text-xs"
                />
                <span className="text-slate-500 font-mono">→</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">To</span>
                <input
                  type="date"
                  value={selectedEndDate}
                  max={getTodaySriLanka()}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-transparent text-slate-200 font-mono font-semibold outline-none cursor-pointer text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleDateStep(1)}
                title="Step Forward (Next Day/Period)"
                disabled={selectedEndDate >= getTodaySriLanka()}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => loadAllData(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Download Detailed Report (CSV) Button - Executive Admin Only */}
          {isOwner && (
            <button
              onClick={exportDetailedReconciliationCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              title="Download detailed Excel/CSV reconciliation report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Detailed Report</span>
            </button>
          )}

          {/* Print Button - Executive Admin Only */}
          {isOwner && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
          )}

          {/* Set Branch Opening Float - Executive Owner Only */}
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setTargetFloatBranchId(effectiveBranchId || (branches[0]?.id ?? ''));
                setNewOpeningFloatAmount('');
                setBranchFloatError(null);
                setShowSetBranchFloatModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Set Branch Opening Float</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs uppercase font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TABS NAVIGATION (Executive Admin Only) */}
      {/* ========================================================= */}
      {isOwner && (
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800/80 pb-2 overflow-x-auto w-full no-scrollbar scroll-smooth">
          {/* Shift Tally & Adjustments Hub (Executive Owner View) */}
          <button
            onClick={() => setActiveTab('shift_tally')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'shift_tally'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-300" />
            <span>Shift Tally & Adjustments Hub</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-purple-200 font-mono font-bold">
              {shiftTallyKPIs.filteredShifts.length}
            </span>
          </button>

          {/* Admin Multi-Branch Summary */}
          <button
            onClick={() => setActiveTab('admin_summary')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'admin_summary'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Multi-Branch Summary
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {consolidatedSummaries.length}
            </span>
          </button>

          {/* Bank Deposit Register */}
          <button
            onClick={() => setActiveTab('bank_register')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'bank_register'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Bank Deposit Register (BOC / NSB / NTB)
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {consolidatedBankDeposits.length}
            </span>
          </button>

          {/* Cashier Shortages */}
          <button
            onClick={() => setActiveTab('shortages')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'shortages'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Cashier Shortages & Payroll
            {shortageTotals.pendingAmt > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full">
                LKR {shortageTotals.pendingAmt.toLocaleString()}
              </span>
            )}
          </button>

          {/* Daily Accounts Ledger */}
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Daily Accounts & Float (F) Audit
          </button>

          {/* Branch Worksheet */}
          <button
            onClick={() => setActiveTab('worksheet')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'worksheet'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Coins className="w-4 h-4" />
            Branch Worksheet (Count Drawer)
          </button>

          {/* Company Bank Accounts */}
          <button
            onClick={() => setActiveTab('bank_accounts')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'bank_accounts'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Bank Accounts ({companyBankAccounts.length})
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 0: OWNER'S SHIFT TALLY & ADJUSTMENTS HUB */}
      {/* ========================================================= */}
      {activeTab === 'shift_tally' && isOwner && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Active Context Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Shift Drawer Tally, Shortage Deductions & Extra Income Hub</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Operational shifts for{' '}
                  <strong className="text-purple-300 font-semibold">{activeBranchFilter === 'ALL' ? 'All Retail Branches' : getBranchName(activeBranchFilter)}</strong> on{' '}
                  <strong className="text-amber-300 font-mono font-semibold">{selectedDate === selectedEndDate ? selectedDate : `${selectedDate} to ${selectedEndDate}`}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {shiftTallyKPIs.filteredShifts.length} {shiftTallyKPIs.filteredShifts.length === 1 ? 'Shift Recorded' : 'Shifts Recorded'}
              </span>
            </div>
          </div>

          {/* 1. 5 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            {/* 1. Total Cash Inflow */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Cash Inflow</span>
                <Coins className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-black text-slate-100 font-mono mt-1.5">
                LKR {shiftTallyKPIs.totalCashInflow.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex flex-col gap-0.5">
                <span>Opening (LKR {shiftTallyKPIs.totalOpeningFloat.toLocaleString('en-LK', { minimumFractionDigits: 0 })}) + POS Cash (LKR {shiftTallyKPIs.totalPosCash.toLocaleString('en-LK', { minimumFractionDigits: 0 })})</span>
                <span className="text-purple-300 font-medium">+ Special Sales (LKR {shiftTallyKPIs.totalSpecialSales.toLocaleString('en-LK', { minimumFractionDigits: 0 })})</span>
              </div>
            </div>

            {/* 2. Banked & Paid Out */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Banked & Paid Out</span>
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-black text-amber-400 font-mono mt-1.5">
                LKR {shiftTallyKPIs.totalPaidOut.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex flex-col gap-0.5">
                <span>Bank Deposits: LKR {shiftTallyKPIs.totalBanked.toLocaleString('en-LK', { minimumFractionDigits: 0 })}</span>
                <span>Purchases + Expenses: LKR {(shiftTallyKPIs.totalGoodsPaid + shiftTallyKPIs.totalOtherExpenses).toLocaleString('en-LK', { minimumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* 3. Counted Remaining Drawer */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Counted Remaining Drawer</span>
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-1.5">
                LKR {shiftTallyKPIs.totalCountedRemaining.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Physical Notes Counted → Next Shift Opening
              </p>
            </div>

            {/* 4. Staff Salary Deductions (Shortages) - Clickable to open Shortages Tab */}
            <div
              onClick={() => setActiveTab('shortages')}
              className="p-4 rounded-2xl bg-slate-900 border border-rose-900/40 bg-rose-950/20 shadow-md cursor-pointer hover:border-rose-700/60 hover:bg-rose-950/30 transition group"
              title="Click to view Cashier Shortages & Payroll Deduction Ledger"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider group-hover:text-rose-300">
                  Salary Deductions
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-black text-rose-400 font-mono mt-1.5">
                {shiftTallyKPIs.totalShortageAmount > 0 ? '-' : ''}
                LKR {shiftTallyKPIs.totalShortageAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className="text-rose-300/80">
                  {shiftTallyKPIs.shortageShiftsCount} {shiftTallyKPIs.shortageShiftsCount === 1 ? 'shift shortage' : 'shift shortages'} recorded
                </span>
                <span className="text-rose-400 font-semibold group-hover:underline">
                  View Ledger →
                </span>
              </div>
            </div>

            {/* 5. Extra Income (Cash Excess) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-900/40 bg-emerald-950/20 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Extra Income (Excess)</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-1.5">
                {shiftTallyKPIs.totalExcessAmount > 0 ? '+' : ''}
                LKR {shiftTallyKPIs.totalExcessAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-emerald-300/80 mt-1">
                {shiftTallyKPIs.excessShiftsCount} {shiftTallyKPIs.excessShiftsCount === 1 ? 'shift excess' : 'shift excesses'} recorded
              </p>
            </div>
          </div>

          {/* 2. Detailed Per-Shift Tally Cards (Shift 1, Shift 2) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-400" />
                <span>Shift Tally Worksheets ({shiftTallyKPIs.filteredShifts.length})</span>
              </h4>
              <span className="text-xs text-slate-500">
                Detailed cash ledger verification per operating shift
              </span>
            </div>

            {shiftTallyKPIs.filteredShifts.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">
                  No Cashier Shift Sheets Recorded for {selectedDate === selectedEndDate ? selectedDate : `${selectedDate} to ${selectedEndDate}`}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When cashiers submit their shift end handovers via the POS terminal, their live drawer tally, receipts, expenses, bank deposits, and cash variances will immediately appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {shiftTallyKPIs.filteredShifts.map((sh) => {
                  const shiftInflow = (sh.opening_float || 0) + (sh.pos_cash_sales || 0) + (sh.modaka_total_amount || 0);
                  const expectedDrawer = sh.expected_remaining_drawer_cash !== undefined
                    ? Number(sh.expected_remaining_drawer_cash)
                    : Math.round((shiftInflow - (sh.goods_purchased_paid || 0) - (sh.other_expenses || 0) - (sh.banked_amount || 0)) * 100) / 100;
                  const countedDrawer = Math.round(Number(sh.counted_remaining_drawer_cash ?? sh.counted_drawer_cash ?? 0) * 100) / 100;
                  const shiftAccounted = (sh.goods_purchased_paid || 0) + (sh.other_expenses || 0) + (sh.banked_amount || 0) + countedDrawer;
                  const variance = sh.cash_variance !== undefined
                    ? Number(sh.cash_variance)
                    : Math.round((countedDrawer - expectedDrawer) * 100) / 100;
                  const isExpanded = expandedDenomsShiftId === sh.id;
                  const denoms = sh.denominations_json || {};
                  const denomEntries = Object.entries(denoms).filter(([_, count]) => Number(count) > 0);

                  return (
                    <div key={sh.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                      {/* Shift Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-sm border border-purple-500/30">
                            {sh.cashier_name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100">{sh.cashier_name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                {formatShiftLabel(sh.shift_number)}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {sh.branch_name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-950 text-amber-300 border border-slate-800">
                                {sh.shift_date}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>
                                {sh.started_at ? new Date(sh.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                {' → '}
                                {sh.ended_at ? new Date(sh.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active Shift'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border ${
                            sh.status === 'closed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {sh.status === 'closed' ? 'Closed & Verified' : 'Open / In-Progress'}
                          </span>
                        </div>
                      </div>

                      {/* Inflows vs Outflows & Remaining Drawer Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Column 1: Cash Inflows */}
                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                            <span>Cash Inflows</span>
                            <span className="text-purple-400 font-mono">Drawer Receipts</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Opening Float:</span>
                            <span className="font-mono font-bold text-slate-200">
                              LKR {(sh.opening_float || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">POS Cash Sales:</span>
                            <span className="font-mono font-bold text-slate-200">
                              LKR {(sh.pos_cash_sales || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Special Stock Sales:</span>
                            <span className="font-mono font-bold text-purple-300">
                              LKR {(sh.modaka_total_amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-bold">
                            <span className="text-slate-200 uppercase text-[11px]">Total Cash Inflow:</span>
                            <span className="font-mono text-sm text-indigo-400">
                              LKR {shiftInflow.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Column 2: Outflows & Remaining Drawer */}
                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                            <span>Outflows & Remaining Drawer</span>
                            <span className="text-amber-400 font-mono">Disbursements & Float</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Goods Purchased Paid Out:</span>
                            <span className="font-mono font-bold text-rose-300">
                              - LKR {(sh.goods_purchased_paid || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Other Expenses:</span>
                            <span className="font-mono font-bold text-rose-300">
                              - LKR {(sh.other_expenses || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Banked Amount:</span>
                            <span className="font-mono font-bold text-indigo-300">
                              - LKR {(sh.banked_amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                            <span className="text-slate-400">System Expected Remaining Drawer:</span>
                            <span className="font-mono font-bold text-amber-300">
                              LKR {expectedDrawer.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300 font-semibold">Cashier Declared Remaining Drawer (Carried Forward):</span>
                            <span className="font-mono font-bold text-emerald-400">
                              LKR {countedDrawer.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Expandable Denominations */}
                          {denomEntries.length > 0 && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setExpandedDenomsShiftId(isExpanded ? null : sh.id)}
                                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                <Coins className="w-3 h-3" />
                                <span>{isExpanded ? 'Hide Bank Deposit Denominations' : 'View Bank Deposit Denominations'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {isExpanded && (
                                <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                    <span>Bank Deposit Denominations</span>
                                    <span className="text-indigo-400 font-mono">Banked: LKR {(sh.banked_amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
                                    {denomEntries.map(([denom, count]) => (
                                      <div key={denom} className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/80 border border-slate-800">
                                        <span className="text-slate-400">{denom} ×</span>
                                        <span className="text-slate-200 font-bold">{count}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-bold">
                            <span className="text-slate-200 uppercase text-[11px]">Total Accounted:</span>
                            <span className="font-mono text-sm text-amber-400">
                              LKR {shiftAccounted.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Verdict Banner */}
                      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-bold ${
                        Math.abs(variance) < 0.01
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                          : variance < 0
                          ? 'bg-rose-950/50 text-rose-200 border-rose-500/40'
                          : 'bg-emerald-950/40 text-emerald-200 border-emerald-500/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          {Math.abs(variance) < 0.01 ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>BALANCED • Zero Variance (Drawer cash tallies perfectly with calculated expectation)</span>
                            </>
                          ) : variance < 0 ? (
                            <>
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                              <span>
                                CASH SHORTAGE: -LKR {Math.abs(variance).toLocaleString('en-LK', { minimumFractionDigits: 2 })} (Salary Deduction = LKR {Math.abs(variance).toLocaleString('en-LK', { minimumFractionDigits: 2 })} for {sh.cashier_name})
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>
                                EXTRA INCOME / EXCESS: +LKR {variance.toLocaleString('en-LK', { minimumFractionDigits: 2 })} (Credited to Business)
                              </span>
                            </>
                          )}
                        </div>

                        <span className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${
                          Math.abs(variance) < 0.01
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : variance < 0
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {Math.abs(variance) < 0.01 ? 'BALANCED • ZERO VARIANCE' : variance < 0 ? 'SHORTAGE' : 'EXCESS'}: {variance > 0 ? '+' : ''}LKR {variance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Handover Remarks */}
                      {sh.handover_notes && (
                        <div className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 italic">
                          <span className="text-slate-500 not-italic font-bold mr-1.5">Handover Remarks:</span>
                          &ldquo;{sh.handover_notes}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Dedicated Owner Log Tables */}
          <div className="space-y-6 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Salary Deductions & Extra Income Audit Logs</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Automated financial adjustment tracking across all cashier shifts
                </p>
              </div>

              {/* Date Scope Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setAdjustmentDateScope('selected_date')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    adjustmentDateScope === 'selected_date'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Selected Date ({selectedDate})
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentDateScope('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    adjustmentDateScope === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All History
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* TABLE 1: Staff Salary Deductions (Shift Shortages) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Staff Salary Deductions (Shift Shortages)
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 font-mono">
                      {salaryDeductionsLog.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const headers = ['Date', 'Branch', 'Shift', 'Employee Name', 'Shortage Amount (LKR)', 'Notes'];
                      const rows = salaryDeductionsLog.map((r) => [
                        r.date,
                        r.branchName,
                        formatShiftLabel(r.shiftNumber),
                        r.employeeName,
                        r.amount,
                        r.notes,
                      ]);
                      exportCsv('staff-salary-deductions', headers, rows);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Branch</th>
                        <th className="py-2 px-2 text-center">Shift</th>
                        <th className="py-2 px-3">Employee Name</th>
                        <th className="py-2 px-3 text-right">Shortage (LKR)</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {salaryDeductionsLog.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                            ✓ No salary deduction shortages recorded for this scope.
                          </td>
                        </tr>
                      ) : (
                        salaryDeductionsLog.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-slate-300 font-sans">{r.date}</td>
                            <td className="py-2.5 px-3 text-slate-300 font-sans font-semibold">{r.branchName}</td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {formatShiftLabel(r.shiftNumber)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-200 font-sans font-bold">{r.employeeName}</td>
                            <td className="py-2.5 px-3 text-right text-rose-400 font-black">
                              -LKR {Number(r.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans truncate max-w-[150px]" title={r.notes}>
                              {r.notes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE 2: Daily Extra Income (Shift Cash Excess) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Daily Extra Income (Shift Cash Excess)
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                      {extraIncomeLog.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const headers = ['Date', 'Branch', 'Shift', 'Employee Name', 'Extra Income Amount (LKR)', 'Notes'];
                      const rows = extraIncomeLog.map((r) => [
                        r.date,
                        r.branchName,
                        formatShiftLabel(r.shiftNumber),
                        r.employeeName,
                        r.amount,
                        r.notes,
                      ]);
                      exportCsv('daily-extra-income', headers, rows);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Branch</th>
                        <th className="py-2 px-2 text-center">Shift</th>
                        <th className="py-2 px-3">Employee Name</th>
                        <th className="py-2 px-3 text-right">Extra Income (LKR)</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {extraIncomeLog.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                            No shift cash excesses recorded for this scope.
                          </td>
                        </tr>
                      ) : (
                        extraIncomeLog.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-slate-300 font-sans">{r.date}</td>
                            <td className="py-2.5 px-3 text-slate-300 font-sans font-semibold">{r.branchName}</td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {formatShiftLabel(r.shiftNumber)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-200 font-sans font-bold">{r.employeeName}</td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-black">
                              +LKR {Number(r.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans truncate max-w-[150px]" title={r.notes}>
                              {r.notes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 1: MULTI-BRANCH DAILY RECONCILIATION SUMMARY */}
      {/* ========================================================= */}
      {activeTab === 'admin_summary' && isOwner && (
        <div className="space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-semibold mb-1">System Cash Sales</div>
              <div className="text-lg font-bold text-slate-100">
                LKR {summaryKPIs.totalSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Aggregated Terminal Sales</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-semibold mb-1">C. Physical Drawer Cash</div>
              <div className="text-lg font-bold text-amber-400">
                LKR {summaryKPIs.totalC.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Total Counted in Drawers</div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 bg-emerald-950/10 rounded-xl p-4">
              <div className="text-xs text-emerald-400 font-bold mb-1">D. Actual Net Income</div>
              <div className="text-lg font-black text-emerald-400">
                LKR {summaryKPIs.totalD.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-emerald-500/70 mt-1">(C + B) - A posted</div>
            </div>

            <div className="bg-slate-900 border border-indigo-500/30 bg-indigo-950/10 rounded-xl p-4">
              <div className="text-xs text-indigo-400 font-bold mb-1">E. Total Banked</div>
              <div className="text-lg font-black text-indigo-400">
                LKR {summaryKPIs.totalE.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-indigo-500/70 mt-1">Dispatched to Bank</div>
            </div>

            <div className="bg-slate-900 border border-purple-500/30 bg-purple-950/10 rounded-xl p-4">
              <div className="text-xs text-purple-400 font-bold mb-1">F. Remaining Float</div>
              <div className="text-lg font-black text-purple-300">
                LKR {summaryKPIs.totalF.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-purple-500/70 mt-1">Carried to Next Day (C - E)</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-semibold mb-1">Net Variance</div>
              <div
                className={`text-lg font-black ${
                  Math.abs(summaryKPIs.totalVariance) < 0.01
                    ? 'text-emerald-400'
                    : summaryKPIs.totalVariance > 0
                    ? 'text-rose-400'
                    : 'text-cyan-400'
                }`}
              >
                {Math.abs(summaryKPIs.totalVariance) < 0.01
                  ? 'LKR 0.00'
                  : `LKR ${summaryKPIs.totalVariance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {Math.abs(summaryKPIs.totalVariance) < 0.01
                  ? 'All Balanced'
                  : summaryKPIs.totalVariance > 0
                  ? 'Net Cash Shortage'
                  : 'Net Cash Overage'}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Presets */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSummaryPreset('all')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    summaryPreset === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Dates
                </button>
                <button
                  onClick={() => setSummaryPreset('today')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    summaryPreset === 'today' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setSummaryPreset('yesterday')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    summaryPreset === 'yesterday' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setSummaryPreset('week')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    summaryPreset === 'week' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setSummaryPreset('month')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    summaryPreset === 'month' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setSummaryPreset('custom')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    summaryPreset === 'custom' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Custom Date Pickers */}
              {summaryPreset === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <input
                    type="date"
                    value={summaryStartDate}
                    onChange={(e) => setSummaryStartDate(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none text-xs"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="date"
                    value={summaryEndDate}
                    onChange={(e) => setSummaryEndDate(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none text-xs"
                  />
                </div>
              )}

              {/* Branch Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={summaryBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={summaryStatus}
                  onChange={(e) => setSummaryStatus(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="balanced">Balanced (0 Variance)</option>
                  <option value="shortage">Shortages</option>
                  <option value="overage">Overages</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const headers = [
                    'Date',
                    'Branch',
                    'Submitted By',
                    'Opening Float A',
                    'Cash Expenses B',
                    'Drawer Count C',
                    'Actual Net Income D',
                    'System Sales',
                    'Variance',
                    'Status',
                    'Bank Deposits E',
                    'Closing Float F',
                  ];
                  const rows = consolidatedSummaries.map((s) => [
                    s.reconciliation_date,
                    s.branch_name,
                    s.submitter_name,
                    s.opening_float_a,
                    s.cash_expenses_b,
                    s.physical_cash_c,
                    s.actual_net_income_d,
                    s.system_cash_sales,
                    s.variance_amount,
                    s.status,
                    s.total_bank_deposits_e,
                    s.closing_cash_f,
                  ]);
                  exportCsv('multi-branch-cash-reconciliation', headers, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Multi-Branch Reconciliation Summary Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-4 text-right">Float A</th>
                    <th className="py-3 px-4 text-right">Expenses B</th>
                    <th className="py-3 px-4 text-right">Drawer C</th>
                    <th className="py-3 px-4 text-right font-bold text-emerald-400">Net Income D</th>
                    <th className="py-3 px-4 text-right">System Sales</th>
                    <th className="py-3 px-4 text-center">Variance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {consolidatedSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 text-sm">
                        No cash reconciliation records found matching the active filters.
                      </td>
                    </tr>
                  ) : (
                    consolidatedSummaries.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-200 font-bold whitespace-nowrap">
                          {row.reconciliation_date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                          {row.branch_name}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                          {row.submitter_name}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-400 font-mono">
                          {row.opening_float_a.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-400 font-mono">
                          {row.cash_expenses_b.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-bold text-amber-400 font-mono">
                          {row.physical_cash_c.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-black text-emerald-400 font-mono">
                          {row.actual_net_income_d.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-300 font-mono">
                          {row.system_cash_sales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.status === 'balanced' ? (
                            <span className="font-mono text-xs text-emerald-400 font-semibold">0.00</span>
                          ) : row.status === 'shortage' ? (
                            <span className="font-mono text-xs font-bold text-rose-400">
                              -{row.variance_amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold text-cyan-400">
                              +{Math.abs(row.variance_amount).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.status === 'balanced' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                              Balanced
                            </span>
                          )}
                          {row.status === 'shortage' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 uppercase">
                              Shortage
                            </span>
                          )}
                          {row.status === 'overage' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                              Overage
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedRecForDenoms(row)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition"
                            title="View denominations breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Denominations</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: BANK DEPOSIT & ACCOUNT-WISE REGISTER (BOC/NSB/NTB) */}
      {/* ========================================================= */}
      {activeTab === 'bank_register' && isOwner && (
        <div className="space-y-6">
          {/* Bank Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BOC Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    BOC • Bank of Ceylon
                  </span>
                  <Building2 className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="text-xl font-bold text-slate-100">
                  LKR {bankDepositTotals.boc.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-1">A/C: 84200192 (Deegayu Weda Madhura)</div>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                Primary wholesale & clinic operating account
              </div>
            </div>

            {/* NSB Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    NSB • National Savings
                  </span>
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-slate-100">
                  LKR {bankDepositTotals.nsb.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-1">A/C: 1092837482 (Central Reserve)</div>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                Kurunegala & Giriulla central savings deposit
              </div>
            </div>

            {/* NTB Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    NTB • Nations Trust
                  </span>
                  <Building2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold text-slate-100">
                  LKR {bankDepositTotals.ntb.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-1">A/C: 0291823749 (Deegayu Ops)</div>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                Alawwa branch operations & electronic transfers
              </div>
            </div>

            {/* Consolidated Total Card */}
            <div className="bg-slate-900 border border-indigo-500/30 bg-indigo-950/10 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Total Banked (All Accounts)
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-indigo-400">
                  LKR {bankDepositTotals.grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400 mt-1">Across all branches & passbooks</div>
              </div>
              <div className="text-[11px] text-indigo-400/80 mt-3 pt-2 border-t border-indigo-900/40">
                Audit against bank branch daily deposit slips
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search slip #, account, person..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none w-full text-xs"
                />
              </div>

              {/* Bank Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Bank:</span>
                <select
                  value={bankFilterBank}
                  onChange={(e) => setBankFilterBank(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Banks</option>
                  <option value="BOC">BOC</option>
                  <option value="NSB">NSB</option>
                  <option value="NTB">NTB</option>
                </select>
              </div>

              {/* Branch Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Branch:</span>
                <select
                  value={bankFilterBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export CSV */}
            <button
              onClick={() => {
                const headers = ['Date', 'Branch', 'Bank', 'Account Number', 'Account Name', 'Slip Reference #', 'Deposited By', 'Amount (LKR)'];
                const rows = filteredBankDeposits.map((d) => [
                  d.reconciliation_date,
                  d.branch_name,
                  d.bank_name,
                  d.account_number,
                  d.account_name,
                  d.deposit_reference || 'N/A',
                  d.deposited_by || 'Staff',
                  d.amount,
                ]);
                exportCsv('bank-deposits-register', headers, rows);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Export Bank Register
            </button>
          </div>

          {/* Bank Deposit Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Bank</th>
                    <th className="py-3 px-4">Account Number & Name</th>
                    <th className="py-3 px-4">Deposit Slip / Ref #</th>
                    <th className="py-3 px-4">Deposited By</th>
                    <th className="py-3 px-4 text-right">Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBankDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                        No bank deposits recorded matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBankDeposits.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-200 font-bold whitespace-nowrap">
                          {item.reconciliation_date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                          {item.branch_name}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-black ${
                              item.bank_name.toUpperCase().includes('BOC')
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                : item.bank_name.toUpperCase().includes('NSB')
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {item.bank_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="font-mono font-bold text-slate-200">{item.account_number}</div>
                          <div className="text-[11px] text-slate-400">{item.account_name}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-amber-300">
                          {item.deposit_reference || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {item.deposited_by || 'Branch Staff'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-indigo-400 font-mono text-sm">
                          LKR {item.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: CASHIER SHORTAGES & PAYROLL DEDUCTION MANAGER */}
      {/* ========================================================= */}
      {activeTab === 'shortages' && isOwner && (
        <div className="space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-rose-900/40 bg-rose-950/20 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-400">Total Cash Shortages (Period)</span>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  -LKR {shiftTallyKPIs.totalShortageAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-[11px] text-rose-300/80 mt-3 pt-2 border-t border-rose-900/40">
                {shiftTallyKPIs.shortageShiftsCount} {shiftTallyKPIs.shortageShiftsCount === 1 ? 'shift shortage' : 'shift shortages'} recorded for {selectedDate === selectedEndDate ? selectedDate : `${selectedDate} to ${selectedEndDate}`}
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-900/40 bg-emerald-950/20 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400">Total Cash Excess / Extra Income</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  +LKR {shiftTallyKPIs.totalExcessAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-[11px] text-emerald-300/80 mt-3 pt-2 border-t border-emerald-900/40">
                {shiftTallyKPIs.excessShiftsCount} {shiftTallyKPIs.excessShiftsCount === 1 ? 'shift excess' : 'shift excesses'} recorded
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">Shifts with Discrepancies</span>
                  <UserCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {shiftTallyKPIs.shortageShiftsCount + shiftTallyKPIs.excessShiftsCount} Shifts
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                Filtered across {shortageLedgerRows.length} matching rows
              </div>
            </div>
          </div>

          {/* Per-Employee Shortage Summary Strip */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Active Staff Shortage Totals ({selectedDate === selectedEndDate ? selectedDate : `${selectedDate} to ${selectedEndDate}`})
              </span>
              <span className="text-[11px] text-slate-500">Click a staff member to filter ledger</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {ACTIVE_STAFF.map((staffName) => {
                const s = staffShortageSummary[staffName] || { count: 0, totalShortage: 0 };
                const isSelected = shortageCashierFilter === staffName;
                return (
                  <button
                    key={staffName}
                    type="button"
                    onClick={() => setShortageCashierFilter(isSelected ? 'ALL' : staffName)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-500/30'
                        : s.totalShortage > 0
                        ? 'bg-rose-950/20 border-rose-900/40 hover:bg-rose-950/30'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className={isSelected ? 'text-amber-300' : 'text-slate-200'}>{staffName}</span>
                      {s.count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                          {s.count}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-mono font-black text-rose-400">
                      {s.totalShortage > 0 ? `-LKR ${s.totalShortage.toLocaleString('en-LK', { minimumFractionDigits: 0 })}` : 'LKR 0.00'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Variance Type Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {[
                  { id: 'shortages', label: 'Shortages Only' },
                  { id: 'excess', label: 'Excess Only' },
                  { id: 'all', label: 'All Variances' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setShortageVarianceTypeFilter(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      shortageVarianceTypeFilter === t.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Download CSV */}
              <button
                type="button"
                onClick={exportShortagesCsv}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                title="Download CSV report of filtered shortages"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Shortage Report (CSV)</span>
              </button>
            </div>

            {/* Sub-Filters: Cashier, Branch, and Search */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Cashier Filter Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-medium">Cashier:</span>
                  <select
                    value={shortageCashierFilter}
                    onChange={(e) => setShortageCashierFilter(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Active Staff</option>
                    {ACTIVE_STAFF.map((name) => (
                      <option key={name} value={name} className="bg-slate-900 text-slate-200">
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Branch Filter Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-medium">Branch:</span>
                  <select
                    value={shortageBranchFilter}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Deduction Status Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-medium">Status:</span>
                  <select
                    value={shortageStatusFilter}
                    onChange={(e) => setShortageStatusFilter(e.target.value as any)}
                    className="bg-transparent text-slate-200 font-semibold outline-none cursor-pointer text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending_payroll">Pending Payroll</option>
                    <option value="deducted">Deducted / Settled</option>
                  </select>
                </div>
              </div>

              {/* Search Box */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search shift, remarks, date..."
                  value={shortageSearchQuery}
                  onChange={(e) => setShortageSearchQuery(e.target.value)}
                  className="bg-transparent text-slate-200 placeholder-slate-500 outline-none text-xs w-full"
                />
                {shortageSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setShortageSearchQuery('')}
                    className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sortable Shortages Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800 select-none">
                  <tr>
                    <th
                      onClick={() => handleSortClick('date')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition"
                    >
                      Date {renderSortIndicator('date')}
                    </th>
                    <th
                      onClick={() => handleSortClick('cashier')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition"
                    >
                      Employee / Cashier {renderSortIndicator('cashier')}
                    </th>
                    <th
                      onClick={() => handleSortClick('branch')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition"
                    >
                      Branch {renderSortIndicator('branch')}
                    </th>
                    <th
                      onClick={() => handleSortClick('shift')}
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition"
                    >
                      Shift {renderSortIndicator('shift')}
                    </th>
                    <th
                      onClick={() => handleSortClick('expected')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-200 transition"
                    >
                      Expected Cash (LKR) {renderSortIndicator('expected')}
                    </th>
                    <th
                      onClick={() => handleSortClick('actual')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-200 transition"
                    >
                      Actual Counted / Banked (LKR) {renderSortIndicator('actual')}
                    </th>
                    <th
                      onClick={() => handleSortClick('shortage')}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-200 transition"
                    >
                      Shortage / Variance {renderSortIndicator('shortage')}
                    </th>
                    <th className="py-3 px-4">Handover Remarks</th>
                    <th className="py-3 px-4 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {shortageLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans text-sm">
                        No cash discrepancies recorded matching the selected filters. Zero-variance maintained!
                      </td>
                    </tr>
                  ) : (
                    shortageLedgerRows.map((item) => {
                      const isShortage = item.varianceType === 'shortage' || item.shortageAmount > 0;
                      const isExcess = item.varianceType === 'excess' || item.excessAmount > 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-3 px-4 font-sans font-bold text-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{item.cashierName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                                {item.branchName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300 whitespace-nowrap">
                            {item.branchName}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded font-black text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              {item.shiftLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-300 font-bold whitespace-nowrap">
                            LKR {item.expectedCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-200 font-bold whitespace-nowrap">
                            LKR {item.actualCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {isShortage ? (
                              <span className="px-2 py-1 rounded-md text-xs font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                -LKR {item.shortageAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                              </span>
                            ) : isExcess ? (
                              <span className="px-2 py-1 rounded-md text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                +LKR {item.excessAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-md text-xs font-bold text-slate-400 bg-slate-800">
                                Balanced (0.00)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-sans text-xs text-slate-400 max-w-xs truncate" title={item.notes}>
                            {item.notes || '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap font-sans">
                            {isShortage ? (
                              <button
                                type="button"
                                onClick={() => handleMarkDeducted(item.id)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 text-xs font-bold text-emerald-400 transition cursor-pointer"
                              >
                                Mark Deducted
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500">Verified</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: DAILY ACCOUNTS LEDGER & CARRY-FORWARD FLOAT (F) AUDIT */}
      {/* ========================================================= */}
      {activeTab === 'ledger' && isOwner && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Daily Accounts Ledger & Float (F) Carry-Forward Audit
              </h2>
              <p className="text-xs text-slate-400">
                Audit trail of posted net revenue D alongside tomorrow’s opening float F remaining in cash drawers.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-400">Branch:</span>
                <select
                  value={ledgerBranchFilter}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  const headers = [
                    'Date',
                    'Branch',
                    'System Sales',
                    'Cash Expenses B',
                    'Net Income D',
                    'Banked E',
                    'Closing Float F',
                    'Variance',
                    'Status',
                  ];
                  const rows = consolidatedLedger.map((l) => [
                    l.entry_date,
                    l.branch_name,
                    l.system_sales,
                    l.cash_expenses,
                    l.actual_net_income,
                    l.banked_amount,
                    l.closing_cash,
                    l.variance,
                    l.status,
                  ]);
                  exportCsv('daily-accounts-ledger-audit', headers, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export Ledger
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4 text-right">System Sales</th>
                    <th className="py-3 px-4 text-right">Cash Expenses (B)</th>
                    <th className="py-3 px-4 text-right font-bold text-emerald-400">Net Income (D)</th>
                    <th className="py-3 px-4 text-right font-bold text-indigo-400">Banked (E)</th>
                    <th className="py-3 px-4 text-right font-bold text-purple-300">Closing Float (F)</th>
                    <th className="py-3 px-4 text-center">Variance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {consolidatedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                        No ledger entries posted matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    consolidatedLedger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-200 font-bold whitespace-nowrap">
                          {entry.entry_date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                          {entry.branch_name}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-300 font-mono">
                          LKR {Number(entry.system_sales).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-400 font-mono">
                          LKR {Number(entry.cash_expenses).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-black text-emerald-400 font-mono">
                          LKR {Number(entry.actual_net_income).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-black text-indigo-400 font-mono">
                          LKR {Number(entry.banked_amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-black text-purple-300 font-mono">
                          LKR {Number(entry.closing_cash).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {Math.abs(Number(entry.variance)) < 0.01 ? (
                            <span className="text-emerald-400 font-mono text-xs">0.00</span>
                          ) : Number(entry.variance) > 0 ? (
                            <span className="text-rose-400 font-mono text-xs font-bold">
                              -{Number(entry.variance).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-cyan-400 font-mono text-xs font-bold">
                              +{Math.abs(Number(entry.variance)).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: BRANCH WORKSHEET (Drawer Count Entry) */}
      {/* ========================================================= */}
      {(activeTab === 'worksheet' || !isOwner) && (
        <div className="space-y-6">
          {/* Branch & Date Switcher Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  {isOwner ? 'Daily Branch Reconciliation Worksheet' : `Daily Branch Reconciliation — ${currentBranchName}`}
                </h2>
                <p className="text-xs text-slate-400">
                  Count physical currency notes &amp; coins, allocate bank deposits, and verify zero variance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Branch Select: Locked for staff to prevent cross-branch mutation */}
              {!isOwner ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 select-none text-xs">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-slate-200">{currentBranchName}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                    Active Branch
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={activeBranchFilter}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none cursor-pointer font-semibold"
                  >
                    <option value="ALL" className="bg-slate-900 text-slate-200">
                      All Branches
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Display / Stepper */}
              {!isOwner ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 select-none text-xs">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-slate-200">{selectedDate} (Today)</span>
                </div>
              ) : (
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => handleDateStep(-1)}
                    title="Previous Day"
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="bg-transparent text-slate-200 font-mono font-semibold outline-none cursor-pointer text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDateStep(1)}
                    title="Next Day"
                    disabled={selectedDate >= getTodaySriLanka()}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {selectedDate !== getTodaySriLanka() && (
                    <button
                      type="button"
                      onClick={() => handleDateChange(getTodaySriLanka())}
                      className="px-2 py-1 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition border-l border-slate-800 cursor-pointer"
                    >
                      Today
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Shimmer loading bar */}
          {loading && (
            <div className="w-full bg-slate-900 h-1 overflow-hidden rounded-full">
              <div className="bg-amber-400 h-full w-1/3 animate-pulse rounded-full" />
            </div>
          )}

          {/* 6-Card System Sales Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Settled Bills</div>
              <div className="text-lg font-bold text-slate-100 mt-1 font-mono">
                {worksheetData.totalCompletedBills.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Completed bills</div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Gross Sales</div>
              <div className="text-lg font-bold text-slate-100 mt-1 font-mono">
                LKR {worksheetData.totalGrossSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">All payment modes</div>
            </div>
            <div className="p-3 bg-slate-900 border border-amber-500/30 bg-amber-950/10 rounded-xl">
              <div className="text-[11px] font-bold text-amber-400">POS Cash Sales</div>
              <div className="text-lg font-black text-amber-300 mt-1 font-mono">
                LKR {worksheetData.systemCashSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-amber-400/70 mt-0.5">Live register collections</div>
            </div>
            <div className="p-3 bg-slate-900 border border-purple-500/30 bg-purple-950/10 rounded-xl">
              <div className="text-[11px] font-bold text-purple-300">Special Sales (Shift Ledger)</div>
              <div className="text-lg font-black text-purple-200 mt-1 font-mono">
                LKR {modakaSalesTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-purple-300/70 mt-0.5">
                {worksheetData.modakaUnitsTotal || 0} units (Special Stock)
              </div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">Card Payments</div>
              <div className="text-lg font-bold text-blue-400 mt-1 font-mono">
                LKR {worksheetData.systemCardSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Direct merchant A/C</div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
              <div className="text-[11px] font-medium text-slate-400">QR Payments</div>
              <div className="text-lg font-bold text-indigo-400 mt-1 font-mono">
                LKR {worksheetData.systemQrSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">LANKAQR digital</div>
            </div>
          </div>

          {/* Historical Archive Banner */}
          {worksheetData.isHistorical && (
            <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-purple-100">
                    Historical System Ledger (Legacy Records)
                  </div>
                  <div className="text-purple-300/80 mt-0.5">
                    Showing aggregated sales ledger from POS records on {selectedDate}. Net income and physical cash are balanced to system cash sales (LKR {worksheetData.systemCashSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}).
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0 self-start sm:self-auto">
                Historical Archive
              </span>
            </div>
          )}

          {/* Shift Handover Sheets Recorded Today */}
          {worksheetData.shifts.length > 0 && (
            <div className="p-4 bg-slate-900 border border-indigo-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Shift Handover Sheets Recorded On This Date ({worksheetData.shifts.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  From Shift Off digitized handover sheets
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {worksheetData.shifts.map((s: ShiftHandoverSummary) => {
                  const shiftExpenses = (s.goods_purchased_paid || 0) + (s.other_expenses || 0);
                  const shiftSales = s.pos_gross_sales || s.declared_shift_sale || 0;
                  const shiftVar = s.cash_variance || 0;
                  return (
                    <div key={s.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-bold text-xs text-slate-200">{s.cashier_name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {formatShiftLabel(s.shift_number)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {s.started_at ? new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        {' - '}
                        {s.ended_at ? new Date(s.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                        <div>
                          <span className="text-slate-500">POS Sales:</span>
                          <div className="font-bold text-slate-200">
                            LKR {shiftSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Special Sales:</span>
                          <div className="font-bold text-purple-300">
                            LKR {(s.modaka_total_amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Drawer Cash:</span>
                          <div className="font-bold text-amber-400">
                            LKR {s.counted_drawer_cash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Expenses:</span>
                          <div className="font-bold text-slate-300">
                            LKR {shiftExpenses.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <span className="text-slate-500">Shift Variance:</span>
                          <div className={`font-bold ${Math.abs(shiftVar) < 0.01 ? 'text-emerald-400' : shiftVar < 0 ? 'text-rose-400' : 'text-cyan-400'}`}>
                            {Math.abs(shiftVar) < 0.01 ? 'Balanced' : `LKR ${shiftVar.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cashier Register Breakdown Table */}
          {worksheetData.cashierBreakdown.length > 0 && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Cashier Register Breakdown ({worksheetData.cashierBreakdown.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Individual terminal collections for {selectedDate}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-2">Cashier Name</th>
                      <th className="py-2 text-center">Settled Bills</th>
                      <th className="py-2 text-right">Cash Sales (LKR)</th>
                      <th className="py-2 text-right">Card Sales (LKR)</th>
                      <th className="py-2 text-right">QR / Credit (LKR)</th>
                      <th className="py-2 text-right">Total Billed (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {worksheetData.cashierBreakdown.map((c) => (
                      <tr key={c.cashier_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 font-bold text-slate-200">{c.cashier_name}</td>
                        <td className="py-2.5 text-center text-slate-300 font-mono">{c.bill_count}</td>
                        <td className="py-2.5 text-right font-bold text-amber-400 font-mono">
                          {c.cash_sales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right text-blue-400 font-mono">
                          {(c.card_sales || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right text-indigo-400 font-mono">
                          {((c.qr_sales || 0) + (c.credit_sales || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-right font-black text-slate-100 font-mono">
                          {(c.total_sales || c.cash_sales).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status banner for existing record (Admin View) */}
          {existingRecord && isOwner && (
            <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs text-blue-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                This day was previously reconciled on{' '}
                {new Date(existingRecord.updated_at || existingRecord.created_at || '').toLocaleTimeString()} with status:{' '}
                <strong className="uppercase">{existingRecord.status}</strong>. You may adjust counts and re-submit.
              </span>
            </div>
          )}

          {/* POST-SUBMISSION CONFIRMATION FOR STAFF */}
          {!isOwner && existingRecord && !staffEditingSubmitted ? (
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-bold text-slate-100">
                        Today&apos;s End-of-Day Reconciliation Submitted
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {existingRecord.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Recorded for <strong className="text-slate-200">{currentBranchName}</strong> on{' '}
                      <strong className="text-slate-200">{selectedDate}</strong> at{' '}
                      {new Date(existingRecord.updated_at || existingRecord.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStaffEditingSubmitted(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition self-start sm:self-auto cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  Adjust / Update Count
                </button>
              </div>

              {/* Submitted Figures Summary (A, B, C, D, E, F) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">A. Opening Float</div>
                  <div className="text-base font-bold text-slate-100 mt-1">
                    LKR {Number(existingRecord.opening_float_a || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Carried forward</div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">B. Cash Expenses</div>
                  <div className="text-base font-bold text-slate-100 mt-1">
                    LKR {Number(existingRecord.cash_expenses_b || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Paid out</div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 font-medium">C. Cash in Drawer</div>
                  <div className="text-base font-bold text-amber-400 mt-1">
                    LKR {Number(existingRecord.physical_cash_c || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Physical count</div>
                </div>

                <div className="bg-slate-950/80 border border-emerald-500/20 bg-emerald-950/10 rounded-xl p-3.5">
                  <div className="text-[11px] text-emerald-400 font-bold">D. Net Income</div>
                  <div className="text-base font-black text-emerald-400 mt-1">
                    LKR {Number(existingRecord.actual_net_income_d || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-emerald-500/70 mt-0.5">(C + B) - A</div>
                </div>

                <div className="bg-slate-950/80 border border-indigo-500/20 bg-indigo-950/10 rounded-xl p-3.5">
                  <div className="text-[11px] text-indigo-400 font-bold">E. Banked Today</div>
                  <div className="text-base font-black text-indigo-400 mt-1">
                    LKR {Number(existingRecord.total_bank_deposits_e || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-indigo-500/70 mt-0.5">Bank deposits</div>
                </div>

                <div className="bg-slate-950/80 border border-purple-500/20 bg-purple-950/10 rounded-xl p-3.5">
                  <div className="text-[11px] text-purple-400 font-bold">F. Tomorrow Float</div>
                  <div className="text-base font-black text-purple-300 mt-1">
                    LKR {Number(existingRecord.closing_cash_f || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-purple-500/70 mt-0.5">Left in drawer (C - E)</div>
                </div>
              </div>

              {/* Bank Deposits Dispatched */}
              {bankDeposits && bankDeposits.filter((d) => Number(d.amount) > 0).length > 0 && (
                <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2.5">
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    Dispatched Bank Deposits:
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {bankDeposits
                      .filter((d) => Number(d.amount) > 0)
                      .map((d, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-200">{d.bank_name}</span>
                            <span className="text-slate-400 ml-2 font-mono">A/C: {d.account_number}</span>
                            {d.deposit_reference && (
                              <span className="text-amber-400 ml-2 font-mono">Ref: {d.deposit_reference}</span>
                            )}
                          </div>
                          <span className="font-bold font-mono text-indigo-300">
                            LKR {Number(d.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {existingRecord.notes && (
                <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-medium">Reconciliation Notes: </span>
                  <span className="text-slate-200">{existingRecord.notes}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* If staff is editing a previously submitted record, show reminder banner */}
              {!isOwner && existingRecord && staffEditingSubmitted && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    You are editing today&apos;s previously submitted reconciliation. Make your adjustments and click &quot;Confirm &amp; Post&quot; below.
                  </span>
                  <button
                    type="button"
                    onClick={() => setStaffEditingSubmitted(false)}
                    className="text-xs text-amber-400 hover:text-amber-200 font-semibold underline ml-2"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

          {/* TOP SUMMARY CARDS (A, B, C, D, E, F) */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Card A: Opening Float */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold text-slate-300">A. Opening Float</span>
                <button
                  type="button"
                  onClick={() => setIsFloatLocked(!isFloatLocked)}
                  className="text-slate-400 hover:text-amber-400 transition"
                  title={isFloatLocked ? 'Float is locked from previous day. Click to edit.' : 'Lock float'}
                >
                  {isFloatLocked ? <Lock className="w-3.5 h-3.5 text-slate-500" /> : <Unlock className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
              {isFloatLocked ? (
                <div className="text-xl font-bold text-slate-100">
                  LKR {openingFloatA.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">LKR</span>
                  <input
                    type="number"
                    step="0.01"
                    value={openingFloatA || ''}
                    onChange={(e) => setOpeningFloatA(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-amber-500/40 rounded px-2 py-0.5 text-sm font-bold text-amber-300 outline-none"
                  />
                </div>
              )}
              <div className="text-[11px] text-slate-500 mt-2">Yesterday’s closing carryover</div>
            </div>

            {/* Card B: Cash Expenses */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold text-slate-300">B. Cash Expenses</span>
                <span className="text-[10px] text-slate-500">Paid Out</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">LKR</span>
                <input
                  type="number"
                  step="0.01"
                  value={cashExpensesB || ''}
                  onChange={(e) => setCashExpensesB(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded px-2 py-0.5 text-sm font-bold text-slate-100 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Tea, supplies, courier etc.</div>
            </div>

            {/* Card C: Physical Cash Accounted */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold text-slate-300">C. Cash Accounted</span>
                <Coins className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-400">
                LKR {physicalCashC.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {countMode === 'after_banking' ? 'Drawer (F) + Banked (E)' : 'Live physical drawer count'}
              </div>
            </div>

            {/* Card D: Actual Net Cash Income */}
            <div className="bg-slate-900/90 border border-emerald-500/30 bg-emerald-950/10 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
                <span className="font-bold">D. Net Cash Income</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-emerald-400">
                LKR {actualNetIncomeD.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-2">(C + B) - A</div>
            </div>

            {/* Card E: Total Bank Deposits */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold text-slate-300">E. Banked Today</span>
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-indigo-400">
                LKR {totalBankDepositsE.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Dispatched to bank accounts</div>
            </div>

            {/* Card F: Tomorrow's Opening Float */}
            <div className="bg-slate-900 border border-purple-500/30 bg-purple-950/10 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-400 text-xs mb-1">
                <span className="font-bold">F. Tomorrow Float</span>
                <Banknote className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-black text-purple-300">
                LKR {closingCashF.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-purple-400/80 mt-2">
                {countMode === 'after_banking' ? 'Counted in drawer (F)' : 'Remains in drawer (C - E)'}
              </div>
            </div>
          </div>

          {/* ZERO-VARIANCE & SHORTAGE BREAKDOWN BANNER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Zero-Variance Cash Reconciliation Check
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">System POS Cash Sales: </span>
                    <strong className="text-slate-200">
                      LKR {systemCashSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  {modakaSalesTotal > 0 && (
                    <div className="px-2.5 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                      <span className="text-purple-300 font-medium">Special Sales (Shift Ledger): </span>
                      <strong className="text-purple-200">
                        +LKR {modakaSalesTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Total Expected Cash: </span>
                    <strong className="text-amber-300">
                      LKR {totalExpectedSalesCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Actual Net Income (D): </span>
                    <strong className="text-emerald-400">
                      LKR {actualNetIncomeD.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-3">
                {varianceStatus === 'balanced' && (
                  <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    BALANCED — ZERO VARIANCE (LKR 0.00)
                  </div>
                )}
                {varianceStatus === 'shortage' && (
                  <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    CASH SHORTAGE: LKR {varianceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                )}
                {varianceStatus === 'overage' && (
                  <div className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-cyan-400" />
                    CASH OVERAGE: +LKR {Math.abs(varianceAmount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            {/* Shortage Attribution Sub-Panel */}
            {varianceStatus === 'shortage' && (
              <div className="mt-4 pt-4 border-t border-slate-800/60 bg-rose-950/20 rounded-xl p-4 border border-rose-900/40">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm mb-2">
                  <UserCheck className="w-4 h-4 text-rose-400" />
                  Automatic Cashier Shortage Attribution & Payroll Deduction
                </div>
                <p className="text-xs text-rose-200/80 mb-3">
                  This cash shortage will be recorded against the active cashier(s) and logged for monthly payroll deduction.
                </p>

                {cashierSummaries.length > 0 ? (
                  <div className="space-y-2">
                    {cashierSummaries.map((cashier) => {
                      const allocatedAmt = shortageSplit[cashier.cashier_id] || 0;
                      return (
                        <div
                          key={cashier.cashier_id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-900/80 border border-rose-900/30 rounded-lg text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200">{cashier.cashier_name}</span>
                            <span className="text-slate-400 ml-2">
                              (Cash Sales: LKR {cashier.cash_sales.toLocaleString('en-LK', { minimumFractionDigits: 2 })} across{' '}
                              {cashier.bill_count} bills)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Shortage Attributed: LKR</span>
                            <input
                              type="number"
                              step="0.01"
                              value={allocatedAmt || ''}
                              onChange={(e) =>
                                setShortageSplit((prev) => ({
                                  ...prev,
                                  [cashier.cashier_id]: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-28 bg-slate-950 border border-rose-700/60 rounded px-2 py-1 text-rose-300 font-bold outline-none text-right"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/80 border border-rose-900/30 rounded-lg text-xs text-slate-300 flex items-center justify-between">
                    <span>Zero terminal sales today. Shortage attributed to submitting cashier ({loggedInCashierName}):</span>
                    <span className="font-bold text-rose-400">
                      LKR {varianceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TWO COLUMN GRID: DENOMINATION COUNTER & BANK DEPOSIT TRACKER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: PHYSICAL CASH DENOMINATION COUNTER */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <div>
                      <h2 className="text-base font-bold text-slate-100">
                        {countMode === 'after_banking'
                          ? 'Physical Cash Denomination Counter — Drawer Remaining (F)'
                          : 'Physical Cash Denomination Counter — All Cash (C)'}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        {countMode === 'after_banking'
                          ? 'Count notes & coins left in drawer for tomorrow’s opening float'
                          : 'Count all physical cash before dispatching bank deposits'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const reset: Record<number, number> = {};
                      SRI_LANKA_DENOMINATIONS.forEach((d) => (reset[d] = 0));
                      setDenominations(reset);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    Reset All
                  </button>
                </div>

                {/* 2-Option Counting Mode Switcher */}
                <div className="mb-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>When are you counting the drawer?</span>
                    <span className="text-[10px] text-amber-400 font-semibold">
                      {countMode === 'after_banking' ? 'Already Banked' : 'Before Banking'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCountMode('after_banking')}
                      className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                        countMode === 'after_banking'
                          ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            countMode === 'after_banking'
                              ? 'border-amber-400 bg-amber-400'
                              : 'border-slate-600 bg-transparent'
                          }`}
                        >
                          {countMode === 'after_banking' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </div>
                        <span className={countMode === 'after_banking' ? 'text-amber-300' : 'text-slate-300'}>
                          Already Banked
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5.5 leading-snug">
                        Count <strong>ONLY</strong> cash remaining in drawer (F). Banked today (E) is automatically added to total C.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCountMode('before_banking')}
                      className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                        countMode === 'before_banking'
                          ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            countMode === 'before_banking'
                              ? 'border-amber-400 bg-amber-400'
                              : 'border-slate-600 bg-transparent'
                          }`}
                        >
                          {countMode === 'before_banking' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                        </div>
                        <span className={countMode === 'before_banking' ? 'text-amber-300' : 'text-slate-300'}>
                          Before Banking
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5.5 leading-snug">
                        Count <strong>ALL</strong> cash in drawer (C) before dispatching bank deposits. Tomorrow float F = C - E.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs border-b border-slate-800 pb-2">
                        <th className="py-2">Denomination</th>
                        <th className="py-2 text-center">Type</th>
                        <th className="py-2 text-center w-28">Count</th>
                        <th className="py-2 text-right">Subtotal (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {SRI_LANKA_DENOMINATIONS.map((denom) => {
                        const count = denominations[denom] || 0;
                        const subtotal = denom * count;
                        const isNote = denom >= 20;

                        return (
                          <tr key={denom} className="hover:bg-slate-800/30 transition">
                            <td className="py-2.5 font-bold">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded text-xs font-black ${
                                  denom === 5000
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : denom === 2000
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : denom === 1000
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : denom === 500
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : denom === 100
                                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                    : isNote
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                Rs. {denom.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 text-center text-xs text-slate-400">
                              {isNote ? 'Note' : 'Coin'}
                            </td>
                            <td className="py-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                value={count === 0 ? '' : count}
                                placeholder="0"
                                onChange={(e) => handleDenominationChange(denom, e.target.value)}
                                className="w-24 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded px-2.5 py-1 text-center font-bold text-slate-100 outline-none transition"
                              />
                            </td>
                            <td className="py-2.5 text-right font-semibold text-slate-200">
                              {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Physical Cash Summary */}
              <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {countMode === 'after_banking' ? 'Counted in Drawer for Tomorrow (F):' : 'Physical Cash Counted (C):'}
                  </span>
                  <span className="font-bold text-slate-200">
                    LKR {countedDenominationsTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {countMode === 'after_banking' && (
                  <div className="flex items-center justify-between text-xs text-indigo-400 pt-1 border-t border-slate-800/60">
                    <span>+ Dispatched Bank Deposits (E):</span>
                    <span className="font-semibold">+ LKR {totalBankDepositsE.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-sm font-bold text-slate-200">Total Cash Accounted (C):</span>
                  <span className="text-xl font-black text-amber-400">
                    LKR {physicalCashC.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: BANK DEPOSIT TRACKER */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-base font-bold text-slate-100">Bank Deposit Tracker (E)</h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDepositRow}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Bank Row
                  </button>
                </div>

                {/* Repeatable Bank Rows */}
                <div className="space-y-3">
                  {bankDeposits.map((deposit, index) => (
                    <div
                      key={index}
                      className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">Deposit Entry #{index + 1}</span>
                        {bankDeposits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDepositRow(index)}
                            className="text-slate-500 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Bank Selector */}
                        <div>
                          <label className="block text-slate-400 mb-1">Bank Name</label>
                          <select
                            value={deposit.bank_name}
                            onChange={(e) => handleDepositChange(index, 'bank_name', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          >
                            {SRI_LANKA_BANKS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Account Number */}
                        <div>
                          <label className="block text-slate-400 mb-1">Account Number</label>
                          <select
                            value={deposit.account_number}
                            onChange={(e) => handleDepositChange(index, 'account_number', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          >
                            {companyBankAccounts
                              .filter((a) => a.bank_name.toLowerCase() === deposit.bank_name.toLowerCase())
                              .map((a) => (
                                <option key={a.id} value={a.account_number}>
                                  {a.account_number} ({a.account_name})
                                </option>
                              ))}
                            <option value={deposit.account_number || 'custom'}>
                              {deposit.account_number || 'Default Account'}
                            </option>
                          </select>
                        </div>

                        {/* Deposit Amount */}
                        <div>
                          <label className="block text-slate-400 mb-1">Deposit Amount (LKR)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={deposit.amount || ''}
                            placeholder="0.00"
                            onChange={(e) => handleDepositChange(index, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded px-2.5 py-1.5 font-bold text-slate-100 outline-none text-right"
                          />
                        </div>

                        {/* Deposit Slip / Ref No */}
                        <div>
                          <label className="block text-slate-400 mb-1">Deposit Slip / Ref #</label>
                          <input
                            type="text"
                            value={deposit.deposit_reference || ''}
                            placeholder="e.g. SLIP-8921"
                            onChange={(e) => handleDepositChange(index, 'deposit_reference', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes Input */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Reconciliation Notes / Paid-out explanations
                  </label>
                  <textarea
                    rows={2}
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Enter cashier shift notes, petty cash paid out explanations, or discrepancy reasons..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-slate-700"
                  />
                </div>
              </div>

              {/* Total Bank Deposits Summary & Submit Button */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-sm font-bold text-slate-300">Total Bank Deposits (E):</span>
                  <span className="text-xl font-black text-indigo-400">
                    LKR {totalBankDepositsE.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm & Post End-of-Day Reconciliation
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )}

      {/* ========================================================= */}
      {/* VIEW 6: COMPANY BANK ACCOUNTS CATALOG */}
      {/* ========================================================= */}
      {activeTab === 'bank_accounts' && isOwner && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100">Authorized Company Bank Accounts</h2>
              <p className="text-xs text-slate-400">
                Official accounts used for daily branch cash banking, electronic transfers, and passbook audits.
              </p>
            </div>
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add Bank Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companyBankAccounts.map((acc) => (
              <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-black">
                    {acc.bank_name}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </span>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-slate-100 tracking-wider">
                    {acc.account_number}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5 font-medium">{acc.account_name}</div>
                  {acc.branch_name && (
                    <div className="text-[11px] text-slate-500 mt-1">Designated Branch: {acc.branch_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DENOMINATIONS BREAKDOWN MODAL */}
      {/* ========================================================= */}
      {selectedRecForDenoms && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    Denominations Breakdown Audit
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedRecForDenoms.branch_name} • Date: {selectedRecForDenoms.reconciliation_date} • Submitted by: {selectedRecForDenoms.submitter_name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecForDenoms(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reconciliation Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block">Opening Float A:</span>
                <span className="font-mono font-bold text-slate-200">
                  LKR {selectedRecForDenoms.opening_float_a.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Physical Cash C:</span>
                <span className="font-mono font-bold text-amber-400">
                  LKR {selectedRecForDenoms.physical_cash_c.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Actual Net Income D:</span>
                <span className="font-mono font-bold text-emerald-400">
                  LKR {selectedRecForDenoms.actual_net_income_d.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Variance:</span>
                <span
                  className={`font-mono font-bold ${
                    selectedRecForDenoms.status === 'balanced'
                      ? 'text-emerald-400'
                      : selectedRecForDenoms.status === 'shortage'
                      ? 'text-rose-400'
                      : 'text-cyan-400'
                  }`}
                >
                  {selectedRecForDenoms.status === 'balanced'
                    ? '0.00 (Balanced)'
                    : `LKR ${selectedRecForDenoms.variance_amount.toFixed(2)} (${selectedRecForDenoms.status})`}
                </span>
              </div>
            </div>

            {/* Denomination Notes & Coins Grid */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Denomination</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-center">Count</th>
                    <th className="py-2.5 px-3 text-right">Subtotal (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {SRI_LANKA_DENOMINATIONS.map((d) => {
                    const count = Number((selectedRecForDenoms.denominations as any)[d]) || 0;
                    const subtotal = d * count;
                    const isNote = d >= 20;

                    return (
                      <tr key={d} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-bold text-slate-200">
                          Rs. {d.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">
                          {isNote ? 'Note' : 'Coin'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-300">
                          {count}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-200 font-semibold">
                          {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bank Deposits Dispatched on this Date */}
            {selectedRecForDenoms.bank_deposits && selectedRecForDenoms.bank_deposits.length > 0 && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Bank Deposits Dispatched on {selectedRecForDenoms.reconciliation_date}:
                </div>
                <div className="divide-y divide-slate-800">
                  {selectedRecForDenoms.bank_deposits.map((dep, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-200">{dep.bank_name}</span>
                        <span className="text-slate-400 ml-2">A/C: {dep.account_number}</span>
                        {dep.deposit_reference && (
                          <span className="text-amber-400 ml-2 font-mono">Ref: {dep.deposit_reference}</span>
                        )}
                      </div>
                      <div className="font-mono font-bold text-indigo-300">
                        LKR {dep.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes if any */}
            {selectedRecForDenoms.notes && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="font-bold text-slate-300 mb-1">Reconciliation Shift Notes:</div>
                <p className="text-slate-400 italic">{selectedRecForDenoms.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRecForDenoms(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONFIRMATION MODAL (Worksheet Submit) */}
      {/* ========================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Confirm Daily Cash Reconciliation</h3>
                <p className="text-xs text-slate-400">Date: {selectedDate} • {currentBranchName}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>A. Opening Float:</span>
                <span className="font-mono text-slate-200">
                  LKR {openingFloatA.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>B. Cash Expenses / Paid Out:</span>
                <span className="font-mono text-slate-200">
                  LKR {cashExpensesB.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{countMode === 'after_banking' ? 'Counted in Drawer (F):' : 'Physical Cash Counted (C):'}</span>
                <span className="font-mono text-slate-200">
                  LKR {countedDenominationsTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>C. Total Cash Accounted:</span>
                <span className="font-mono text-amber-400 font-bold">
                  LKR {physicalCashC.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2">
                <span className="font-semibold text-emerald-400">D. Actual Net Income:</span>
                <span className="font-mono font-bold text-emerald-400">
                  LKR {actualNetIncomeD.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>E. Bank Deposits Dispatched:</span>
                <span className="font-mono text-indigo-400 font-bold">
                  LKR {totalBankDepositsE.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>F. Tomorrow’s Drawer Float:</span>
                <span className="font-mono text-purple-300 font-bold">
                  LKR {closingCashF.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-2 font-bold">
                <span>Variance (System Sales - D):</span>
                <span
                  className={
                    varianceStatus === 'balanced'
                      ? 'text-emerald-400'
                      : varianceStatus === 'shortage'
                      ? 'text-rose-400'
                      : 'text-cyan-400'
                  }
                >
                  {varianceStatus === 'balanced'
                    ? 'LKR 0.00 (BALANCED)'
                    : `LKR ${varianceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })} (${varianceStatus.toUpperCase()})`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
              >
                Back to Worksheet
              </button>
              <button
                type="button"
                onClick={handleSaveReconciliation}
                disabled={submitting}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Post to Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD BANK ACCOUNT MODAL */}
      {/* ========================================================= */}
      {showAddAccountModal && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleAddCompanyAccount}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Add Company Bank Account</h3>
                <p className="text-xs text-slate-400">Configure new deposit destination account</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Bank Name</label>
                <select
                  value={newAccountForm.bank_name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, bank_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none"
                >
                  {SRI_LANKA_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 84200192"
                  value={newAccountForm.account_number}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account Name (Beneficiary)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deegayu Weda Madhura (Pvt) Ltd"
                  value={newAccountForm.account_name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Branch Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dambadeniya"
                  value={newAccountForm.branch_name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, branch_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition"
              >
                Save Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SET BRANCH OPENING FLOAT MODAL */}
      {showSetBranchFloatModal && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSetBranchOpeningFloat}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Set Branch Opening Float</h3>
                  <p className="text-xs text-slate-400">Owner starting cash control for shifts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetBranchFloatModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {branchFloatError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{branchFloatError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Target Branch
              </label>
              <select
                value={targetFloatBranchId}
                onChange={(e) => setTargetFloatBranchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                Starting Drawer Float (LKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">
                  LKR
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="e.g. 5000.00"
                  value={newOpeningFloatAmount}
                  onChange={(e) => setNewOpeningFloatAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-3 py-2 text-sm text-slate-100 font-mono font-bold outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Updates active open shift opening float or pre-seeds next shift opening float.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSetBranchFloatModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingBranchFloat}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingBranchFloat ? 'Saving Float...' : 'Confirm & Set Float'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT-ONLY AUDIT SLIP (Hidden on screen, visible on print) */}
      {/* ========================================================= */}
      <div className="hidden print:block text-black bg-white p-6 font-sans">
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-2xl font-black tracking-tight">{business?.name || 'Deegayu Weda Madhura'}</h2>
          <p className="text-sm font-semibold tracking-wide">EXECUTIVE CASH RECONCILIATION & BANKING REPORT</p>
          <p className="text-xs text-gray-600 mt-1">
            Branch: {activeBranchFilter === 'ALL' ? 'All Retail Branches' : currentBranchName} • Date Range: {selectedDate === selectedEndDate ? selectedDate : `${selectedDate} to ${selectedEndDate}`} • Printed on: {new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}
          </p>
        </div>

        {/* Executive Shift Tally Summary Block */}
        <div className="border p-3 rounded mb-4 text-xs">
          <h4 className="font-bold border-b pb-1 mb-2">PERIOD SUMMARY & CASH INFLOW OVERVIEW</h4>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-600 block">Total Cash Inflow:</span>
              <strong className="text-sm">LKR {shiftTallyKPIs.totalCashInflow.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">POS Cash Sales:</span>
              <strong className="text-sm">LKR {shiftTallyKPIs.totalPosCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">Special Stock Sales:</span>
              <strong className="text-sm">LKR {shiftTallyKPIs.totalSpecialSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">Bank Deposits Total:</span>
              <strong className="text-sm">LKR {shiftTallyKPIs.totalBanked.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">Expenses Paid Out:</span>
              <strong>LKR {(shiftTallyKPIs.totalGoodsPaid + shiftTallyKPIs.totalOtherExpenses).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">Drawer Cash Counted:</span>
              <strong>LKR {shiftTallyKPIs.totalCountedRemaining.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">Cash Shortages:</span>
              <strong className="text-rose-700">{shiftTallyKPIs.totalShortageAmount > 0 ? `-LKR ${shiftTallyKPIs.totalShortageAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : 'LKR 0.00'}</strong>
            </div>
            <div>
              <span className="text-gray-600 block">Cash Excess:</span>
              <strong className="text-emerald-700">{shiftTallyKPIs.totalExcessAmount > 0 ? `+LKR ${shiftTallyKPIs.totalExcessAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : 'LKR 0.00'}</strong>
            </div>
          </div>
        </div>

        {/* Detailed Shift-by-Shift Ledger if shifts exist */}
        {shiftTallyKPIs.filteredShifts.length > 0 && (
          <div className="border rounded mb-4 overflow-hidden text-xs">
            <div className="bg-gray-100 font-bold px-3 py-1.5 border-b">SHIFT HANDOVER LEDGER ({shiftTallyKPIs.filteredShifts.length} SHIFTS)</div>
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-1.5">Date</th>
                  <th className="p-1.5">Branch</th>
                  <th className="p-1.5">Shift</th>
                  <th className="p-1.5">Cashier</th>
                  <th className="p-1.5 text-right">Inflow (LKR)</th>
                  <th className="p-1.5 text-right">Paid Out (LKR)</th>
                  <th className="p-1.5 text-right">Banked (LKR)</th>
                  <th className="p-1.5 text-right">Counted Drawer</th>
                  <th className="p-1.5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {shiftTallyKPIs.filteredShifts.map((sh) => {
                  const inflow = (sh.opening_float || 0) + (sh.pos_cash_sales || 0) + (sh.modaka_total_amount || 0);
                  const paid = (sh.goods_purchased_paid || 0) + (sh.other_expenses || 0);
                  const counted = sh.counted_remaining_drawer_cash || sh.counted_drawer_cash || 0;
                  const variance = sh.cash_variance !== undefined ? sh.cash_variance : 0;
                  return (
                    <tr key={sh.id}>
                      <td className="p-1.5 font-sans">{sh.shift_date}</td>
                      <td className="p-1.5 font-sans">{sh.branch_name}</td>
                      <td className="p-1.5 font-sans font-bold">{formatShiftLabel(sh.shift_number)}</td>
                      <td className="p-1.5 font-sans">{sh.cashier_name}</td>
                      <td className="p-1.5 text-right">{inflow.toFixed(2)}</td>
                      <td className="p-1.5 text-right">{paid.toFixed(2)}</td>
                      <td className="p-1.5 text-right">{(sh.banked_amount || 0).toFixed(2)}</td>
                      <td className="p-1.5 text-right">{counted.toFixed(2)}</td>
                      <td className="p-1.5 text-right font-bold">
                        {variance < -0.01 ? `-${Math.abs(variance).toFixed(2)}` : variance > 0.01 ? `+${variance.toFixed(2)}` : '0.00'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div className="border p-2 rounded">
            <h4 className="font-bold mb-1">RECONCILIATION SUMMARY</h4>
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>A. Opening Float:</span>
                <strong>LKR {openingFloatA.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>B. Cash Expenses / Paid Out:</span>
                <strong>LKR {cashExpensesB.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>C. Total Cash Accounted:</span>
                <strong>LKR {physicalCashC.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>D. Actual Net Income (C+B-A):</span>
                <strong>LKR {actualNetIncomeD.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>E. Bank Deposits Dispatched:</span>
                <strong>LKR {totalBankDepositsE.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>F. Tomorrow’s Drawer Float:</span>
                <strong>LKR {closingCashF.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>System Sales:</span>
                <span>LKR {systemCashSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Reconciliation Status:</span>
                <span className="uppercase">{varianceStatus} ({varianceAmount.toFixed(2)})</span>
              </div>
            </div>
          </div>

          <div className="border p-2 rounded">
            <h4 className="font-bold mb-1">DENOMINATION BREAKDOWN</h4>
            <div className="grid grid-cols-2 gap-x-2 text-[10px]">
              {SRI_LANKA_DENOMINATIONS.map((d) => (
                <div key={d} className="flex justify-between">
                  <span>Rs. {d}:</span>
                  <span>{denominations[d] || 0} ({((denominations[d] || 0) * d).toFixed(2)})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border p-2 rounded mb-6 text-xs">
          <h4 className="font-bold mb-1">BANK DEPOSITS</h4>
          {bankDeposits.map((dep, idx) => (
            <div key={idx} className="flex justify-between text-[11px] py-0.5">
              <span>
                {dep.bank_name} - {dep.account_number} ({dep.account_name || 'Main'})
              </span>
              <strong>LKR {Number(dep.amount).toFixed(2)}</strong>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
          <div className="border-t pt-1">
            <p className="font-bold">Cashier Signature</p>
          </div>
          <div className="border-t pt-1">
            <p className="font-bold">Manager Signature</p>
          </div>
          <div className="border-t pt-1">
            <p className="font-bold">Accounts / Auditor</p>
          </div>
        </div>
      </div>
    </div>
  );
}
