'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AlertsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Inventory & System Alerts</h1>
            <p className="text-xs text-slate-500">Low stock notices, batch expiration alerts, and system health triggers</p>
          </div>
        </div>
        <Link
          href="/dashboard/inventory"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Full Inventory &rarr;
        </Link>
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-950">Low Stock Reorder Thresholds</div>
              <div className="text-xs text-amber-700 mt-0.5">8 Ayurvedic items are currently below safety reserve count (≤ 5 units).</div>
            </div>
          </div>
          <Link
            href="/dashboard/purchases"
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition-colors"
          >
            Create PO
          </Link>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-950">Hardware & Peripheral Health</div>
              <div className="text-xs text-emerald-700 mt-0.5">Web Print, ESC/POS drivers, and Bluetooth bridges operating nominally.</div>
            </div>
          </div>
          <Link
            href="/dashboard/settings/hardware"
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors"
          >
            Hardware Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
