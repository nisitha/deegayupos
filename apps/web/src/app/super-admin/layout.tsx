'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Layers,
  ScrollText,
  Sliders,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Terminal,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    name: 'Overview',
    href: '/super-admin',
    icon: LayoutDashboard,
  },
  {
    name: 'Tenants & Orgs',
    href: '/super-admin/tenants',
    icon: Building2,
  },
  {
    name: 'SaaS Plans',
    href: '/super-admin/plans',
    icon: Layers,
  },
  {
    name: 'System Audit Logs',
    href: '/super-admin/audit-logs',
    icon: ScrollText,
  },
  {
    name: 'Platform Settings',
    href: '/super-admin/settings',
    icon: Sliders,
  },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#07090E] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-cyan-500 selection:text-black">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0B0E17]/90 border-r border-zinc-800/80 backdrop-blur-xl flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 via-cyan-500 to-emerald-400 p-[1px] shadow-lg shadow-cyan-950/50">
              <div className="w-full h-full bg-[#07090E] rounded-[7px] flex items-center justify-center">
                <Terminal className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                PixelCraft
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  Core
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">Super Admin Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Platform Management
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/super-admin'
                ? pathname === '/super-admin'
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/60 shadow-sm shadow-cyan-950/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-cyan-400' : 'text-zinc-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Identity Badge */}
        <div className="p-4 border-t border-zinc-800/60 bg-zinc-950/40 m-3 rounded-xl border">
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-200">
              Super Admin Session
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 font-mono break-all mb-3">
            admin@pixelcraftlk.com
          </p>
          <Link
            href="/"
            className="flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <span>Exit to Storefront</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-zinc-800/60 bg-[#0B0E17]/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>Platform</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-200 capitalize">
              {pathname?.split('/')[2] || 'Overview'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>RLS Isolation Active</span>
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              v1.0.0-phase04
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
