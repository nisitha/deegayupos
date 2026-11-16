'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Store,
  Receipt,
  Package,
  Users,
  Grid,
  Banknote,
  LayoutGrid,
  ClipboardCheck,
  Bell,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';

interface BottomNavBarProps {
  onOpenMoreActions?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick?: () => void;
}

export function BottomNavBar({ onOpenMoreActions }: BottomNavBarProps) {
  const pathname = usePathname();
  const { isOwner, grnBranchIds } = useTenantBranch();
  const hasGrnAccess = isOwner || (Array.isArray(grnBranchIds) && grnBranchIds.length > 0);

  const ownerItems: NavItem[] = [
    {
      name: 'Home (POS)',
      href: '/dashboard/pos',
      icon: Store,
      isActive: pathname === '/dashboard/pos',
    },
    {
      name: 'Orders',
      href: '/dashboard/orders',
      icon: Receipt,
      isActive: pathname.startsWith('/dashboard/orders') || pathname.startsWith('/dashboard/sales'),
    },
    {
      name: 'Products',
      href: '/dashboard/products',
      icon: Package,
      isActive: pathname.startsWith('/dashboard/products'),
    },
    {
      name: 'Customers',
      href: '/dashboard/customers',
      icon: Users,
      isActive: pathname.startsWith('/dashboard/customers'),
    },
    {
      name: 'More',
      href: '/dashboard/settings',
      icon: Grid,
      isActive: pathname.startsWith('/dashboard/settings'),
      onClick: onOpenMoreActions,
    },
  ];

  const staffItems: NavItem[] = [
    {
      name: 'POS',
      href: '/dashboard/pos',
      icon: Store,
      isActive: pathname === '/dashboard/pos',
    },
    {
      name: 'Reconciliation',
      href: '/dashboard/finance/reconciliation',
      icon: Banknote,
      isActive: pathname.startsWith('/dashboard/finance/reconciliation'),
    },
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutGrid,
      isActive: pathname === '/dashboard',
    },
    ...(hasGrnAccess
      ? [
          {
            name: 'GRN Stock',
            href: '/dashboard/purchases',
            icon: ClipboardCheck,
            isActive: pathname.startsWith('/dashboard/purchases'),
          },
        ]
      : [
          {
            name: 'Alerts',
            href: '/dashboard/alerts',
            icon: Bell,
            isActive: pathname.startsWith('/dashboard/alerts'),
          },
        ]),
  ];

  const navItems = isOwner ? ownerItems : staffItems;

  return (
    <nav
      aria-label="Bottom Thumb Navigation Dock"
      className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 flex items-center justify-around px-2 z-30 select-none shadow-[0_-2px_10px_rgba(0,0,0,0.03)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive;

        const content = (
          <div
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 touch-manipulation relative ${
              active
                ? 'text-[#5B46F6] font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            {active && (
              <span className="absolute -top-1 w-8 h-1 bg-[#5B46F6] rounded-full shadow-xs" />
            )}
            <Icon className={`w-5 h-5 mb-0.5 transition-transform ${active ? 'scale-110' : ''}`} />
            <span className="text-[10px] tracking-tight truncate max-w-[64px]">{item.name}</span>
          </div>
        );

        if (item.onClick) {
          return (
            <button
              key={item.name}
              type="button"
              onClick={item.onClick}
              className="flex-1 flex justify-center focus:outline-none"
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            prefetch={false}
            className="flex-1 flex justify-center focus:outline-none"
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
