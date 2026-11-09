'use client';

import React, { useState } from 'react';
import { X, User, Phone, Check, UserPlus, Search, Star } from 'lucide-react';

export interface CustomerData {
  id: string;
  name: string;
  phone?: string;
  loyaltyPoints?: number;
  type?: 'RETAIL' | 'VIP' | 'PATIENT' | 'DOCTOR';
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomer: CustomerData | null;
  onSelectCustomer: (customer: CustomerData | null) => void;
}

const DEFAULT_DEEGAYU_CUSTOMERS: CustomerData[] = [
  {
    id: 'walk-in',
    name: 'Walk-in Customer',
    phone: 'General Walk-in',
    loyaltyPoints: 0,
    type: 'RETAIL',
  },
  {
    id: 'cust-1',
    name: 'Dr. C. Senanayake',
    phone: '+94 77 123 4567',
    loyaltyPoints: 1250,
    type: 'DOCTOR',
  },
  {
    id: 'cust-2',
    name: 'Mrs. Malini Perera',
    phone: '+94 71 987 6543',
    loyaltyPoints: 480,
    type: 'VIP',
  },
  {
    id: 'cust-3',
    name: 'Mr. Kalinga Wickramasinghe',
    phone: '+94 76 555 1212',
    loyaltyPoints: 210,
    type: 'PATIENT',
  },
  {
    id: 'cust-4',
    name: 'Mrs. Sumana Ranasinghe',
    phone: '+94 70 333 4444',
    loyaltyPoints: 340,
    type: 'PATIENT',
  },
  {
    id: 'cust-5',
    name: 'Dr. (Mrs) H. Jayawardena',
    phone: '+94 78 444 8899',
    loyaltyPoints: 890,
    type: 'DOCTOR',
  },
];

export function CustomerModal({
  isOpen,
  onClose,
  selectedCustomer,
  onSelectCustomer,
}: CustomerModalProps) {
  const [search, setSearch] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  if (!isOpen) return null;

  const filteredCustomers = DEFAULT_DEEGAYU_CUSTOMERS.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term))
    );
  });

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCust: CustomerData = {
      id: `cust-${Date.now()}`,
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      loyaltyPoints: 50,
      type: 'RETAIL',
    };

    onSelectCustomer(newCust);
    setNewName('');
    setNewPhone('');
    setIsCreatingNew(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Customer Management</h3>
              <p className="text-[11px] text-slate-500">Deegayu Patient & Client Directory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {!isCreatingNew ? (
            <>
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by patient name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-sky-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Customer List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {filteredCustomers.map((c) => {
                  const isSelected =
                    selectedCustomer?.id === c.id ||
                    (!selectedCustomer && c.id === 'walk-in');

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectCustomer(c.id === 'walk-in' ? null : c);
                        onClose();
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/70 text-sky-950 font-semibold'
                          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            c.type === 'DOCTOR'
                              ? 'bg-purple-100 text-purple-700'
                              : c.type === 'VIP'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.type === 'VIP' ? (
                            <Star className="w-3.5 h-3.5" />
                          ) : (
                            <User className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 truncate">
                            {c.name}
                          </div>
                          {c.phone && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {c.phone}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {c.loyaltyPoints && c.loyaltyPoints > 0 ? (
                          <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                            {c.loyaltyPoints} pts
                          </span>
                        ) : null}
                        {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Add New Customer CTA */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-sky-300 hover:border-sky-500 hover:bg-sky-50/50 text-sky-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register New Customer / Patient</span>
                </button>
              </div>
            </>
          ) : (
            /* Create New Form */
            <form onSubmit={handleAddNew} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Customer / Patient Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasun Jayasinghe"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="e.g. 077 123 4567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Back to List
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-xl transition-colors"
                >
                  Save & Attach
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

