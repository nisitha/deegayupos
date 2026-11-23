'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Banknote,
  Coins,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calculator,
} from 'lucide-react';
import { shiftsApi, type CashierShiftDto } from '../../lib/api-client';

interface ShiftStartModalProps {
  isOpen: boolean;
  activeShift: CashierShiftDto | null;
  branchName: string;
  cashierName: string;
  onConfirmSuccess: (confirmedOpeningFloat: number) => void;
  isOwner?: boolean;
}

const SRI_LANKA_DENOMINATIONS = [
  { value: 5000, label: 'Rs. 5,000 Note' },
  { value: 2000, label: 'Rs. 2,000 Note' },
  { value: 1000, label: 'Rs. 1,000 Note' },
  { value: 500, label: 'Rs. 500 Note' },
  { value: 100, label: 'Rs. 100 Note' },
  { value: 50, label: 'Rs. 50 Note' },
  { value: 20, label: 'Rs. 20 Note' },
  { value: 10, label: 'Coins (Rs. 10, 5, 2, 1 Total)' },
];

export function ShiftStartModal({
  isOpen,
  activeShift,
  branchName,
  cashierName,
  onConfirmSuccess,
  isOwner,
}: ShiftStartModalProps) {
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [showDenomCounter, setShowDenomCounter] = useState<boolean>(false);
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    setCountedCashInput('');
    setDenomCounts({});
    setShowDenomCounter(false);
    setErrorMsg(null);
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 150);
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, activeShift?.id]);

  const denomSum = useMemo(() => {
    return SRI_LANKA_DENOMINATIONS.reduce((acc, d) => {
      const count = denomCounts[d.value] || 0;
      return acc + (d.value * count);
    }, 0);
  }, [denomCounts]);

  const handleDenomChange = (val: number, countStr: string) => {
    const count = parseInt(countStr, 10) || 0;
    const nextCounts = { ...denomCounts, [val]: Math.max(0, count) };
    setDenomCounts(nextCounts);

    const newTotal = SRI_LANKA_DENOMINATIONS.reduce((acc, d) => {
      const c = nextCounts[d.value] || 0;
      return acc + (d.value * c);
    }, 0);

    setCountedCashInput(newTotal > 0 ? newTotal.toString() : '');
  };

  const parsedCash = parseFloat(countedCashInput);
  const isValidAmount = countedCashInput.trim() !== '' && !isNaN(parsedCash) && parsedCash >= 0;

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValidAmount || !activeShift?.id || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const breakdown: Record<string, number> = {};
      Object.entries(denomCounts).forEach(([k, v]) => {
        if (v > 0) breakdown[k] = v;
      });

      const res = await shiftsApi.confirmShiftOpeningCount(
        activeShift.id,
        parsedCash,
        Object.keys(breakdown).length > 0 ? breakdown : undefined,
        activeShift.branchId
      );

      if (res.success) {
        onConfirmSuccess(parsedCash);
      } else {
        setErrorMsg(res.error?.message || 'Failed to confirm opening float. Please try again.');
      }
    } catch (err: any) {
      console.error('[ShiftStartModal] Confirmation failed:', err);
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !activeShift || isOwner) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-start-modal-title"
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (No close button - strictly non-dismissible) */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shadow-inner">
              <Banknote className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="shift-start-modal-title" className="text-base font-bold text-white tracking-tight">
                  Start Shift for {cashierName} — Opening Drawer Cash Count
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-indigo-200/80 mt-0.5">
                <span className="font-semibold">{branchName || 'Branch Terminal'}</span>
                <span>•</span>
                <span>Cashier: <strong className="text-white font-medium">{cashierName}</strong></span>
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Mandatory Count
          </span>
        </div>

        {/* Content Area */}
        <form onSubmit={handleConfirm} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Security Notice Pill */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 text-xs">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-indigo-950">Blind Cash Verification Policy</div>
              <p className="text-indigo-800/90 mt-0.5 leading-relaxed">
                Please physically count all notes and coins in the cash drawer before starting POS operations. Enter the exact total below to initialize your shift session.
              </p>
            </div>
          </div>

          {/* Primary Numeric Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Physical Cash Counted in Drawer (LKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="font-bold text-sm text-slate-400 font-mono">LKR</span>
              </div>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-14 pl-16 pr-4 text-2xl font-black font-mono text-slate-900 bg-white border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none transition-all placeholder:text-slate-300 tabular-nums shadow-sm"
              />
            </div>
            <p className="text-xs text-slate-500 flex items-center justify-between">
              <span>Count physical cash in the drawer at shift commencement and enter exact total.</span>
              <span className="text-[11px] text-slate-400">Accepts 0.00 if drawer starts empty</span>
            </p>
          </div>

          {/* Collapsible Quick Note & Coin Counter */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60 transition-all">
            <button
              type="button"
              onClick={() => setShowDenomCounter(!showDenomCounter)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                <span>Quick Note & Coin Counter (Optional Breakdown)</span>
                {denomSum > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 rounded-md">
                    Total: LKR {denomSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[11px] font-normal">{showDenomCounter ? 'Collapse' : 'Expand'}</span>
                {showDenomCounter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showDenomCounter && (
              <div className="p-4 pt-2 border-t border-slate-200/90 bg-white space-y-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pb-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>Enter quantity of each bill or coin denomination to auto-populate the counted total:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {SRI_LANKA_DENOMINATIONS.map((d) => (
                    <div key={d.value} className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-600 truncate" title={d.label}>
                        {d.label}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-bold font-mono">×</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={denomCounts[d.value] || ''}
                          onChange={(e) => handleDenomChange(d.value, e.target.value)}
                          disabled={isSubmitting}
                          className="w-full h-8 px-2 text-right font-mono text-xs font-bold bg-white border border-slate-300 rounded focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="text-[10px] text-right font-mono text-slate-500 font-semibold truncate">
                        LKR {((denomCounts[d.value] || 0) * d.value).toLocaleString('en-US')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isValidAmount || isSubmitting}
              className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                isValidAmount && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying & Opening Terminal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Confirm Opening Float & Open POS Terminal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
