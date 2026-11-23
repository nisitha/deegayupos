'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  CashierShiftDto,
  EndShiftPayload,
  shiftsApi,
  ShiftCashBillItem,
} from '../../lib/api-client';
import { supabase } from '../../lib/supabase';

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
  isOwner = false,
}: ShiftEndModalProps) {
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
  const [posBulkSpecialSalesTotal, setPosBulkSpecialSalesTotal] = useState<number>(0);
  const [posBulkSpecialUnitsMap, setPosBulkSpecialUnitsMap] = useState<Record<string, { packs: number; units: number; amount: number }>>({});
  const [livePosBillCount, setLivePosBillCount] = useState<number>(0);
  const [liveCashBills, setLiveCashBills] = useState<ShiftCashBillItem[]>([]);
  const [isCashBillsExpanded, setIsCashBillsExpanded] = useState<boolean>(false);
  const [isRefreshingSales, setIsRefreshingSales] = useState<boolean>(false);
  const [goodsPurchasedPaid, setGoodsPurchasedPaid] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [bankDepositAmountInput, setBankDepositAmountInput] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [customBankDetails, setCustomBankDetails] = useState<string>('');
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const openingMetadataRef = useRef<Record<string, any> | null>(null);

  // Step 02 Drawer Cash Count: Sum of all physical notes & coins counted in drawer
  const totalDrawerCashCounted = useMemo(() => {
    return DENOMINATIONS.reduce((acc, d) => acc + d * (counts[d] || 0), 0);
  }, [counts]);


  // Step 03 Manual Bank Deposit Amount (Entered by cashier)
  const bankDepositAmount = useMemo(() => {
    const trimmed = bankDepositAmountInput.trim();
    if (!trimmed) return 0;
    const num = parseFloat(trimmed);
    return !isNaN(num) && num >= 0 ? Math.round(num * 100) / 100 : 0;
  }, [bankDepositAmountInput]);

  const isBankDepositExceeding = useMemo(() => {
    return bankDepositAmount > totalDrawerCashCounted;
  }, [bankDepositAmount, totalDrawerCashCounted]);

  const isBankDepositValid = useMemo(() => {
    const trimmed = bankDepositAmountInput.trim();
    if (!trimmed) return true;
    const num = parseFloat(trimmed);
    return !isNaN(num) && num >= 0 && num <= totalDrawerCashCounted;
  }, [bankDepositAmountInput, totalDrawerCashCounted]);

  // Step 03 Auto-Calculated Remaining Cash Left in Drawer (Total Drawer Cash − Bank Deposit)
  const remainingDrawerCash = useMemo(() => {
    return Math.max(0, Math.round((totalDrawerCashCounted - bankDepositAmount) * 100) / 100);
  }, [totalDrawerCashCounted, bankDepositAmount]);


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
    setBankDepositAmountInput('');

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
            inQty: Number(e.inQty || 0) > 0 ? Math.round(Number(e.inQty || 0) / 25) : 0,
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
            shift.startedAt || (shift as any)?.started_at,
            shift.cashierId || effectiveCashierId,
            shift.cashierName || cashierName
          );
          if (liveSalesRes.success && liveSalesRes.data) {
            setDeclaredShiftSale(Number(liveSalesRes.data.posCashSales || 0));
            setLivePosBillCount(Number(liveSalesRes.data.posBills || 0));
            setLiveCashBills(liveSalesRes.data.bills || []);
            setPosBulkSpecialSalesTotal(Number(liveSalesRes.data.posBulkSpecialSalesTotal || 0));
            setPosBulkSpecialUnitsMap(liveSalesRes.data.posBulkSpecialUnitsMap || {});
          } else {
            setDeclaredShiftSale(0);
            setLivePosBillCount(0);
            setLiveCashBills([]);
            setPosBulkSpecialSalesTotal(0);
            setPosBulkSpecialUnitsMap({});
          }
        } catch {
          setDeclaredShiftSale(0);
          setLivePosBillCount(0);
          setLiveCashBills([]);
          setPosBulkSpecialSalesTotal(0);
          setPosBulkSpecialUnitsMap({});
        }

        setGoodsPurchasedPaid(Number(shift.goodsPurchasedPaid || 0));
        setOtherExpenses(Number(shift.otherExpenses || 0));

        // Cleanly separate system JSON opening metadata from cashier human remarks
        const rawNotes = (shift as any)?.notes || shift?.handoverNotes || '';
        let cleanHumanRemarks = '';
        let parsedOpeningMeta: Record<string, any> | null = null;

        if (rawNotes) {
          let content = String(rawNotes).trim();
          if (content.includes('[PENDING_OPENING_COUNT]')) {
            content = content.replace('[PENDING_OPENING_COUNT]', '').trim();
          }

          const jsonStart = content.indexOf('{');
          const jsonEnd = content.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            try {
              const jsonStr = content.slice(jsonStart, jsonEnd + 1);
              parsedOpeningMeta = JSON.parse(jsonStr);
              if (parsedOpeningMeta?.remarks) {
                cleanHumanRemarks = String(parsedOpeningMeta.remarks).trim();
              } else if (parsedOpeningMeta?.cashier_remarks) {
                cleanHumanRemarks = String(parsedOpeningMeta.cashier_remarks).trim();
              } else {
                const before = content.slice(0, jsonStart).trim();
                const after = content.slice(jsonEnd + 1).trim();
                cleanHumanRemarks = [before, after].filter(Boolean).join(' ').trim();
              }
            } catch {
              if (!content.startsWith('{')) {
                cleanHumanRemarks = content;
              }
            }
          } else if (!content.startsWith('{')) {
            cleanHumanRemarks = content;
          }
        }

        openingMetadataRef.current = parsedOpeningMeta;
        setHandoverNotes(cleanHumanRemarks);
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
      const actualStockInUnits = Math.max(0, Math.floor(Number(r.inQty) || 0)) * 25;
      const c = r.openingQty + actualStockInUnits;
      const e = Math.max(0, c - r.soldQty);
      const f = r.soldQty * r.appliedRate;

      sumA += r.openingQty;
      sumB += actualStockInUnits;
      sumC += c;
      sumD += r.soldQty;
      sumE += e;
      sumF += f;
    });

    return { sumA, sumB, sumC, sumD, sumE, sumF };
  }, [modakaRows]);

  const modakaUnitsTotal = modakaTotals.sumD;
  const modakaSalesTotal = modakaTotals.sumF;

  // Step 02 & 03 Math: totalDrawerCashCounted, bankDepositAmount, remainingDrawerCash defined at component top

  // Double-counting prevention: POS bulk special sales are already inside declaredShiftSale
  const counterRetailSpecialSales = useMemo(() => {
    return Math.max(0, Math.round((modakaSalesTotal - posBulkSpecialSalesTotal) * 100) / 100);
  }, [modakaSalesTotal, posBulkSpecialSalesTotal]);

  // 1. Total Cash Inflow = openingFloat + declaredShiftSale (POS cash) + counterRetailSpecialSales (Manual counter special stock sales)
  const totalCashInflow = useMemo(() => {
    return Math.round((openingFloat + declaredShiftSale + counterRetailSpecialSales) * 100) / 100;
  }, [openingFloat, declaredShiftSale, counterRetailSpecialSales]);

  const currentShift = activeShift || localShift;

  const formattedShiftStartTime = useMemo(() => {
    const rawTime =
      currentShift?.startedAt ||
      (currentShift as any)?.started_at ||
      localShift?.startedAt ||
      (localShift as any)?.started_at ||
      activeShift?.startedAt ||
      (activeShift as any)?.started_at;
    if (!rawTime) return null;
    try {
      const d = new Date(rawTime);
      if (isNaN(d.getTime())) return null;
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return null;
    }
  }, [
    currentShift?.startedAt,
    (currentShift as any)?.started_at,
    localShift?.startedAt,
    (localShift as any)?.started_at,
    activeShift?.startedAt,
    (activeShift as any)?.started_at,
  ]);

  if (!isOpen) return null;

  const refreshLiveSales = async () => {
    const targetShift = activeShift || localShift;
    if (!targetShift) return;
    setIsRefreshingSales(true);
    try {
      const effectiveBranchId =
        branchId || targetShift.branchId ||
        (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_selected_branch') : null);
      const effectiveCashierId =
        cashierId || targetShift.cashierId ||
        (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_cashier_id') : null);

      const liveSalesRes = await shiftsApi.getLiveShiftPosSales(
        effectiveBranchId || targetShift.branchId,
        targetShift.id,
        targetShift.startedAt || (targetShift as any)?.started_at,
        effectiveCashierId,
        cashierName
      );
      if (liveSalesRes.success && liveSalesRes.data) {
        setDeclaredShiftSale(Number(liveSalesRes.data.posCashSales || 0));
        setLivePosBillCount(Number(liveSalesRes.data.posBills || 0));
        setLiveCashBills(liveSalesRes.data.bills || []);
        setPosBulkSpecialSalesTotal(Number(liveSalesRes.data.posBulkSpecialSalesTotal || 0));
        setPosBulkSpecialUnitsMap(liveSalesRes.data.posBulkSpecialUnitsMap || {});
      }
    } catch (err) {
      console.warn('[ShiftEndModal] refreshLiveSales error:', err);
    } finally {
      setIsRefreshingSales(false);
    }
  };

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

    if (isBankDepositExceeding) {
      setErrorMessage('Bank deposit cannot exceed total counted drawer cash.');
      setIsSubmitting(false);
      return;
    }

    if (!isBankDepositValid) {
      setErrorMessage('Please enter a valid numeric amount for Bank Deposit.');
      setIsSubmitting(false);
      return;
    }

    let selectedBankStr = '';
    if (bankDepositAmount > 0) {
      const foundBank = bankAccounts.find((b) => b.id === selectedBankId);
      if (foundBank) {
        selectedBankStr = `${foundBank.bankName} (${foundBank.accountNumber} - ${foundBank.accountName}${foundBank.branchName ? ` • ${foundBank.branchName}` : ''
          })`;
      } else if (customBankDetails.trim()) {
        selectedBankStr = customBankDetails.trim();
      }
    }

    // Cleanly merge human remarks with preserved opening metadata
    const userRemark = handoverNotes.trim();
    let finalHandoverNotes = userRemark;
    if (openingMetadataRef.current) {
      finalHandoverNotes = JSON.stringify({
        ...openingMetadataRef.current,
        remarks: userRemark || undefined,
      });
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
      bankedAmount: bankDepositAmount,
      bankAccountDetails: selectedBankStr,
      countedDrawerCash: totalDrawerCashCounted,
      countedRemainingDrawerCash: remainingDrawerCash,
      closingDrawerFloat: remainingDrawerCash,
      denominationsJson: counts,
      handoverNotes: finalHandoverNotes,
      posBulkSpecialSalesTotal,
      modakaEntries: modakaRows.map((r) => ({
        productId: r.productId,
        openingQty: r.openingQty,
        inQty: Math.max(0, Math.floor(Number(r.inQty) || 0)) * 25,
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
                  Cashier: {cashierName}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {branchName} • Cashier: <strong className="text-slate-200 font-semibold">{cashierName}</strong>
                {formattedShiftStartTime && (
                  <span className="text-slate-400 font-normal">
                    {' '}• Shift started at <strong className="text-indigo-300 font-semibold">{formattedShiftStartTime}</strong> (Asia/Colombo)
                  </span>
                )}
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
                label: 'Drawer Cash Count',
                badge: `LKR ${totalDrawerCashCounted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
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
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                    >
                      {step.stepNum}
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm block truncate leading-tight">
                        {step.label}
                      </span>
                      <span
                        className={`text-[11px] font-mono block truncate ${isActive ? 'text-indigo-200' : 'text-slate-500'
                          }`}
                      >
                        {step.badge}
                      </span>
                    </div>
                  </div>
                  <Icon
                    className={`w-4 h-4 shrink-0 hidden md:block ${isActive ? 'text-indigo-400' : 'text-slate-400'
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
                Shift for <strong className="text-emerald-700 font-bold">{cashierName}</strong> has been officially closed and verified. Completing handover...
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
                          const actualStockInUnits = Math.max(0, Math.floor(Number(row.inQty) || 0)) * 25;
                          const totalAvail = row.openingQty + actualStockInUnits;
                          const closing = Math.max(0, totalAvail - row.soldQty);
                          const lineSales = row.soldQty * row.appliedRate;
                          const bulkInfo = posBulkSpecialUnitsMap[row.productId];
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
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <span className="font-mono text-[11px] text-slate-500">
                                        {row.productSku || `SKU-337${idx + 1}`}
                                      </span>
                                      {bulkInfo && bulkInfo.units > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                          POS Bulk Sold: {bulkInfo.packs} pk ({bulkInfo.units} u)
                                        </span>
                                      )}
                                    </div>
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
                      <span>Proceed to Drawer Cash Count</span>
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
                        Drawer Cash Count (Total Cash in Drawer)
                      </h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Count all physical notes and coins currently inside the cash drawer. Enter the quantity of each denomination below.
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
                          Total Cash Counted in Drawer
                        </h5>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Total physical drawer cash counted before any bank deposits.
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tabular-nums">
                      LKR {totalDrawerCashCounted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      <span>Proceed to Cash &amp; Reconciliation</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: SHIFT CASH & EXPENSE SUMMARY */}
              {activeTab === 'SUMMARY' && (
                <div className="space-y-4">
                  <div className={!isOwner ? 'max-w-2xl mx-auto' : ''}>
                    <h4 className="text-lg font-bold text-slate-900">
                      Cash &amp; Shift Reconciliation
                    </h4>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {isOwner
                        ? 'Side-by-side reconciliation of shift inflows, expenses, bank deposits, and next shift drawer float.'
                        : 'Reconciliation of shift expenses, bank deposits, and physical drawer cash for next shift.'}
                    </p>
                  </div>

                  {/* Top Summary Card: Total Cash Counted in Drawer */}
                  <div className={`p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800 ${!isOwner ? 'max-w-2xl mx-auto' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                        <Banknote className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                            Total Physical Cash in Drawer
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Counted in Step 02
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Physical notes &amp; coins in drawer before bank deposit.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                        LKR {totalDrawerCashCounted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('DENOMINATIONS')}
                        className="text-xs font-bold text-indigo-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Recount
                      </button>
                    </div>
                  </div>

                  {/* 2-Column Responsive Layout for Owner vs Clean Centered Layout for Staff */}
                  <div className={isOwner ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : 'max-w-2xl mx-auto space-y-5'}>
                    {/* LEFT COLUMN: CASH INFLOWS (OWNER ONLY) */}
                    {isOwner && (
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
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                                <span>🔒</span> Confirmed at Shift Start
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Physical drawer cash verified and confirmed at shift commencement
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-slate-400">LKR</span>
                            <input
                              type="number"
                              readOnly
                              disabled
                              value={openingFloat || 0}
                              className="w-36 h-11 px-3 text-right font-mono text-lg font-bold tabular-nums rounded-lg bg-slate-100 text-slate-700 border border-slate-300 cursor-not-allowed select-none"
                            />
                          </div>
                        </div>

                        {/* 2. POS Cash Sales */}
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[15px] text-slate-900 block">
                                  POS Cash Sales
                                </span>
                                {livePosBillCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setIsCashBillsExpanded((prev) => !prev)}
                                    className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-100/80 hover:bg-indigo-200/80 px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Toggle cash bills breakdown"
                                  >
                                    {isCashBillsExpanded ? (
                                      <>
                                        <span>Hide bills</span>
                                        <ChevronUp className="w-3 h-3" />
                                      </>
                                    ) : (
                                      <>
                                        <span>View {livePosBillCount} bill{livePosBillCount > 1 ? 's' : ''}</span>
                                        <ChevronDown className="w-3 h-3" />
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={refreshLiveSales}
                                  disabled={isRefreshingSales}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded cursor-pointer disabled:opacity-50"
                                  title="Refresh shift sales"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSales ? 'animate-spin text-indigo-600' : ''}`} />
                                </button>
                              </div>
                              <span className="text-xs text-slate-500 block mt-0.5">
                                {livePosBillCount > 0
                                  ? `Auto-pulled from ${livePosBillCount} cash bill${livePosBillCount > 1 ? 's' : ''} in this shift${formattedShiftStartTime ? ` (since ${formattedShiftStartTime})` : ''}`
                                  : `Auto-pulled from completed cash bills in this shift${formattedShiftStartTime ? ` (since ${formattedShiftStartTime})` : ''}`}
                              </span>
                              {Number(currentShift?.shiftNumber || localShift?.shiftNumber || 1) > 1 && (
                                <span className="text-[11px] text-amber-700/90 block mt-0.5 font-medium">
                                  Earlier bills from today belong to previous cashier handover and are accounted for in that handover.
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold text-slate-400">LKR</span>
                              <span className="w-36 h-11 px-3 flex items-center justify-end font-mono text-lg font-bold tabular-nums rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200">
                                {declaredShiftSale.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Expandable Breakdown of Included Cash Invoices */}
                          {isCashBillsExpanded && liveCashBills.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-indigo-100/80 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {liveCashBills.map((b) => {
                                const timeStr = (() => {
                                  try {
                                    return new Intl.DateTimeFormat('en-US', {
                                      timeZone: 'Asia/Colombo',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    }).format(new Date(b.soldAt));
                                  } catch {
                                    return '';
                                  }
                                })();

                                return (
                                  <div
                                    key={b.id}
                                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/90 border border-indigo-100 shadow-2xs font-mono"
                                  >
                                    <div className="flex items-center gap-2 text-slate-700">
                                      <span className="font-semibold text-slate-900">{b.invoiceNumber}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-slate-500 text-[11px]">{timeStr}</span>
                                      {b.isSplit && (
                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-sans px-1.5 py-0.5 rounded font-medium">
                                          Split Cash
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-bold text-slate-900">
                                      LKR {b.cashAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 3. Special Stock Sales */}
                        <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <span className="font-bold text-[15px] text-purple-950 block">
                                Special Stock Sales
                              </span>
                              <span className="text-xs text-purple-700 block mt-0.5">
                                Total Special Stock sold: {modakaUnitsTotal} units (LKR {modakaSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </span>
                            </div>
                            <span className="font-mono text-lg font-bold text-purple-900 shrink-0">
                              + LKR {counterRetailSpecialSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {posBulkSpecialSalesTotal > 0 && (
                            <div className="text-[11px] text-purple-800 bg-purple-100/70 p-2 rounded-lg font-medium">
                              Note: LKR {posBulkSpecialSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of Special Stock was sold via POS Bulk and is already counted in POS Cash Sales above. Adding LKR {counterRetailSpecialSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} counter retail.
                            </div>
                          )}
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
                    )}

                    {/* RIGHT COLUMN: DEDUCTIONS, BANK DEPOSIT & CLOSING FLOAT */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
                      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                          {isOwner ? '2. Deductions & Drawer Float' : 'Deductions & Drawer Float'}
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

                      {/* Bank Deposit Amount (Manual Input) */}
                      <div className="pt-1 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div>
                            <span className="font-semibold text-[15px] text-slate-900 block">
                              Bank Deposit Amount (LKR)
                            </span>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Cash taken out of drawer to deposit in bank (optional, default 0)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <span className="text-xs font-bold text-rose-600 font-mono">- LKR</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={totalDrawerCashCounted}
                              inputMode="decimal"
                              placeholder="0.00"
                              value={bankDepositAmountInput}
                              onChange={(e) => setBankDepositAmountInput(e.target.value)}
                              className={`w-36 h-11 px-3 text-right font-mono text-lg font-bold tabular-nums rounded-lg border focus:outline-none focus:ring-2 ${isBankDepositExceeding
                                ? 'bg-rose-50 text-rose-900 border-rose-400 focus:ring-rose-200'
                                : 'bg-rose-50/50 text-rose-900 border-rose-200 focus:border-rose-400 focus:ring-rose-200'
                                }`}
                            />
                          </div>
                        </div>

                        {isBankDepositExceeding && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>
                              Bank deposit (LKR {bankDepositAmount.toLocaleString()}) cannot exceed total counted drawer cash (LKR {totalDrawerCashCounted.toLocaleString()}).
                            </span>
                          </div>
                        )}

                        {bankDepositAmount > 0 && !isBankDepositExceeding && (
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

                      {/* Remaining Cash Left in Drawer (Auto-Calculated Formula) */}
                      <div className="p-4 rounded-xl border-2 border-emerald-500/70 bg-emerald-50/30 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[15px] text-slate-900 block">
                                Remaining Cash Left in Drawer
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-800 border border-emerald-300">
                                Carried Forward
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                              Auto-calculated: <strong>Total Drawer Cash</strong> (LKR {totalDrawerCashCounted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) − <strong>Bank Deposit</strong> (LKR {bankDepositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </p>
                            <p className="text-[11px] text-emerald-700 font-medium mt-1">
                              Automatically carries forward as the Opening Float for the next shift today or tomorrow morning.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <span className="text-xs font-bold text-emerald-800 font-mono">LKR</span>
                            <span className="w-44 h-11 px-3 flex items-center justify-end font-mono text-xl font-black tabular-nums bg-white text-emerald-950 border border-emerald-400 rounded-lg shadow-2xs">
                              {remainingDrawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Handover Notes */}
                      <div className="pt-1">
                        <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">
                          Handover Notes / Remarks
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Optional remarks for Admin..."
                          value={handoverNotes}
                          onChange={(e) => setHandoverNotes(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200 focus:border-indigo-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Back Action */}
                  <div className={`flex items-center justify-start pt-2 ${!isOwner ? 'max-w-2xl mx-auto' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('DENOMINATIONS')}
                      className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200/90 shadow-2xs"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Drawer Cash Count</span>
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
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-900 font-medium text-xs sm:text-sm">
                Drawer Counted: <strong className="font-mono text-slate-950 font-bold ml-1">LKR {totalDrawerCashCounted.toFixed(2)}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-medium text-xs sm:text-sm">
                Bank Deposit: <strong className="font-mono text-indigo-950 font-bold ml-1">LKR {bankDepositAmount.toFixed(2)}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium text-xs sm:text-sm">
                Remaining Drawer Float: <strong className="font-mono text-emerald-950 font-bold ml-1">LKR {remainingDrawerCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
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
                  <span>Proceed to Drawer Cash Count</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'DENOMINATIONS' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('SUMMARY')}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <span>Proceed to Cash &amp; Reconciliation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'SUMMARY' && (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || isBankDepositExceeding || !isBankDepositValid}
                  className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[14px] sm:text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
