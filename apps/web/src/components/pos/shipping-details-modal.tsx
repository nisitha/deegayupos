'use client';

import React, { useState } from 'react';
import { X, Package, MapPin, Phone, Truck, Check } from 'lucide-react';

export interface ShippingDetails {
  enabled: boolean;
  courier: string;
  address: string;
  phone: string;
  fee: number;
  notes?: string;
}

interface ShippingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipping: ShippingDetails;
  onSaveShipping: (details: ShippingDetails) => void;
}

export function ShippingDetailsModal({
  isOpen,
  onClose,
  shipping,
  onSaveShipping,
}: ShippingDetailsModalProps) {
  const [courier, setCourier] = useState(shipping.courier || 'PromptX Courier');
  const [address, setAddress] = useState(shipping.address || '');
  const [phone, setPhone] = useState(shipping.phone || '');
  const [fee, setFee] = useState(shipping.fee > 0 ? shipping.fee.toString() : '350');
  const [notes, setNotes] = useState(shipping.notes || '');

  if (!isOpen) return null;

  const couriers = [
    'PromptX Courier',
    'Domex Express',
    'PickMe Flash',
    'In-House Dispatch',
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFee = parseFloat(fee) || 0;
    onSaveShipping({
      enabled: true,
      courier,
      address: address.trim(),
      phone: phone.trim(),
      fee: parsedFee,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleRemove = () => {
    onSaveShipping({
      enabled: false,
      courier: 'PromptX Courier',
      address: '',
      phone: '',
      fee: 0,
      notes: '',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Ship / Dispatch Delivery</h3>
              <p className="text-xs text-slate-500">Configure parcel courier & dispatch address</p>
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

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Courier Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              Courier Service Partner
            </label>
            <div className="grid grid-cols-2 gap-2">
              {couriers.map((c) => {
                const isSelected = courier === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourier(c)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{c}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-rose-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Delivery Destination Address <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. 28 Temple Road, Kalubowila, Dehiwala"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Recipient Phone & Delivery Fee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Contact Phone
              </label>
              <input
                type="tel"
                placeholder="+94 77 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Shipping Fee (LKR)
              </label>
              <input
                type="number"
                step="50"
                min="0"
                placeholder="350"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-bold font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Driver Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Fragile glass bottles, deliver before 5 PM"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            {shipping.enabled ? (
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Cancel Delivery
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm active:scale-95 transition-all"
              >
                Attach Delivery
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

