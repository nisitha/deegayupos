'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Calendar,
  Building2,
  Bell,
  Store,
  ChevronDown,
  LogOut,
  Layers,
  Monitor,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isPosPage = pathname === '/dashboard/pos';

  const {
    selectedBranchId,
    setSelectedBranchId,
    business,
    branches,
    user,
    tenant,
    isOwnerOrAdmin,
  } = useTenantBranch();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const profileRef = useRef<HTMLDivElement>(null);

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

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pixelcraft_access_token');
      localStorage.removeItem('pixelcraft_refresh_token');
      localStorage.removeItem('pixelcraft_user');
      localStorage.removeItem('pixelcraft_tenant');
      localStorage.removeItem('pixelcraft_tenant_id');
      localStorage.removeItem('pixelcraft_permissions');
    }
    setProfileDropdownOpen(false);
    router.push('/login');
  };

  const currentBranchName =
    branches.find((b) => b.id === selectedBranchId)?.name || 'Main Branch';
  const displayName = user?.fullName || 'Dr. Deegayu (Owner)';
  const displayRole = user?.role || tenant?.role || 'OWNER';
  const businessName = business?.name || tenant?.name || 'Deegayu Weda Madura';

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-5 flex items-center justify-between shrink-0 z-30 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
      {/* Left: Store Monogram & Active Status */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3] shadow-sm">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <span>{businessName}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {currentBranchName} • Terminal REG-01
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
            className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#005BD3] focus:bg-white transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Right: Launch POS CTA, Branch Switcher, Live Date, User Profile Menu */}
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
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#005BD3]" />
        </button>

        {/* Interactive Cashier / User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all select-none"
            aria-expanded={profileDropdownOpen}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#005BD3] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-white">
              {displayName.charAt(0)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                <span>{displayName}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-[#005BD3] border border-blue-200/60 uppercase">
                  {displayRole}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                {businessName}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                profileDropdownOpen ? 'rotate-180 text-slate-700' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Flyout */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Profile Card Summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-[#005BD3] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {displayName.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {displayName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate font-mono">
                      {user?.email || 'owner@deegayu.pixelcraftlk.com'}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Active Business:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[130px]">
                    {businessName}
                  </span>
                </div>
              </div>

              {/* Terminal & Branch Status */}
              <div className="px-3 py-2 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-[#005BD3]" /> Branch:
                  </span>
                  <span className="font-semibold text-slate-800">{currentBranchName}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Monitor className="w-3 h-3 text-[#005BD3]" /> Station:
                  </span>
                  <span className="font-semibold text-slate-800">REG-01 (Active)</span>
                </div>
              </div>

              <div className="my-1.5 border-t border-slate-100" />

              {/* Quick Navigation Items */}
              <div className="space-y-0.5">
                <Link
                  href="/dashboard/pos"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-[#005BD3] transition-colors"
                >
                  <Store className="w-4 h-4 text-[#005BD3]" />
                  <span>Launch POS Checkout</span>
                </Link>

                <Link
                  href="/dashboard/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Business Settings</span>
                </Link>
              </div>

              <div className="my-1.5 border-t border-slate-100" />

              {/* Sign Out Action Button */}
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors group"
              >
                <LogOut className="w-4 h-4 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                <span>Sign Out of Terminal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
