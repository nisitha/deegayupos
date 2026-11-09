'use client';

import React, { useState } from 'react';
import { X, Percent, Check, Tag } from 'lucide-react';

interface DiscountPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPercent: number;
  currentFlatAmount: number;
  onApplyDiscount: (type: 'PERCENT' | 'FLAT', value: number) => void;
}

export function DiscountPickerModal({
  isOpen,
  onClose,
  currentPercent,
  currentFlatAmount,
  onApplyDiscount,
}: DiscountPickerModalProps) {
  const [tab, setTab] = useState<'PERCENT' | 'FLAT' | 'PROMO'>('PERCENT');
  const [customPercent, setCustomPercent] = useState<string>(
    currentPercent > 0 ? currentPercent.toString() : '',
  );
  const [customFlat, setCustomFlat] = useState<string>(
    currentFlatAmount > 0 ? currentFlatAmount.toString() : '',
  );
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);

  if (!isOpen) return null;

  const percentPresets = [5, 10, 15, 20, 25, 50];
  const flatPresets = [100, 250, 500, 1000, 2000];

  const handleApplyPercent = (pct: number) => {
    onApplyDiscount('PERCENT', pct);
    onClose();
  };

  const handleApplyFlat = (amt: number) => {
    onApplyDiscount('FLAT', amt);
    onClose();
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'VIP10' || code === 'DEEGAYU10') {
      onApplyDiscount('PERCENT', 10);
      onClose();
    } else if (code === 'AYURVEDA15' || code === 'HERBAL15') {
      onApplyDiscount('PERCENT', 15);
      onClose();
    } else if (code === 'DEEGAYU20') {
      onApplyDiscount('PERCENT', 20);
      onClose();
    } else {
      setPromoError('Invalid promo code. Try VIP10, HERBAL15, or DEEGAYU20');
    }
  };

  const handleClear = () => {
    onApplyDiscount('PERCENT', 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shadow-xs">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Apply Order Discount</h3>
              <p className="text-xs text-slate-500">Choose percentage, flat cash deduction, or promo</p>
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

        {/* Segmented Mode Selector */}
        <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setTab('PERCENT')}
            className={`py-2 rounded-lg transition-all ${
              tab === 'PERCENT'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setTab('FLAT')}
            className={`py-2 rounded-lg transition-all ${
              tab === 'FLAT'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            Flat (LKR)
          </button>
          <button
            type="button"
            onClick={() => setTab('PROMO')}
            className={`py-2 rounded-lg transition-all ${
              tab === 'PROMO'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            Promo Code
          </button>
        </div>

        {/* Tab 1: Percentage */}
        {tab === 'PERCENT' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {percentPresets.map((pct) => {
                const isSelected = currentPercent === pct && currentFlatAmount === 0;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleApplyPercent(pct)}
                    className={`py-3 rounded-xl border text-sm font-bold font-mono transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800'
                    }`}
                  >
                    <span>{pct}%</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Custom %"
                value={customPercent}
                onChange={(e) => setCustomPercent(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(customPercent);
                  if (!isNaN(val) && val >= 0) handleApplyPercent(val);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Flat Amount */}
        {tab === 'FLAT' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {flatPresets.map((amt) => {
                const isSelected = currentFlatAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleApplyFlat(amt)}
                    className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all active:scale-95 flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800'
                    }`}
                  >
                    <span>Rs. {amt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Custom LKR amount"
                value={customFlat}
                onChange={(e) => setCustomFlat(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(customFlat);
                  if (!isNaN(val) && val >= 0) handleApplyFlat(val);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Promo Code */}
        {tab === 'PROMO' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Enter Merchant Promo Voucher
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. VIP10, HERBAL15"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoError(null);
                    }}
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-mono font-bold uppercase rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0"
                >
                  Verify & Apply
                </button>
              </div>
              {promoError && (
                <p className="text-[11px] text-rose-500 font-medium">{promoError}</p>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          {(currentPercent > 0 || currentFlatAmount > 0) ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Remove Discount
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

