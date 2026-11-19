import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UseRealtimePosSyncOptions {
  showToast?: boolean;
  intervalMs?: number;
  channelName?: string;
}

/**
 * Hook to listen for live Supabase changes on sales, cashier_shifts, and shift_modaka_entries.
 * Automatically reloads page data when staff at any branch ring up a sale or close/update shifts.
 * Includes a 15-second silent background poll fallback.
 */
export function useRealtimePosSync(
  onReload: () => void | Promise<void>,
  options: UseRealtimePosSyncOptions = {}
) {
  const { showToast = true, intervalMs = 15000, channelName = 'pos_live_sync' } = options;
  const reloadRef = useRef(onReload);
  reloadRef.current = onReload;

  // Lightweight transient floating pill notification
  const triggerToast = (message: string) => {
    if (typeof window === 'undefined' || !showToast) return;

    try {
      const existingToast = document.getElementById('pixelcraft-realtime-toast');
      if (existingToast) existingToast.remove();

      const toast = document.createElement('div');
      toast.id = 'pixelcraft-realtime-toast';
      toast.className =
        'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700/60 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none';
      toast.innerHTML = `
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    } catch {
      // Ignore DOM errors in test / headless environments
    }
  };

  useEffect(() => {
    let debounceTimer: any = null;

    const debouncedReload = (toastMsg?: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          reloadRef.current();
        } catch (e) {
          console.warn('[useRealtimePosSync] reload error:', e);
        }
        if (toastMsg) triggerToast(toastMsg);
      }, 400);
    };

    // 1. Setup Supabase Realtime Subscription
    const channel = supabase
      .channel(`${channelName}_${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales' },
        (payload) => {
          const inv = (payload.new as any)?.invoice_number || 'New bill';
          debouncedReload(`⚡ ${inv} recorded in real-time`);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sales' },
        () => debouncedReload()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cashier_shifts' },
        () => debouncedReload('🔄 Shift status updated')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_modaka_entries' },
        () => debouncedReload('📦 Special Stock updated')
      )
      .subscribe();

    // 2. Silent 15-second background interval fallback
    const intervalId = setInterval(() => {
      try {
        reloadRef.current();
      } catch (e) {
        console.warn('[useRealtimePosSync] interval reload error:', e);
      }
    }, intervalMs);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [channelName, intervalMs, showToast]);
}
