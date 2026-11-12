'use client';

import React from 'react';
import Link from 'next/link';
import { Store } from 'lucide-react';

export default function MarketplacePage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">PixelCraft App Marketplace</h1>
            <p className="text-xs text-slate-500">Extensions, accounting sync plugins, and courier delivery bridges</p>
          </div>
        </div>
        <Link
          href="/dashboard/pos"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Return to POS &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accounting</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Installed</span>
          </div>
          <div className="text-base font-bold text-slate-900 mt-2">QuickBooks & Xero Sync</div>
          <p className="text-xs text-slate-500 mt-1">Automatic end-of-day sales journal export</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logistics</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Available</span>
          </div>
          <div className="text-base font-bold text-slate-900 mt-2">PickMe & Uber Delivery</div>
          <p className="text-xs text-slate-500 mt-1">Direct courier dispatch for herbal prescription deliveries</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Gateway</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Connected</span>
          </div>
          <div className="text-base font-bold text-slate-900 mt-2">Dialog & Mobitel SMS</div>
          <p className="text-xs text-slate-500 mt-1">Digital receipt SMS and credit payment vouchers</p>
        </div>
      </div>
    </div>
  );
}

