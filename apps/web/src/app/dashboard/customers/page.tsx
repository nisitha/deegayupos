'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  CreditCard,
  TrendingUp,
  BookOpen,
  Receipt,
  X,
  Check,
  Calendar,
  Printer,
  ShieldCheck,
  ShieldAlert,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type {
  CustomerDto,
  CustomerLedgerDto,
  CustomerPaymentDto,
  CustomerTelemetryDto,
  CustomerType,
  CustomerPaymentMethod,
} from '@pixelcraft/types';
import { supabase } from '@/lib/supabase';

export default function CustomersManagementPage() {
  // Data state
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [telemetry, setTelemetry] = useState<CustomerTelemetryDto>({
    totalCustomers: 0,
    totalReceivables: 0,
    activeCreditAccounts: 0,
    totalCreditLimit: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEBT_ONLY' | 'RETAIL_CREDIT' | 'WHOLESALE' | 'WALK_IN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Modals & Drawers state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerDto | null>(null);
  const [drawerLedger, setDrawerLedger] = useState<CustomerLedgerDto[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Settlement Modal state
  const [settlementCustomer, setSettlementCustomer] = useState<CustomerDto | null>(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMethod, setSettlementMethod] = useState<CustomerPaymentMethod>('CASH');
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [settlementSuccessVoucher, setSettlementSuccessVoucher] = useState<{
    customer: CustomerDto;
    payment: CustomerPaymentDto;
    ledgerEntry: CustomerLedgerDto;
  } | null>(null);

  // Add Customer Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNic, setNewNic] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<CustomerType>('RETAIL_CREDIT');
  const [newCreditLimit, setNewCreditLimit] = useState('30000');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);

  // Fetch customers and telemetry directly from Supabase / localStorage
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      let custList: CustomerDto[] = [];

      // 1. Try Supabase
      try {
        let query = supabase.from('customers').select('*').order('name', { ascending: true });
        if (searchQuery.trim()) {
          query = query.ilike('name', `%${searchQuery.trim()}%`);
        }
        if (activeTab === 'DEBT_ONLY') {
          query = query.gt('current_balance', 0);
        } else if (activeTab === 'RETAIL_CREDIT' || activeTab === 'WHOLESALE' || activeTab === 'WALK_IN') {
          query = query.eq('customer_type', activeTab);
        }
        if (statusFilter !== 'ALL') {
          query = query.eq('status', statusFilter);
        }

        const { data: sbCust, error: sbErr } = await query;
        if (!sbErr && sbCust && sbCust.length > 0) {
          custList = sbCust.map((c: any) => {
            const creditLimit = Number(c.credit_limit ?? c.creditLimit ?? 0);
            const currentBalance = Number(c.current_balance ?? c.currentBalance ?? 0);
            return {
              id: c.id,
              tenantId: c.tenant_id || c.tenantId || '0fef1423-5d89-4147-8af8-17c7e641c88a',
              name: c.name,
              phone: c.phone,
              email: c.email,
              nicNumber: c.nic_number || c.nicNumber,
              address: c.address,
              customerType: c.customer_type || c.customerType || 'WALK_IN',
              status: c.status || 'ACTIVE',
              creditLimit,
              currentBalance,
              availableCredit: Math.max(0, creditLimit - currentBalance),
              loyaltyPoints: Number(c.loyalty_points ?? c.loyaltyPoints ?? 0),
              totalSpent: Number(c.total_spent ?? c.totalSpent ?? 0),
              createdAt: c.created_at || c.createdAt || new Date().toISOString(),
              updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
            };
          });
        }
      } catch (sbErr) {
        console.warn('Could not query Supabase customers:', sbErr);
      }

      // 2. Local fallback if Supabase returned nothing
      if (custList.length === 0) {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_customers') : null;
        if (stored) {
          try {
            custList = JSON.parse(stored);
          } catch {
            // Ignore
          }
        }
        if (custList.length === 0) {
          custList = [
            {
              id: 'c1',
              tenantId: '0fef1423-5d89-4147-8af8-17c7e641c88a',
              name: 'Walk-In Customer (Cash)',
              phone: '0770000000',
              email: null,
              nicNumber: null,
              address: 'Colombo, Sri Lanka',
              customerType: 'WALK_IN',
              status: 'ACTIVE',
              creditLimit: 0,
              currentBalance: 0,
              availableCredit: 0,
              loyaltyPoints: 120,
              totalSpent: 12500,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'c2',
              tenantId: '0fef1423-5d89-4147-8af8-17c7e641c88a',
              name: 'Sunil Weerasinghe',
              phone: '0712345678',
              email: 'sunil@gmail.com',
              nicNumber: '198512345678',
              address: 'Galle Road, Kalutara',
              customerType: 'RETAIL_CREDIT',
              status: 'ACTIVE',
              creditLimit: 25000,
              currentBalance: 8400,
              availableCredit: 16600,
              loyaltyPoints: 450,
              totalSpent: 45000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'c3',
              tenantId: '0fef1423-5d89-4147-8af8-17c7e641c88a',
              name: 'Nimali Jayawardena',
              phone: '0778899001',
              email: 'nimali.j@yahoo.com',
              nicNumber: '199056789012',
              address: 'Main Street, Panadura',
              customerType: 'WHOLESALE',
              status: 'ACTIVE',
              creditLimit: 50000,
              currentBalance: 14200,
              availableCredit: 35800,
              loyaltyPoints: 980,
              totalSpent: 98000,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
        }
      }

      setCustomers(custList);

      // Compute telemetry
      const totalCust = custList.length;
      const totalCreditCust = custList.filter((c) => (c.currentBalance || 0) > 0).length;
      const totalDebt = custList.reduce((acc, c) => acc + (c.currentBalance > 0 ? c.currentBalance : 0), 0);
      const totalCreditLimit = custList.reduce((acc, c) => acc + (c.creditLimit || 0), 0);
      const totalCollected = custList.reduce((acc, c) => acc + (c.totalSpent || 0), 0);

      setTelemetry({
        totalCustomers: totalCust,
        totalReceivables: totalDebt,
        activeCreditAccounts: totalCreditCust,
        totalCreditLimit: totalCreditLimit,
        creditAccounts: totalCreditCust,
        totalOutstandingDebt: totalDebt,
        settlementsThisMonth: totalCollected,
      });
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, activeTab, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Open Khata statement drawer
  const openCustomerDrawer = async (cust: CustomerDto) => {
    setSelectedCustomerId(cust.id);
    setDrawerCustomer(cust);
    setIsDrawerOpen(true);
    setIsLoadingLedger(true);

    try {
      const { data: sbLedger } = await supabase
        .from('customer_ledgers')
        .select('*')
        .eq('customer_id', cust.id)
        .order('created_at', { ascending: false });

      if (sbLedger && sbLedger.length > 0) {
        setDrawerLedger(
          sbLedger.map((l: any) => ({
            id: l.id,
            tenantId: l.tenant_id || cust.tenantId || '0fef1423-5d89-4147-8af8-17c7e641c88a',
            customerId: l.customer_id,
            customerName: cust.name,
            entryType: l.entry_type || 'CREDIT_SALE',
            referenceId: l.reference_id || l.reference_number || '',
            referenceNumber: l.reference_number || l.reference_id || '',
            debitAmount: Number(l.debit_amount || (l.entry_type === 'CREDIT_SALE' ? l.amount : 0) || 0),
            creditAmount: Number(l.credit_amount || (l.entry_type === 'PAYMENT_RECEIVED' ? l.amount : 0) || 0),
            runningBalance: Number(l.running_balance ?? l.balance_after ?? 0),
            amount: Number(l.amount || 0),
            balanceAfter: Number(l.balance_after || l.running_balance || 0),
            notes: l.notes || '',
            createdAt: l.created_at || new Date().toISOString(),
          }))
        );
      } else {
        setDrawerLedger([
          {
            id: 'l1',
            tenantId: cust.tenantId || '0fef1423-5d89-4147-8af8-17c7e641c88a',
            customerId: cust.id,
            customerName: cust.name,
            entryType: 'CREDIT_SALE',
            referenceId: 'INV-DEMO-001',
            referenceNumber: 'INV-DEMO-001',
            debitAmount: cust.currentBalance,
            creditAmount: 0,
            runningBalance: cust.currentBalance,
            amount: cust.currentBalance,
            balanceAfter: cust.currentBalance,
            notes: 'Initial pharmacy credit sale',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load customer ledger:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Open Settlement Modal
  const openSettlementModal = (cust: CustomerDto) => {
    setSettlementCustomer(cust);
    setSettlementAmount(String(cust.currentBalance > 0 ? cust.currentBalance : ''));
    setSettlementMethod('CASH');
    setSettlementRef('');
    setSettlementNotes('');
    setSettlementSuccessVoucher(null);
    setIsSettlementModalOpen(true);
  };

  // Handle settlement submission
  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementCustomer) return;

    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    setIsSubmittingSettlement(true);
    try {
      const newBal = Math.max(0, settlementCustomer.currentBalance - amount);

      try {
        await supabase
          .from('customers')
          .update({ current_balance: newBal })
          .eq('id', settlementCustomer.id);
      } catch {
        // Safe
      }

      const updatedCust: CustomerDto = {
        ...settlementCustomer,
        currentBalance: newBal,
      };

      const ledgerEntry: CustomerLedgerDto = {
        id: `pay-${Date.now()}`,
        tenantId: settlementCustomer.tenantId || '0fef1423-5d89-4147-8af8-17c7e641c88a',
        customerId: settlementCustomer.id,
        customerName: settlementCustomer.name,
        entryType: 'PAYMENT_RECEIVED',
        referenceId: settlementRef.trim() || `RCP-${Date.now().toString().slice(-4)}`,
        referenceNumber: settlementRef.trim() || `RCP-${Date.now().toString().slice(-4)}`,
        debitAmount: 0,
        creditAmount: amount,
        runningBalance: newBal,
        amount: amount,
        balanceAfter: newBal,
        notes: settlementNotes.trim() || `Debt settlement via ${settlementMethod}`,
        createdAt: new Date().toISOString(),
      };

      const payment: CustomerPaymentDto = {
        id: `p-${Date.now()}`,
        tenantId: settlementCustomer.tenantId || '0fef1423-5d89-4147-8af8-17c7e641c88a',
        customerId: settlementCustomer.id,
        customerName: settlementCustomer.name,
        amount,
        paymentMethod: settlementMethod,
        receiptNumber: ledgerEntry.referenceId || `RCP-${Date.now().toString().slice(-4)}`,
        referenceNumber: settlementRef.trim() || undefined,
        notes: settlementNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      setSettlementSuccessVoucher({
        customer: updatedCust,
        payment,
        ledgerEntry,
      });

      // Update local customers state
      setCustomers((prev) =>
        prev.map((c) => (c.id === settlementCustomer.id ? updatedCust : c))
      );

      if (selectedCustomerId === settlementCustomer.id) {
        setDrawerCustomer(updatedCust);
        setDrawerLedger((prev) => [ledgerEntry, ...prev]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  // Handle Add Customer submission
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmittingCustomer(true);
    setAddCustomerError(null);

    try {
      const newCust: CustomerDto = {
        id: `cust-${Date.now()}`,
        tenantId: '0fef1423-5d89-4147-8af8-17c7e641c88a',
        name: newName.trim(),
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        nicNumber: newNic.trim() || null,
        address: newAddress.trim() || null,
        customerType: newCustomerType,
        status: 'ACTIVE',
        creditLimit: parseFloat(newCreditLimit) || 0,
        currentBalance: 0,
        availableCredit: parseFloat(newCreditLimit) || 0,
        loyaltyPoints: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const { data: inserted } = await supabase.from('customers').insert({
          name: newCust.name,
          phone: newCust.phone,
          email: newCust.email,
          nic_number: newCust.nicNumber,
          address: newCust.address,
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

      setCustomers((prev) => [newCust, ...prev]);

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('pixelcraft_customers');
        const prevList = stored ? JSON.parse(stored) : [];
        localStorage.setItem('pixelcraft_customers', JSON.stringify([newCust, ...prevList]));
      }

      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewNic('');
      setNewAddress('');
    } catch (err) {
      setAddCustomerError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Customer CRM & Credit Ledger</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                  Khata Ledger
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Deegayu Weda Madura • Retail Credit, Wholesale Accounts & Debt Settlement
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchCustomers}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
            title="Refresh Ledger"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Customer</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs hover:border-slate-200 transition-all flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Customers
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {telemetry.totalCustomers}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Registered clinic clients
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs hover:border-rose-200 transition-all flex items-center justify-between bg-gradient-to-br from-white to-rose-50/20">
          <div>
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">
              Outstanding Debt
            </span>
            <div className="text-2xl font-black text-rose-700 mt-1 font-mono">
              LKR {telemetry.totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-rose-500 font-medium mt-0.5 block">
              Total uncollected receivables
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Active Credit Accounts */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs hover:border-amber-200 transition-all flex items-center justify-between bg-gradient-to-br from-white to-amber-50/20">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
              Active Debtors
            </span>
            <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
              {telemetry.activeCreditAccounts} <span className="text-xs text-slate-400 font-sans font-normal">accounts</span>
            </div>
            <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">
              Customers with positive debt
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Total Credit Exposure */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs hover:border-emerald-200 transition-all flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/20">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
              Total Credit Limit
            </span>
            <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              LKR {telemetry.totalCreditLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">
              Approved credit ceiling
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Accounts' },
            { id: 'DEBT_ONLY', label: `Debtors Only (${telemetry.activeCreditAccounts})` },
            { id: 'RETAIL_CREDIT', label: 'Retail Khata' },
            { id: 'WHOLESALE', label: 'Wholesale' },
            { id: 'WALK_IN', label: 'Walk-in' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input & Status dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, phone, NIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* 4. Customer Directory Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Customer Name & NIC</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Credit Limit</th>
                <th className="py-3.5 px-4 text-right">Outstanding Debt</th>
                <th className="py-3.5 px-4 text-right">Available Credit</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading Deegayu Customer Ledgers...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const hasDebt = c.currentBalance > 0;
                  const creditPercent = c.creditLimit > 0 ? Math.min(100, Math.round((c.currentBalance / c.creditLimit) * 100)) : 0;
                  const isSuspended = c.status === 'SUSPENDED';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Name & NIC */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs ${
                              c.customerType === 'WHOLESALE'
                                ? 'bg-purple-100 text-purple-700'
                                : c.customerType === 'RETAIL_CREDIT'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c?.name ? c.name.slice(0, 2).toUpperCase() : 'CU'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {c?.name || 'Customer'}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {c.nicNumber ? `NIC: ${c.nicNumber}` : 'No NIC on file'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">No phone</span>
                        )}
                        {c.email && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[160px]">
                            <Mail className="w-2.5 h-2.5 text-slate-300" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1 border ${
                            c.customerType === 'WHOLESALE'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : c.customerType === 'RETAIL_CREDIT'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {c.customerType === 'WHOLESALE'
                            ? 'Wholesale'
                            : c.customerType === 'RETAIL_CREDIT'
                            ? 'Khata Credit'
                            : 'Walk-in'}
                        </span>
                      </td>

                      {/* Credit Limit */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        LKR {c.creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Outstanding Debt */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {hasDebt ? (
                          <div>
                            <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                              LKR {c.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {c.creditLimit > 0 && (
                              <div className="w-20 ml-auto mt-1.5 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    creditPercent > 90 ? 'bg-rose-500' : creditPercent > 70 ? 'bg-amber-500' : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${creditPercent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[10px]">
                            Cleared (LKR 0.00)
                          </span>
                        )}
                      </td>

                      {/* Available Credit */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        LKR {c.availableCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase inline-flex items-center gap-1 ${
                            isSuspended
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isSuspended ? (
                            <>
                              <ShieldAlert className="w-3 h-3" />
                              Suspended
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              Active
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openCustomerDrawer(c)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-semibold flex items-center gap-1 text-[11px] transition-all cursor-pointer shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Statement</span>
                          </button>

                          {hasDebt && (
                            <button
                              type="button"
                              onClick={() => openSettlementModal(c)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 text-[11px] transition-all shadow-xs active:scale-95 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Settle Debt</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          5. SLIDE-OUT CUSTOMER STATEMENT / KHATA DRAWER
      ========================================================================= */}
      {isDrawerOpen && drawerCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Pane */}
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center shadow-xs">
                  {drawerCustomer?.name ? drawerCustomer.name.slice(0, 2).toUpperCase() : 'CU'}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    {drawerCustomer?.name || 'Customer'}
                  </h2>
                  <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                    {drawerCustomer.phone && <span>📞 {drawerCustomer.phone}</span>}
                    {drawerCustomer.nicNumber && <span>NIC: {drawerCustomer.nicNumber}</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Credit Status Summary Cards */}
            <div className="p-6 bg-indigo-50/40 border-b border-indigo-100/60 grid grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Credit Limit
                </span>
                <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">
                  LKR {drawerCustomer.creditLimit.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-2xs">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                  Current Debt
                </span>
                <span className="text-sm font-black text-rose-600 font-mono mt-0.5 block">
                  LKR {drawerCustomer.currentBalance.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Available Credit
                </span>
                <span className="text-sm font-black text-emerald-700 font-mono mt-0.5 block">
                  LKR {drawerCustomer.availableCredit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Quick Settle CTA */}
            {drawerCustomer.currentBalance > 0 && (
              <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Customer has outstanding debt of{' '}
                  <strong className="text-rose-600 font-mono">
                    LKR {drawerCustomer.currentBalance.toLocaleString()}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => openSettlementModal(drawerCustomer)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Settle Debt</span>
                </button>
              </div>
            )}

            {/* Khata Ledger Statement Timeline */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Khata Statement Timeline</span>
              </h3>

              {isLoadingLedger ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading ledger entries...</span>
                </div>
              ) : drawerLedger.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No credit transactions recorded yet for this customer.
                </div>
              ) : (
                <div className="space-y-3">
                  {drawerLedger.map((entry) => {
                    const isCreditSale = entry.entryType === 'CREDIT_SALE';
                    const isPayment = entry.entryType === 'PAYMENT_RECEIVED';

                    return (
                      <div
                        key={entry.id}
                        className="p-3.5 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-all shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                                isCreditSale
                                  ? 'bg-rose-100 text-rose-700'
                                  : isPayment
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isCreditSale ? '➕' : isPayment ? '✓' : '•'}
                            </span>
                            <span className="font-bold text-slate-900">
                              {isCreditSale
                                ? 'Credit Purchase (POS Sale)'
                                : isPayment
                                ? 'Debt Settlement Payment'
                                : entry.entryType}
                            </span>
                            {entry.referenceId && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                #{entry.referenceId}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50 font-mono">
                          <div>
                            {isCreditSale && (
                              <span className="font-bold text-rose-600">
                                + Debit: LKR {entry.debitAmount.toLocaleString()}
                              </span>
                            )}
                            {isPayment && (
                              <span className="font-bold text-emerald-600">
                                - Credit Paid: LKR {entry.creditAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Balance: <strong className="text-slate-800">LKR {entry.runningBalance.toLocaleString()}</strong>
                          </div>
                        </div>

                        {entry.notes && (
                          <div className="text-[11px] text-slate-400 italic">
                            &quot;{entry.notes}&quot;
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. RECORD DEBT SETTLEMENT MODAL
      ========================================================================= */}
      {isSettlementModalOpen && settlementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsSettlementModalOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          />

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Record Debt Settlement
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Payment receipt voucher against Khata ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content / Voucher view */}
            <div className="p-6 space-y-4">
              {settlementSuccessVoucher ? (
                /* Payment Success Voucher */
                <div className="space-y-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                    <Check className="w-7 h-7 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      Settlement Payment Recorded!
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Voucher #{settlementSuccessVoucher.payment.receiptNumber}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer:</span>
                      <strong className="text-slate-900">{settlementSuccessVoucher?.customer?.name || 'Customer'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount Paid:</span>
                      <strong className="text-emerald-700 text-sm">
                        LKR {settlementSuccessVoucher.payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Method:</span>
                      <span className="text-slate-800 font-semibold">{settlementSuccessVoucher.payment.paymentMethod}</span>
                    </div>
                    {settlementSuccessVoucher.payment.referenceNumber && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reference:</span>
                        <span className="text-slate-800">{settlementSuccessVoucher.payment.referenceNumber}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                      <span className="text-slate-700">Remaining Debt:</span>
                      <span className="text-rose-600">
                        LKR {settlementSuccessVoucher.customer.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSettlementModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Payment Form */
                <form onSubmit={handleSettlementSubmit} className="space-y-4">
                  {/* Customer & Debt Banner */}
                  <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{settlementCustomer?.name || 'Customer'}</div>
                      <div className="text-[11px] text-slate-500">Khata Credit Account</div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-rose-500 font-bold block">Current Debt</span>
                      <strong className="text-sm font-black text-rose-700">
                        LKR {(settlementCustomer?.currentBalance ?? 0).toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Settlement Amount (LKR) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setSettlementAmount(String(settlementCustomer.currentBalance))}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 cursor-pointer"
                      >
                        Settle Full (LKR {settlementCustomer.currentBalance.toLocaleString()})
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="e.g. 5000.00"
                      value={settlementAmount}
                      onChange={(e) => setSettlementAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition-all"
                      autoFocus
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                      {[
                        { id: 'CASH', label: 'Cash' },
                        { id: 'CARD', label: 'Card' },
                        { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSettlementMethod(tab.id as CustomerPaymentMethod)}
                          className={`py-2 rounded-xl border transition-all cursor-pointer ${
                            settlementMethod === tab.id
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Reference / Slip No (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TXN-99882 or Deposit Slip #401"
                      value={settlementRef}
                      onChange={(e) => setSettlementRef(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Notes / Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Settle January medicines"
                      value={settlementNotes}
                      onChange={(e) => setSettlementNotes(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSettlementModalOpen(false)}
                      className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSettlement || !settlementAmount}
                      className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      {isSubmittingSettlement ? 'Recording...' : 'Confirm Payment'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. REGISTER CUSTOMER MODAL
      ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsAddModalOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          />

          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Register New Customer / Account
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add customer profile and approved credit limit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddCustomerSubmit} className="p-6 space-y-4">
              {addCustomerError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {addCustomerError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. H. M. Karunaratne"
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
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    NIC Number
                  </label>
                  <input
                    type="text"
                    placeholder="198012345678"
                    value={newNic}
                    onChange={(e) => setNewNic(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="karunaratne@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Customer Category
                  </label>
                  <select
                    value={newCustomerType}
                    onChange={(e) => setNewCustomerType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="RETAIL_CREDIT">Retail Khata</option>
                    <option value="WHOLESALE">Wholesale</option>
                    <option value="WALK_IN">Standard Walk-in</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Credit Limit (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Postal Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kandy Road, Kiribathgoda"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer || !newName.trim()}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {isSubmittingCustomer ? 'Registering...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
