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
        // If testing directly in local dev without login, seed Deegayu session or redirect
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
      <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#5C6AC4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] text-slate-900 flex overflow-hidden antialiased selection:bg-[#5C6AC4] selection:text-white">
      {/* Left Slim Navigation Rail (Hidden on mobile/tablet < lg) */}
      <PosSidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Modern Clean Top Header Bar with Interactive Profile & Sign Out */}
        <Header />

        {/* Page Content Viewport */}
        <main
          className={`flex-1 ${
            isPosPage
              ? 'overflow-hidden p-0 bg-[#F8FAFC]'
              : 'overflow-y-auto p-4 sm:p-5 lg:p-6 pb-20 lg:pb-6 bg-[#F8FAFC]'
          }`}
        >
          {children}
        </main>

        {/* Bottom Thumb Navigation Dock (< lg screens) */}
        <div className="lg:hidden shrink-0">
          <BottomNavBar />
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
