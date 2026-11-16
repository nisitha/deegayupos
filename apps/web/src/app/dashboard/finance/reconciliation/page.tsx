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
} from 'lucide-react';
import { useTenantBranch } from '../../../../context/tenant-branch-context';
import {
  reconciliationApi,
  SRI_LANKA_DENOMINATIONS,
  SRI_LANKA_BANKS,
  type BankDepositItem,
  type CashierSalesSummary,
  type CashierShortageItem,
  type CompanyBankAccountRecord,
  type DailyAccountsLedgerRecord,
  type DailyCashReconciliationRecord,
} from '../../../../lib/reconciliation-api';

type TabView = 'worksheet' | 'shortages' | 'ledger' | 'bank_accounts';

export default function CashReconciliationPage() {
  const { business, branches, allowedBranches, selectedBranchId, setSelectedBranchId, user, isOwner } = useTenantBranch();

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

  const [activeTab, setActiveTab] = useState<TabView>('worksheet');
  const [selectedDate, setSelectedDate] = useState<string>(getTodaySriLanka());
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Reconciliation Worksheet State
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

  // Bank accounts catalog
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccountRecord[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [newAccountForm, setNewAccountForm] = useState({
    bank_name: 'BOC',
    account_number: '',
    account_name: '',
    branch_name: '',
  });

  // Ledger & Shortages tabs data
  const [shortagesList, setShortagesList] = useState<CashierShortageItem[]>([]);
  const [accountsLedgerList, setAccountsLedgerList] = useState<DailyAccountsLedgerRecord[]>([]);
  const [shortageFilter, setShortageFilter] = useState<'all' | 'pending_payroll' | 'deducted'>('all');

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // ==========================================
  // CALCULATIONS (Formulas A, B, C, D, E, F, Variance)
  // ==========================================

  // C = Physical Cash in Drawer
  const physicalCashC = useMemo(() => {
    return SRI_LANKA_DENOMINATIONS.reduce((sum, denom) => {
      const count = denominations[denom] || 0;
      return sum + denom * count;
    }, 0);
  }, [denominations]);

  // E = Total Bank Deposits
  const totalBankDepositsE = useMemo(() => {
    return bankDeposits.reduce((sum, dep) => sum + (Number(dep.amount) || 0), 0);
  }, [bankDeposits]);

  // D = Actual Net Cash Income = (C + B) - A
  const actualNetIncomeD = useMemo(() => {
    return physicalCashC + (Number(cashExpensesB) || 0) - (Number(openingFloatA) || 0);
  }, [physicalCashC, cashExpensesB, openingFloatA]);

  // F = Tomorrow's Opening Float = C - E
  const closingCashF = useMemo(() => {
    return physicalCashC - totalBankDepositsE;
  }, [physicalCashC, totalBankDepositsE]);

  // Variance = System Cash Sales - D
  // > 0 = Shortage (physical is LESS than system)
  // < 0 = Overage (physical is MORE than system)
  // = 0 = Balanced
  const varianceAmount = useMemo(() => {
    return Number((systemCashSales - actualNetIncomeD).toFixed(2));
  }, [systemCashSales, actualNetIncomeD]);

  const varianceStatus = useMemo((): 'balanced' | 'shortage' | 'overage' => {
    if (Math.abs(varianceAmount) < 0.01) return 'balanced';
    return varianceAmount > 0 ? 'shortage' : 'overage';
  }, [varianceAmount]);

  // ==========================================
  // DATA LOADING
  // ==========================================

  const loadData = useCallback(async () => {
    if (!effectiveBranchId) return;
    setLoading(true);
    setSaveSuccessMsg(null);

    try {
      // 1. Fetch bank accounts
      const bankAccs = await reconciliationApi.getBankAccounts(tenantId);
      setCompanyBankAccounts(bankAccs);

      // 2. Load worksheet
      const worksheet = await reconciliationApi.loadReconciliationWorksheet(effectiveBranchId, selectedDate);

      setSystemCashSales(worksheet.systemCashSales);
      setCashierSummaries(worksheet.cashierBreakdown);

      if (worksheet.existingRec) {
        // Populate existing record
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
        // Fresh worksheet for this date
        setExistingRecord(null);
        if (worksheet.previousClosingF !== null) {
          setOpeningFloatA(worksheet.previousClosingF);
          setIsFloatLocked(true);
        } else {
          setOpeningFloatA(0);
          setIsFloatLocked(false);
        }

        setCashExpensesB(worksheet.autoCashExpenses);

        // Reset denominations to 0
        const initialDenoms: Record<number, number> = {};
        SRI_LANKA_DENOMINATIONS.forEach((d) => {
          initialDenoms[d] = 0;
        });
        setDenominations(initialDenoms);

        // Default initial bank deposit from first company bank account if available
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

      // 3. Load Shortages & Ledger for other tabs
      const shortages = await reconciliationApi.getShortages(effectiveBranchId, shortageFilter);
      setShortagesList(shortages);

      const ledger = await reconciliationApi.getAccountsLedger(effectiveBranchId, 30);
      setAccountsLedgerList(ledger);
    } catch (err) {
      console.error('Error loading reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, selectedDate, tenantId, shortageFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize or update shortage split when cashierSummaries or varianceAmount changes
  useEffect(() => {
    if (varianceStatus === 'shortage' && varianceAmount > 0) {
      if (cashierSummaries.length === 1 && cashierSummaries[0]) {
        // Single cashier gets 100%
        setShortageSplit({ [cashierSummaries[0].cashier_id]: varianceAmount });
      } else if (cashierSummaries.length > 1) {
        // Proportional split based on cash sales volume
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
        // No cashier detected from sales
        setShortageSplit({ unassigned: varianceAmount });
      }
    } else {
      setShortageSplit({});
    }
  }, [varianceAmount, varianceStatus, cashierSummaries]);

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

      // If bank name changes, automatically pick corresponding account number
      if (field === 'bank_name') {
        const match = companyBankAccounts.find((a) => a.bank_name.toLowerCase() === String(value).toLowerCase());
        if (match) {
          nextItem.account_number = match.account_number;
          nextItem.account_name = match.account_name;
        }
      }

      // If account number changes, pick matching name
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
      // Build shortage attributions if shortage exists
      const shortageAttributions: { cashier_id?: string; cashier_name: string; amount: number }[] = [];
      if (varianceStatus === 'shortage' && varianceAmount > 0) {
        Object.entries(shortageSplit).forEach(([cId, amt]) => {
          if (amt > 0) {
            const cashier = cashierSummaries.find((c) => c.cashier_id === cId);
            shortageAttributions.push({
              cashier_id: cId !== 'unassigned' ? cId : undefined,
              cashier_name: cashier ? cashier.cashier_name : 'Staff Member',
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
      await loadData();
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
      loadData();
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
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Daily Cash Reconciliation & Banking</h1>
              <p className="text-sm text-slate-400">
                End-of-day physical drawer count, bank deposits, zero-variance check, and cashier shortages.
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar: Branch, Date, Refresh & Print */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Select */}
          {allowedBranches.length <= 1 && !isOwner ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 select-none">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">{currentBranchName}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">Assigned</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={effectiveBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
              >
                {allowedBranches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
            Print Sheet
          </button>
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
      {/* TABS NAVIGATION */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800/80 pb-2">
        <button
          onClick={() => setActiveTab('worksheet')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'worksheet'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          Daily Reconciliation Worksheet
        </button>

        <button
          onClick={() => setActiveTab('shortages')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'shortages'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Cashier Shortages & Payroll Deductions
          {shortagesList.filter((s) => s.deduction_status === 'pending_payroll').length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
              {shortagesList.filter((s) => s.deduction_status === 'pending_payroll').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'ledger'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Daily Accounts Ledger
        </button>

        <button
          onClick={() => setActiveTab('bank_accounts')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'bank_accounts'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Company Bank Accounts ({companyBankAccounts.length})
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DAILY RECONCILIATION WORKSHEET */}
      {/* ========================================================= */}
      {activeTab === 'worksheet' && (
        <div className="space-y-6">
          {/* Status banner for existing record */}
          {existingRecord && (
            <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs text-blue-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                This day was previously reconciled on{' '}
                {new Date(existingRecord.updated_at || existingRecord.created_at || '').toLocaleTimeString()} with status:{' '}
                <strong className="uppercase">{existingRecord.status}</strong>. You may adjust counts and re-submit.
              </span>
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

            {/* Card C: Physical Cash in Drawer */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="font-semibold text-slate-300">C. Cash in Drawer</span>
                <Coins className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-400">
                LKR {physicalCashC.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Live from denomination count</div>
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
              <div className="text-[10px] text-purple-400/80 mt-2">Remains in drawer (C - E)</div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ZERO-VARIANCE & SHORTAGE BREAKDOWN BANNER */}
          {/* ========================================================= */}
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

            {/* Shortage Attribution Sub-Panel (when variance is a shortage) */}
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
                    <span>No specific cashier tagged to sales today. Attributing to General Terminal Cashier:</span>
                    <span className="font-bold text-rose-400">
                      LKR {varianceAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* TWO COLUMN GRID: DENOMINATION COUNTER & BANK DEPOSIT TRACKER */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: PHYSICAL CASH DENOMINATION COUNTER */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base font-bold text-slate-100">Physical Cash Denomination Counter (C)</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const reset: Record<number, number> = {};
                      SRI_LANKA_DENOMINATIONS.forEach((d) => (reset[d] = 0));
                      setDenominations(reset);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 transition"
                  >
                    Reset All
                  </button>
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
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-sm font-bold text-slate-300">Total Drawer Cash (C):</span>
                <span className="text-xl font-black text-amber-400">
                  LKR {physicalCashC.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
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
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CASHIER SHORTAGES & PAYROLL DEDUCTIONS */}
      {/* ========================================================= */}
      {activeTab === 'shortages' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100">Cashier Shortages & Payroll Deductions Ledger</h2>
              <p className="text-xs text-slate-400">
                Track automatic cash shortage deductions attributed to terminal cashiers and settle payroll recovery.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Status Filter:</span>
              <select
                value={shortageFilter}
                onChange={(e) => setShortageFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-xs rounded px-2.5 py-1.5 text-slate-200 outline-none"
              >
                <option value="all">All Shortages</option>
                <option value="pending_payroll">Pending Payroll Deduction</option>
                <option value="deducted">Deducted from Salary</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Cashier Name</th>
                    <th className="py-3 px-4 text-right">Shortage Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {shortagesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                        No cash shortages recorded for this branch. Zero-variance maintained!
                      </td>
                    </tr>
                  ) : (
                    shortagesList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-300">{item.shortage_date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">{item.cashier_name}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-400">
                          LKR {Number(item.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
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
                        <td className="py-3 px-4 text-xs text-slate-400">{item.notes || 'End-of-day shortage'}</td>
                        <td className="py-3 px-4 text-right">
                          {item.deduction_status === 'pending_payroll' && (
                            <button
                              onClick={() => handleMarkDeducted(item.id)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-400 transition"
                            >
                              Mark Deducted
                            </button>
                          )}
                          {item.deduction_status === 'deducted' && (
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
      {/* TAB 3: DAILY ACCOUNTS LEDGER */}
      {/* ========================================================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <h2 className="text-base font-bold text-slate-100">Daily Accounts Ledger & Revenue Postings</h2>
            <p className="text-xs text-slate-400">
              Audit trail of daily net cash income, expenses, bank deposits, and drawer balances.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">System Sales</th>
                    <th className="py-3 px-4 text-right">Cash Expenses (B)</th>
                    <th className="py-3 px-4 text-right">Net Income (D)</th>
                    <th className="py-3 px-4 text-right">Banked (E)</th>
                    <th className="py-3 px-4 text-right">Closing Float (F)</th>
                    <th className="py-3 px-4 text-center">Variance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {accountsLedgerList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 text-sm">
                        No ledger entries posted yet. Confirm today’s reconciliation to post your first record.
                      </td>
                    </tr>
                  ) : (
                    accountsLedgerList.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-xs text-slate-300 font-bold">{entry.entry_date}</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          LKR {Number(entry.system_sales).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          LKR {Number(entry.cash_expenses).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          LKR {Number(entry.actual_net_income).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-400">
                          LKR {Number(entry.banked_amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-purple-300">
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
      {/* TAB 4: COMPANY BANK ACCOUNTS */}
      {/* ========================================================= */}
      {activeTab === 'bank_accounts' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-100">Authorized Company Bank Accounts</h2>
              <p className="text-xs text-slate-400">
                Official accounts used for daily cash deposits and electronic fund transfers.
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
                  <div className="text-xs text-slate-400 mt-0.5">{acc.account_name}</div>
                  {acc.branch_name && (
                    <div className="text-[11px] text-slate-500 mt-1">Branch: {acc.branch_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONFIRMATION MODAL */}
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
                <span>C. Physical Cash in Drawer:</span>
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
      {showAddAccountModal && (
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
                <span>C. Physical Cash in Drawer:</span>
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
                <span>F. Tomorrow’s Drawer Float (C-E):</span>
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
