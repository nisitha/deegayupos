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
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';

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
      { name: 'Suppliers (94)', href: '/dashboard/suppliers', icon: Truck },
      { name: 'Purchases & GRN', href: '/dashboard/purchases', icon: ClipboardCheck },
      { name: 'Pricing Engine', href: '/dashboard/pricing', icon: Tag },
      { name: 'Customers', href: '/dashboard/customers', icon: Users },
    ],
  },
  {
    title: 'FINANCE & REPORTS',
    items: [
      { name: 'Cash Reconciliation', href: '/dashboard/finance/reconciliation', icon: Banknote, badge: 'Daily' },
      { name: 'Reports Suite', href: '/dashboard/reports', icon: BarChart3, badge: '30' },
      { name: 'Revenue Desk', href: '/dashboard/finance/revenue', icon: Receipt },
      { name: 'Tax Engine', href: '/dashboard/finance/tax', icon: FileText },
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
  const { user, tenant, business, isOwner, grnBranchIds } = useTenantBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pixelcraft_access_token');
      localStorage.removeItem('pixelcraft_refresh_token');
      localStorage.removeItem('pixelcraft_user');
      localStorage.removeItem('pixelcraft_tenant');
      localStorage.removeItem('pixelcraft_tenant_id');
      localStorage.removeItem('pixelcraft_permissions');
    }
    router.push('/login');
  };

  const businessName = business?.name || tenant?.name || 'Deegayu Weda Madura';
  const initial = businessName.charAt(0) || 'D';
  const logoUrl = business?.logoUrl || (tenant as { logoUrl?: string | null } | null)?.logoUrl;
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const displayName = user?.fullName || 'Dr. Deegayu';
  const userEmail = user?.email || 'owner@deegayu.pixelcraftlk.com';

  const hasGrnAccess = isOwner || (Array.isArray(grnBranchIds) && grnBranchIds.length > 0);

  // Strict Role-Based Navigation Sections
  // OWNER sees 100% of sections (COMMAND, COMMERCE, FINANCE & REPORTS, PLATFORM).
  // STAFF sees a clean operational tree:
  // - Entire COMMERCE section is HIDDEN
  // - FINANCE & REPORTS is simplified to FINANCE with only Cash Reconciliation (Reports Suite, Revenue Desk, Tax Engine hidden)
  // - PLATFORM is replaced with OPERATIONS (POS Terminal, and Purchases & GRN only if authorized for a branch)
  const sectionsToDisplay: SidebarMenuSection[] = React.useMemo(() => {
    if (isOwner) {
      return MENU_SECTIONS;
    }

    const staffSections: SidebarMenuSection[] = [
      {
        title: 'COMMAND',
        items: [
          { name: 'Overview', href: '/dashboard', icon: LayoutGrid },
          { name: 'Live Monitor', href: '/dashboard/live', icon: Activity },
          { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
        ],
      },
      {
        title: 'FINANCE',
        items: [
          {
            name: 'Cash Reconciliation',
            href: '/dashboard/finance/reconciliation',
            icon: Banknote,
            badge: 'Daily',
          },
        ],
      },
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
      // Exact match for the dashboard root
      if (href === '/dashboard') {
        return pathname === '/dashboard';
      }
      // Exact match
      if (pathname === href) {
        return true;
      }
      // If another menu item matches pathname exactly, don't greedily match parent
      if (allVisibleHrefs.includes(pathname)) {
        return false;
      }
      // Exact match or sub-route match with strict trailing slash boundary
      return pathname.startsWith(`${href}/`);
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
    <aside className="hidden md:flex w-[240px] lg:w-[260px] bg-[#0F1222] border-r border-slate-800/80 flex-col justify-between h-full shrink-0 select-none z-30">
      {/* 1. Brand Header */}
      <div className="p-4 pb-3 border-b border-slate-800/60">
        <Link href="/dashboard" prefetch={false} className="flex items-center gap-2.5 group">
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
      </div>

      {/* 3. Categorized Menu Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">
        {filteredSections.map((section) => (
          <div key={section.title}>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400/80 mb-2 px-3 uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch={false}
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
      <div className="p-3 border-t border-white/10 bg-white/[0.02]">
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
            className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg"
            title="Sign out of POS session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
