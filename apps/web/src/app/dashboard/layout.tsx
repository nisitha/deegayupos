'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PosSidebar } from '../../components/layout/pos-sidebar';
import { Header } from '../../components/layout/header';
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
      <div className="h-screen w-screen bg-[#F4F6F9] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#005BD3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#F4F6F9] text-slate-900 flex overflow-hidden antialiased selection:bg-[#005BD3] selection:text-white">
      {/* Left Slim Navigation Rail */}
      <PosSidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Modern Clean Top Header Bar with Interactive Profile & Sign Out */}
        <Header />

        {/* Page Content Viewport */}
        <main
          className={`flex-1 ${
            isPosPage
              ? 'overflow-hidden p-3 lg:p-4 bg-[#F4F6F9]'
              : 'overflow-y-auto p-5 lg:p-6 bg-[#F4F6F9]'
          }`}
        >
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
