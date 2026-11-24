'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  X,
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { shiftsApi, sortSpecialStockItems } from '../../lib/api-client';

export interface SpecialBulkSelection {
  productId: string;
  productName: string;
  productSku: string;
  packsCount: number;
  unitsPerPack: number;
  totalUnits: number;
  unitRate: number;
  packPrice: number;
  totalAmount?: number;
  totalPrice?: number;
  availableUnits?: number;
}

export interface SpecialBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string | null;
  branchName?: string;
  activeShift?: any;
  activeShiftId?: string;
  onAddToCart: (item: SpecialBulkSelection) => void;
}

interface SpecialItemWithStock {
  productId: string;
  productName: string;
  productSku: string;
  customRate: number;
  availableUnits: number;
  availablePacks: number;
}

export function SpecialBulkModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  activeShift,
  activeShiftId,
  onAddToCart,
}: SpecialBulkModalProps) {
  const [items, setItems] = useState<SpecialItemWithStock[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [packsInput, setPacksInput] = useState<string>('1');

  const effectiveShiftId = activeShiftId || activeShift?.id;

  // Load Special items and live branch shift stock
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        // 1. Fetch Modaka / Special Item configs
        const configsRes = await shiftsApi.getModakaConfigs();
        const configs = (configsRes.data || []).filter((c) => c.isActive);

        // 2. Fetch live stock from active shift entries or warehouses
        const stockMap = new Map<string, number>();

        if (effectiveShiftId) {
          const { data: smeData } = await supabase
            .from('shift_modaka_entries')
            .select('product_id, closing_qty, total_available_qty, sold_qty, opening_qty, in_qty')
            .eq('shift_id', effectiveShiftId);

          (smeData || []).forEach((row: any) => {
            const closing = Number(row.closing_qty ?? (Number(row.opening_qty || 0) + Number(row.in_qty || 0) - Number(row.sold_qty || 0)));
            stockMap.set(row.product_id, Math.max(0, closing));
          });
        }

        // Fallback or fill missing from warehouses -> stock_levels
        if (branchId) {
          const { data: wh } = await supabase
            .from('warehouses')
            .select('id')
            .eq('branch_id', branchId)
            .limit(1)
            .maybeSingle();

          if (wh?.id) {
            const { data: slData } = await supabase
              .from('stock_levels')
              .select('product_id, quantity_on_hand')
              .eq('warehouse_id', wh.id);

            (slData || []).forEach((sl: any) => {
              if (!stockMap.has(sl.product_id)) {
                stockMap.set(sl.product_id, Math.max(0, Number(sl.quantity_on_hand || 0)));
              }
            });
          }
        }

        if (isMounted) {
          const combined: SpecialItemWithStock[] = configs.map((cfg) => {
            const avail = stockMap.get(cfg.productId) || 0;
            return {
              productId: cfg.productId,
              productName: cfg.productName,
              productSku: cfg.productSku || 'SKU-SPECIAL',
              customRate: Number(cfg.customRate || 250),
              availableUnits: avail,
              availablePacks: Math.floor(avail / 25),
            };
          });

          const sortedCombined = sortSpecialStockItems(combined);
          setItems(sortedCombined);
          if (sortedCombined.length > 0 && !selectedProductId) {
            setSelectedProductId(sortedCombined[0]!.productId);
          }
        }
      } catch (err) {
        console.error('[SpecialBulkModal] load error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, branchId, activeShiftId]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i.productId === selectedProductId) || null;
  }, [items, selectedProductId]);

  const packsCount = useMemo(() => {
    const val = parseInt(packsInput, 10);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [packsInput]);

  const totalUnits = packsCount * 25;
  const unitRate = selectedItem?.customRate || 250;
  const packPrice = unitRate * 25;
  const lineTotal = totalUnits * unitRate;

  const isExceeding = useMemo(() => {
    if (!selectedItem) return false;
    return totalUnits > selectedItem.availableUnits;
  }, [selectedItem, totalUnits]);

  const canAddToCart = packsCount >= 1 && !isExceeding && selectedItem !== null;

  const handlePackQuickSelect = (numPacks: number) => {
    setPacksInput(String(numPacks));
  };

  const handleAdd = () => {
    if (!canAddToCart || !selectedItem) return;

    onAddToCart({
      productId: selectedItem.productId,
      productName: selectedItem.productName,
      productSku: selectedItem.productSku,
      packsCount,
      unitsPerPack: 25,
      totalUnits,
      unitRate,
      packPrice,
      totalAmount: lineTotal,
      availableUnits: selectedItem.availableUnits,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="max-w-3xl w-full bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center justify-center font-bold">
              <Package className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Special Item Bulk Billing (25-Pack)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-200 border border-purple-400/30">
                  Wholesale Pack
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                {branchName || 'Active Branch'} • 1 Pack = 25 Special Stock Units
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#F8FAFC]">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-sm font-semibold text-slate-500">
                Loading live Special Stock for {branchName}...
              </span>
            </div>
          ) : (
            <>
              {/* Product Selection Grid */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  1. Select Special Item ({items.length} Registered SKUs)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {items.map((item) => {
                    const isSelected = item.productId === selectedProductId;
                    const isOutOfStock = item.availableUnits < 25;

                    return (
                      <button
                        key={item.productId}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(item.productId);
                          setPacksInput('1');
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/30'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                isSelected ? 'bg-white/15 text-indigo-200' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.productSku}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : isSelected
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {item.availablePacks} pk ({item.availableUnits} u)
                            </span>
                          </div>
                          <span className="font-bold text-xs sm:text-sm block mt-2 line-clamp-1 leading-snug">
                            {item.productName}
                          </span>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100/20 flex items-center justify-between text-xs">
                          <span className={isSelected ? 'text-indigo-200' : 'text-slate-500'}>
                            LKR {item.customRate}/u
                          </span>
                          <span className="font-mono font-bold text-emerald-400">
                            LKR {(item.customRate * 25).toLocaleString()}/pk
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pack Count & Calculation Section */}
              {selectedItem && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        2. Enter Number of 25-Packs
                      </span>
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 mt-0.5">
                        {selectedItem.productName} ({selectedItem.productSku})
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Available in Shift</span>
                      <span className="font-mono text-sm font-bold text-indigo-700">
                        {selectedItem.availablePacks} Packs ({selectedItem.availableUnits} units)
                      </span>
                    </div>
                  </div>

                  {/* Quick-Tap Buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 block">Quick-Select Quantity:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((num) => {
                        const requiredUnits = num * 25;
                        const disabled = requiredUnits > selectedItem.availableUnits;
                        const isCurrent = packsCount === num;

                        return (
                          <button
                            key={num}
                            type="button"
                            disabled={disabled}
                            onClick={() => handlePackQuickSelect(num)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              disabled
                                ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                                : isCurrent
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            <span className="block">{num} Pack{num > 1 ? 's' : ''}</span>
                            <span className={`text-[10px] font-mono block ${isCurrent ? 'text-indigo-200' : 'text-slate-500'}`}>
                              ({requiredUnits} units)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Manual Stepper & Input */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPacksInput(String(Math.max(1, packsCount - 1)))}
                        disabled={packsCount <= 1}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={selectedItem.availablePacks}
                        step="1"
                        value={packsInput}
                        onChange={(e) => setPacksInput(e.target.value)}
                        className="w-24 h-10 px-3 text-center font-mono text-lg font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setPacksInput(String(packsCount + 1))}
                        disabled={totalUnits + 25 > selectedItem.availableUnits}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-semibold text-slate-500 ml-1">
                        Packs ({totalUnits} total units)
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                        Wholesale Pack Rate
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-700">
                        25 units × LKR {unitRate} = LKR {packPrice.toLocaleString()} / Pack
                      </span>
                    </div>
                  </div>

                  {/* Exceeding Warning */}
                  {isExceeding && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        Requested {totalUnits} units ({packsCount} packs) exceeds live branch shift stock of {selectedItem.availableUnits} units ({selectedItem.availablePacks} packs).
                      </span>
                    </div>
                  )}

                  {/* Live Computation Card */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          Bulk Breakdown
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                          {packsCount} Pack{packsCount > 1 ? 's' : ''} × 25
                        </span>
                      </div>
                      <p className="font-mono text-xs text-slate-300 mt-1">
                        {packsCount} Pack{packsCount > 1 ? 's' : ''} × 25 units = <strong className="text-white font-bold">{totalUnits} units</strong> @ LKR {unitRate.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Line Total
                      </span>
                      <span className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                        LKR {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200/90 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAddToCart}
            className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>
              Add {packsCount > 0 ? `${packsCount} Pack${packsCount > 1 ? 's' : ''} (${totalUnits} units)` : 'Bulk Pack'} to Cart
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
