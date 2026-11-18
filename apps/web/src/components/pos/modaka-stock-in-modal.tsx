'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, PackageCheck, AlertCircle, Loader2 } from 'lucide-react';
import { CashierShiftDto, shiftsApi } from '../../lib/api-client';

interface ModakaStockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: CashierShiftDto | null;
  onSuccess: () => void;
}

export function ModakaStockInModal({
  isOpen,
  onClose,
  activeShift,
  onSuccess,
}: ModakaStockInModalProps) {
  const [inQuantities, setInQuantities] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInQuantities({});
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !activeShift) return null;

  const entries = activeShift.modakaEntries || [];

  const handleQtyChange = (productId: string, val: string) => {
    // Only allow positive numbers
    const clean = val.replace(/[^0-9]/g, '');
    setInQuantities((prev) => ({ ...prev, [productId]: clean }));
  };

  const totalInQty = Object.values(inQuantities).reduce(
    (acc, v) => acc + (parseInt(v, 10) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalInQty <= 0) {
      setErrorMessage('Please enter at least one quantity to add to incoming stock.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const updates = Object.entries(inQuantities)
      .map(([productId, qtyStr]) => ({
        productId,
        inQty: parseInt(qtyStr, 10) || 0,
      }))
      .filter((u) => u.inQty > 0);

    const res = await shiftsApi.recordModakaStockIn(activeShift.id, updates);
    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setErrorMessage(res.error?.message || 'Failed to record incoming Modaka stock.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-white shadow-inner">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Modaka Stock In (ලද ප්‍රමාණය - B)
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Record incoming Modaka stock received during Shift {activeShift.shiftNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl text-xs text-amber-900 leading-relaxed">
              💡 <strong>Mid-Shift Entry:</strong> Entering stock received here adds directly to column{' '}
              <strong>B (In)</strong> and recalculates available stock (<strong>C = A + B</strong>) immediately without ending your shift.
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Modaka Variety / විස්තරය</th>
                    <th className="py-2.5 px-3 text-center w-20">A: Opening</th>
                    <th className="py-2.5 px-3 text-center w-28 bg-amber-100/60 text-amber-900">
                      + B: Receive Now
                    </th>
                    <th className="py-2.5 px-3 text-center w-24">C: New Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((item, idx) => {
                    const currentIn = Number(item.inQty || 0);
                    const entering = parseInt(inQuantities[item.productId] || '0', 10);
                    const newTotalIn = currentIn + entering;
                    const newTotalAvail = Number(item.openingQty || 0) + newTotalIn;

                    return (
                      <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-800">{item.productName}</p>
                          {currentIn > 0 && (
                            <span className="text-[10px] text-amber-600 font-mono">
                              Already received today: {currentIn}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                          {item.openingQty}
                        </td>
                        <td className="py-2 px-3 text-center bg-amber-50/40">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={inQuantities[item.productId] || ''}
                            onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                            className="w-20 px-2 py-1.5 text-center font-bold font-mono text-sm bg-white border border-amber-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none shadow-2xs"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                          {newTotalAvail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total incoming footer */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Total Additional Modaka Units Received:</span>
              <span className="font-mono text-base font-black text-amber-600">
                +{totalInQty} units
              </span>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalInQty <= 0}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording Stock In...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4" />
                  Save Stock In (+{totalInQty})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
