'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Scale, Droplet, Hash, Check, Tag } from 'lucide-react';
import {
  detectUnitConfig,
  calculateBaseQuantity,
  formatQuantityWithUnit,
  type QuickPreset,
} from '../../lib/unit-utils';

export interface QuantityUnitModalProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  retailPrice: number;
  costPrice?: number;
  stockOnHand: number;
  unit: string;
  imageUrl?: string;
  departmentId?: string;
}

export interface QuantityUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: QuantityUnitModalProduct | null;
  cartItemId?: string;
  initialUnit?: string;
  initialDisplayQuantity?: number;
  initialCustomPrice?: number;
  onConfirm: (result: {
    productId: string;
    cartItemId?: string;
    selectedUnit: string;
    displayQuantity: number;
    baseQuantity: number;
    unitPrice: number;
  }) => void;
}

export function QuantityUnitModal({
  isOpen,
  onClose,
  product,
  cartItemId,
  initialUnit,
  initialDisplayQuantity,
  initialCustomPrice,
  onConfirm,
}: QuantityUnitModalProps) {
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const config = useMemo(() => {
    if (!product) return null;
    return detectUnitConfig(product);
  }, [product]);

  const [selectedUnit, setSelectedUnit] = useState<string>('g');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [showCustomPrice, setShowCustomPrice] = useState<boolean>(false);

  // Initialize modal state on open or product change
  useEffect(() => {
    if (!isOpen || !product || !config) {
      return undefined;
    }

    const defaultUnit = initialUnit || config.baseUnit;
    setSelectedUnit(defaultUnit);

    // Default quantity input
    if (initialDisplayQuantity !== undefined) {
      setQuantityInput(initialDisplayQuantity.toString());
    } else if (config.mode === 'weight_g') {
      setQuantityInput(defaultUnit === 'kg' ? '1' : '100');
    } else if (config.mode === 'volume_ml') {
      setQuantityInput(defaultUnit === 'L' ? '1' : '250');
    } else {
      setQuantityInput('1');
    }

    // Custom price
    const priceVal = initialCustomPrice ?? product.retailPrice;
    setCustomPriceInput(priceVal.toFixed(2));
    setShowCustomPrice(initialCustomPrice !== undefined && initialCustomPrice !== product.retailPrice);

    // Focus and select input
    const timer = setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, product, config, initialUnit, initialDisplayQuantity, initialCustomPrice]);

  // Handle unit switching (e.g. g <-> kg, ml <-> L) with numerical conversion
  const handleSwitchUnit = (newUnit: string) => {
    if (!config || newUnit === selectedUnit) return;
    const curNum = parseFloat(quantityInput);
    if (!isNaN(curNum) && curNum > 0) {
      if (config.mode === 'weight_g') {
        if (selectedUnit === 'g' && newUnit === 'kg') {
          const converted = Math.round((curNum / 1000) * 1000) / 1000;
          setQuantityInput(converted.toString());
        } else if (selectedUnit === 'kg' && newUnit === 'g') {
          const converted = Math.round(curNum * 1000 * 1000) / 1000;
          setQuantityInput(converted.toString());
        }
      } else if (config.mode === 'volume_ml') {
        if (selectedUnit === 'ml' && newUnit === 'L') {
          const converted = Math.round((curNum / 1000) * 1000) / 1000;
          setQuantityInput(converted.toString());
        } else if (selectedUnit === 'L' && newUnit === 'ml') {
          const converted = Math.round(curNum * 1000 * 1000) / 1000;
          setQuantityInput(converted.toString());
        }
      }
    }
    setSelectedUnit(newUnit);
    qtyInputRef.current?.focus();
  };

  // Handle clicking a quick preset
  const handlePresetClick = (preset: QuickPreset) => {
    setSelectedUnit(preset.unit);
    setQuantityInput(preset.displayValue.toString());
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  };

  // Calculations
  const qtyNumber = parseFloat(quantityInput) || 0;
  const effectiveRate = parseFloat(customPriceInput) >= 0 ? parseFloat(customPriceInput) : product?.retailPrice || 0;
  const baseQuantity = config ? calculateBaseQuantity(qtyNumber, selectedUnit, config) : qtyNumber;
  const lineTotal = Math.round(baseQuantity * effectiveRate * 100) / 100;

  // Submit action
  const handleConfirm = useCallback(() => {
    if (!product || !config) return;
    if (qtyNumber <= 0) return;

    onConfirm({
      productId: product.id,
      cartItemId,
      selectedUnit,
      displayQuantity: qtyNumber,
      baseQuantity,
      unitPrice: effectiveRate,
    });
    onClose();
  }, [product, config, qtyNumber, onConfirm, cartItemId, selectedUnit, baseQuantity, effectiveRate, onClose]);

  // Capture keyboard events (Enter to confirm, Escape to close)
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, handleConfirm]);

  if (!isOpen || !product || !config) return null;

  const isWeight = config.mode === 'weight_g';
  const isVolume = config.mode === 'volume_ml';
  const isMultiUnit = isWeight || isVolume;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 flex flex-col gap-5 select-none relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. Product Header */}
        <div className="pr-8">
          <div className="flex items-center gap-2 mb-1">
            {isWeight ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Scale className="w-3 h-3" />
                Weight Item
              </span>
            ) : isVolume ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                <Droplet className="w-3 h-3" />
                Liquid Item
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-[#5B46F6] border border-indigo-200">
                <Hash className="w-3 h-3" />
                {config.label}
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-400">{product.sku}</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {product.name}
          </h3>

          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-lg font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Stock: {product.stockOnHand.toLocaleString()} {config.baseUnit}
            </span>
            <span className="px-2.5 py-1 rounded-lg font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Rate: LKR {product.retailPrice.toFixed(2)} / 1{config.baseUnit}
            </span>
          </div>
        </div>

        {/* 2. Large Segmented Unit Switcher (Weight & Volume) */}
        {isMultiUnit && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Select Measurement Unit
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => handleSwitchUnit(config.baseUnit)}
                className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedUnit === config.baseUnit
                    ? 'bg-[#5B46F6] text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
                }`}
              >
                <span>{isWeight ? 'Grams (g)' : 'Milliliters (ml)'}</span>
                {selectedUnit === config.baseUnit && <Check className="w-4 h-4 stroke-[2.5]" />}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchUnit(config.alternateUnit!)}
                className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedUnit === config.alternateUnit
                    ? 'bg-[#5B46F6] text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
                }`}
              >
                <span>{isWeight ? 'Kilograms (kg)' : 'Liters (L)'}</span>
                {selectedUnit === config.alternateUnit && <Check className="w-4 h-4 stroke-[2.5]" />}
              </button>
            </div>
          </div>
        )}

        {/* 3. Large Quantity Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enter Quantity ({selectedUnit})
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Type number or click preset</span>
          </div>

          <div className="relative">
            <input
              ref={qtyInputRef}
              type="number"
              step={selectedUnit === 'kg' || selectedUnit === 'L' || config.allowDecimals ? 'any' : '1'}
              min="0.001"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="w-full text-3xl font-extrabold text-center tabular-nums h-16 rounded-2xl border-2 border-indigo-500 bg-white text-slate-900 shadow-inner focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold font-mono text-slate-400 pointer-events-none">
              {selectedUnit}
            </span>
          </div>
        </div>

        {/* 4. Quick Presets Grid */}
        {config.quickPresets.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Quick Presets
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {config.quickPresets.map((preset) => {
                const isActive =
                  selectedUnit === preset.unit && parseFloat(quantityInput) === preset.displayValue;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[#0F1222] text-white border-[#0F1222] shadow-sm'
                        : 'bg-slate-50 hover:bg-indigo-50 hover:text-[#5B46F6] hover:border-indigo-300 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Custom Price Override (Collapsible) */}
        <div className="pt-1">
          {!showCustomPrice ? (
            <button
              type="button"
              onClick={() => setShowCustomPrice(true)}
              className="text-xs font-semibold text-[#5B46F6] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Override Unit Rate for This Bill Only (LKR {effectiveRate.toFixed(2)})</span>
            </button>
          ) : (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Custom Unit Price (per 1{config.baseUnit})</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPriceInput(product.retailPrice.toFixed(2));
                    setShowCustomPrice(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 font-normal underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  LKR
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customPriceInput}
                  onChange={(e) => setCustomPriceInput(e.target.value)}
                  className="w-full pl-11 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Live Conversion & Line Total Digital Readout */}
        <div className="bg-[#0F1222] text-white rounded-2xl p-4 flex items-center justify-between shadow-inner border border-slate-800">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              Line Calculation
            </span>
            <span className="text-xs font-mono text-indigo-300 mt-0.5">
              {formatQuantityWithUnit(baseQuantity, selectedUnit, config)} × LKR {effectiveRate.toFixed(2)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
              Line Total
            </span>
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              LKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 7. Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer active:scale-95"
          >
            Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={qtyNumber <= 0}
            className="flex-1 bg-gradient-to-r from-[#5B46F6] to-[#4A35E5] hover:from-[#4E39EC] hover:to-[#3E29D6] disabled:opacity-40 text-white font-bold text-sm sm:text-base py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            <span>{cartItemId ? 'Update Order' : 'Add to Order'} (Enter) &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}

