'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, Radio, Printer, Server, Cpu, CheckCircle2 } from 'lucide-react';
import { useRealtimePosSync } from '../../../hooks/use-realtime-pos-sync';
import {
  MotionPageShell,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '../../../components/ui/motion-primitives';

export default function LiveMonitorPage() {
  useRealtimePosSync(() => {}, { showToast: true });

  const activeBranches = [
    { name: 'Alawwa Dispensary', terminal: 'REG-AL-01', cashier: 'Shashini', status: 'ONLINE', ping: '11ms' },
    { name: 'Dambadeniya Dispensary', terminal: 'REG-DB-01', cashier: 'Tharindu', status: 'ONLINE', ping: '14ms' },
    { name: 'Giriulla Dispensary', terminal: 'REG-GR-01', cashier: 'Kumari', status: 'ONLINE', ping: '9ms' },
  ];

  return (
    <MotionPageShell className="p-6 md:p-8 space-y-6 bg-[#EEF2F7] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center border border-teal-200/80 shadow-xs relative">
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0D9488]"></span>
            </span>
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Live POS Telemetry & Monitor</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                Active Heartbeat
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Real-time terminal heartbeats, transaction streams, and register health across dispensaries
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/pos"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-[#0D9488] shadow-md transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>Open POS Terminal</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* Telemetry Metric Cards */}
      <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MotionStaggerItem>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0D9488] to-[#0F766E] text-white shadow-lg shadow-teal-500/15 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-100 uppercase tracking-wider">Terminal Fleet</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/20 px-2.5 py-0.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  3 Active Stations
                </span>
              </div>
              <div className="text-2xl font-black text-white mt-3">Alawwa • Dambadeniya • Giriulla</div>
              <p className="text-xs text-teal-100 mt-2">Cashier Terminals • Deegayu Weda Madhura</p>
            </div>
          </div>
        </MotionStaggerItem>

        <MotionStaggerItem>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white shadow-lg shadow-sky-500/15 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-100 uppercase tracking-wider">Sync Telemetry</span>
                <Server className="w-4 h-4 text-sky-200" />
              </div>
              <div className="text-2xl font-black text-white mt-3">&lt; 12 ms Latency</div>
              <p className="text-xs text-sky-100 font-medium mt-2">IndexedDB Hydrated • 3,120 Products Active</p>
            </div>
          </div>
        </MotionStaggerItem>

        <MotionStaggerItem>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#4338CA] text-white shadow-lg shadow-indigo-500/15 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Hardware Interface</span>
                <Printer className="w-4 h-4 text-indigo-200" />
              </div>
              <div className="text-2xl font-black text-white mt-3">ESC/POS Thermal 80mm</div>
              <p className="text-xs text-indigo-100 mt-2">Auto-Cut Driver Active • Drawer Kick Armed</p>
            </div>
          </div>
        </MotionStaggerItem>
      </MotionStaggerGrid>

      {/* Active Branch Terminal Status Stream */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#0D9488] animate-pulse" />
            <h2 className="text-sm font-bold text-slate-800">Branch Terminal Telemetry Matrix</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">Live Pulse Rate: 5000ms</span>
        </div>
        <div className="divide-y divide-slate-100">
          {activeBranches.map((b) => (
            <div key={b.terminal} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-200/60">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">{b.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-slate-600">{b.terminal}</span>
                    <span>•</span>
                    <span>Operator: <strong className="text-slate-700">{b.cashier}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-500 hidden sm:inline">{b.ping}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{b.status}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MotionPageShell>
  );
}
