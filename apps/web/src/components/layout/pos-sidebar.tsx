'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Grid,
  Package,
  Boxes,
  Receipt,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';

export function PosSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useTenantBranch();

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

  // Core commercial retail navigation suite (Always visible to ensure zero dead-ends)
  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      isPos: false,
    },
    {
      name: 'POS Terminal',
      href: '/dashboard/pos',
      icon: Store,
      isPos: true, // Special high-contrast highlight
    },
    {
      name: 'Products',
      href: '/dashboard/products',
      icon: Package,
      isPos: false,
    },
    {
      name: 'Inventory',
      href: '/dashboard/inventory',
      icon: Boxes,
      isPos: false,
    },
    {
      name: 'Sales & Orders',
      href: '/dashboard/sales',
      icon: Receipt,
      isPos: false,
    },
    {
      name: 'Customers',
      href: '/dashboard/customers',
      icon: Users,
      isPos: false,
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      isPos: false,
    },
  ];

  return (
    <aside className="w-20 md:w-24 bg-white border-r border-slate-200/90 flex flex-col items-center justify-between py-4 shrink-0 z-40 select-none shadow-[1px_0_3px_0_rgba(0,0,0,0.02)]">
      {/* Brand Logo Header */}
      <div className="flex flex-col items-center gap-1">
        <Link
          href="/dashboard"
          className="w-11 h-11 rounded-2xl bg-[#005BD3] flex items-center justify-center text-white shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
          title="PixelCraft POS Command Center"
        >
          <Grid className="w-5 h-5" />
        </Link>
        <span className="text-[10px] font-bold text-slate-900 tracking-tight mt-0.5 font-mono">
          PixelPOS
        </span>
      </div>

      {/* Primary Navigation Rail */}
      <nav className="flex flex-col items-center gap-2.5 w-full px-2 my-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className="group relative flex flex-col items-center justify-center w-full"
              title={item.name}
            >
              {/* Active Indicator Pill (Shopify Cobalt #005BD3) on left edge */}
              {isActive && (
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-[#005BD3] rounded-r-full shadow-sm animate-in fade-in duration-200" />
              )}

              {/* 48x48px Touch Target Button */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 relative ${
                  isActive
                    ? item.isPos
                      ? 'bg-[#005BD3] text-white shadow-md shadow-blue-500/25 scale-105 font-bold'
                      : 'bg-slate-900 text-white shadow-sm scale-105'
                    : item.isPos
                      ? 'bg-blue-50/80 text-[#005BD3] border border-blue-200/60 hover:bg-[#005BD3] hover:text-white shadow-sm hover:scale-105'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className="w-5 h-5" />

                {/* Instant Tooltip Flyout */}
                <span className="group-hover:opacity-100 opacity-0 pointer-events-none absolute left-16 z-50 bg-slate-900 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap transition-opacity duration-150 border border-slate-700/60 flex items-center gap-1.5">
                  <span>{item.name}</span>
                  {item.isPos && (
                    <kbd className="px-1 py-0.2 text-[9px] font-mono bg-blue-600 rounded text-white">
                      F1
                    </kbd>
                  )}
                </span>
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-medium mt-0.5 tracking-tight line-clamp-1 text-center ${
                  isActive
                    ? 'text-[#005BD3] font-bold'
                    : item.isPos
                      ? 'text-[#005BD3] font-semibold'
                      : 'text-slate-500 group-hover:text-slate-800'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile Avatar & Logout */}
      <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100 w-full">
        <div
          className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xs font-bold text-slate-800 cursor-pointer hover:bg-slate-200 transition-colors"
          title={user?.fullName || 'Active Session'}
        >
          {user?.fullName?.charAt(0) || 'U'}
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Sign Out of Session"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
