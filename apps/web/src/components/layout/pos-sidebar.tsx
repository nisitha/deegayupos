'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Grid,
  Package,
  Settings,
  LogOut,
  UtensilsCrossed,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';

export function PosSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission, posMode } = useTenantBranch();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pixelcraft_access_token');
      localStorage.removeItem('pixelcraft_refresh_token');
      localStorage.removeItem('pixelcraft_user');
      localStorage.removeItem('pixelcraft_tenant');
      localStorage.removeItem('pixelcraft_tenant_id');
      localStorage.removeItem('pixelcraft_permissions');
    }
    router.push('/');
  };

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'POS Menu',
      href: '/dashboard/pos',
      icon: Store,
      show: hasPermission('pos:access'),
    },
    {
      name: 'Tables',
      href: '/dashboard/tables',
      icon: UtensilsCrossed,
      show: hasPermission('pos:access') || posMode === 'restaurant',
    },
    {
      name: 'Catalogue',
      href: '/dashboard/products',
      icon: Package,
      show: hasPermission('inventory:view'),
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      show: hasPermission('settings:view'),
    },
  ];

  return (
    <aside className="w-20 md:w-24 bg-white border-r border-slate-200 flex flex-col items-center justify-between py-5 shrink-0 z-40 select-none shadow-sm">
      {/* Brand Logo Header */}
      <div className="flex flex-col items-center gap-1">
        <Link
          href="/dashboard"
          className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2F65F6] to-[#4F46E5] flex items-center justify-center text-white shadow-pos-btn hover:scale-105 transition-transform"
        >
          <Grid className="w-6 h-6" />
        </Link>
        <span className="text-[10px] font-bold text-slate-800 tracking-tight mt-1">
          PixelPOS
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col items-center gap-3 w-full px-2">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className="group relative flex flex-col items-center justify-center"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-[#2F65F6] text-white shadow-pos-btn scale-105'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-medium mt-1 tracking-tight ${
                    isActive ? 'text-[#2F65F6] font-semibold' : 'text-slate-500'
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
      </nav>

      {/* Bottom Profile & Sign Out */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors"
          title={user?.fullName || 'User Profile'}
        >
          {user?.fullName?.charAt(0) || 'U'}
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
