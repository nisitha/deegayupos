'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  LogOut,
  Layers,
  Banknote,
} from 'lucide-react';
import {
  CashierShiftDto,
  EndShiftPayload,
  shiftsApi,
} from '../../lib/api-client';
import { useTenantBranch } from '../../context/tenant-branch-context';

interface ShiftEndModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: CashierShiftDto | null;
  branchName: string;
  cashierName: string;
  onConfirmEndShift: (closedShift: CashierShiftDto) => void;
  branchId?: string | null;
  cashierId?: string | null;
  isOwner?: boolean;
}

const DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

export function ShiftEndModal({
  isOpen,
  onClose,
  activeShift,
  branchName,
  cashierName,
  onConfirmEndShift,
  branchId,
  cashierId,
  isOwner: propIsOwner,
}: ShiftEndModalProps) {
  const { isOwner: ctxIsOwner, user } = useTenantBranch();
  const isOwner = propIsOwner !== undefined ? propIsOwner : (ctxIsOwner && user?.role === 'OWNER');

  const [activeTab, setActiveTab] = useState<'MODAKA' | 'DENOMINATIONS' | 'SUMMARY'>('MODAKA');
  const [localShift, setLocalShift] = useState<CashierShiftDto | null>(activeShift);
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<
    { id: string; bankName: string; accountNumber: string; accountName: string; branchName?: string }[]
  >([]);

  // Section 1: Modaka entries state
  const [modakaRows, setModakaRows] = useState<
    {
      productId: string;
      productName: string;
      productSku?: string;
      openingQty: number;
      inQty: number;
      soldQty: number;
      appliedRate: number;
    }[]
  >([]);

  // Section 2: Denomination counts state (including 2000 LKR notes)
  const [counts, setCounts] = useState<Record<number, number>>({
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

  // Section 3: Shift Cash & Expense Summary state
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [declaredShiftSale, setDeclaredShiftSale] = useState<number>(0);
  const [goodsPurchasedPaid, setGoodsPurchasedPaid] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [bankedAmount, setBankedAmount] = useState<number>(0);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [customBankDetails, setCustomBankDetails] = useState<string>('');
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  useEffect(() => {
    if (activeShift) {
      setLocalShift(activeShift);
    }
  }, [activeShift]);

  // Initialize data on modal open
  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('MODAKA');
    setIsSubmitting(false);
    setIsSuccess(false);
    setErrorMessage(null);

    const initShift = async () => {
      let shift = activeShift;
      if (!shift) {
        setIsLoadingShift(true);
        const effectiveBranchId =
          branchId ||
          (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_selected_branch') : null);
        const effectiveCashierId =
          cashierId ||
          (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_cashier_id') : null);

        if (effectiveBranchId && effectiveCashierId) {
          const shiftRes = await shiftsApi.getOrCreateActiveShift(
            effectiveBranchId,
            effectiveCashierId,
            cashierName
          );
          if (shiftRes.success && shiftRes.data) {
            shift = shiftRes.data;
            setLocalShift(shift);
          }
        }
        setIsLoadingShift(false);
      } else {
        setLocalShift(shift);
      }

      if (shift) {
        // Initialize Modaka rows
        const rows = (shift.modakaEntries || []).map((e) => ({
          productId: e.productId,
          productName: e.productName || 'Special Item',
          productSku: e.productSku || '',
          openingQty: Number(e.openingQty || 0),
          inQty: Number(e.inQty || 0),
          soldQty: Number(e.soldQty || 0),
          appliedRate: Number(e.appliedRate || 250),
        }));
        setModakaRows(rows);

        // Initialize denominations from JSON or 0 (including 2000 LKR notes)
        const initialCounts: Record<number, number> = {
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
        };
        if (shift.denominationsJson && typeof shift.denominationsJson === 'object') {
          DENOMINATIONS.forEach((d) => {
            if (d in (shift.denominationsJson as any)) {
              initialCounts[d] = Number((shift.denominationsJson as any)[d] || 0);
            }
          });
        }
        setCounts(initialCounts);

        // Initialize expenses & float
        setOpeningFloat(Number(shift.openingFloat || 0));
        setDeclaredShiftSale(
          Number(shift.declaredShiftSale > 0 ? shift.declaredShiftSale : shift.posCashSales)
        );
        setGoodsPurchasedPaid(Number(shift.goodsPurchasedPaid || 0));
        setOtherExpenses(Number(shift.otherExpenses || 0));
        setBankedAmount(Number(shift.bankedAmount || 0));
        setHandoverNotes(shift.handoverNotes || '');
      }

      // Fetch company bank accounts
      shiftsApi.getCompanyBankAccounts().then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setBankAccounts(res.data);
          if (res.data[0]?.id) {
            setSelectedBankId(res.data[0].id);
          }
        }
      });
    };

    initShift();
  }, [isOpen, activeShift, branchId, cashierId, cashierName]);

  // Modaka calculations
  const modakaTotals = useMemo(() => {
    let sumA = 0;
    let sumB = 0;
    let sumC = 0;
    let sumD = 0;
    let sumE = 0;
    let sumF = 0;

    modakaRows.forEach((r) => {
      const c = r.openingQty + r.inQty;
      const e = c - r.soldQty;
      const f = r.soldQty * r.appliedRate;

      sumA += r.openingQty;
      sumB += r.inQty;
      sumC += c;
      sumD += r.soldQty;
      sumE += e;
      sumF += f;
    });

    return { sumA, sumB, sumC, sumD, sumE, sumF };
  }, [modakaRows]);

  const modakaUnitsTotal = modakaTotals.sumD;
  const modakaSalesTotal = modakaTotals.sumF;

  // Exact Shift Tally Math:
  // Counted Remaining Drawer Cash = Sum of counted notes/coins from Denominations
  const countedRemainingDrawerCash = useMemo(() => {
    return DENOMINATIONS.reduce((acc, d) => acc + d * (counts[d] || 0), 0);
  }, [counts]);

  // 1. Total Cash Inflow = openingFloat + systemPosCashSales + specialStockSalesTotal
  const totalCashInflow = useMemo(() => {
    return openingFloat + declaredShiftSale + modakaSalesTotal;
  }, [openingFloat, declaredShiftSale, modakaSalesTotal]);

  // 2. Expected Remaining Drawer Cash = Total Cash Inflow - goodsPurchasedPaid - otherExpenses - bankedAmount
  const expectedRemainingDrawerCash = useMemo(() => {
    return totalCashInflow - goodsPurchasedPaid - otherExpenses - bankedAmount;
  }, [totalCashInflow, goodsPurchasedPaid, otherExpenses, bankedAmount]);

  // 3. Cash Variance = Counted Remaining Drawer Cash - Expected Remaining Drawer Cash
  const cashVariance = useMemo(() => {
    return countedRemainingDrawerCash - expectedRemainingDrawerCash;
  }, [countedRemainingDrawerCash, expectedRemainingDrawerCash]);

  // 4. Carry-Forward Float for next shift: Save closing_float = Counted Remaining Drawer Cash
  const closingDrawerFloat = useMemo(() => {
    return countedRemainingDrawerCash;
  }, [countedRemainingDrawerCash]);

  if (!isOpen) return null;
  const currentShift = activeShift || localShift;

  // Handlers
  const handleModakaChange = (index: number, field: 'inQty' | 'soldQty', valueStr: string) => {
    const val = parseInt(valueStr.replace(/[^0-9]/g, ''), 10) || 0;
    setModakaRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    );
  };

  const handleCountChange = (denom: number, countStr: string) => {
    const clean = parseInt(countStr.replace(/[^0-9]/g, ''), 10) || 0;
    setCounts((prev) => ({ ...prev, [denom]: clean }));
  };

  const handleClearDenominations = () => {
    const cleared: Record<number, number> = {};
    DENOMINATIONS.forEach((d) => (cleared[d] = 0));
    setCounts(cleared);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const targetShift = activeShift || localShift;
    if (!targetShift) {
      setErrorMessage('No active shift found to complete handover.');
      setIsSubmitting(false);
      return;
    }

    let selectedBankStr = '';
    if (bankedAmount > 0) {
      const foundBank = bankAccounts.find((b) => b.id === selectedBankId);
      if (foundBank) {
        selectedBankStr = `${foundBank.bankName} (${foundBank.accountNumber} - ${foundBank.accountName}${foundBank.branchName ? ` • ${foundBank.branchName}` : ''
          })`;
      } else if (customBankDetails.trim()) {
        selectedBankStr = customBankDetails.trim();
      }
    }

    const payload: EndShiftPayload = {
      shiftId: targetShift.id,
      branchId: targetShift.branchId,
      cashierId: targetShift.cashierId,
      employeeName: cashierName,
      openingFloat,
      declaredShiftSale,
      goodsPurchasedPaid,
      otherExpenses,
      bankedAmount,
      bankAccountDetails: selectedBankStr,
      countedDrawerCash: countedRemainingDrawerCash,
      countedRemainingDrawerCash,
      closingDrawerFloat,
      denominationsJson: counts,
      handoverNotes: handoverNotes.trim(),
      modakaEntries: modakaRows.map((r) => ({
        productId: r.productId,
        openingQty: r.openingQty,
        inQty: r.inQty,
        soldQty: r.soldQty,
        appliedRate: r.appliedRate,
      })),
    };

    const res = await shiftsApi.closeShiftHandover(payload);
    setIsSubmitting(false);

    if (res.success && res.data) {
      setIsSuccess(true);
      setTimeout(() => {
        onConfirmEndShift(res.data);
        onClose();
        // Redirect to login to force clean handover
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pixelcraft_auth_token');
          localStorage.removeItem('pixelcraft_user');
          localStorage.removeItem('pixelcraft_active_cashier');
          window.location.href = '/login';
        }
      }, 1600);
    } else {
      setErrorMessage(res.error?.message || 'Failed to complete Shift Handover.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center font-bold text-white shadow-inner shrink-0">
              <Layers className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  End Shift Handover
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Shift {currentShift?.shiftNumber || 1}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium truncate max-w-[220px] sm:max-w-none">
                {branchName} • Cashier: <strong className="text-white">{cashierName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 pt-2.5 pb-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('MODAKA')}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'MODAKA'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>1. Special Stock</span>
            <span
              className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${activeTab === 'MODAKA'
                ? 'bg-purple-800 text-purple-200'
                : 'bg-slate-100 text-slate-600'
                }`}
            >
              {isOwner
                ? `${modakaUnitsTotal} units • LKR ${modakaSalesTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : `${modakaUnitsTotal} units`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DENOMINATIONS')}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'DENOMINATIONS'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
          >
            <Banknote className="w-4 h-4" />
            <span>2. Denominations</span>
            <span
              className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${activeTab === 'DENOMINATIONS'
                ? 'bg-purple-800 text-purple-200'
                : 'bg-slate-100 text-slate-600'
                }`}
            >
              LKR {countedRemainingDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUMMARY')}
            className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'SUMMARY'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
          >
            <Receipt className="w-4 h-4" />
            <span>3. Cash & Expenses</span>
            {isOwner && (
              cashVariance !== 0 ? (
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${cashVariance > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                >
                  {cashVariance > 0 ? `+${cashVariance.toFixed(0)}` : cashVariance.toFixed(0)}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Balanced
                </span>
              )
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoadingShift || !currentShift ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
              <span className="text-sm font-semibold text-slate-600">Loading active shift information...</span>
            </div>
          ) : isSuccess ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-lg font-black text-slate-900">Shift Handover Completed!</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Shift {currentShift.shiftNumber} has been officially closed and verified. Signing out cashier{' '}
                <strong>{cashierName}</strong> to allow the next shift cashier to sign in...
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: MODAKA LEDGER */}
              {activeTab === 'MODAKA' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        Special Stock & Sales Summary
                      </h4>
                      <p className="text-xs text-slate-500">
                        Opening stock carries forward automatically from previous closed shift. Enter incoming stock (B) and shift sales (D).
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-500 block">Total Sold Units:</span>
                      <span className="text-base font-black font-mono text-purple-700">
                        {modakaTotals.sumD} units
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-200 bg-white rounded-2xl overflow-x-auto shadow-2xs">
                    <table className="w-full min-w-[580px] text-xs text-left">
                      <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-8 text-center">#</th>
                          <th className="py-2.5 px-3 w-24">Item Code</th>
                          <th className="py-2.5 px-3 min-w-[150px] sticky left-0 bg-slate-100 z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">Special Item</th>
                          <th className="py-2.5 px-2 text-center w-20">A (Opening)</th>
                          <th className="py-2.5 px-2 text-center w-24 bg-amber-50/70 text-amber-900">
                            B (In)
                          </th>
                          <th className="py-2.5 px-2 text-center w-20 bg-slate-50">C (Balance)</th>
                          <th className="py-2.5 px-2 text-center w-24 bg-purple-50/70 text-purple-900">
                            D (Shift Sale)
                          </th>
                          <th className="py-2.5 px-2 text-center w-20 bg-emerald-50/70 text-emerald-900 font-bold">
                            E (Closing)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modakaRows.map((row, idx) => {
                          const totalAvail = row.openingQty + row.inQty;
                          const closing = totalAvail - row.soldQty;
                          return (
                            <tr key={row.productId} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-500">
                                {row.productSku || `MOD-0${idx + 1}`}
                              </td>
                              <td className="py-2.5 px-3 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                <span className="font-bold text-slate-800 block text-xs">
                                  {row.productName}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                                {row.openingQty}
                              </td>
                              <td className="py-1.5 px-2 text-center bg-amber-50/30">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.inQty || ''}
                                  onChange={(e) => handleModakaChange(idx, 'inQty', e.target.value)}
                                  className="w-16 h-10 px-1 text-center font-bold font-mono text-base sm:text-xs bg-white border border-amber-300 rounded-lg focus:border-amber-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 bg-slate-50/40">
                                {totalAvail}
                              </td>
                              <td className="py-1.5 px-2 text-center bg-purple-50/30">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.soldQty || ''}
                                  onChange={(e) => handleModakaChange(idx, 'soldQty', e.target.value)}
                                  className="w-16 h-10 px-1 text-center font-bold font-mono text-base sm:text-xs bg-white border border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-black text-emerald-700 bg-emerald-50/30">
                                {closing}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100/90 font-mono font-bold text-slate-800 text-xs border-t-2 border-slate-300">
                        <tr>
                          <td colSpan={3} className="py-2 px-3 uppercase text-[10px] tracking-wider text-slate-600">
                            Total Units
                          </td>
                          <td className="py-2 px-2 text-center">{modakaTotals.sumA}</td>
                          <td className="py-2 px-2 text-center text-amber-800">+{modakaTotals.sumB}</td>
                          <td className="py-2 px-2 text-center text-slate-900">{modakaTotals.sumC}</td>
                          <td className="py-2 px-2 text-center text-purple-800">{modakaTotals.sumD}</td>
                          <td className="py-2 px-2 text-center text-emerald-800">{modakaTotals.sumE}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('DENOMINATIONS')}
                      className="min-h-[44px] px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
                    >
                      <span>Proceed to Denomination Counter</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: DENOMINATIONS COUNTER */}
              {activeTab === 'DENOMINATIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        Drawer Cash Denomination Counter
                      </h4>
                      <p className="text-xs text-slate-500">
                        Count each note & coin in the cash drawer. Total cash automatically links to Shift Summary.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDenominations}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                    >
                      Clear All Counts
                    </button>
                  </div>

                  {/* Denominations Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DENOMINATIONS.map((d) => {
                      const count = counts[d] || 0;
                      const lineTotal = d * count;
                      return (
                        <div
                          key={d}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-purple-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-14 text-center py-1 rounded-lg text-xs font-mono font-black ${d >= 500
                                ? 'bg-purple-100 text-purple-900'
                                : d >= 20
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-slate-800'
                                }`}
                            >
                              {d.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-400">×</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={count > 0 ? count : ''}
                              onChange={(e) => handleCountChange(d, e.target.value)}
                              className="w-20 h-10 px-2 py-1 text-center font-mono font-bold text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-sans">Value (LKR)</span>
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Big Total Box */}
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Coins className="w-6 h-6 text-emerald-600" />
                      <div>
                        <h5 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Counted Remaining Drawer Cash
                        </h5>
                        <p className="text-[11px] text-emerald-700">
                          Total physical notes and coins remaining in cash drawer (excluding bank deposit)
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-black font-mono text-emerald-800">
                      LKR {countedRemainingDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('MODAKA')}
                      className="min-h-[44px] px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Special Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('SUMMARY')}
                      className="min-h-[44px] px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Proceed to Shift Summary</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: SHIFT CASH & EXPENSE SUMMARY */}
              {activeTab === 'SUMMARY' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Shift Cash & Expense Summary
                    </h4>
                    <p className="text-xs text-slate-500">
                      Reconcile cash inflows, supplier purchases paid from drawer, and specify banked amount.
                    </p>
                  </div>

                  {/* Reconcile Rows */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 divide-y divide-slate-100 text-xs">
                    {/* Financial Inflow Metrics (Exclusively visible to OWNER) */}
                    {isOwner && (
                      <>
                        {/* 1. Opening Drawer Float */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <span className="font-bold text-slate-800 block">
                              Opening Float
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Auto carried from previous shift closing float
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">LKR</span>
                            <input
                              type="number"
                              step="0.01"
                              value={openingFloat}
                              onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* 2. Declared Shift Sale */}
                        <div className="flex items-center justify-between pt-2.5">
                          <div>
                            <span className="font-bold text-slate-800 block">
                              Shift Sale Amount
                            </span>
                            <span className="text-[11px] text-purple-600 font-mono">
                              POS Live Cash Sales: LKR {currentShift ? currentShift.posCashSales.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">LKR</span>
                            <input
                              type="number"
                              step="0.01"
                              value={declaredShiftSale}
                              onChange={(e) => setDeclaredShiftSale(parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Special Sales (Auto-calculated from Special Stock Summary) */}
                        <div className="flex items-center justify-between pt-2.5 bg-purple-50/70 p-2.5 rounded-xl border border-purple-200/80">
                          <div>
                            <span className="font-bold text-purple-950 block">
                              Special Sales
                            </span>
                            <span className="text-[11px] text-purple-700 font-medium">
                              Auto-calculated from Special Stock Summary ({modakaUnitsTotal} units)
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-purple-900">
                            + LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Total Cash Inflow */}
                        <div className="flex items-center justify-between pt-2.5 font-bold bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100">
                          <div>
                            <span className="text-slate-900 block">
                              Total Cash Inflow:
                            </span>
                            <span className="text-[10px] text-indigo-700 font-medium">
                              Opening Float + POS Live Cash + Special Stock Sales
                            </span>
                          </div>
                          <span className="font-mono text-base font-black text-indigo-950">
                            LKR {totalCashInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}

                    {/* 3. Goods Purchased Paid */}
                    <div className="flex items-center justify-between pt-2.5">
                      <div>
                        <span className="font-bold text-rose-700 block">
                          Goods Purchased Paid Out
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Cash paid out to suppliers or incoming stock
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-400">- LKR</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={goodsPurchasedPaid || ''}
                          onChange={(e) => setGoodsPurchasedPaid(parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-right font-mono font-bold text-xs bg-rose-50/40 border border-rose-200 rounded-lg focus:bg-white focus:border-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 4. Other Expenses */}
                    <div className="flex items-center justify-between pt-2.5">
                      <div>
                        <span className="font-bold text-rose-700 block">
                          Other Expenses
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Petty cash, meals, transport, branch maintenance
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-400">- LKR</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={otherExpenses || ''}
                          onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-right font-mono font-bold text-xs bg-rose-50/40 border border-rose-200 rounded-lg focus:bg-white focus:border-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* 5. Banked Amount & Bank Selection */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 block">
                            Bank Deposit Amount
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Cash taken out from drawer to deposit into company bank
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">- LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={bankedAmount || ''}
                            onChange={(e) => setBankedAmount(parseFloat(e.target.value) || 0)}
                            className="w-28 px-2 py-1 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {bankedAmount > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block uppercase">
                              Deposit Bank Account
                            </label>
                            <select
                              value={selectedBankId}
                              onChange={(e) => setSelectedBankId(e.target.value)}
                              className="w-full mt-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                            >
                              {bankAccounts.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.bankName} - {b.accountNumber} ({b.accountName})
                                </option>
                              ))}
                              <option value="custom">Other / Custom Account</option>
                            </select>
                          </div>
                          {selectedBankId === 'custom' && (
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block uppercase">
                                Custom Bank & Slip Reference
                              </label>
                              <input
                                type="text"
                                placeholder="Bank, Branch, Reference"
                                value={customBankDetails}
                                onChange={(e) => setCustomBankDetails(e.target.value)}
                                className="w-full mt-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Drawer Tally Variance & Metrics (Exclusively visible to OWNER) */}
                    {isOwner && (
                      <>
                        {/* Expected Remaining Drawer Cash */}
                        <div className="flex items-center justify-between pt-2.5 font-bold bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
                          <div>
                            <span className="text-amber-950 block">
                              Expected Remaining Drawer Cash:
                            </span>
                            <span className="text-[10px] text-amber-700 font-medium">
                              Total Inflow - Purchases - Expenses - Bank Deposit
                            </span>
                          </div>
                          <span className="font-mono text-base font-black text-amber-950">
                            LKR {expectedRemainingDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Actual Counted Remaining Cash from Section 2 */}
                        <div className="flex items-center justify-between pt-2.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                          <div>
                            <span className="font-bold text-emerald-950 block">
                              Counted Remaining Drawer Cash:
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Sum of physical notes & coins counted in Tab 2. Denominations
                            </span>
                          </div>
                          <span className="font-mono text-base font-black text-emerald-800">
                            LKR {countedRemainingDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Cash Variance Display & Automatic Action Notice */}
                        <div
                          className={`p-3 rounded-2xl font-bold border transition-all ${cashVariance === 0
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : cashVariance > 0
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs'
                              : 'bg-rose-50 text-rose-900 border-rose-300 shadow-2xs'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase tracking-wider">
                              Cash Variance:{' '}
                              {cashVariance === 0
                                ? 'Balanced'
                                : cashVariance > 0
                                  ? 'Excess / Over (+)'
                                  : 'Shortage / Deficit (-)'}
                            </span>
                            <span className="font-mono text-base font-black">
                              {cashVariance > 0 ? '+' : ''}
                              LKR {cashVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium mt-1">
                            {cashVariance === 0 && (
                              <span className="text-slate-600">
                                ✓ Drawer cash tallies perfectly with calculated expectation.
                              </span>
                            )}
                            {cashVariance < 0 && (
                              <span className="text-rose-700 font-semibold">
                                ⚠️ Shortage of LKR {Math.abs(cashVariance).toLocaleString(undefined, { minimumFractionDigits: 2 })} will be automatically recorded as a Salary Deduction for {cashierName}.
                              </span>
                            )}
                            {cashVariance > 0 && (
                              <span className="text-emerald-700 font-semibold">
                                ✓ Excess of LKR {cashVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })} will be automatically recorded as Extra Income for the business.
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Closing Drawer Float (Auto Carried Forward to Next Shift) */}
                    <div className="pt-2">
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-xs">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider block">
                            Closing Drawer Float (Carried to Next Shift)
                          </span>
                          <span className="text-[10px] text-emerald-100 font-medium">
                            Auto carries forward as Shift {currentShift?.shiftNumber === 1 ? '2' : '1'} Opening Float
                          </span>
                        </div>
                        <span className="text-xl font-black font-mono">
                          LKR {countedRemainingDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Handover Notes */}
                    <div className="pt-3">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Handover Notes / Remarks
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Any notes for the next shift cashier or owner regarding shortages, cash, or branch inventory..."
                        value={handoverNotes}
                        onChange={(e) => setHandoverNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('DENOMINATIONS')}
                      className="min-h-[44px] px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Denominations</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={isSubmitting}
                      className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Closing Shift & Saving...</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="w-4 h-4" />
                          <span>Submit Shift Handover & Sign Out</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Persistent Mini Footer */}
        {!isSuccess && (
          <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 flex-wrap">
              <span>
                Drawer: <strong className="font-mono text-emerald-700">LKR {countedRemainingDrawerCash.toFixed(2)}</strong>
              </span>
              {isOwner && (
                <span>
                  Expected: <strong className="font-mono text-slate-900">LKR {expectedRemainingDrawerCash.toFixed(2)}</strong>
                </span>
              )}
              <span>
                Next Float:{' '}
                <strong className="font-mono text-purple-700">LKR {countedRemainingDrawerCash.toFixed(2)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[36px] sm:min-h-0 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 rounded-lg bg-slate-100 sm:bg-transparent text-center"
            >
              Cancel / Return to POS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
