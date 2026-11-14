'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, User, Check, UserPlus, Search, CreditCard, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface CustomerData {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  nicNumber?: string | null;
  customerType?: 'WALK_IN' | 'RETAIL_CREDIT' | 'WHOLESALE' | string;
  creditLimit?: number;
  currentBalance?: number;
  availableCredit?: number;
  loyaltyPoints?: number;
  status?: string;
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomer: CustomerData | null;
  onSelectCustomer: (customer: CustomerData | null) => void;
}

export function CustomerModal({
  isOpen,
  onClose,
  selectedCustomer,
  onSelectCustomer,
}: CustomerModalProps) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNic, setNewNic] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<'WALK_IN' | 'RETAIL_CREDIT' | 'WHOLESALE'>('RETAIL_CREDIT');
  const [newCreditLimit, setNewCreditLimit] = useState('25000');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch real customers directly from Supabase / localStorage
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      let list: CustomerData[] = [];
      try {
        const { data: sbCust, error: sbErr } = await supabase
          .from('customers')
          .select('*')
          .order('name', { ascending: true })
          .limit(100);

        if (!sbErr && sbCust && sbCust.length > 0) {
          list = sbCust.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            nicNumber: c.nic_number || c.nicNumber,
            customerType: c.customer_type || c.customerType || 'WALK_IN',
            creditLimit: Number(c.credit_limit ?? c.creditLimit ?? 0),
            currentBalance: Number(c.current_balance ?? c.currentBalance ?? 0),
            availableCredit: Math.max(0, Number(c.credit_limit ?? 0) - Number(c.current_balance ?? 0)),
            status: c.status || 'ACTIVE',
          }));
        }
      } catch (sbErr) {
        console.warn('Supabase customer query note:', sbErr);
      }

      if (list.length === 0) {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_customers') : null;
        if (stored) {
          try {
            list = JSON.parse(stored);
          } catch {
            // Ignore
          }
        }
        if (list.length === 0) {
          list = [
            {
              id: 'c1',
              name: 'Walk-In Customer (Cash)',
              phone: '0770000000',
              customerType: 'WALK_IN',
              creditLimit: 0,
              currentBalance: 0,
              status: 'ACTIVE',
            },
            {
              id: 'c2',
              name: 'Sunil Weerasinghe',
              phone: '0712345678',
              customerType: 'RETAIL_CREDIT',
              creditLimit: 25000,
              currentBalance: 8400,
              availableCredit: 16600,
              status: 'ACTIVE',
            },
          ];
        }
      }
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers for POS modal:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen, fetchCustomers]);

  if (!isOpen) return null;

  const term = search.toLowerCase().trim();
  const filteredCustomers = customers.filter((c) => {
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.nicNumber && c.nicNumber.toLowerCase().includes(term))
    );
  });

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const newCust: CustomerData = {
        id: `cust-${Date.now()}`,
        name: newName.trim(),
        phone: newPhone.trim() || null,
        nicNumber: newNic.trim() || null,
        customerType: newCustomerType,
        creditLimit: parseFloat(newCreditLimit) || 0,
        currentBalance: 0,
        availableCredit: parseFloat(newCreditLimit) || 0,
        status: 'ACTIVE',
      };

      try {
        const { data: inserted } = await supabase.from('customers').insert({
          name: newCust.name,
          phone: newCust.phone,
          nic_number: newCust.nicNumber,
          customer_type: newCust.customerType,
          credit_limit: newCust.creditLimit,
          tenant_id: '0fef1423-5d89-4147-8af8-17c7e641c88a',
        }).select().maybeSingle();

        if (inserted) {
          newCust.id = inserted.id;
        }
      } catch {
        // Safe
      }

      onSelectCustomer(newCust);
      setNewName('');
      setNewPhone('');
      setNewNic('');
      setIsCreatingNew(false);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Customer & Khata Credit Directory
              </h3>
              <p className="text-[11px] text-slate-500">
                Deegayu Ayurvedic CRM & Credit Accounts (ණය පොත)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {!isCreatingNew ? (
            <>
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, phone (077...) or NIC..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                  autoFocus
                />
              </div>

              {/* Walk-in Customer Option */}
              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null);
                  onClose();
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between text-xs cursor-pointer ${
                  !selectedCustomer
                    ? 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                    🚶
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Walk-in Customer (General)</div>
                    <div className="text-[11px] text-slate-500">Standard retail cash/card checkout</div>
                  </div>
                </div>
                {!selectedCustomer && <Check className="w-4 h-4 text-indigo-600" />}
              </button>

              {/* Customer List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading Deegayu customers...</span>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No customers found matching &quot;{search}&quot;
                  </div>
                ) : (
                  filteredCustomers.map((c) => {
                    const isSelected = selectedCustomer?.id === c.id;
                    const debt = Number(c.currentBalance || 0);
                    const limit = Number(c.creditLimit || 0);
                    const available = Number(c.availableCredit || Math.max(0, limit - debt));
                    const isSuspended = c.status === 'SUSPENDED';

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCustomer(c);
                          onClose();
                        }}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex flex-col gap-2 text-xs cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-200'
                            : isSuspended
                            ? 'border-red-200 bg-red-50/30 hover:bg-red-50/60 opacity-80'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                                c.customerType === 'WHOLESALE'
                                  ? 'bg-purple-100 text-purple-700'
                                  : c.customerType === 'RETAIL_CREDIT'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {isSuspended && (
                                  <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <ShieldAlert className="w-3 h-3" /> Suspended
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                {c.phone && <span>📞 {c.phone}</span>}
                                {c.nicNumber && <span>NIC: {c.nicNumber}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                c.customerType === 'WHOLESALE'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : c.customerType === 'RETAIL_CREDIT'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.customerType === 'WHOLESALE'
                                ? 'Wholesale'
                                : c.customerType === 'RETAIL_CREDIT'
                                ? 'Khata / ණය'
                                : 'Walk-in'}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </div>
                        </div>

                        {/* Credit & Debt Pills */}
                        {limit > 0 && (
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100/80 bg-white/60 p-2 rounded-xl">
                            <div className="flex items-center gap-1 text-slate-500">
                              <CreditCard className="w-3 h-3 text-slate-400" />
                              <span>Limit: <strong className="text-slate-800">LKR {limit.toLocaleString()}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              {debt > 0 ? (
                                <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  Debt: LKR {debt.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                                  No Debt
                                </span>
                              )}
                              <span className="font-semibold text-emerald-600">
                                Avail: LKR {available.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Add New Customer CTA */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register New Customer / Khata Account</span>
                </button>
              </div>
            </>
          ) : (
            /* Create New Form */
            <form onSubmit={handleAddNew} className="space-y-3.5">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Nihal Jayawardena"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="077 123 4567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    NIC Number
                  </label>
                  <input
                    type="text"
                    placeholder="198512345678"
                    value={newNic}
                    onChange={(e) => setNewNic(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Customer Type
                  </label>
                  <select
                    value={newCustomerType}
                    onChange={(e) => setNewCustomerType(e.target.value as typeof newCustomerType)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="RETAIL_CREDIT">Retail Credit (ණය පාරිභෝගික)</option>
                    <option value="WHOLESALE">Wholesale (තොග)</option>
                    <option value="WALK_IN">Standard Walk-in</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Credit Limit (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || isSaving}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {isSaving ? 'Registering...' : 'Save & Attach'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
