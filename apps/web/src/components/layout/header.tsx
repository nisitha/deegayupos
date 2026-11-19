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
  Menu,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { BranchCreateModal } from '../branches/branch-create-modal';
import { formatSriLankaHeaderClock } from '../../lib/date-utils';
import { performAppLogout } from '../../lib/auth-utils';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isPosPage = pathname === '/dashboard/pos' || pathname?.startsWith('/dashboard/pos');

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
    setProfileDropdownOpen(false);
    performAppLogout(router);
  };

  const handleSwitchShopLogout = () => {
    setProfileDropdownOpen(false);
    performAppLogout(router);
  };

  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const currentBranchName = currentBranch?.name || (selectedBranchId === null ? 'All Branches' : 'Main Branch');
  const displayName = user?.fullName || 'Dr. Deegayu (Owner)';
  const displayRole = user?.role || tenant?.role || 'OWNER';
  const rawBusinessName = business?.name || tenant?.name || 'Deegayu Weda Madura';
  const businessName = rawBusinessName.replace(/^[^\w\s/]*\s*\/\s*/, '').trim() || 'Deegayu Weda Madura';

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200/90 px-3 sm:px-5 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        {/* Left: Mobile Drawer Trigger + Store Monogram & Active Status */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* 44x44px Touch-Target Hamburger Menu Button (< lg screens) */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
              }
            }}
            className="lg:hidden w-11 h-11 -ml-1 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shrink-0 cursor-pointer"
            aria-label="Open mobile navigation menu"
            title="Menu"
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>

          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3] shadow-2xs shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-bold text-slate-900 whitespace-nowrap truncate max-w-[105px] sm:max-w-[180px]">
              {businessName}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {/* Center: Global Search Bar (Non-POS pages only) */}
        {!isPosPage && (
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, orders, receipts..."
                className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#005BD3] focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>
        )}

        {/* Right: Launch POS CTA, Branch Switcher, Live Date, User Profile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* High-Visibility "Launch POS" CTA Button (Hidden on POS route) */}
          {!isPosPage && (
            <Link
              href="/dashboard/pos"
              prefetch={false}
              className="h-8 bg-[#005BD3] hover:bg-[#004CB5] text-white text-xs font-semibold px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all whitespace-nowrap shrink-0"
              title="Launch Retail POS Terminal (Shortcut: F1)"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open POS Terminal</span>
              <span className="sm:hidden text-[11px]">POS</span>
              <kbd className="hidden sm:inline-block bg-blue-700/60 text-[10px] px-1 py-0.2 rounded text-blue-100 font-mono">
                F1
              </kbd>
            </Link>
          )}

          {/* Branch Section: Locked Session for Staff, Switcher for Owner */}
          <div className="relative shrink-0" ref={branchRef}>
            {!isOwner ? (
              /* Non-owner staff: Locked Branch Badge + Switch Shop (Logout) Button */
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div
                  className="h-8 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 select-none shadow-2xs whitespace-nowrap shrink-0"
                  title={`Branch Session Locked: ${currentBranchName}`}
                >
                  <MapPin className="w-3.5 h-3.5 text-[#005BD3] shrink-0" />
                  <span className="font-bold text-slate-900 whitespace-nowrap truncate max-w-[85px] sm:max-w-none">
                    {currentBranchName}
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-[#005BD3] border border-blue-200/60 shrink-0 whitespace-nowrap">
                    Locked
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSwitchShopLogout}
                  className="h-8 flex items-center gap-1 px-2 sm:px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                  title="Switch branch by terminating session and logging in"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Switch Shop</span>
                </button>
              </div>
            ) : (
              /* Owner: Full Multi-Branch Switcher Button */
              <button
                type="button"
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-all select-none cursor-pointer whitespace-nowrap shrink-0"
                title="Switch Retail Branch / Location"
              >
                <MapPin className="w-3.5 h-3.5 text-[#005BD3] shrink-0" />
                <span className="font-bold text-slate-800 whitespace-nowrap truncate max-w-[85px] sm:max-w-none">
                  {currentBranchName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
                    branchDropdownOpen ? 'rotate-180 text-slate-700' : ''
                  }`}
                />
              </button>
            )}

            {/* Branch Switcher Flyout (Owner Only) */}
            {branchDropdownOpen && isOwner && (
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
              className="hidden lg:flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-600 font-mono tabular-nums shadow-2xs select-none whitespace-nowrap shrink-0"
              title="Sri Lanka Standard Time (Asia/Colombo, UTC+05:30)"
            >
              <Clock className="w-3.5 h-3.5 text-[#005BD3] shrink-0" />
              <span className="whitespace-nowrap">{currentDateStr}</span>
            </div>
          )}

          {/* Notification Bell */}
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="hidden sm:flex relative h-8 w-8 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#005BD3]" />
          </button>

          {/* Interactive Cashier / User Profile Dropdown */}
          <div className="relative shrink-0" ref={profileRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="h-8 flex items-center gap-1 sm:gap-2 px-1 sm:px-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all select-none whitespace-nowrap shrink-0 cursor-pointer"
              aria-expanded={profileDropdownOpen}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#005BD3] to-[#4F46E5] text-white flex items-center justify-center font-bold text-[11px] shadow-2xs shrink-0">
                {displayName.charAt(0)}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{displayName}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-[#005BD3] border border-blue-200/60 uppercase whitespace-nowrap">
                  {displayRole}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
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
                      href="/dashboard/pos?action=shift-handover"
                      prefetch={false}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Special Stock & Shift Off</span>
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

          {/* Top-Right Direct Logout Button */}
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            title="Sign out of session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Logout</span>
          </button>
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
