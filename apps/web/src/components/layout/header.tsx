'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  Bell,
  Store,
  ChevronDown,
  LogOut,
  Layers,
  Monitor,
  MapPin,
  Plus,
  Check,
  Banknote,
  Clock,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { BranchCreateModal } from '../branches/branch-create-modal';
import { formatSriLankaHeaderClock } from '../../lib/date-utils';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isPosPage = pathname === '/dashboard/pos';

  const {
    selectedBranchId,
    setSelectedBranchId,
    business,
    branches,
    allowedBranches,
    user,
    tenant,
    isOwner,
  } = useTenantBranch();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  const profileRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  // Real-time ticking clock locked to Sri Lanka time (Asia/Colombo, UTC+05:30)
  useEffect(() => {
    setCurrentDateStr(formatSriLankaHeaderClock(new Date()));
    const timer = setInterval(() => {
      setCurrentDateStr(formatSriLankaHeaderClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close profile & branch dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (branchRef.current && !branchRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
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

  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const currentBranchName = currentBranch?.name || (selectedBranchId === null ? 'All Branches' : 'Main Branch');
  const displayName = user?.fullName || 'Dr. Deegayu (Owner)';
  const displayRole = user?.role || tenant?.role || 'OWNER';
  const businessName = business?.name || tenant?.name || 'Deegayu Weda Madura';

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-5 flex items-center justify-between shrink-0 z-30 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        {/* Left: Store Monogram & Active Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3] shadow-sm shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{businessName}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">
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
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* High-Visibility "Launch POS" CTA Button */}
          {!isPosPage && (
            <Link
              href="/dashboard/pos"
              prefetch={false}
              className="bg-[#005BD3] hover:bg-[#004CB5] text-white text-xs font-semibold px-3 sm:px-3.5 py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-sm shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              title="Launch Retail POS Terminal (Shortcut: F1)"
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Open POS Terminal</span>
              <span className="sm:hidden text-[11px]">POS</span>
              <kbd className="hidden sm:inline-block bg-blue-700/60 text-[10px] px-1.5 py-0.5 rounded text-blue-100 font-mono">
                F1
              </kbd>
            </Link>
          )}

          {/* Interactive Multi-Branch Switcher Dropdown */}
          <div className="relative" ref={branchRef}>
            {allowedBranches.length <= 1 && !isOwner ? (
              /* Single-branch staff: Locked Badge with MapPin */
              <div
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 select-none"
                title={`Branch Assigned: ${currentBranchName}`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[120px] font-bold text-slate-800">
                  {currentBranchName}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200/80 text-slate-600">
                  Assigned
                </span>
              </div>
            ) : (
              /* Multi-branch staff or Owner: Switcher Button */
              <button
                type="button"
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all select-none cursor-pointer"
                title="Switch Retail Branch / Location"
              >
                <MapPin className="w-3.5 h-3.5 text-[#005BD3] shrink-0" />
                <span className="truncate max-w-[90px] sm:max-w-[120px] font-bold text-slate-800">
                  {currentBranchName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    branchDropdownOpen ? 'rotate-180 text-slate-700' : ''
                  }`}
                />
              </button>
            )}

            {/* Branch Switcher Flyout */}
            {branchDropdownOpen && (allowedBranches.length > 1 || isOwner) && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.14)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 mb-1 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Branch & Inventory Location
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {allowedBranches.length} {allowedBranches.length === 1 ? 'Location' : 'Locations'} Assigned
                    </div>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBranchId(null);
                        setBranchDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        selectedBranchId === null
                          ? 'bg-blue-50 text-[#005BD3] font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span>All Branches (Consolidated)</span>
                      </div>
                      {selectedBranchId === null && <Check className="w-4 h-4 text-[#005BD3]" />}
                    </button>
                  )}

                  {allowedBranches.map((b) => {
                    const isSelected = selectedBranchId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBranchId(b.id);
                          setBranchDropdownOpen(false);
                        }}
                        className={`w-full flex items-start justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-[#005BD3]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="truncate">{b.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                              {b.code}
                            </span>
                            {b.isPrimary && (
                              <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-800">
                                Primary
                              </span>
                            )}
                          </div>
                          {b.address && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {b.address}
                            </div>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#005BD3] shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>

                {isOwner && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setBranchDropdownOpen(false);
                        setBranchModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#005BD3] hover:bg-blue-50/70 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Retail Branch</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Real-Time Sri Lanka Clock Badge (Asia/Colombo, tabular-nums) */}
          {currentDateStr && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-700 font-mono tabular-nums shadow-2xs select-none"
              title="Sri Lanka Standard Time (Asia/Colombo, UTC+05:30)"
            >
              <Clock className="w-3.5 h-3.5 text-[#005BD3] shrink-0" />
              <span>{currentDateStr}</span>
            </div>
          )}

          {/* Notification Bell */}
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative w-9 h-9 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
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
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#005BD3] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-white shrink-0">
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
                    prefetch={false}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-[#005BD3] transition-colors"
                  >
                    <Store className="w-4 h-4 text-[#005BD3]" />
                    <span>Launch POS Checkout</span>
                  </Link>

                  {isOwner ? (
                    <Link
                      href="/dashboard/settings"
                      prefetch={false}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span>Business Settings</span>
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/finance/reconciliation"
                      prefetch={false}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Daily Reconciliation</span>
                    </Link>
                  )}
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

      {/* Branch Creation Modal */}
      <BranchCreateModal
        isOpen={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
      />
    </>
  );
}
