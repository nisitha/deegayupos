'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Award,
  CreditCard,
  TrendingUp,
  Store,
} from 'lucide-react';
import { useTenantBranch } from '../../../context/tenant-branch-context';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  storeCredit: number;
  totalSpent: number;
  ordersCount: number;
  tier: 'PLATINUM' | 'GOLD' | 'SILVER' | 'STANDARD';
  lastVisit: string;
}

const SAMPLE_CUSTOMERS: CustomerRecord[] = [
  {
    id: 'cust-1',
    name: 'Kavindu Senanayake',
    phone: '+94 77 123 4567',
    email: 'kavindu.s@gmail.com',
    loyaltyPoints: 1420,
    storeCredit: 2500.0,
    totalSpent: 148500.0,
    ordersCount: 24,
    tier: 'PLATINUM',
    lastVisit: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'cust-2',
    name: 'Dilshan Silva',
    phone: '+94 71 987 6543',
    email: 'dilshan.silva@outlook.com',
    loyaltyPoints: 680,
    storeCredit: 0.0,
    totalSpent: 62400.0,
    ordersCount: 11,
    tier: 'GOLD',
    lastVisit: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'cust-3',
    name: 'Amanda Wickramasinghe',
    phone: '+94 70 456 7890',
    email: 'amanda.w@yahoo.com',
    loyaltyPoints: 340,
    storeCredit: 1200.0,
    totalSpent: 38200.0,
    ordersCount: 7,
    tier: 'SILVER',
    lastVisit: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'cust-4',
    name: 'Mohamed Farhan',
    phone: '+94 76 333 2211',
    email: 'm.farhan@colombobiz.lk',
    loyaltyPoints: 120,
    storeCredit: 0.0,
    totalSpent: 16800.0,
    ordersCount: 3,
    tier: 'STANDARD',
    lastVisit: new Date(Date.now() - 22 * 86400000).toISOString(),
  },
  {
    id: 'cust-5',
    name: 'Nipuni Perera',
    phone: '+94 72 888 9900',
    email: 'nipuni.p@gmail.com',
    loyaltyPoints: 2150,
    storeCredit: 5000.0,
    totalSpent: 215000.0,
    ordersCount: 38,
    tier: 'PLATINUM',
    lastVisit: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export default function CustomersPage() {
  const { currency } = useTenantBranch();
  const [customers] = useState<CustomerRecord[]>(SAMPLE_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTier = selectedTier === 'ALL' || c.tier === selectedTier;

      return matchSearch && matchTier;
    });
  }, [customers, searchQuery, selectedTier]);

  const totalStoreCredit = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.storeCredit, 0);
  }, [customers]);

  const totalLoyaltyPoints = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  }, [customers]);

  const formatCurrency = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getTierBadge = (tier: CustomerRecord['tier']) => {
    switch (tier) {
      case 'PLATINUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Award className="w-3 h-3 text-purple-600" /> Platinum
          </span>
        );
      case 'GOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Award className="w-3 h-3 text-amber-600" /> Gold
          </span>
        );
      case 'SILVER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Silver
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
            Standard
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Customers & Loyalty
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-[#005BD3] border border-blue-200/60">
              CRM Engine
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Retail customer directories, loyalty point rewards, credit ledgers, and purchase history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('New customer onboarding modal will open here.')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Customer</span>
          </button>

          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-pos-btn transition-all group"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold text-white/90">
              F1
            </kbd>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Customers</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {customers.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">Registered commercial accounts</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Store Credit Ledger</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalStoreCredit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Available prepaid customer credit</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loyalty Points Balance</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalLoyaltyPoints.toLocaleString()} pts
            </div>
            <div className="mt-1 text-xs text-slate-500">Redeemable at POS checkout</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Repeat Purchase Rate</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              84.2%
            </div>
            <div className="mt-1 text-xs text-slate-500">Multi-order customer retention</div>
          </div>
        </div>
      </div>

      {/* Main Customers Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone number, or email..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] transition-all"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500">Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
            >
              <option value="ALL">All Tiers</option>
              <option value="PLATINUM">Platinum</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="STANDARD">Standard</option>
            </select>
          </div>
        </div>

        {/* Customer Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-right">Store Credit</th>
                <th className="py-3 px-4 text-right">Loyalty Points</th>
                <th className="py-3 px-4 text-right">Lifetime Spent</th>
                <th className="py-3 px-4 text-right">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-[#005BD3] font-bold flex items-center justify-center text-xs">
                          {cust.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                            {cust.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {cust.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {cust.phone}
                      </div>
                      {cust.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {cust.email}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {getTierBadge(cust.tier)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-800">
                      {cust.ordersCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(cust.storeCredit)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-700">
                      {cust.loyaltyPoints.toLocaleString()} pts
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(cust.totalSpent)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px]">
                      {isMounted
                        ? new Date(cust.lastVisit).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '--'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600 text-sm">No customers matched your search</p>
                    <p className="text-xs text-slate-400 mt-1">Try searching by telephone digits or customer name</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
          <div>
            Showing <span className="font-semibold text-slate-700">{filteredCustomers.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{customers.length}</span> customer accounts
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Automated Points Accrual Enabled
          </div>
        </div>
      </div>
    </div>
  );
}
