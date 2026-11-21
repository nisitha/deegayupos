'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Activity,
  Bell,
  Package,
  Boxes,
  Tag,
  Users,
  Receipt,
  FileText,
  Layers,
  Settings,
  Search,
  LogOut,
  Truck,
  ClipboardCheck,
  Printer,
  UserCheck,
  BarChart3,
  Banknote,
  FileSpreadsheet,
  Calendar,
  CalendarCheck,
  Coins,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { performAppLogout } from '../../lib/auth-utils';

interface SidebarMenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface SidebarMenuSection {
  title: string;
  items: SidebarMenuItem[];
}

const MENU_SECTIONS: SidebarMenuSection[] = [
  {
    title: 'COMMAND',
    items: [
      { name: 'Overview', href: '/dashboard', icon: LayoutGrid },
      { name: 'Live Monitor', href: '/dashboard/live', icon: Activity },
      { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      { name: 'Sales & Bills', href: '/dashboard/orders', icon: Receipt },
      { name: 'Catalog', href: '/dashboard/products', icon: Package },
      { name: 'Branch Inventory', href: '/dashboard/inventory', icon: Boxes },
      { name: 'Stock Transfers', href: '/dashboard/inventory/transfers', icon: ArrowLeftRight },
      { name: 'Suppliers (94)', href: '/dashboard/suppliers', icon: Truck },
      { name: 'Purchases & GRN', href: '/dashboard/purchases', icon: ClipboardCheck },
      { name: 'Special Stock & Shift Off', href: '/dashboard/pos?action=shift-handover', icon: FileSpreadsheet, badge: 'Shift' },
      { name: 'Pricing Engine', href: '/dashboard/pricing', icon: Tag },
      { name: 'Customers', href: '/dashboard/customers', icon: Users },
    ],
  },
  {
    title: 'FINANCE & REPORTS',
    items: [
      { name: 'Cash Reconciliation', href: '/dashboard/finance/reconciliation', icon: Banknote, badge: 'Daily' },
      { name: 'Payroll & HR', href: '/dashboard/payroll', icon: Coins, badge: 'HR' },
      { name: 'Special Sales & Stock Summary', href: '/dashboard/finance/modaka', icon: FileSpreadsheet, badge: 'A-F' },
      { name: 'Reports Suite', href: '/dashboard/reports', icon: BarChart3, badge: '30' },
      { name: 'Revenue Desk', href: '/dashboard/finance/revenue', icon: Receipt },
      { name: 'Tax Engine', href: '/dashboard/finance/tax', icon: FileText },
    ],
  },
  {
    title: 'PAYROLL & HR',
    items: [
      { name: 'Payroll & Salary Slips', href: '/dashboard/payroll', icon: Coins, badge: 'EPF' },
      { name: 'Daily & CSV Attendance', href: '/dashboard/payroll/attendance', icon: CalendarCheck },
      { name: 'Employees & Wages', href: '/dashboard/payroll/employees', icon: Briefcase },
      { name: 'SL Holiday Calendar', href: '/dashboard/payroll/special-days', icon: Calendar },
    ],
  },
  {
    title: 'PLATFORM',
    items: [
      { name: 'POS', href: '/dashboard/pos', icon: Layers, badge: 'POS' },
      { name: 'Staff & Roles', href: '/dashboard/staff', icon: UserCheck },
      { name: 'Hardware & Printers', href: '/dashboard/settings/hardware', icon: Printer },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export function PosSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, business, isOwner, grnBranchIds, selectedBranchId } = useTenantBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isPosPage = pathname === '/dashboard/pos' || pathname?.startsWith('/dashboard/pos');

  // Adaptive viewport collapse logic:
  // On /dashboard/pos: collapse to icon-rail (w-[68px]) on < 1440px; expand on >= 1440px
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const adaptToViewport = () => {
      const width = window.innerWidth;
      if (isPosPage) {
        if (width < 1440) {
          setIsCollapsed(true);
        } else {
          setIsCollapsed(false);
        }
      }
    };

    adaptToViewport();
    window.addEventListener('resize', adaptToViewport);
    return () => window.removeEventListener('resize', adaptToViewport);
  }, [isPosPage]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Listen to mobile menu drawer toggle event from top header
  useEffect(() => {
    const handleToggle = () => setMobileDrawerOpen((prev) => !prev);
    const handleClose = () => setMobileDrawerOpen(false);
    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('close-mobile-sidebar', handleClose);
    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

  // Global ⌘K / Ctrl+K shortcut listener to quickly focus command search
  useEffect(() => {
    const handleGlobalCmdK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalCmdK);
    return () => window.removeEventListener('keydown', handleGlobalCmdK);
  }, []);

  const handleLogout = () => {
    performAppLogout(router);
  };

  const rawBusinessName = business?.name || tenant?.name || 'Deegayu Weda Madhura';
  const businessName = rawBusinessName.replace(/^[^\w\s/]*\s*\/\s*/, '').trim() || 'Deegayu Weda Madhura';
  const initial = businessName.charAt(0) || 'D';
  const logoUrl = business?.logoUrl || (tenant as { logoUrl?: string | null } | null)?.logoUrl;
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const displayName = user?.fullName || 'Dr. Deegayu';
  const userEmail = user?.email || 'owner@deegayu.pixelcraftlk.com';

  const hasGrnAccess =
    isOwner ||
    (Boolean(selectedBranchId) &&
      Array.isArray(grnBranchIds) &&
      grnBranchIds.includes(selectedBranchId!));

  // Strict Role-Based Navigation Sections (Financial Blind Mode)
  // OWNER sees 100% of sections (COMMAND, COMMERCE, FINANCE & REPORTS, PLATFORM).
  // STAFF sees strictly 3 operational links under OPERATIONS (POS Terminal, Purchases & GRN, Special Stock & Shift Off).
  // All financial pages (Overview, Alerts, Cash Reconciliation, Modaka Summary, Reports, etc.) are completely hidden.
  const sectionsToDisplay: SidebarMenuSection[] = React.useMemo(() => {
    if (isOwner) {
      return MENU_SECTIONS;
    }

    const staffSections: SidebarMenuSection[] = [
      {
        title: 'OPERATIONS',
        items: [
          { name: 'POS Terminal', href: '/dashboard/pos', icon: Layers, badge: 'POS' },
          ...(hasGrnAccess
            ? [
                {
                  name: 'Purchases & GRN',
                  href: '/dashboard/purchases',
                  icon: ClipboardCheck,
                  badge: 'Stock',
                },
              ]
            : []),
          {
            name: 'Special Stock & Shift Off',
            href: '/dashboard/pos?action=shift-handover',
            icon: FileSpreadsheet,
            badge: 'Shift',
          },
        ],
      },
    ];

    return staffSections;
  }, [isOwner, hasGrnAccess]);

  const allVisibleHrefs = React.useMemo(() => {
    return sectionsToDisplay.flatMap((s) => s.items.map((i) => i.href));
  }, [sectionsToDisplay]);

  const isItemActive = useCallback(
    (href: string) => {
      if (!href || href === '#') return false;
      const cleanHref = href.split('?')[0];

      // Exact match for the dashboard root
      if (cleanHref === '/dashboard') {
        return pathname === '/dashboard';
      }
      // If href is a query action shortcut like shift-handover, don't override base POS tab
      if (href.includes('?')) {
        return false;
      }
      // Exact match
      if (pathname === cleanHref) {
        return true;
      }
      // If another menu item matches pathname exactly, don't greedily match parent
      if (allVisibleHrefs.includes(pathname)) {
        return false;
      }
      // Exact match or sub-route match with strict trailing slash boundary
      return pathname.startsWith(`${cleanHref}/`);
    },
    [pathname, allVisibleHrefs],
  );

  const filteredSections = React.useMemo(() => {
    return sectionsToDisplay
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!searchTerm.trim()) return true;
          const q = searchTerm.toLowerCase();
          return item.name.toLowerCase().includes(q) || section.title.toLowerCase().includes(q);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sectionsToDisplay, searchTerm]);

  return (
    <>
      {/* Mobile Slide-Over Navigation Drawer (< md screens) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop Tap-to-Close */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Slide-over Content Surface */}
          <div className="relative w-[280px] max-w-[85vw] bg-[#0F1222] border-r border-slate-800 h-full flex flex-col justify-between z-10 shadow-2xl animate-in slide-in-from-left duration-250 select-none">
            {/* Header with Close Button */}
            <div className="p-4 pb-3 border-b border-slate-800/60">
              <div className="flex items-center justify-between">
                <Link
                  href="/dashboard"
                  prefetch={false}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5 group min-w-0"
                >
                  <div className="bg-white/5 border border-white/10 text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-sm shrink-0 overflow-hidden p-0.5">
                    {logoUrl && !logoError ? (
                      <img
                        src={logoUrl}
                        alt={businessName}
                        className="w-full h-full object-contain"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-white truncate leading-tight">
                      {businessName}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                      Ayurvedic Pharmacy OS
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Command Search */}
              <div className="mt-3 relative">
                <div className="w-full bg-white/[0.06] border border-white/10 text-sm px-3 py-2 rounded-xl text-slate-200 flex items-center justify-between focus-within:border-indigo-400 transition-all">
                  <div className="flex items-center gap-2 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search menu..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="text-xs text-slate-400 hover:text-white px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">
              {filteredSections.map((section) => (
                <div key={section.title}>
                  <div className="text-[11px] font-semibold tracking-wider text-slate-400/80 mb-2 px-3 uppercase">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isItemActive(item.href);

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          prefetch={false}
                          onClick={() => {
                            setMobileDrawerOpen(false);
                            if (item.href.includes('action=shift-handover') && typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('open-shift-handover'));
                            }
                          }}
                          className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all group ${
                            isActive
                              ? 'bg-gradient-to-r from-[#5B46F6] to-[#4F46E5] text-white font-medium shadow-md'
                              : 'text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={`w-5 h-5 shrink-0 ${
                                isActive ? 'text-white' : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>

                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom User Card & Logout */}
            <div className="p-3 border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#5B46F6] to-[#7052FF] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs border border-white/10">
                    {displayName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {displayName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate">
                      {userEmail}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                  title="Sign out of POS session"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop / Tablet Sidebar (>= md screens) */}
      <aside
        className={`hidden md:flex ${
          isCollapsed ? 'w-[68px]' : 'w-64'
        } bg-[#0F1222] border-r border-slate-800/80 flex-col justify-between h-full shrink-0 select-none z-30 transition-all duration-200`}
      >
      {/* 1. Brand Header */}
      <div className={`border-b border-slate-800/60 ${isCollapsed ? 'p-3 pb-3 flex flex-col items-center gap-2.5' : 'p-4 pb-3'}`}>
        {isCollapsed ? (
          <>
            <Link href="/dashboard" prefetch={false} className="group" title={businessName}>
              <div className="bg-white/5 border border-white/10 text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-sm shrink-0 group-hover:scale-105 transition-transform overflow-hidden p-0.5">
                {logoUrl && !logoError ? (
                  <img
                    src={logoUrl}
                    alt={businessName}
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Link href="/dashboard" prefetch={false} className="flex items-center gap-2.5 group min-w-0">
                <div className="bg-white/5 border border-white/10 text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm shadow-sm shrink-0 group-hover:scale-105 transition-transform overflow-hidden p-0.5">
                  {logoUrl && !logoError ? (
                    <img
                      src={logoUrl}
                      alt={businessName}
                      className="w-full h-full object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-indigo-300 transition-colors">
                    {businessName}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                    Ayurvedic Pharmacy OS
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Sleek Command Search Input */}
            <div className="mt-3 relative">
              <div className="w-full bg-white/[0.06] border border-white/10 text-sm px-3 py-2 rounded-xl text-slate-200 flex items-center justify-between focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/30 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search... ⌘K"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchTerm('');
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-400 focus:outline-none"
                  />
                </div>
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-[10px] text-slate-400 hover:text-white px-1 cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <kbd className="text-[10px] font-mono bg-white/10 border border-white/10 px-1.5 py-0.5 rounded text-slate-400 shadow-2xs shrink-0 font-medium">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Categorized Menu Navigation */}
      <div className={`flex-1 overflow-y-auto no-scrollbar ${isCollapsed ? 'px-2 py-3 space-y-2 flex flex-col items-center' : 'px-3 py-3 space-y-4'}`}>
        {filteredSections.map((section, sIdx) => (
          <div key={section.title} className={isCollapsed ? 'w-full flex flex-col items-center space-y-1' : ''}>
            {isCollapsed ? (
              sIdx > 0 && <div className="w-6 h-px bg-slate-800/80 my-1.5" />
            ) : (
              <div className="text-[11px] font-semibold tracking-wider text-slate-400/80 mb-2 px-3 uppercase">
                {section.title}
              </div>
            )}
            <div className={isCollapsed ? 'space-y-1 w-full flex flex-col items-center' : 'space-y-0.5'}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.href);

                if (isCollapsed) {
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={false}
                      onClick={() => {
                        if (item.href.includes('action=shift-handover') && typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('open-shift-handover'));
                        }
                      }}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
                        isActive
                          ? 'bg-gradient-to-r from-[#5B46F6] to-[#4F46E5] text-white shadow-md shadow-indigo-950/50'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      title={item.name}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {item.badge && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#5B46F6] ring-2 ring-[#0F1222]" />
                      )}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={false}
                    onClick={() => {
                      if (item.href.includes('action=shift-handover') && typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('open-shift-handover'));
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#5B46F6] to-[#4F46E5] text-white font-medium shadow-md shadow-indigo-950/50'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 4. Bottom User Profile & Sign Out */}
      <div className={`border-t border-white/10 bg-white/[0.02] ${isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3'}`}>
        {isCollapsed ? (
          <>
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#5B46F6] to-[#7052FF] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs border border-white/10 cursor-pointer"
              title={`${displayName} (${userEmail})`}
            >
              {displayName.charAt(0)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
              title="Sign out of POS session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.05] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#5B46F6] to-[#7052FF] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs border border-white/10">
                {displayName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {displayName}
                </div>
                <div className="text-xs text-slate-400 font-mono truncate">
                  {userEmail}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg cursor-pointer"
              title="Sign out of POS session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
