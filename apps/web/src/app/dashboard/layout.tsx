'use client';

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Building2,
  Bell,
  UtensilsCrossed,
  ShoppingBag,
} from 'lucide-react';
import { PosSidebar } from '../../components/layout/pos-sidebar';
import {
  TenantBranchProvider,
  useTenantBranch,
} from '../../context/tenant-branch-context';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    selectedBranchId,
    setSelectedBranchId,
    business,
    branches,
    user,
    posMode,
    setPosMode,
    orderType,
    setOrderType,
    isOwnerOrAdmin,
  } = useTenantBranch();

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Today's date formatted nicely
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const orderTypeOptions =
    posMode === 'restaurant'
      ? ['Dine-In', 'Takeaway', 'Delivery']
      : ['Walk-In', 'Delivery', 'Wholesale'];

  return (
    <div className="h-screen w-screen bg-[#F4F6F9] text-slate-900 flex overflow-hidden antialiased selection:bg-[#2F65F6] selection:text-white">
      {/* Left Slim Navigation Rail */}
      <PosSidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-5 flex items-center justify-between shrink-0 z-30 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
          {/* Left: Universal Search & Order Type Toggle */}
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative w-72 lg:w-80">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6] focus:bg-white transition-all shadow-inner"
              />
            </div>

            {/* Order Type Toggle Pills */}
            <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              {orderTypeOptions.map((type) => {
                const isSelected = orderType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      isSelected
                        ? 'bg-white text-[#2F65F6] shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Branch Switcher, POS Mode Toggle, Date & Cashier Pill */}
          <div className="flex items-center gap-3">
            {/* Multi-Industry Mode Switcher */}
            <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl text-xs">
              <button
                onClick={() => {
                  setPosMode('restaurant');
                  setOrderType('Dine-In');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  posMode === 'restaurant'
                    ? 'bg-white text-[#2F65F6] shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Switch to Restaurant & Dining Mode"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Dining</span>
              </button>
              <button
                onClick={() => {
                  setPosMode('retail');
                  setOrderType('Walk-In');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  posMode === 'retail'
                    ? 'bg-white text-[#2F65F6] shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Switch to Retail POS Mode"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Retail</span>
              </button>
            </div>

            {/* Branch Switcher Dropdown */}
            <div className="relative hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-[#2F65F6]" />
              <select
                value={selectedBranchId || 'ALL'}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranchId(val === 'ALL' ? null : val);
                }}
                disabled={!isOwnerOrAdmin && branches.length <= 1}
                className="bg-transparent text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                {isOwnerOrAdmin && (
                  <option value="ALL">All Branches</option>
                )}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Date Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{todayFormatted}</span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative w-9 h-9 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#2F65F6]" />
            </button>

            {/* Cashier / User Profile Badge */}
            <div className="flex items-center gap-2.5 pl-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2F65F6] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.fullName?.charAt(0) || 'C'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {user?.fullName || 'Cashier Station'}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {business?.name || 'Online'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-[#F4F6F9] p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantBranchProvider>
      <DashboardShell>{children}</DashboardShell>
    </TenantBranchProvider>
  );
}
