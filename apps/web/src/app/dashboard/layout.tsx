'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PosSidebar } from '../../components/layout/pos-sidebar';
import { Header } from '../../components/layout/header';
import { BottomNavBar } from '../../components/layout/bottom-nav-bar';
import { TenantBranchProvider, useTenantBranch } from '../../context/tenant-branch-context';

// Master list of administrative routes restricted exclusively to OWNER
const OWNER_ONLY_ROUTES = [
  '/dashboard/orders',
  '/dashboard/sales',
  '/dashboard/products',
  '/dashboard/suppliers',
  '/dashboard/pricing',
  '/dashboard/customers',
  '/dashboard/reports',
  '/dashboard/live',
  '/dashboard/finance/revenue',
  '/dashboard/finance/tax',
  '/dashboard/finance/payouts',
  '/dashboard/staff',
  '/dashboard/settings',
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPosPage = pathname === '/dashboard/pos' || pathname?.startsWith('/dashboard/pos');
  const [authChecked, setAuthChecked] = useState(false);
  const {
    isOwner,
    grnBranchIds,
    selectedBranchId,
    assignedBranchIds,
    isLoading: isTenantLoading,
  } = useTenantBranch();

  // Authentication Guard: Redirect to /login if no active session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token =
        localStorage.getItem('pixelcraft_access_token') ||
        localStorage.getItem('pixelcraft_user');

      if (!token) {
        const hasSession = localStorage.getItem('pixelcraft_tenant_id');
        if (!hasSession) {
          router.push('/login');
          return;
        }
      }
      setAuthChecked(true);
    }
  }, [router]);

  // Ensure multi-branch staff has an active branch locked
  useEffect(() => {
    if (authChecked && !isTenantLoading && !isOwner) {
      if (assignedBranchIds && assignedBranchIds.length > 1 && !selectedBranchId) {
        console.warn('[RouteGuard] Multi-branch staff has no active branch selected. Redirecting to login.');
        router.push('/login');
      }
    }
  }, [authChecked, isTenantLoading, isOwner, assignedBranchIds, selectedBranchId, router]);

  // Determine if active route is restricted for current staff session
  const isRestrictedForStaff = useMemo(() => {
    if (!authChecked || isTenantLoading || isOwner) {
      return false;
    }

    // Direct match or sub-path match on OWNER_ONLY_ROUTES
    const isOwnerRoute = OWNER_ONLY_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (isOwnerRoute) return true;

    // Purchases & GRN is allowed for staff ONLY if authorized for the currently active branch (e.g. Dambadeniya for Tharindu)
    if (pathname === '/dashboard/purchases' || pathname.startsWith('/dashboard/purchases/')) {
      const canAccessActiveBranchGrn =
        isOwner ||
        (Boolean(selectedBranchId) &&
          Array.isArray(grnBranchIds) &&
          grnBranchIds.includes(selectedBranchId!));
      return !canAccessActiveBranchGrn;
    }

    return false;
  }, [authChecked, isTenantLoading, isOwner, grnBranchIds, selectedBranchId, pathname]);

  // Enforce Route Guard: redirect unauthorized staff to /dashboard/pos
  useEffect(() => {
    if (isRestrictedForStaff) {
      console.warn(`[RouteGuard] Access denied to ${pathname} for non-owner staff. Redirecting to /dashboard/pos`);
      router.replace('/dashboard/pos');
    }
  }, [isRestrictedForStaff, pathname, router]);

  if (!authChecked || isRestrictedForStaff) {
    return (
      <div className="h-screen w-screen bg-[#EDE9FE] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#7052FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    /* Outer Viewport Canvas (Soft Modern Canvas Tint) */
    <div className="h-screen w-screen bg-[#EDE9FE] p-2 sm:p-3 md:p-4 lg:p-5 overflow-hidden box-border flex items-center justify-center antialiased selection:bg-[#7052FF] selection:text-white">
      {/* Inner Floating App Surface (Confidency OS Design System) */}
      <div
        className={`rounded-3xl shadow-2xl border border-slate-200/60 w-full h-full flex overflow-hidden relative ${
          isPosPage ? 'bg-[#0F1222]' : 'bg-white'
        }`}
      >
        {/* Left Column: Categorized Navigation Sidebar (220px-240px) */}
        <PosSidebar />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Executive Header (Adapts automatically for POS and non-POS routes) */}
          <Header />

          {/* Page Content Viewport */}
          <main
            className={`flex-1 ${
              isPosPage
                ? 'overflow-hidden p-0 h-full bg-[#E6EAF2]'
                : 'overflow-y-auto p-4 sm:p-5 lg:p-6 pb-20 lg:pb-6 bg-slate-50/50'
            }`}
          >
            {children}
          </main>

          {/* Mobile Bottom Thumb Navigation (< md) */}
          <div className="md:hidden shrink-0">
            <BottomNavBar />
          </div>
        </div>
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
