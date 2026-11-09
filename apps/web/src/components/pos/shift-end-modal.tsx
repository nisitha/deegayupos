'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, DollarSign, Clock, Store } from 'lucide-react';

interface ShiftEndModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashierName: string;
  registerCode: string;
  openingFloat: number;
  totalSalesToday: number;
  onConfirmEndShift: () => void;
}

export function ShiftEndModal({
  isOpen,
  onClose,
  cashierName,
  registerCode,
  openingFloat,
  totalSalesToday,
  onConfirmEndShift,
}: ShiftEndModalProps) {
  const [actualCash, setActualCash] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const expectedCash = openingFloat + totalSalesToday * 0.65; // Estimated cash portion
  const parsedActual = parseFloat(actualCash) || expectedCash;
  const difference = parsedActual - expectedCash;

  const handleConfirm = () => {
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onConfirmEndShift();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#7052FF] flex items-center justify-center font-bold shadow-xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">End Cashier Shift</h3>
              <p className="text-xs text-slate-500">Terminal {registerCode} • {cashierName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="text-sm font-bold text-slate-900">Shift Closed Successfully</h4>
            <p className="text-xs text-slate-500">Printing Z-Report summary slip to thermal printer...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Shift Breakdown Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-500">
                <span className="flex items-center gap-1.5 font-sans">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Shift Started:
                </span>
                <span className="font-bold text-slate-800 font-mono">Today, 8:30 AM</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span className="flex items-center gap-1.5 font-sans">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  Opening Float:
                </span>
                <span className="font-bold text-slate-800 font-mono">LKR {openingFloat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span className="font-sans">Shift Total Sales:</span>
                <span className="font-bold text-[#7052FF] font-mono">LKR {totalSalesToday.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span className="font-sans">Expected Drawer Balance:</span>
                <span className="font-mono text-emerald-700">LKR {expectedCash.toFixed(2)}</span>
              </div>
            </div>

            {/* Actual Counted Cash */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Actual Cash Counted in Drawer (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={expectedCash.toFixed(2)}
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF]"
              />
              {actualCash && difference !== 0 && (
                <p className={`text-[11px] font-mono font-semibold ${difference > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {difference > 0 ? `Over by +LKR ${difference.toFixed(2)}` : `Short by -LKR ${Math.abs(difference).toFixed(2)}`}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-[#7052FF] hover:bg-[#5E3FE6] rounded-xl shadow-sm active:scale-95 transition-all"
              >
                Close Shift & Print Z-Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

