'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, PackagePlus, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { CashierShiftDto, shiftsApi } from '../../lib/api-client';

interface ModakaItemRow {
  productId: string;
  productName: string;
  openingQty: number;
  currentInQty: number;
  appliedRate: number;
}

interface ModakaStockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: CashierShiftDto | null;
  branchId?: string | null;
  cashierId?: string | null;
  cashierName?: string | null;
  onSuccess: () => void;
}

export function ModakaStockInModal({
  isOpen,
  onClose,
  activeShift,
  branchId,
  cashierId,
  cashierName,
  onSuccess,
}: ModakaStockInModalProps) {
  const [items, setItems] = useState<ModakaItemRow[]>([]);
  const [inQuantities, setInQuantities] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedShiftId, setResolvedShiftId] = useState<string | null>(null);

  // Load items on modal open
  const loadModalData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setInQuantities({});

    try {
      // 1. If activeShift with entries is passed, use it directly
      if (activeShift && activeShift.modakaEntries && activeShift.modakaEntries.length > 0) {
        setResolvedShiftId(activeShift.id);
        setItems(
          activeShift.modakaEntries.map((e) => ({
            productId: e.productId,
            productName: e.productName || 'Special Item',
            openingQty: Number(e.openingQty || 0),
            currentInQty: Number(e.inQty || 0),
            appliedRate: Number(e.appliedRate || 250),
          }))
        );
        setIsLoading(false);
        return;
      }

      // 2. If activeShift is missing, resolve or open shift via API
      const effectiveBranchId = branchId || (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_selected_branch') : null);
      const effectiveCashierId = cashierId || (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_cashier_id') : null);

      if (effectiveBranchId && effectiveCashierId) {
        const shiftRes = await shiftsApi.getOrCreateActiveShift(
          effectiveBranchId,
          effectiveCashierId,
          cashierName || undefined
        );
        if (shiftRes.success && shiftRes.data) {
          setResolvedShiftId(shiftRes.data.id);
          const entries = shiftRes.data.modakaEntries || [];
          if (entries.length > 0) {
            setItems(
              entries.map((e) => ({
                productId: e.productId,
                productName: e.productName || 'Special Item',
                openingQty: Number(e.openingQty || 0),
                currentInQty: Number(e.inQty || 0),
                appliedRate: Number(e.appliedRate || 250),
              }))
            );
            setIsLoading(false);
            return;
          }
        }
      }

      // 3. Fallback to active Modaka configs directly from database
      const configsRes = await shiftsApi.getModakaConfigs();
      if (configsRes.success && configsRes.data) {
        const activeConfigs = configsRes.data.filter((c) => c.isActive);
        setItems(
          activeConfigs.map((c) => ({
            productId: c.productId,
            productName: c.productName,
            openingQty: 0,
            currentInQty: 0,
            appliedRate: c.customRate,
          }))
        );
      }
    } catch (err: any) {
      console.warn('[ModakaStockInModal] load error:', err);
      setErrorMessage('Could not load special items. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeShift, branchId, cashierId, cashierName]);

  useEffect(() => {
    if (isOpen) {
      loadModalData();
    }
  }, [isOpen, loadModalData]);

  // NEVER silently return null if !activeShift — only return null if !isOpen
  if (!isOpen) return null;

  const handleQtyChange = (productId: string, val: string) => {
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

    try {
      let targetShiftId = resolvedShiftId || activeShift?.id;

      // Self-heal: If shiftId is still missing, resolve it now
      if (!targetShiftId) {
        const effectiveBranchId = branchId || (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_selected_branch') : null);
        const effectiveCashierId = cashierId || (typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_cashier_id') : null);

        if (effectiveBranchId && effectiveCashierId) {
          const shiftRes = await shiftsApi.getOrCreateActiveShift(
            effectiveBranchId,
            effectiveCashierId,
            cashierName || undefined
          );
          if (shiftRes.success && shiftRes.data) {
            targetShiftId = shiftRes.data.id;
            setResolvedShiftId(targetShiftId);
          }
        }
      }

      if (!targetShiftId) {
        setErrorMessage('Cannot save: Active branch or shift session not found. Please re-select branch.');
        setIsSubmitting(false);
        return;
      }

      const updates = Object.entries(inQuantities)
        .map(([productId, qtyStr]) => ({
          productId,
          inQty: parseInt(qtyStr, 10) || 0,
        }))
        .filter((u) => u.inQty > 0);

      const res = await shiftsApi.recordModakaStockIn(targetShiftId, updates);
      setIsSubmitting(false);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error?.message || 'Failed to record incoming special stock.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'An unexpected error occurred while saving.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-rose-500 via-pink-600 to-orange-500 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-white shadow-inner">
              <PackagePlus className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">
                  Special Stock In (B)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/20">
                  {activeShift ? `Shift ${activeShift.shiftNumber}` : 'Active Shift'}
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium">
                Record incoming Special Stock received during the current working shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
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

            {isLoading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-rose-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Loading Special Items...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-700">No active special items configured</p>
                <p className="text-[11px] text-slate-400">Configure special items in Admin Finance Ledger</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Special Item</th>
                      <th className="py-2.5 px-2 text-center w-24">Opening (A)</th>
                      <th className="py-2.5 px-3 text-center w-28 bg-rose-100/70 text-rose-950 font-black">
                        Add In (B)
                      </th>
                      <th className="py-2.5 px-2 text-center w-24">Balance (C)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const entering = parseInt(inQuantities[item.productId] || '0', 10);
                      const totalIn = item.currentInQty + entering;
                      const newTotalAvail = item.openingQty + totalIn;

                      return (
                        <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900 text-xs">{item.productName}</p>
                            {item.currentInQty > 0 && (
                              <span className="text-[10px] text-amber-600 font-mono font-medium block">
                                Already received today: {item.currentInQty}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-slate-600">
                            {item.openingQty}
                          </td>
                          <td className="py-2.5 px-3 text-center bg-rose-50/40">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={inQuantities[item.productId] || ''}
                              onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                              className="w-20 px-2 py-1.5 text-center font-bold font-mono text-sm bg-white border border-rose-300 rounded-xl focus:border-rose-600 focus:ring-2 focus:ring-rose-200 focus:outline-none shadow-2xs"
                            />
                          </td>
                          <td className="py-3 px-2 text-center font-mono font-black text-emerald-700">
                            {newTotalAvail}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total incoming footer */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs">
              <span className="font-bold text-slate-700">Total Additional Special Units Received:</span>
              <span className="font-mono text-lg font-black text-rose-600">
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
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalInQty <= 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-bold shadow-md shadow-rose-500/25 flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Special Stock In...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Special Stock In (+{totalInQty})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
