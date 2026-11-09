'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  Building2,
  Store,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
  GitBranch,
} from 'lucide-react';
import {
  TenantBranchProvider,
  useTenantBranch,
} from '../../context/tenant-branch-context';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  requiredPermission?: string;
  badge?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    name: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'POS Checkout',
    href: '/dashboard/pos',
    icon: ShoppingCart,
    requiredPermission: 'pos:access',
    badge: 'Terminal',
  },
  {
    name: 'Products & Catalog',
    href: '/dashboard/products',
    icon: Package,
    requiredPermission: 'inventory:view',
  },
  {
    name: 'Inventory',
    href: '/dashboard/inventory',
    icon: Boxes,
    requiredPermission: 'inventory:view',
  },
  {
    name: 'Purchases',
    href: '/dashboard/purchases',
    icon: Truck,
    requiredPermission: 'inventory:manage',
  },
  {
    name: 'Customers',
    href: '/dashboard/customers',
    icon: Users,
    requiredPermission: 'pos:access',
  },
  {
    name: 'Suppliers',
    href: '/dashboard/suppliers',
    icon: Store,
    requiredPermission: 'inventory:manage',
  },
  {
    name: 'Registers & Shifts',
    href: '/dashboard/registers',
    icon: Store,
    requiredPermission: 'pos:access',
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: BarChart3,
    requiredPermission: 'reports:view',
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    requiredPermission: 'settings:view',
  },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const {
    selectedBranchId,
    setSelectedBranchId,
    business,
    branches,
    user,
    tenant,
    isOwnerOrAdmin,
    hasPermission,
  } = useTenantBranch();

  // Dynamic permission-aware filtering: omit modules user cannot access
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(item.requiredPermission);
  });

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

  return (
    <div className="min-h-screen bg-[#080C14] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-cyan-500 selection:text-black">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0E1422]/95 border-r border-[#1F2C44] backdrop-blur-xl flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#1F2C44]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 via-cyan-500 to-emerald-400 p-[1px] shadow-lg shadow-cyan-950/40">
              <div className="w-full h-full bg-[#0E1422] rounded-[7px] flex items-center justify-center">
                <Store className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white tracking-wide truncate max-w-[130px]">
                {business?.name || tenant?.name || 'PixelCraft POS'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase">
                {tenant?.slug || 'tenant'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Menu Navigation
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-emerald-500/5 text-cyan-400 border border-cyan-500/20 shadow-sm shadow-cyan-950/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161F33]/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-cyan-400' : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom Platform Indicator */}
        <div className="p-3 border-t border-[#1F2C44]/80 bg-[#0A0E18]/60">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#0E1422] border border-[#1F2C44]/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-zinc-300 font-medium">Cloud POS Engine</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              v1.0
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#0E1422]/80 border-b border-[#1F2C44] backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Tenant Business Badge */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-xs">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium text-cyan-300 truncate max-w-[150px]">
                {business?.name || tenant?.name || 'PixelCraft Store'}
              </span>
            </div>

            {/* Branch Selector Dropdown */}
            <div className="relative">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141C2E] border border-[#1F2C44] text-xs">
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                <select
                  value={selectedBranchId || 'ALL'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBranchId(val === 'ALL' ? null : val);
                  }}
                  disabled={!isOwnerOrAdmin && branches.length <= 1}
                  className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer text-xs pr-2"
                >
                  {isOwnerOrAdmin && (
                    <option value="ALL" className="bg-[#0E1422] text-zinc-200">
                      All Branches
                    </option>
                  )}
                  {branches.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-[#0E1422] text-zinc-200"
                    >
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-full hover:bg-zinc-800/60 border border-transparent hover:border-[#1F2C44] transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 text-black flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-medium text-zinc-200 leading-tight">
                    {user?.fullName || 'Business Staff'}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight">
                    {tenant?.role || user?.role || 'Staff'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {/* Profile Dropdown */}
              {profileMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-[#0E1422] border border-[#1F2C44] rounded-xl shadow-xl shadow-black/60 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-[#1F2C44]/60 mb-1">
                    <p className="text-xs font-semibold text-white truncate">
                      {user?.fullName || 'User'}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {user?.email || ''}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono">
                        {tenant?.role || user?.role || 'MEMBER'}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-[#161F33] rounded-lg transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-zinc-400" />
                    Business Settings
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
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
