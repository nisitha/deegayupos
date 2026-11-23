'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, CheckCircle, ShieldAlert, ArrowRight } from 'lucide-react';
import {
  MotionPageShell,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '../../../components/ui/motion-primitives';

export default function AlertsPage() {
  return (
    <MotionPageShell className="p-6 md:p-8 space-y-6 bg-[#EEF2F7] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#E11D48] flex items-center justify-center border border-rose-200/80 shadow-xs relative">
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E11D48]"></span>
            </span>
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inventory & System Telemetry Alerts</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                Live Sentinel
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Low stock reorder notices, batch expiration monitors, and system health threshold triggers
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <span>View Full Inventory</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* Severity Alert Banners */}
      <MotionStaggerGrid className="space-y-3.5">
        {/* Critical / High Severity Alert */}
        <MotionStaggerItem>
          <div className="p-5 rounded-2xl border border-rose-200 bg-white shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#E11D48]" />
            <div className="flex items-start sm:items-center gap-3.5 pl-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#E11D48] flex items-center justify-center border border-rose-200/80 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-slate-900">Safety Reserve Reorder Triggers</div>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-[#E11D48] border border-rose-200">
                    Priority Action
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  8 Ayurvedic preparations are currently at or below safety reorder threshold count (&le; 5 units).
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/purchases"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#E11D48] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-500/20 cursor-pointer self-start sm:self-auto"
            >
              <span>Create Supplier PO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </MotionStaggerItem>

        {/* Warning Severity Alert */}
        <MotionStaggerItem>
          <div className="p-5 rounded-2xl border border-amber-200 bg-white shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D97706]" />
            <div className="flex items-start sm:items-center gap-3.5 pl-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/80 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-slate-900">Shift Handover Drawer Tallies</div>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    Daily Review
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Cash drawer physical count reconciliations and Special Stock balances are verified across active branch shifts.
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/finance/reconciliation"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <span>Review Reconciliations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </MotionStaggerItem>

        {/* Nominal / Operational Status */}
        <MotionStaggerItem>
          <div className="p-5 rounded-2xl border border-emerald-200 bg-white shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#059669]" />
            <div className="flex items-start sm:items-center gap-3.5 pl-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80 shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-slate-900">Peripheral & ESC/POS Hardware Status</div>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Nominal
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  ESC/POS thermal printer bridges, cash drawer triggers, and Web Print interfaces are connected and online.
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/settings/hardware"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <span>Hardware Diagnostics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </MotionStaggerItem>
      </MotionStaggerGrid>
    </MotionPageShell>
  );
}
