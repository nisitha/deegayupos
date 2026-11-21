'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { RefreshCw, Sparkles } from 'lucide-react';

interface VersionPayload {
  buildId: string;
  builtAt?: string;
}

// Global declaration for window cart flags
declare global {
  interface Window {
    __PIXELCRAFT_POS_CART_ACTIVE?: boolean;
    __PIXELCRAFT_POS_CART_COUNT?: number;
  }
}

export function AutoUpdateWatcher() {
  const pathname = usePathname();
  const isPosPage = pathname === '/dashboard/pos' || pathname?.startsWith('/dashboard/pos');

  const initialBuildIdRef = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadMessage, setReloadMessage] = useState('Applying latest POS update...');

  // Helper: check if active POS cart currently has items
  const isCartActive = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    if (!isPosPage) return false;

    // Check window global flag set by POS page
    if (typeof window.__PIXELCRAFT_POS_CART_ACTIVE === 'boolean') {
      return window.__PIXELCRAFT_POS_CART_ACTIVE;
    }

    // Check sessionStorage fallback
    try {
      const activeFlag = sessionStorage.getItem('pixelcraft_pos_cart_active');
      if (activeFlag === 'true') return true;
      const count = Number(sessionStorage.getItem('pixelcraft_pos_cart_count') || '0');
      if (count > 0) return true;
    } catch {
      // sessionStorage unavailable
    }

    return false;
  }, [isPosPage]);

  // Execute reload safely
  const triggerReload = useCallback(() => {
    if (isReloading) return;
    setIsReloading(true);
    setReloadMessage('Applying latest POS update...');

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }, [isReloading]);

  // Version check function
  const checkVersion = useCallback(async () => {
    if (typeof window === 'undefined' || isReloading) return;

    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return;

      const data: VersionPayload = await res.json();
      if (!data?.buildId) return;

      // On first run, record current buildId
      if (!initialBuildIdRef.current) {
        initialBuildIdRef.current = data.buildId;
        return;
      }

      // Check if new buildId differs from initial
      if (data.buildId !== initialBuildIdRef.current) {
        // New version detected!
        if (isPosPage && isCartActive()) {
          // Defer reload until cashier finishes or clears current cart
          setUpdateAvailable(true);
        } else {
          // Cart is empty or user is on non-POS page -> reload smoothly
          setUpdateAvailable(false);
          triggerReload();
        }
      }
    } catch {
      // Network hiccup - ignore silently
    }
  }, [isCartActive, isPosPage, isReloading, triggerReload]);

  // Initial check & interval polling (every 60s) + window focus check
  useEffect(() => {
    // Check immediately on mount
    checkVersion();

    const intervalId = setInterval(checkVersion, 60000);

    const handleFocus = () => {
      checkVersion();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkVersion]);

  // Secondary watcher: when update is available and we are on POS, wait until cart becomes empty
  useEffect(() => {
    if (!updateAvailable || isReloading) return;

    const idleChecker = setInterval(() => {
      if (!isCartActive()) {
        clearInterval(idleChecker);
        setUpdateAvailable(false);
        triggerReload();
      }
    }, 4000);

    return () => clearInterval(idleChecker);
  }, [updateAvailable, isCartActive, isReloading, triggerReload]);

  // Render non-blocking toast when reload is applying
  if (isReloading) {
    return (
      <aside
        aria-label="System Update"
        className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-slate-900/95 text-white border border-indigo-500/50 shadow-2xl px-4 py-3 rounded-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300"
      >
        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-white tracking-wide">
            {reloadMessage}
          </span>
          <span className="text-[10px] text-slate-400">
            Refreshing terminal seamlessly...
          </span>
        </div>
      </aside>
    );
  }

  // Subtle non-intrusive badge if an update is queued while cashier has an active cart
  if (updateAvailable && isPosPage) {
    return (
      <aside
        aria-label="Pending Update Notice"
        className="fixed top-3 right-3 z-40 hidden sm:flex items-center gap-2 bg-indigo-950/90 text-indigo-200 border border-indigo-700/60 shadow-lg px-3 py-1.5 rounded-xl backdrop-blur-xs text-[11px] font-semibold animate-in fade-in duration-200"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        <span>Update queued • Applies automatically after current sale</span>
      </aside>
    );
  }

  return null;
}
