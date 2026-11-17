'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { useTenantBranch } from '../../../../context/tenant-branch-context';
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
} from '../../../../lib/reconciliation-api';

type TabView =
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
  const effectiveBranchId =
    selectedBranchId ||
    (allowedBranches.length > 0 && allowedBranches[0] ? allowedBranches[0].id : (branches.length > 0 && branches[0] ? branches[0].id : ''));

  // Get current date in Sri Lanka (UTC+5:30)
  const getTodaySriLanka = (): string => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const slTime = new Date(utcTime + 5.5 * 3600000);
    const datePart = slTime.toISOString().split('T')[0];
    return datePart || new Date().toISOString().slice(0, 10);
  };

  // Set default tab based on role and URL params (Strictly locked to worksheet for Staff)
  const [activeTab, setActiveTab] = useState<TabView>(() => {
    if (!isOwner) return 'worksheet';
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p && ['admin_summary', 'bank_register', 'shortages', 'ledger', 'worksheet', 'bank_accounts'].includes(p)) {
        return p as TabView;
      }
    }
    return 'admin_summary';
  });

  useEffect(() => {
    if (!isOwner) {
      setActiveTab('worksheet');
      return;
    }
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p && ['admin_summary', 'bank_register', 'shortages', 'ledger', 'worksheet', 'bank_accounts'].includes(p)) {
        setActiveTab(p as TabView);
      }
    }
  }, [isOwner]);

  const [staffEditingSubmitted, setStaffEditingSubmitted] = useState<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<string>(getTodaySriLanka());
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // ==========================================
  // TAB 1: ADMIN MULTI-BRANCH SUMMARY STATE
  // ==========================================
  const [summaryPreset, setSummaryPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [summaryStartDate, setSummaryStartDate] = useState<string>('');
  const [summaryEndDate, setSummaryEndDate] = useState<string>('');
  const [summaryBranchId, setSummaryBranchId] = useState<string>('ALL');
  const [summaryStatus, setSummaryStatus] = useState<string>('all');
  const [consolidatedSummaries, setConsolidatedSummaries] = useState<ConsolidatedReconciliationRow[]>([]);
  const [selectedRecForDenoms, setSelectedRecForDenoms] = useState<ConsolidatedReconciliationRow | null>(null);

  // ==========================================
  // TAB 2: BANK DEPOSIT REGISTER STATE
  // ==========================================
  const [bankFilterBank, setBankFilterBank] = useState<string>('ALL');
  const [bankFilterBranch, setBankFilterBranch] = useState<string>('ALL');
  const [bankSearch, setBankSearch] = useState<string>('');
  const [consolidatedBankDeposits, setConsolidatedBankDeposits] = useState<ConsolidatedBankDepositRow[]>([]);

  // ==========================================
  // TAB 3: CASHIER SHORTAGES STATE
  // ==========================================
  const [shortageCashierFilter, setShortageCashierFilter] = useState<string>('ALL');
  const [shortageBranchFilter, setShortageBranchFilter] = useState<string>('ALL');
  const [shortageStatusFilter, setShortageStatusFilter] = useState<'all' | 'pending_payroll' | 'deducted'>('all');
  const [consolidatedShortages, setConsolidatedShortages] = useState<CashierShortageRow[]>([]);

  // ==========================================
  // TAB 4: DAILY ACCOUNTS LEDGER STATE
  // ==========================================
  const [ledgerBranchFilter, setLedgerBranchFilter] = useState<string>('ALL');
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
    { bank_name: 'BOC', account_number: '84200192', account_name: 'Deegayu Weda Madura (Pvt) Ltd', amount: 0 },
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

  const physicalCashC = useMemo(() => {
    if (countMode === 'after_banking') {
      return countedDenominationsTotal + totalBankDepositsE;
    }
    return countedDenominationsTotal;
  }, [countMode, countedDenominationsTotal, totalBankDepositsE]);

  const closingCashF = useMemo(() => {
    if (countMode === 'after_banking') {
      return countedDenominationsTotal;
    }
    return countedDenominationsTotal - totalBankDepositsE;
  }, [countMode, countedDenominationsTotal, totalBankDepositsE]);

  const actualNetIncomeD = useMemo(() => {
    return physicalCashC + (Number(cashExpensesB) || 0) - (Number(openingFloatA) || 0);
  }, [physicalCashC, cashExpensesB, openingFloatA]);

  const varianceAmount = useMemo(() => {
    return Number((systemCashSales - actualNetIncomeD).toFixed(2));
  }, [systemCashSales, actualNetIncomeD]);

  const varianceStatus = useMemo((): 'balanced' | 'shortage' | 'overage' => {
    if (Math.abs(varianceAmount) < 0.01) return 'balanced';
    return varianceAmount > 0 ? 'shortage' : 'overage';
  }, [varianceAmount]);

  // ==========================================
  // DATA LOADING ENGINE
  // ==========================================
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setSaveSuccessMsg(null);

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
        setCompanyBankAccounts(bankAccs);

        if (effectiveBranchId) {
          const worksheet = await reconciliationApi.loadReconciliationWorksheet(effectiveBranchId, todayStr);
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
      setCompanyBankAccounts(bankAccs);

      // 2. Fetch Multi-Branch Reconciliations
      const recHistory = await reconciliationApi.getReconciliationHistory({
        branchId: summaryBranchId !== 'ALL' ? summaryBranchId : undefined,
        startDate: sDate,
        endDate: eDate,
        status: summaryStatus !== 'all' ? summaryStatus : undefined,
      });
      setConsolidatedSummaries(recHistory);

      // 3. Fetch Consolidated Bank Deposits
      const depositsReport = await reconciliationApi.getBankDepositsReport({
        branchId: bankFilterBranch !== 'ALL' ? bankFilterBranch : undefined,
        bankName: bankFilterBank !== 'ALL' ? bankFilterBank : undefined,
        startDate: sDate,
        endDate: eDate,
      });
      setConsolidatedBankDeposits(depositsReport);

      // 4. Fetch Consolidated Shortages
      const shortagesReport = await reconciliationApi.getShortagesReport({
        branchId: shortageBranchFilter !== 'ALL' ? shortageBranchFilter : undefined,
        cashierName: shortageCashierFilter !== 'ALL' ? shortageCashierFilter : undefined,
        statusFilter: shortageStatusFilter,
        startDate: sDate,
        endDate: eDate,
      });
      setConsolidatedShortages(shortagesReport);

      // 5. Fetch Consolidated Ledger
      const ledgerReport = await reconciliationApi.getConsolidatedLedger({
        branchId: ledgerBranchFilter !== 'ALL' ? ledgerBranchFilter : undefined,
        startDate: sDate,
        endDate: eDate,
        limit: 50,
      });
      setConsolidatedLedger(ledgerReport);

      // 6. If on worksheet tab or effective branch selected, load worksheet
      if (effectiveBranchId) {
        const worksheet = await reconciliationApi.loadReconciliationWorksheet(effectiveBranchId, selectedDate);
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
      }
    } catch (err) {
      console.error('Error loading consolidated reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  }, [
    isOwner,
    tenantId,
    effectiveBranchId,
    selectedDate,
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
    loadAllData();
  }, [loadAllData]);

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
      account_name: 'Deegayu Weda Madura (Pvt) Ltd',
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

      await reconciliationApi.submitReconciliation({
        tenantId,
        branchId: effectiveBranchId,
        reconciliationDate: selectedDate,
        openingFloatA,
        cashExpensesB,
        denominations,
        physicalCashC,
        actualNetIncomeD,
        totalBankDepositsE,
        closingCashF,
        systemCashSales,
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

  const currentBranchName = branches.find((b) => b.id === effectiveBranchId)?.name || 'Main Branch';

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

  // Staff members list for quick pills
  const KNOWN_STAFF = ['Shashini', 'Tharindu', 'Anusha', 'Kumari', 'Gindika'];

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
          {/* Refresh Button */}
          <button
            onClick={() => loadAllData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>

          {/* Print Button - Executive Admin Only */}
          {isOwner && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
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
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800/80 pb-2 overflow-x-auto">
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
                  onChange={(e) => setSummaryBranchId(e.target.value)}
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
                <div className="text-xs text-slate-400 mt-1">A/C: 84200192 (Deegayu Weda Madura)</div>
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
                  onChange={(e) => setBankFilterBranch(e.target.value)}
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
                  <span className="text-xs font-bold text-rose-400">Outstanding Pending Deductions</span>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-400">
                  LKR {shortageTotals.pendingAmt.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-[11px] text-rose-300/80 mt-3 pt-2 border-t border-rose-900/40">
                To be deducted from monthly cashier payroll
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-900/40 bg-emerald-950/20 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400">Total Settled / Deducted</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  LKR {shortageTotals.deductedAmt.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-[11px] text-emerald-300/80 mt-3 pt-2 border-t border-emerald-900/40">
                Settled through previous salary payouts
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">Staff with Pending Shortages</span>
                  <UserCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {Object.keys(shortageTotals.pendingPerCashier).length} Cashiers
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
                Active cash accounts under recovery
              </div>
            </div>
          </div>

          {/* Cashier Filter Pills */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-400">Quick Cashier Filter:</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShortageCashierFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  shortageCashierFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                All Cashiers ({consolidatedShortages.length})
              </button>

              {KNOWN_STAFF.map((name) => {
                const pendingAmt = shortageTotals.pendingPerCashier[name] || 0;
                return (
                  <button
                    key={name}
                    onClick={() => setShortageCashierFilter(name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      shortageCashierFilter === name
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>{name}</span>
                    {pendingAmt > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                        LKR {pendingAmt.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sub-Filters: Status & Branch */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Status:</span>
                  <select
                    value={shortageStatusFilter}
                    onChange={(e) => setShortageStatusFilter(e.target.value as any)}
                    className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
                  >
                    <option value="all">All Shortages</option>
                    <option value="pending_payroll">Pending Payroll Deduction</option>
                    <option value="deducted">Deducted / Settled</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Branch:</span>
                  <select
                    value={shortageBranchFilter}
                    onChange={(e) => setShortageBranchFilter(e.target.value)}
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

              {/* Export Button */}
              <button
                onClick={() => {
                  const headers = ['Date', 'Branch', 'Cashier Name', 'Shortage Amount (LKR)', 'Deduction Status', 'Deducted At', 'Notes'];
                  const rows = consolidatedShortages.map((s) => [
                    s.shortage_date,
                    s.branch_name,
                    s.cashier_name,
                    s.amount,
                    s.deduction_status,
                    s.deducted_at || 'Pending',
                    s.notes || '',
                  ]);
                  exportCsv('cashier-shortages-report', headers, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export Shortages CSV
              </button>
            </div>
          </div>

          {/* Shortages Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Cashier Name</th>
                    <th className="py-3 px-4 text-right">Shortage Amount</th>
                    <th className="py-3 px-4 text-center">Deduction Status</th>
                    <th className="py-3 px-4">Notes / Incident</th>
                    <th className="py-3 px-4 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {consolidatedShortages.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                        No cashier shortages recorded matching the filters. Zero-variance maintained!
                      </td>
                    </tr>
                  ) : (
                    consolidatedShortages.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-200 font-bold whitespace-nowrap">
                          {item.shortage_date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                          {item.branch_name}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-100 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{item.cashier_name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {item.branch_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-400 font-mono text-sm whitespace-nowrap">
                          LKR {Number(item.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {item.deduction_status === 'pending_payroll' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              Pending Payroll
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Deducted
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400 max-w-xs truncate">
                          {item.notes || 'End-of-day drawer discrepancy'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {item.deduction_status === 'pending_payroll' ? (
                            <button
                              onClick={() => handleMarkDeducted(item.id)}
                              className="px-3 py-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 text-xs font-bold text-emerald-400 transition"
                            >
                              Mark Deducted
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {item.deducted_at ? new Date(item.deducted_at).toLocaleDateString() : 'Settled'}
                            </span>
                          )}
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
                  onChange={(e) => setLedgerBranchFilter(e.target.value)}
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
                    value={effectiveBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Display / Picker */}
              {!isOwner ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 select-none text-xs">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-slate-200">{selectedDate} (Today)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

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
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">System Cash Sales: </span>
                    <strong className="text-slate-200">
                      LKR {systemCashSales.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
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
                  placeholder="e.g. Deegayu Weda Madura (Pvt) Ltd"
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

      {/* ========================================================= */}
      {/* PRINT-ONLY AUDIT SLIP (Hidden on screen, visible on print) */}
      {/* ========================================================= */}
      <div className="hidden print:block text-black bg-white p-6 font-sans">
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-2xl font-black tracking-tight">{business?.name || 'Deegayu Weda Madura'}</h2>
          <p className="text-sm font-semibold">DAILY CASH RECONCILIATION & DEPOSIT SLIP</p>
          <p className="text-xs text-gray-600">
            Branch: {currentBranchName} • Date: {selectedDate} • Printed on: {new Date().toLocaleString()}
          </p>
        </div>

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
