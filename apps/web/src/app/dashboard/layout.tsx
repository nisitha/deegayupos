'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Calendar,
  Building2,
  Bell,
  Store,
} from 'lucide-react';
import { PosSidebar } from '../../components/layout/pos-sidebar';
import {
  TenantBranchProvider,
  useTenantBranch,
} from '../../context/tenant-branch-context';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPosPage = pathname === '/dashboard/pos';

  const {
    selectedBranchId,
    setSelectedBranchId,
    business,
    branches,
    user,
    isOwnerOrAdmin,
  } = useTenantBranch();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Hydration-safe date formatting
  useEffect(() => {
    setCurrentDateStr(
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    );
  }, []);

  // Global F1 Shortcut to launch POS Terminal from anywhere
  useEffect(() => {
    const handleGlobalF1 = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        router.push('/dashboard/pos');
      }
    };
    window.addEventListener('keydown', handleGlobalF1);
    return () => window.removeEventListener('keydown', handleGlobalF1);
  }, [router]);

  const currentBranchName =
    branches.find((b) => b.id === selectedBranchId)?.name || 'All Branches';

  return (
    <div className="h-screen w-screen bg-[#F4F6F9] text-slate-900 flex overflow-hidden antialiased selection:bg-[#2F65F6] selection:text-white">
      {/* Left Slim Navigation Rail */}
      <PosSidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Modern Clean Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-5 flex items-center justify-between shrink-0 z-30 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
          {/* Left: Store Monogram & Active Status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2F65F6] shadow-sm">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>{business?.name || 'PixelCraft POS'}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                {currentBranchName}
              </p>
            </div>
          </div>

          {/* Center: Global Search Bar (Non-POS pages) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, orders, receipts..."
                className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6] focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Right: Launch POS CTA, Branch Switcher, Live Date, Cashier Avatar */}
          <div className="flex items-center gap-2.5">
            {/* High-Visibility "Launch POS" CTA Button */}
            {!isPosPage && (
              <Link
                href="/dashboard/pos"
                className="bg-[#005BD3] hover:bg-[#004CB5] text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                title="Launch Retail POS Terminal (Shortcut: F1)"
              >
                <Store className="w-4 h-4" />
                <span className="hidden sm:inline">Open POS Terminal</span>
                <span className="sm:hidden">POS</span>
                <kbd className="hidden sm:inline-block bg-blue-700/60 text-[10px] px-1.5 py-0.5 rounded text-blue-100 font-mono">
                  F1
                </kbd>
              </Link>
            )}

            {/* Branch Switcher Dropdown */}
            <div className="relative hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-[#005BD3]" />
              <select
                value={selectedBranchId || 'ALL'}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranchId(val === 'ALL' ? null : val);
                }}
                disabled={!isOwnerOrAdmin && branches.length <= 1}
                className="bg-transparent text-slate-800 focus:outline-none cursor-pointer pr-1 font-semibold text-xs"
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

            {/* Current Date Badge (Hydration safe) */}
            {currentDateStr && (
              <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentDateStr}</span>
              </div>
            )}

            {/* Notification Bell */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative w-9 h-9 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#2F65F6]" />
            </button>

            {/* Cashier / User Profile Badge */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200/80">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2F65F6] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.fullName?.charAt(0) || 'C'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {user?.fullName || 'Cashier Station'}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {user?.role ? user.role.toLowerCase() : 'Staff'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main
          className={`flex-1 ${
            isPosPage
              ? 'overflow-hidden p-3 lg:p-4 bg-[#F4F6F9]'
              : 'overflow-y-auto p-5 lg:p-6 bg-[#F4F6F9]'
          }`}
        >
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
