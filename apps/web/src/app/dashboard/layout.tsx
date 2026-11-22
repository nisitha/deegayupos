'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PosSidebar } from '../../components/layout/pos-sidebar';
import { Header } from '../../components/layout/header';
import { BottomNavBar } from '../../components/layout/bottom-nav-bar';
import { AutoUpdateWatcher } from '../../components/layout/auto-update-watcher';
import { TenantBranchProvider, useTenantBranch } from '../../context/tenant-branch-context';

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

  // Determine if active route is restricted for current staff session (Strict Financial Blind Mode)
  const isRestrictedForStaff = useMemo(() => {
    if (!authChecked || isTenantLoading || isOwner) {
      return false;
    }

    // 1. POS Terminal is allowed
    if (pathname === '/dashboard/pos' || pathname?.startsWith('/dashboard/pos')) {
      return false;
    }

    // 2. Purchases & GRN is allowed for staff ONLY if authorized for the currently active branch
    if (pathname === '/dashboard/purchases' || pathname.startsWith('/dashboard/purchases/')) {
      const canAccessActiveBranchGrn =
        Boolean(selectedBranchId) &&
        Array.isArray(grnBranchIds) &&
        grnBranchIds.includes(selectedBranchId!);
      return !canAccessActiveBranchGrn;
    }

    // 3. Stock Transfers is allowed for staff so branch staff can submit outgoing transfer requests
    if (
      pathname === '/dashboard/transfers' ||
      pathname.startsWith('/dashboard/transfers/') ||
      pathname === '/dashboard/inventory/transfers' ||
      pathname.startsWith('/dashboard/inventory/transfers/')
    ) {
      return false;
    }

    // All other administrative, overview & financial routes are strictly restricted for STAFF
    return true;
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
    /* Outer Viewport Canvas: Edge-to-edge on POS, subtle canvas tint on Admin */
    <div
      className={`h-dvh w-screen max-w-full overflow-x-hidden ${
        isPosPage ? 'p-0 bg-[#0F1222]' : 'bg-[#EDE9FE] p-0 sm:p-2 md:p-3 lg:p-5'
      } overflow-hidden box-border flex items-center justify-center antialiased selection:bg-[#7052FF] selection:text-white`}
    >
      {/* Inner Surface: Full Edge-to-Edge on POS, Floating on Admin */}
      <div
        className={`${
          isPosPage
            ? 'rounded-none border-0 shadow-none bg-[#0F1222]'
            : 'rounded-none sm:rounded-2xl lg:rounded-3xl shadow-none sm:shadow-2xl border-0 sm:border border-slate-200/60 bg-white'
        } w-full h-full flex overflow-hidden relative`}
      >
        {/* Left Column: Categorized Navigation Sidebar / Mobile Slide-Over Drawer */}
        <PosSidebar />

        {/* Global Cart-Safe Auto-Update Watcher */}
        <AutoUpdateWatcher />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Executive Header: Render exclusively on non-POS pages; POS page has its own dedicated top bar */}
          {!isPosPage && <Header />}

          {/* Page Content Viewport */}
          <main
            className={`flex-1 min-w-0 overflow-x-hidden ${
              isPosPage
                ? 'overflow-hidden p-0 h-full bg-[#E6EAF2]'
                : 'overflow-y-auto p-3 sm:p-5 lg:p-6 pb-20 lg:pb-6 bg-slate-50/50'
            }`}
          >
            {children}
          </main>

          {/* Mobile Bottom Thumb Navigation (< md) for non-POS pages */}
          {!isPosPage && (
            <div className="md:hidden shrink-0">
              <BottomNavBar />
            </div>
          )}
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
