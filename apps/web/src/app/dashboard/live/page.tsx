'use client';

import React from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { useRealtimePosSync } from '../../../hooks/use-realtime-pos-sync';

export default function LiveMonitorPage() {
  useRealtimePosSync(() => {}, { showToast: true });
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Live POS Telemetry & Monitor</h1>
            <p className="text-xs text-slate-500">Real-time terminal heartbeats, transaction streams, and register health</p>
          </div>
        </div>
        <Link
          href="/dashboard/pos"
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-[#7052FF] transition-colors"
        >
          Open POS Terminal &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">Terminal Station</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Online
            </span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">REG-01 (Main Counter)</div>
          <p className="text-xs text-blue-100 mt-1">Cashier Station • Deegayu Weda Madhura</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-lg shadow-emerald-500/10">
          <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Database Sync Latency</div>
          <div className="text-2xl font-bold text-white mt-2">&lt; 12 ms</div>
          <p className="text-xs text-emerald-100 font-medium mt-1">IndexedDB Hydrated • 3,120 Products</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#4338CA] text-white shadow-lg shadow-indigo-500/10">
          <div className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Hardware Interface</div>
          <div className="text-2xl font-bold text-white mt-2">Thermal 80mm</div>
          <p className="text-xs text-indigo-100 mt-1">ESC/POS Bridge Ready • Drawer Kick Armed</p>
        </div>
      </div>
    </div>
  );
}

