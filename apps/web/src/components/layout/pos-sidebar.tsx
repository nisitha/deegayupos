'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Activity,
  Bell,
  ShoppingBag,
  Package,
  Tag,
  Users,
  Receipt,
  CreditCard,
  FileText,
  Store,
  Layers,
  Settings,
  Search,
  LogOut,
  Truck,
  ClipboardCheck,
  Printer,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';

interface SidebarMenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  isPos?: boolean;
}

interface SidebarMenuSection {
  title: string;
  items: SidebarMenuItem[];
}

export function PosSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, business } = useTenantBranch();
  const [searchTerm, setSearchTerm] = useState('');

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
  const displayName = user?.fullName || 'Dr. Deegayu';
  const userEmail = user?.email || 'owner@deegayu.pixelcraftlk.com';

  const menuSections: SidebarMenuSection[] = [
    {
      title: 'COMMAND',
      items: [
        { name: 'Overview', href: '/dashboard', icon: LayoutGrid, exact: true },
        { name: 'Live Monitor', href: '/dashboard/inventory', icon: Activity },
        { name: 'Alerts', href: '/dashboard/settings', icon: Bell },
      ],
    },
    {
      title: 'COMMERCE',
      items: [
        { name: 'Order Queue', href: '/dashboard/sales', icon: ShoppingBag },
        { name: 'Catalog', href: '/dashboard/products', icon: Package },
        { name: 'Suppliers (94)', href: '/dashboard/suppliers', icon: Truck },
        { name: 'Purchases & GRN', href: '/dashboard/purchases', icon: ClipboardCheck },
        { name: 'Pricing Engine', href: '/dashboard/products', icon: Tag },
        { name: 'Customers', href: '/dashboard/customers', icon: Users },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { name: 'Revenue Desk', href: '/dashboard/sales', icon: Receipt },
        { name: 'Payouts', href: '/dashboard/sales', icon: CreditCard },
        { name: 'Tax Engine', href: '/dashboard/settings', icon: FileText },
      ],
    },
    {
      title: 'PLATFORM',
      items: [
        { name: 'Marketplace', href: '/dashboard/inventory', icon: Store },
        { name: 'POS', href: '/dashboard/pos', icon: Layers, isPos: true },
        { name: 'Hardware & Printers', href: '/dashboard/settings/hardware', icon: Printer },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex w-[220px] lg:w-[240px] bg-white border-r border-slate-100 flex-col justify-between h-full shrink-0 select-none z-30">
      {/* 1. Brand Header */}
      <div className="p-4 pb-3 border-b border-slate-50">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="bg-[#7052FF] text-white font-bold rounded-xl w-9 h-9 flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            <span>{initial}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-[#7052FF] transition-colors">
              {businessName}
            </h2>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              Ayurvedic Pharmacy OS
            </p>
          </div>
        </Link>

        {/* 2. Sleek Command Search Input */}
        <div className="mt-3 relative">
          <div className="w-full bg-slate-50 border border-slate-200/80 text-xs px-2.5 py-1.5 rounded-xl text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
            <kbd className="text-[9px] font-mono bg-white border border-slate-200/80 px-1 py-0.2 rounded text-slate-400 shadow-2xs shrink-0">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* 3. Categorized Menu Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">
        {menuSections.map((section) => (
          <div key={section.title}>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-2.5">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : item.isPos
                    ? pathname === '/dashboard/pos'
                    : pathname.startsWith(item.href) && pathname !== '/dashboard/pos';

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors group ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-[#7052FF]'
                            : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.isPos && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                          isActive
                            ? 'bg-[#7052FF] text-white'
                            : 'bg-slate-200/70 text-slate-600'
                        }`}
                      >
                        POS
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
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7052FF] to-[#9B82FF] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {displayName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {displayName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {userEmail}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded-lg"
            title="Sign out of POS session"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
