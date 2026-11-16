'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PosSidebar } from '../../components/layout/pos-sidebar';
import { Header } from '../../components/layout/header';
import { BottomNavBar } from '../../components/layout/bottom-nav-bar';
import { TenantBranchProvider } from '../../context/tenant-branch-context';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPosPage = pathname === '/dashboard/pos';
  const [authChecked, setAuthChecked] = useState(false);

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

  if (!authChecked) {
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
      <div className={`rounded-3xl shadow-2xl border border-slate-200/60 w-full h-full flex overflow-hidden relative ${
        isPosPage ? 'bg-[#0F1222]' : 'bg-white'
      }`}>
        {/* Left Column: Categorized Navigation Sidebar (220px-240px) */}
        <PosSidebar />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Non-POS pages render standard Header; POS page renders its integrated Top Terminal Status Bar */}
          {!isPosPage && <Header />}

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
