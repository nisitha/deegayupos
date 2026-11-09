'use client';

import React, { useState } from 'react';
import { X, Tag, Plus } from 'lucide-react';

interface CustomSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomItem: (item: {
    name: string;
    price: number;
    quantity: number;
    note?: string;
  }) => void;
}

export function CustomSaleModal({
  isOpen,
  onClose,
  onAddCustomItem,
}: CustomSaleModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(price);
    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);

    if (!name.trim()) return;
    if (isNaN(parsedPrice) || parsedPrice <= 0) return;

    onAddCustomItem({
      name: name.trim(),
      price: parsedPrice,
      quantity: parsedQty,
      note: note.trim() || undefined,
    });

    // Reset & Close
    setName('');
    setPrice('');
    setQuantity('1');
    setNote('');
    onClose();
  };

  const presetPrices = [250, 500, 1000, 1500, 2500];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shadow-xs">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Custom Sale Item</h3>
              <p className="text-xs text-slate-500">Unlisted retail item or service fee</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Item Title / Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Ayurvedic Consultation, Packaging Fee..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5C6AC4]/20 focus:border-[#5C6AC4] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Price (LKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5C6AC4]/20 focus:border-[#5C6AC4] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-[#5C6AC4]"
              />
            </div>
          </div>

          {/* Quick Price Presets */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Quick Price Presets
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {presetPrices.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPrice(preset.toString())}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-50 border border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
                >
                  Rs. {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Optional Note
            </label>
            <input
              type="text"
              placeholder="e.g. Special order by patient"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-none focus:border-[#5C6AC4]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#5C6AC4] hover:bg-[#4F5DB0] rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
