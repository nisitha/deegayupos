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
  formatShiftLabel,
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

const getDenomBadgeCls = (d: number) => {
  switch (d) {
    case 5000:
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 2000:
      return 'bg-orange-100 text-orange-900 border-orange-300';
    case 1000:
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 500:
      return 'bg-purple-100 text-purple-900 border-purple-300';
    case 100:
      return 'bg-rose-100 text-rose-900 border-rose-300';
    case 50:
      return 'bg-sky-100 text-sky-900 border-sky-300';
    case 20:
      return 'bg-red-100 text-red-900 border-red-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
};

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
  const [livePosBillCount, setLivePosBillCount] = useState<number>(0);
  const [goodsPurchasedPaid, setGoodsPurchasedPaid] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [remainingDrawerCash, setRemainingDrawerCash] = useState<number>(0);
  const [isDrawerManuallyEdited, setIsDrawerManuallyEdited] = useState<boolean>(false);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [customBankDetails, setCustomBankDetails] = useState<string>('');
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  const isInitialZeroFloat = Number(localShift?.openingFloat || activeShift?.openingFloat || 0) === 0;
  const isLockedOpeningFloat = Boolean(
    localShift?.hasLockedOpeningFloat ?? ((localShift?.shiftNumber || activeShift?.shiftNumber || 1) > 1)
  );
  const prevShiftLabel = localShift?.previousShiftLabel || formatShiftLabel((localShift?.shiftNumber || 2) - 1);
  const canEditOpeningFloat = !isLockedOpeningFloat && (isOwner || isInitialZeroFloat || isEditingOpeningFloat);

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
    setIsDrawerManuallyEdited(false);

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

        // Auto-pull live completed POS cash sales strictly for this same-day active shift window
        try {
          const liveSalesRes = await shiftsApi.getLiveShiftPosSales(
            effectiveBranchId || shift.branchId,
            shift.id,
            shift.startedAt,
            shift.cashierId || effectiveCashierId,
            shift.cashierName || cashierName
          );
          if (liveSalesRes.success && liveSalesRes.data) {
            setDeclaredShiftSale(Number(liveSalesRes.data.posCashSales || 0));
            setLivePosBillCount(Number(liveSalesRes.data.posBills || 0));
          } else {
            setDeclaredShiftSale(0);
            setLivePosBillCount(0);
          }
        } catch {
          setDeclaredShiftSale(0);
          setLivePosBillCount(0);
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

  // 2. Expected Remaining Drawer Cash (Closing Float) = Total Cash Inflow - goodsPurchasedPaid - otherExpenses - denominationsTotal
  const expectedClosingDrawerFloat = useMemo(() => {
    return Math.max(
      0,
      Number(
        (
          totalCashInflow -
          goodsPurchasedPaid -
          otherExpenses -
          denominationsTotal
        ).toFixed(2)
      )
    );
  }, [totalCashInflow, goodsPurchasedPaid, otherExpenses, denominationsTotal]);

  // Auto-sync remainingDrawerCash to expectedClosingDrawerFloat unless manually overridden
  useEffect(() => {
    if (!isDrawerManuallyEdited) {
      setRemainingDrawerCash(expectedClosingDrawerFloat);
    }
  }, [expectedClosingDrawerFloat, isDrawerManuallyEdited]);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col bg-[#F8FAFC] border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden">
        {/* Refined Deep-Slate Executive Header */}
        <div className="bg-[#0F172A] px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-white shrink-0">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold tracking-tight text-white">
                  End Shift Handover
                </h3>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {formatShiftLabel(currentShift?.shiftNumber).toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {branchName} • Cashier: <strong className="text-slate-200 font-semibold">{cashierName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Step Guided Architectural Stepper */}
        <div className="bg-white border-b border-slate-200/90 px-6 py-2.5 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: 'MODAKA',
                stepNum: '01',
                label: 'Special Stock',
                badge: `${modakaUnitsTotal} units • LKR ${modakaSalesTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                icon: FileSpreadsheet,
              },
              {
                id: 'DENOMINATIONS',
                stepNum: '02',
                label: 'Bank Denominations',
                badge: `LKR ${denominationsTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                icon: Banknote,
              },
              {
                id: 'SUMMARY',
                stepNum: '03',
                label: 'Cash & Reconciliation',
                badge: `Next Float: LKR ${remainingDrawerCash.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                icon: Receipt,
              },
            ].map((step) => {
              const isActive = activeTab === step.id;
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveTab(step.id as any)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                        isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {step.stepNum}
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm block truncate leading-tight">
                        {step.label}
                      </span>
                      <span
                        className={`text-[11px] font-mono block truncate ${
                          isActive ? 'text-indigo-200' : 'text-slate-500'
                        }`}
                      >
                        {step.badge}
                      </span>
                    </div>
                  </div>
                  <Icon
                    className={`w-4 h-4 shrink-0 hidden md:block ${
                      isActive ? 'text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#F8FAFC]">
          {errorMessage && (
            <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {isLoadingShift || !currentShift ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3.5">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <span className="text-base font-semibold text-slate-600">Loading active shift information...</span>
            </div>
          ) : isSuccess ? (
            <div className="py-16 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="text-2xl font-bold text-slate-900">Shift Handover Completed!</h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {formatShiftLabel(currentShift.shiftNumber)} has been officially closed and verified. Signing out cashier{' '}
                <strong className="text-emerald-700 font-bold">{cashierName}</strong> to allow the next shift cashier to sign in...
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: SPECIAL STOCK LEDGER */}
              {activeTab === 'MODAKA' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">
                        Special Stock &amp; Sales Summary
                      </h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Opening stock carries forward automatically from previous closed shift. Enter incoming stock (B) and shift sales (D).
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block">Total Sold Units</span>
                        <span className="text-sm font-bold font-mono text-indigo-600">
                          {modakaUnitsTotal} units
                        </span>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block">Total Special Revenue</span>
                        <span className="text-base font-extrabold font-mono text-emerald-700">
                          LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Single-Screen Table Card */}
                  <div className="border border-slate-200/90 bg-white rounded-xl overflow-x-auto shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-3 px-3">SPECIAL ITEM</th>
                          <th className="py-3 px-2 text-center w-24">OPENING (A)</th>
                          <th className="py-3 px-2 text-center w-26 bg-amber-50/60 text-amber-800 border-x border-amber-200/80">
                            STOCK IN (B)
                          </th>
                          <th className="py-3 px-2 text-center w-24">AVAILABLE (C)</th>
                          <th className="py-3 px-2 text-center w-26 bg-indigo-50/60 text-indigo-800 border-x border-indigo-200/80">
                            SHIFT SALE (D)
                          </th>
                          <th className="py-3 px-2 text-center w-24 text-emerald-700 font-bold">
                            CLOSING (E)
                          </th>
                          <th className="py-3 px-3 text-right w-28 text-slate-600">
                            RATE (LKR)
                          </th>
                          <th className="py-3 px-3 text-right w-32 font-bold text-slate-900">
                            TOTAL (LKR)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modakaRows.map((row, idx) => {
                          const totalAvail = row.openingQty + row.inQty;
                          const closing = totalAvail - row.soldQty;
                          const lineSales = row.soldQty * row.appliedRate;
                          return (
                            <tr key={row.productId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-center font-bold text-xs text-slate-400 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <span
                                      className="font-semibold text-[15px] text-slate-900 block truncate"
                                      title={row.productName}
                                    >
                                      {row.productName}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-500 block">
                                      {row.productSku || `SKU-337${idx + 1}`}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-sm font-bold text-slate-700">
                                {row.openingQty}
                              </td>
                              <td className="py-2 px-2 text-center bg-amber-50/30 border-x border-amber-100">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.inQty || ''}
                                  onChange={(e) => handleModakaChange(idx, 'inQty', e.target.value)}
                                  className="w-20 h-10 px-2 text-center font-bold font-mono text-base bg-amber-50/50 text-amber-900 border border-amber-300/80 rounded-lg focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/15"
                                />
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-sm font-bold text-slate-700 bg-slate-50/40">
                                {totalAvail}
                              </td>
                              <td className="py-2 px-2 text-center bg-indigo-50/30 border-x border-indigo-100">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={row.soldQty || ''}
                                  onChange={(e) => handleModakaChange(idx, 'soldQty', e.target.value)}
                                  className="w-20 h-10 px-2 text-center font-bold font-mono text-base bg-indigo-50/50 text-indigo-900 border border-indigo-300/80 rounded-lg focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                                />
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-sm font-bold text-emerald-700 bg-emerald-50/20">
                                {closing}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-600 tabular-nums">
                                {row.appliedRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                                {lineSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50/90 font-mono font-bold text-slate-900 text-sm border-t border-slate-200">
                        <tr>
                          <td className="py-3 px-3 uppercase text-xs tracking-wider text-slate-500 font-sans">
                            Total Units &amp; Revenue
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-700">{modakaTotals.sumA}</td>
                          <td className="py-3 px-2 text-center font-bold text-amber-800">+{modakaTotals.sumB}</td>
                          <td className="py-3 px-2 text-center font-bold text-slate-800">{modakaTotals.sumC}</td>
                          <td className="py-3 px-2 text-center font-bold text-indigo-800">{modakaTotals.sumD}</td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-700">{modakaTotals.sumE}</td>
                          <td className="py-3 px-3 text-right text-slate-400 font-normal">-</td>
                          <td className="py-3 px-3 text-right text-emerald-700 font-extrabold text-base">
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
                      className="min-h-[44px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer w-full sm:w-auto"
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
                      <h4 className="text-lg font-bold text-slate-900">
                        Bank Deposit Denomination Counter
                      </h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Count notes &amp; coins bundled for bank deposit. Total automatically populates Bank Deposit Amount in Step 3.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDenominations}
                      className="text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Clear All Counts
                    </button>
                  </div>

                  {/* Denominations Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {DENOMINATIONS.map((d) => {
                      const count = counts[d] || 0;
                      const lineTotal = d * count;
                      const badgeCls = getDenomBadgeCls(d);
                      return (
                        <div
                          key={d}
                          className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-400/60 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-20 text-center py-1 rounded-lg text-sm font-black font-mono tracking-tight border ${badgeCls}`}
                            >
                              {d >= 1000 ? `LKR ${d.toLocaleString()}` : `${d} LKR`}
                            </span>
                            <span className="text-sm font-bold text-slate-400">×</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={count > 0 ? count : ''}
                              onChange={(e) => handleCountChange(d, e.target.value)}
                              className="w-20 h-10 px-2 text-center font-mono font-bold text-base bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Subtotal
                            </span>
                            <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                              LKR {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Big Total Box */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                          Bank Deposit Denomination Total
                        </h5>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Counted bundle auto-populates Bank Deposit Amount in Step 3.
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tabular-nums">
                      LKR {denominationsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('MODAKA')}
                      className="min-h-[44px] px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200/90 shadow-2xs"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Special Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('SUMMARY')}
                      className="min-h-[44px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
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
                    <h4 className="text-lg font-bold text-slate-900">
                      Shift Cash &amp; Expense Summary
                    </h4>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Side-by-side reconciliation of shift inflows, expenses, bank deposits, and next shift drawer float.
                    </p>
                  </div>

                  {/* 2-Column Responsive Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* LEFT COLUMN: CASH INFLOWS */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
                      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
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
                            <span className="font-semibold text-[15px] text-slate-900 block">
                              Opening Float
                            </span>
                            {isLockedOpeningFloat ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-300 flex items-center gap-1">
                                <span>🔒</span> Locked
                              </span>
                            ) : (
                              isOwner && !isInitialZeroFloat && (
                                <button
                                  type="button"
                                  onClick={() => setIsEditingOpeningFloat(!isEditingOpeningFloat)}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                                >
                                  {isEditingOpeningFloat ? 'Lock' : 'Edit'}
                                </button>
                              )
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            {isLockedOpeningFloat
                              ? `Auto-carried from ${prevShiftLabel} Closing Drawer Float (Read-Only)`
                              : 'No prior closed shift — enter starting drawer cash'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-400">LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={openingFloat || ''}
                            onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                            readOnly={isLockedOpeningFloat || !canEditOpeningFloat}
                            disabled={isLockedOpeningFloat}
                            className={`w-36 h-11 px-3 text-right font-mono text-lg font-bold tabular-nums rounded-lg focus:outline-none ${
                              isLockedOpeningFloat
                                ? 'bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed select-none'
                                : canEditOpeningFloat
                                ? 'bg-white text-slate-900 border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed'
                            }`}
                          />
                        </div>
                      </div>

                      {/* 2. POS Cash Sales */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <span className="font-semibold text-[15px] text-slate-900 block">
                            POS Cash Sales
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            {livePosBillCount > 0
                              ? `Auto-pulled from ${livePosBillCount} cash bill${livePosBillCount > 1 ? 's' : ''} in this shift`
                              : 'Auto-pulled from completed cash bills in this shift'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-400">LKR</span>
                          <span className="w-36 h-11 px-3 flex items-center justify-end font-mono text-lg font-bold tabular-nums rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200">
                            {declaredShiftSale.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* 3. Special Stock Sales */}
                      <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-[15px] text-purple-950 block">
                            Special Stock Sales
                          </span>
                          <span className="text-xs text-purple-700 block mt-0.5">
                            Auto-calculated from Step 1 Special Stock ({modakaUnitsTotal} units)
                          </span>
                        </div>
                        <span className="font-mono text-lg font-bold text-purple-900 shrink-0">
                          + LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Subtotal: Total Shift Cash Hero Box */}
                      <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
                        <div>
                          <span className="text-sm font-bold text-white block">
                            Total Shift Cash Inflow
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            Opening Float + POS Cash + Special Sales
                          </span>
                        </div>
                        <span className="font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
                          LKR {totalCashInflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: DEDUCTIONS, BANK DEPOSIT & CLOSING FLOAT */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
                      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                          2. Deductions &amp; Drawer Float
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Carried to Next Shift
                        </span>
                      </div>

                      {/* Goods Purchased Paid */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <span className="font-semibold text-[15px] text-slate-900 block">
                            Goods Purchased Paid Out
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Cash paid out to suppliers or incoming stock
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-rose-600">- LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={goodsPurchasedPaid || ''}
                            onChange={(e) => setGoodsPurchasedPaid(parseFloat(e.target.value) || 0)}
                            className="w-36 h-11 px-3 text-right font-mono text-lg font-bold tabular-nums bg-rose-50/50 text-rose-900 border border-rose-200 rounded-lg focus:border-rose-400 focus:ring-2 focus:ring-rose-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Other Expenses */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <span className="font-semibold text-[15px] text-slate-900 block">
                            Other Expenses
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Petty cash, meals, transport, maintenance
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-rose-600">- LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={otherExpenses || ''}
                            onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)}
                            className="w-36 h-11 px-3 text-right font-mono text-lg font-bold tabular-nums bg-rose-50/50 text-rose-900 border border-rose-200 rounded-lg focus:border-rose-400 focus:ring-2 focus:ring-rose-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Bank Deposit Amount */}
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="font-semibold text-[15px] text-slate-900 block">
                              Bank Deposit Amount
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Auto-populated directly from Step 2 Denominations
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-rose-600">- LKR</span>
                            <span className="h-11 px-3 flex items-center justify-end font-mono text-lg font-bold tabular-nums text-slate-900 bg-slate-100 border border-slate-200 rounded-lg">
                              {denominationsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('DENOMINATIONS')}
                              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 px-2.5 py-2 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Edit Notes
                            </button>
                          </div>
                        </div>

                        {bankedAmount > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block uppercase">
                                Deposit Bank Account
                              </label>
                              <select
                                value={selectedBankId}
                                onChange={(e) => setSelectedBankId(e.target.value)}
                                className="w-full mt-1 px-3 py-2 text-xs font-medium bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
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
                                <label className="text-[10px] font-bold text-slate-500 block uppercase">
                                  Custom Bank &amp; Slip Reference
                                </label>
                                <input
                                  type="text"
                                  placeholder="Bank, Branch, Reference"
                                  value={customBankDetails}
                                  onChange={(e) => setCustomBankDetails(e.target.value)}
                                  className="w-full mt-1 px-3 py-2 text-xs bg-white text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Remaining Cash Left in Drawer */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[15px] text-slate-900 block">
                              Remaining Cash Left in Drawer
                            </span>
                            {isDrawerManuallyEdited ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDrawerManuallyEdited(false);
                                  setRemainingDrawerCash(expectedClosingDrawerFloat);
                                }}
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset to Auto</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                Auto-Calculated
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Physical cash remaining in drawer after removing bank deposit
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-emerald-600">LKR</span>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={remainingDrawerCash || ''}
                            onChange={(e) => {
                              setIsDrawerManuallyEdited(true);
                              setRemainingDrawerCash(parseFloat(e.target.value) || 0);
                            }}
                            className="w-36 h-11 px-3 text-right font-mono text-lg font-bold tabular-nums bg-emerald-50/40 text-emerald-950 border border-emerald-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Glowing Emerald Carry-Forward Banner */}
                      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shadow-md">
                        <div>
                          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-100 block">
                            CLOSING DRAWER FLOAT (CARRIED TO NEXT SHIFT)
                          </span>
                          <span className="text-xs text-emerald-100 font-medium block mt-0.5">
                            Auto carries forward as next shift Opening Float
                          </span>
                        </div>
                        <span className="text-2xl sm:text-3xl font-black font-mono text-white tabular-nums">
                          LKR {remainingDrawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Drawer Tally Variance & Metrics (Exclusively visible to OWNER) */}
                      {isOwner && (
                        <div className="space-y-3 pt-2">
                          {/* Expected Remaining Drawer Cash */}
                          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 font-bold">
                            <div>
                              <span className="text-amber-900 block text-xs sm:text-sm">
                                Expected Remaining Drawer Cash:
                              </span>
                              <span className="text-[11px] text-amber-700 font-medium">
                                Total Inflow - Purchases - Expenses - Bank Deposit
                              </span>
                            </div>
                            <span className="font-mono text-lg font-bold text-amber-900">
                              LKR {expectedRemainingDrawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Cash Variance Display & Automatic Action Notice */}
                          <div
                            className={`p-3.5 rounded-xl font-bold border transition-all ${
                              cashVariance === 0
                                ? 'bg-slate-50 text-slate-800 border-slate-200'
                                : cashVariance > 0
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 shadow-2xs'
                                : 'bg-rose-50 text-rose-900 border-rose-200 shadow-2xs'
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
                              <span className="font-mono text-lg font-bold">
                                {cashVariance > 0 ? '+' : ''}
                                LKR {cashVariance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-xs font-medium mt-1.5">
                              {cashVariance === 0 && (
                                <span className="text-emerald-700">
                                  ✓ Drawer cash tallies perfectly with calculated expectation.
                                </span>
                              )}
                              {cashVariance < 0 && (
                                <span className="text-rose-700 font-semibold">
                                  ⚠️ Shortage of LKR {Math.abs(cashVariance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be automatically recorded as a Salary Deduction for {cashierName}.
                                </span>
                              )}
                              {cashVariance > 0 && (
                                <span className="text-emerald-700 font-semibold">
                                  ✓ Excess of LKR {cashVariance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be automatically recorded as Extra Income for the business.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Handover Notes */}
                      <div className="pt-2">
                        <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                          Handover Notes / Remarks
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Any notes for the next shift cashier or owner regarding shortages, cash, or branch inventory..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 focus:border-indigo-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Back Action */}
                  <div className="flex items-center justify-start pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('DENOMINATIONS')}
                      className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200/90 shadow-2xs"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Denominations</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Footer Bar (Guaranteed Never Clipped at Bottom) */}
        {!isSuccess && (
          <div className="shrink-0 border-t border-slate-200/90 bg-white px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-sm text-slate-700 shadow-xs">
            {/* Left: Summary Tally Pills */}
            <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 flex-wrap">
              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-medium text-xs sm:text-sm">
                Bank Deposit: <strong className="font-mono text-indigo-950 font-bold ml-1">LKR {denominationsTotal.toFixed(2)}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium text-xs sm:text-sm">
                Next Float: <strong className="font-mono text-emerald-950 font-bold ml-1">LKR {remainingDrawerCash.toFixed(2)}</strong>
              </span>
              {isOwner && (
                <span className="hidden md:inline-flex px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs sm:text-sm">
                  Expected: <strong className="font-mono text-slate-900 font-bold ml-1">LKR {expectedRemainingDrawerCash.toFixed(2)}</strong>
                </span>
              )}
            </div>

            {/* Right: Actions (Sticky Submit & Navigation) */}
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px] sm:min-h-0 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors py-2 px-3.5 rounded-xl cursor-pointer"
              >
                Cancel / Return to POS
              </button>

              {activeTab === 'MODAKA' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('DENOMINATIONS')}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <span>Proceed to Denominations</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'DENOMINATIONS' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('SUMMARY')}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <span>Proceed to Shift Tally</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'SUMMARY' && (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[14px] sm:text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Closing Shift...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      <span>Submit Shift Handover &amp; Sign Out</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
