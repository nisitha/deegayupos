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
  RotateCcw,
} from 'lucide-react';
import {
  CashierShiftDto,
  EndShiftPayload,
  shiftsApi,
} from '../../lib/api-client';
import { supabase } from '../../lib/supabase';
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
  const [isEditingOpeningFloat, setIsEditingOpeningFloat] = useState<boolean>(false);
  const [declaredShiftSale, setDeclaredShiftSale] = useState<number>(0);
  const [goodsPurchasedPaid, setGoodsPurchasedPaid] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [remainingDrawerCash, setRemainingDrawerCash] = useState<number>(0);
  const [isDrawerCashManualOverride, setIsDrawerCashManualOverride] = useState<boolean>(false);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [customBankDetails, setCustomBankDetails] = useState<string>('');
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  const isInitialZeroFloat = Number(localShift?.openingFloat || activeShift?.openingFloat || 0) === 0;
  const canEditOpeningFloat = isOwner || isInitialZeroFloat || isEditingOpeningFloat;

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
    setIsDrawerCashManualOverride(false);

    const initShift = async () => {
      let shift = activeShift;
      const effectiveBranchId =
        branchId ||
        (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_selected_branch') : null);
      const effectiveCashierId =
        cashierId ||
        (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_cashier_id') : null);

      // Query live branch stock levels via warehouses -> stock_levels
      const stockMap = new Map<string, number>();
      if (effectiveBranchId) {
        try {
          const { data: wh } = await supabase
            .from('warehouses')
            .select('id')
            .eq('branch_id', effectiveBranchId)
            .limit(1)
            .maybeSingle();

          if (wh?.id) {
            const { data: stockLevels } = await supabase
              .from('stock_levels')
              .select('product_id, quantity_on_hand')
              .eq('warehouse_id', wh.id);
            (stockLevels || []).forEach((sl: any) => {
              stockMap.set(sl.product_id, Number(sl.quantity_on_hand || 0));
            });
          }
        } catch (e) {
          console.warn('[ShiftEndModal] stock_levels query error:', e);
        }
      }

      if (!shift) {
        setIsLoadingShift(true);
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
        // Initialize Modaka rows with fallback to branch stock when openingQty === 0
        let rows = (shift.modakaEntries || []).map((e) => {
          const bStock = stockMap.get(e.productId) || 0;
          const open = Number(e.openingQty || 0) === 0 ? bStock : Number(e.openingQty || 0);
          return {
            productId: e.productId,
            productName: e.productName || 'Special Item',
            productSku: e.productSku || '',
            openingQty: open,
            inQty: Number(e.inQty || 0),
            soldQty: Number(e.soldQty || 0),
            appliedRate: Number(e.appliedRate || 250),
          };
        });

        if (rows.length === 0) {
          try {
            const configsRes = await shiftsApi.getModakaConfigs();
            if (configsRes.success && configsRes.data) {
              const activeConfigs = configsRes.data.filter((c) => c.isActive);
              rows = activeConfigs.map((c) => {
                const bStock = stockMap.get(c.productId) || 0;
                return {
                  productId: c.productId,
                  productName: c.productName,
                  productSku: '',
                  openingQty: bStock,
                  inQty: 0,
                  soldQty: 0,
                  appliedRate: c.customRate,
                };
              });
            }
          } catch (e) {
            console.warn('[ShiftEndModal] configs query error:', e);
          }
        }

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

        // Auto-pull live completed POS cash sales for this active shift window
        try {
          const liveSalesRes = await shiftsApi.getLiveShiftPosSales(
            effectiveBranchId || shift.branchId,
            shift.id,
            shift.startedAt
          );
          if (liveSalesRes.success && liveSalesRes.data) {
            setDeclaredShiftSale(liveSalesRes.data.posCashSales);
          } else {
            setDeclaredShiftSale(
              Number(shift.declaredShiftSale > 0 ? shift.declaredShiftSale : shift.posCashSales)
            );
          }
        } catch {
          setDeclaredShiftSale(
            Number(shift.declaredShiftSale > 0 ? shift.declaredShiftSale : shift.posCashSales)
          );
        }

        setGoodsPurchasedPaid(Number(shift.goodsPurchasedPaid || 0));
        setOtherExpenses(Number(shift.otherExpenses || 0));
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
  // Tab 2 Denominations = Notes & coins bundled for Bank Deposit
  const denominationsTotal = useMemo(() => {
    return DENOMINATIONS.reduce((acc, d) => acc + d * (counts[d] || 0), 0);
  }, [counts]);

  // Bank Deposit Amount is auto-populated from Tab 2 Denomination Counter
  const bankedAmount = denominationsTotal;

  // 1. Total Cash Inflow = openingFloat + declaredShiftSale (POS cash) + modakaSalesTotal (Special stock sales)
  const totalCashInflow = useMemo(() => {
    return openingFloat + declaredShiftSale + modakaSalesTotal;
  }, [openingFloat, declaredShiftSale, modakaSalesTotal]);

  // 2. Expected Remaining Drawer Cash (Closing Float) = Total Cash Inflow - goodsPurchasedPaid - otherExpenses - bankedAmount
  const expectedClosingDrawerFloat = useMemo(() => {
    return Math.max(
      0,
      Number(
        ((openingFloat + declaredShiftSale + modakaSalesTotal) -
          goodsPurchasedPaid -
          otherExpenses -
          denominationsTotal
        ).toFixed(2)
      )
    );
  }, [openingFloat, declaredShiftSale, modakaSalesTotal, goodsPurchasedPaid, otherExpenses, denominationsTotal]);

  // Auto-sync remainingDrawerCash to expectedClosingDrawerFloat unless manually overridden
  useEffect(() => {
    if (!isDrawerCashManualOverride) {
      setRemainingDrawerCash(expectedClosingDrawerFloat);
    }
  }, [expectedClosingDrawerFloat, isDrawerCashManualOverride]);

  // 3. Expected Remaining Drawer Cash for variance comparison
  const expectedRemainingDrawerCash = useMemo(() => {
    return totalCashInflow - goodsPurchasedPaid - otherExpenses - bankedAmount;
  }, [totalCashInflow, goodsPurchasedPaid, otherExpenses, bankedAmount]);

  // 4. Cash Variance = Counted Remaining Drawer Cash - Expected Remaining Drawer Cash
  const cashVariance = useMemo(() => {
    return remainingDrawerCash - expectedRemainingDrawerCash;
  }, [remainingDrawerCash, expectedRemainingDrawerCash]);

  // 5. Carry-Forward Float for next shift: Save closing_float = remainingDrawerCash
  const closingDrawerFloat = useMemo(() => {
    return remainingDrawerCash;
  }, [remainingDrawerCash]);

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
        selectedBankStr = `${foundBank.bankName} (${foundBank.accountNumber} - ${foundBank.accountName}${
          foundBank.branchName ? ` • ${foundBank.branchName}` : ''
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
      bankedAmount: denominationsTotal,
      bankAccountDetails: selectedBankStr,
      countedDrawerCash: remainingDrawerCash,
      countedRemainingDrawerCash: remainingDrawerCash,
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0B101D] text-slate-100 rounded-t-3xl sm:rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[#0E1527] via-[#1A1F38] to-[#16122E] border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-bold text-white shadow-inner shrink-0">
              <Layers className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  End Shift Handover
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Shift {currentShift?.shiftNumber || 1}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium truncate max-w-[260px] sm:max-w-none mt-0.5">
                {branchName} • Cashier: <strong className="text-slate-200">{cashierName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-slate-700"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-6 pt-3 pb-2.5 bg-[#0D1527] border-b border-slate-800/80 flex items-center gap-2.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('MODAKA')}
            className={`min-h-[52px] h-13 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-[15px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'MODAKA'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-400/30'
                : 'bg-[#131E35] text-slate-300 hover:text-white hover:bg-[#1A2744] border border-slate-700/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-300" />
            <span>1. Special Stock</span>
            <span
              className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                activeTab === 'MODAKA'
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-400/30'
                  : 'bg-[#0B101D] text-slate-400 border border-slate-800'
              }`}
            >
              {modakaUnitsTotal} units • LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DENOMINATIONS')}
            className={`min-h-[52px] h-13 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-[15px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'DENOMINATIONS'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-400/30'
                : 'bg-[#131E35] text-slate-300 hover:text-white hover:bg-[#1A2744] border border-slate-700/60'
            }`}
          >
            <Banknote className="w-4 h-4 text-indigo-300" />
            <span>2. Denominations</span>
            <span
              className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                activeTab === 'DENOMINATIONS'
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-400/30'
                  : 'bg-[#0B101D] text-slate-400 border border-slate-800'
              }`}
            >
              LKR {denominationsTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SUMMARY')}
            className={`min-h-[52px] h-13 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-[15px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'SUMMARY'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-400/30'
                : 'bg-[#131E35] text-slate-300 hover:text-white hover:bg-[#1A2744] border border-slate-700/60'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-300" />
            <span>3. Cash & Expenses</span>
            {isOwner && (
              cashVariance !== 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                    cashVariance > 0
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {cashVariance > 0 ? `+${cashVariance.toFixed(0)}` : cashVariance.toFixed(0)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                  Balanced
                </span>
              )
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0B101D]">
          {errorMessage && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-950/60 border border-rose-600/50 text-rose-300 text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {isLoadingShift || !currentShift ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3.5">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <span className="text-base font-semibold text-slate-300">Loading active shift information...</span>
            </div>
          ) : isSuccess ? (
            <div className="py-16 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
              <h4 className="text-2xl font-black text-white">Shift Handover Completed!</h4>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Shift {currentShift.shiftNumber} has been officially closed and verified. Signing out cashier{' '}
                <strong className="text-emerald-400">{cashierName}</strong> to allow the next shift cashier to sign in...
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: SPECIAL STOCK LEDGER */}
              {activeTab === 'MODAKA' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg sm:text-xl font-extrabold text-white">
                        Special Stock & Sales Summary
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Opening stock carries forward automatically from previous closed shift. Enter incoming stock (B) and shift sales (D).
                      </p>
                    </div>
                    <div className="text-right flex flex-col sm:items-end gap-1 shrink-0 bg-[#11182A] p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center sm:justify-end gap-2">
                        <span className="text-xs font-semibold text-slate-400">Total Sold Units:</span>
                        <span className="text-sm sm:text-base font-extrabold font-mono text-purple-400">
                          {modakaUnitsTotal} units
                        </span>
                      </div>
                      <div className="flex items-center sm:justify-end gap-2">
                        <span className="text-xs font-semibold text-slate-400">Total Special Stock Sales:</span>
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                          LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-800 bg-[#11182A] rounded-2xl overflow-x-auto shadow-xl">
                    <table className="w-full min-w-[780px] text-xs text-left">
                      <thead className="bg-[#0D1527] text-slate-300 uppercase font-bold text-[11px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-3 w-8 text-center text-slate-400">#</th>
                          <th className="py-3 px-3 w-28 text-slate-300">Item Code</th>
                          <th className="py-3 px-3 min-w-[150px] sticky left-0 bg-[#0D1527] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.4)] text-slate-200">Special Item</th>
                          <th className="py-3 px-2 text-center w-24 text-slate-300">A (Opening)</th>
                          <th className="py-3 px-2 text-center w-26 bg-amber-950/40 text-amber-300 border-x border-amber-900/30">
                            B (In)
                          </th>
                          <th className="py-3 px-2 text-center w-24 bg-[#0A0F1D] text-slate-300">C (Balance)</th>
                          <th className="py-3 px-2 text-center w-26 bg-purple-950/40 text-purple-300 border-x border-purple-900/30">
                            D (Shift Sale)
                          </th>
                          <th className="py-3 px-2 text-center w-24 bg-emerald-950/40 text-emerald-300 font-extrabold">
                            E (Closing)
                          </th>
                          <th className="py-3 px-3 text-right w-28 text-slate-300">
                            RATE (LKR)
                          </th>
                          <th className="py-3 px-3 text-right w-32 bg-emerald-950/40 text-emerald-300 font-extrabold">
                            SALES TOTAL (LKR)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {modakaRows.map((row, idx) => {
                          const totalAvail = row.openingQty + row.inQty;
                          const closing = totalAvail - row.soldQty;
                          const lineSales = row.soldQty * row.appliedRate;
                          return (
                            <tr key={row.productId} className="hover:bg-[#162038] transition-colors">
                              <td className="py-3 px-3 text-center font-bold text-slate-500">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-400">
                                {row.productSku || `MOD-0${idx + 1}`}
                              </td>
                              <td className="py-3 px-3 sticky left-0 bg-[#11182A] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.4)]">
                                <span className="font-semibold text-[15px] text-slate-100 block">
                                  {row.productName}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-base font-bold text-slate-300">
                                {row.openingQty}
                              </td>
                              <td className="py-2 px-2 text-center bg-amber-950/20 border-x border-amber-900/20">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.inQty || ''}
                                  onChange={(e) => handleModakaChange(idx, 'inQty', e.target.value)}
                                  className="w-20 h-10 px-2 text-center font-extrabold font-mono text-base bg-[#0A0F1D] text-amber-300 border border-amber-600/50 rounded-lg focus:border-amber-400 focus:outline-none"
                                />
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-base font-bold text-slate-200 bg-[#0A0F1D]/40">
                                {totalAvail}
                              </td>
                              <td className="py-2 px-2 text-center bg-purple-950/20 border-x border-purple-900/20">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.soldQty || ''}
                                  onChange={(e) => handleModakaChange(idx, 'soldQty', e.target.value)}
                                  className="w-20 h-10 px-2 text-center font-extrabold font-mono text-base bg-[#0A0F1D] text-purple-300 border border-purple-600/50 rounded-lg focus:border-purple-400 focus:outline-none"
                                />
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-base font-black text-emerald-400 bg-emerald-950/20">
                                {closing}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-[15px] font-bold text-slate-300">
                                {row.appliedRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-base font-black text-emerald-400 bg-emerald-950/20">
                                {lineSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-[#0D1527] font-mono font-bold text-slate-200 text-sm border-t-2 border-slate-700">
                        <tr>
                          <td colSpan={3} className="py-3 px-3 uppercase text-xs tracking-wider text-slate-400">
                            Total Units &amp; Sales
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-200">{modakaTotals.sumA}</td>
                          <td className="py-3 px-2 text-center font-bold text-amber-400">+{modakaTotals.sumB}</td>
                          <td className="py-3 px-2 text-center font-bold text-slate-100">{modakaTotals.sumC}</td>
                          <td className="py-3 px-2 text-center font-bold text-purple-400">{modakaTotals.sumD}</td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-400">{modakaTotals.sumE}</td>
                          <td className="py-3 px-3 text-right text-slate-500 font-normal">-</td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-black text-lg">
                            LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('DENOMINATIONS')}
                      className="min-h-[48px] px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all cursor-pointer w-full sm:w-auto"
                    >
                      <span>Proceed to Denomination Counter</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: DENOMINATIONS COUNTER */}
              {activeTab === 'DENOMINATIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg sm:text-xl font-extrabold text-white">
                        Bank Deposit Denomination Counter
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Count notes &amp; coins bundled for bank deposit. Total automatically populates Bank Deposit Amount.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDenominations}
                      className="text-xs sm:text-sm font-semibold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                    >
                      Clear All Counts
                    </button>
                  </div>

                  {/* Denominations Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {DENOMINATIONS.map((d) => {
                      const count = counts[d] || 0;
                      const lineTotal = d * count;
                      return (
                        <div
                          key={d}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#11182A] border border-slate-800 shadow-sm hover:border-purple-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-18 text-center py-1.5 rounded-xl text-sm font-mono font-black ${
                                d >= 500
                                  ? 'bg-purple-950/80 text-purple-200 border border-purple-600/40'
                                  : d >= 20
                                  ? 'bg-amber-950/80 text-amber-200 border border-amber-600/40'
                                  : 'bg-slate-800 text-slate-200 border border-slate-700'
                              }`}
                            >
                              {d.toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-slate-500">×</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={count > 0 ? count : ''}
                              onChange={(e) => handleCountChange(d, e.target.value)}
                              className="w-24 h-12 px-2 py-1 text-center font-mono font-extrabold text-xl tabular-nums bg-[#0A0F1D] text-white border border-slate-700 rounded-xl focus:border-purple-500 focus:bg-[#0E1528] focus:outline-none"
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 block font-medium">Value (LKR)</span>
                            <span className="font-mono font-extrabold text-base sm:text-lg text-slate-100">
                              {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Big Total Box */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-emerald-950/80 border border-emerald-500/40 flex items-center justify-between shadow-lg shadow-emerald-950/40">
                    <div className="flex items-center gap-3">
                      <Coins className="w-7 h-7 text-emerald-400" />
                      <div>
                        <h5 className="text-xs sm:text-sm font-extrabold text-emerald-300 uppercase tracking-wider">
                          BANK DEPOSIT DENOMINATION TOTAL
                        </h5>
                        <p className="text-xs text-emerald-200/80 mt-0.5">
                          Counted bank bundle auto-populates Bank Deposit Amount in Tab 3.
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-300">
                      LKR {denominationsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('MODAKA')}
                      className="min-h-[48px] px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Special Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('SUMMARY')}
                      className="min-h-[48px] px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
                    >
                      <span>Proceed to Shift Summary</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: SHIFT CASH & EXPENSE SUMMARY */}
              {activeTab === 'SUMMARY' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg sm:text-xl font-extrabold text-white">
                      Shift Cash & Expense Summary
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                      Side-by-side reconciliation of shift inflows, expenses, bank deposits, and next shift drawer float.
                    </p>
                  </div>

                  {/* 2-Column Responsive Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* LEFT COLUMN: CASH INFLOWS */}
                    <div className="bg-[#11182A] rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl">
                      <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-purple-400">
                          1. Cash Inflows (Shift Sales &amp; Float)
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          All amounts in LKR
                        </span>
                      </div>

                      {/* 1. Opening Drawer Float */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[15px] sm:text-base text-slate-200 block">
                              Opening Float
                            </span>
                            {isOwner && !isInitialZeroFloat && (
                              <button
                                type="button"
                                onClick={() => setIsEditingOpeningFloat(!isEditingOpeningFloat)}
                                className="text-xs font-bold text-purple-400 hover:text-purple-300 px-2 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded-lg transition-colors cursor-pointer"
                              >
                                {isEditingOpeningFloat ? 'Lock' : 'Edit'}
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            {isInitialZeroFloat
                              ? 'No prior closed shift — enter starting drawer cash'
                              : 'Carried forward from previous shift closing float'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-500">LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={openingFloat || ''}
                            onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                            readOnly={!canEditOpeningFloat}
                            className={`w-36 h-12 px-3 text-right font-mono text-lg sm:text-xl font-extrabold tabular-nums rounded-xl focus:outline-none ${
                              canEditOpeningFloat
                                ? 'bg-[#0A0F1D] text-white border border-slate-700 focus:border-purple-500 focus:bg-[#0E1528]'
                                : 'bg-[#0E1424] text-slate-400 border border-slate-800 cursor-not-allowed'
                            }`}
                          />
                        </div>
                      </div>

                      {/* 2. POS Cash Sales */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <span className="font-semibold text-[15px] sm:text-base text-slate-200 block">
                            POS Cash Sales
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Auto-pulled from completed cash bills in this shift
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-500">LKR</span>
                          <span className="w-36 h-12 px-3 flex items-center justify-end font-mono text-lg sm:text-xl font-extrabold tabular-nums rounded-xl bg-purple-950/40 text-purple-200 border border-purple-500/40">
                            {declaredShiftSale.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* 3. Special Stock Sales */}
                      <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-[15px] text-purple-200 block">
                            Special Stock Sales
                          </span>
                          <span className="text-xs text-purple-300 font-medium block mt-0.5">
                            Auto-calculated from Tab 1 Special Stock ({modakaUnitsTotal} units)
                          </span>
                        </div>
                        <span className="font-mono text-lg sm:text-xl font-black text-purple-300 shrink-0">
                          + LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Subtotal: Total Shift Cash Hero Box */}
                      <div className="p-4.5 rounded-xl bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border border-indigo-500/40 flex items-center justify-between shadow-lg">
                        <div>
                          <span className="text-[15px] font-black text-indigo-200 block">
                            Total Shift Cash Inflow
                          </span>
                          <span className="text-xs text-indigo-300/80 font-medium block mt-0.5">
                            Opening Float + POS Cash + Special Sales
                          </span>
                        </div>
                        <span className="font-mono text-2xl sm:text-3xl font-black text-indigo-200">
                          LKR {totalCashInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: DEDUCTIONS, BANK DEPOSIT & CLOSING FLOAT */}
                    <div className="bg-[#11182A] rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-4 shadow-xl">
                      <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                          2. Deductions &amp; Drawer Float
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Carried to Next Shift
                        </span>
                      </div>

                      {/* Goods Purchased Paid */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <span className="font-semibold text-[15px] sm:text-base text-rose-300 block">
                            Goods Purchased Paid Out
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Cash paid out to suppliers or incoming stock
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-rose-400">- LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={goodsPurchasedPaid || ''}
                            onChange={(e) => setGoodsPurchasedPaid(parseFloat(e.target.value) || 0)}
                            className="w-36 h-12 px-3 text-right font-mono text-lg sm:text-xl font-extrabold tabular-nums bg-rose-950/30 text-rose-200 border border-rose-500/40 rounded-xl focus:border-rose-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Other Expenses */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <span className="font-semibold text-[15px] sm:text-base text-rose-300 block">
                            Other Expenses
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Petty cash, meals, transport, maintenance
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-rose-400">- LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={otherExpenses || ''}
                            onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                            className="w-36 h-12 px-3 text-right font-mono text-lg sm:text-xl font-extrabold tabular-nums bg-rose-950/30 text-rose-200 border border-rose-500/40 rounded-xl focus:border-rose-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Bank Deposit Amount */}
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="font-semibold text-[15px] sm:text-base text-slate-200 block">
                              Bank Deposit Amount
                            </span>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              Auto-populated directly from Tab 2 Denominations
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-rose-400">- LKR</span>
                            <span className="h-12 px-3 flex items-center justify-end font-mono text-lg sm:text-xl font-extrabold tabular-nums text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 rounded-xl">
                              {denominationsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('DENOMINATIONS')}
                              className="text-xs font-bold text-purple-400 hover:text-purple-300 px-3 py-2 bg-purple-950/60 border border-purple-500/30 rounded-xl transition-colors cursor-pointer"
                            >
                              Edit Notes
                            </button>
                          </div>
                        </div>

                        {bankedAmount > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 bg-[#0A0F1D] p-3 rounded-xl border border-slate-800">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block uppercase">
                                Deposit Bank Account
                              </label>
                              <select
                                value={selectedBankId}
                                onChange={(e) => setSelectedBankId(e.target.value)}
                                className="w-full mt-1 px-3 py-2 text-xs font-medium bg-[#11182A] text-slate-200 border border-slate-700 rounded-lg focus:outline-none focus:border-purple-500"
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
                                <label className="text-[10px] font-bold text-slate-400 block uppercase">
                                  Custom Bank &amp; Slip Reference
                                </label>
                                <input
                                  type="text"
                                  placeholder="Bank, Branch, Reference"
                                  value={customBankDetails}
                                  onChange={(e) => setCustomBankDetails(e.target.value)}
                                  className="w-full mt-1 px-3 py-2 text-xs bg-[#11182A] text-slate-200 border border-slate-700 rounded-lg focus:outline-none focus:border-purple-500"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Remaining Cash Left in Drawer */}
                      <div className="flex items-center justify-between gap-3 pt-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[15px] sm:text-base text-slate-200 block">
                              Remaining Cash Left in Drawer
                            </span>
                            {isDrawerCashManualOverride ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDrawerCashManualOverride(false);
                                  setRemainingDrawerCash(expectedClosingDrawerFloat);
                                }}
                                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset to Auto</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                                Auto-Calculated
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Physical cash remaining in drawer after removing bank deposit
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-emerald-500">LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={remainingDrawerCash || ''}
                            onChange={(e) => {
                              setIsDrawerCashManualOverride(true);
                              setRemainingDrawerCash(parseFloat(e.target.value) || 0);
                            }}
                            className="w-36 h-12 px-3 text-right font-mono text-lg sm:text-xl font-extrabold tabular-nums bg-[#0A0F1D] text-emerald-300 border border-emerald-500/50 rounded-xl focus:border-emerald-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Glowing Emerald Carry-Forward Banner */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 border border-emerald-400/50 text-white flex items-center justify-between shadow-xl shadow-emerald-950/60">
                        <div>
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 block">
                            CLOSING DRAWER FLOAT (CARRIED TO NEXT SHIFT)
                          </span>
                          <span className="text-xs text-emerald-200 font-medium block mt-0.5">
                            Auto carries forward as next shift Opening Float
                          </span>
                        </div>
                        <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-300">
                          LKR {remainingDrawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Drawer Tally Variance & Metrics (Exclusively visible to OWNER) */}
                      {isOwner && (
                        <div className="space-y-3 pt-2">
                          {/* Expected Remaining Drawer Cash */}
                          <div className="flex items-center justify-between pt-1 font-bold bg-amber-950/40 p-3 rounded-xl border border-amber-600/40">
                            <div>
                              <span className="text-amber-200 block text-xs sm:text-sm">
                                Expected Remaining Drawer Cash:
                              </span>
                              <span className="text-[11px] text-amber-400 font-medium">
                                Total Inflow - Purchases - Expenses - Bank Deposit
                              </span>
                            </div>
                            <span className="font-mono text-lg sm:text-xl font-black text-amber-200">
                              LKR {expectedRemainingDrawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Cash Variance Display & Automatic Action Notice */}
                          <div
                            className={`p-3.5 rounded-2xl font-bold border transition-all ${
                              cashVariance === 0
                                ? 'bg-slate-900/80 text-slate-200 border-slate-700'
                                : cashVariance > 0
                                ? 'bg-emerald-950/60 text-emerald-200 border-emerald-500/50 shadow-md'
                                : 'bg-rose-950/60 text-rose-200 border-rose-500/50 shadow-md'
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
                              <span className="font-mono text-lg font-black">
                                {cashVariance > 0 ? '+' : ''}
                                LKR {cashVariance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-xs font-medium mt-1.5">
                              {cashVariance === 0 && (
                                <span className="text-emerald-400">
                                  ✓ Drawer cash tallies perfectly with calculated expectation.
                                </span>
                              )}
                              {cashVariance < 0 && (
                                <span className="text-rose-300 font-semibold">
                                  ⚠️ Shortage of LKR {Math.abs(cashVariance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be automatically recorded as a Salary Deduction for {cashierName}.
                                </span>
                              )}
                              {cashVariance > 0 && (
                                <span className="text-emerald-300 font-semibold">
                                  ✓ Excess of LKR {cashVariance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be automatically recorded as Extra Income for the business.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Handover Notes */}
                      <div className="pt-2">
                        <label className="text-xs sm:text-sm font-bold text-slate-300 block mb-1">
                          Handover Notes / Remarks
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Any notes for the next shift cashier or owner regarding shortages, cash, or branch inventory..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-[#0A0F1D] text-slate-200 border border-slate-700 rounded-xl focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('DENOMINATIONS')}
                      className="min-h-[48px] px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Denominations</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={isSubmitting}
                      className="min-h-[48px] px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-xl shadow-purple-900/40 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Closing Shift & Saving...</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="w-5 h-5" />
                          <span>Submit Shift Handover &amp; Sign Out</span>
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
          <div className="px-4 sm:px-6 py-3 bg-[#0B101D] border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs sm:text-sm text-slate-300 shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-5 flex-wrap">
              <span>
                Bank Deposit: <strong className="font-mono text-indigo-300 font-extrabold">LKR {denominationsTotal.toFixed(2)}</strong>
              </span>
              <span>
                Next Float:{' '}
                <strong className="font-mono text-emerald-300 font-extrabold">LKR {remainingDrawerCash.toFixed(2)}</strong>
              </span>
              {isOwner && (
                <span>
                  Expected: <strong className="font-mono text-slate-200 font-extrabold">LKR {expectedRemainingDrawerCash.toFixed(2)}</strong>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[36px] sm:min-h-0 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1 px-3 rounded-lg bg-slate-800/60 sm:bg-transparent text-center cursor-pointer"
            >
              Cancel / Return to POS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
