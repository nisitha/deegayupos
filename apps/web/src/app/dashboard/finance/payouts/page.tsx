'use client';

import React from 'react';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';

export default function PayoutsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Payouts & Disbursements</h1>
            <p className="text-xs text-slate-500">Bank deposits, supplier disbursements, and petty cash settlements</p>
          </div>
        </div>
        <Link
          href="/dashboard/purchases"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Supplier GRNs &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settled to Bank</div>
          <div className="text-2xl font-black text-slate-900 mt-2">LKR 95,000.00</div>
          <p className="text-xs text-slate-500 mt-1">Direct deposit batches</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Supplier Dues</div>
          <div className="text-2xl font-black text-amber-600 mt-2">LKR 42,800.00</div>
          <p className="text-xs text-slate-500 mt-1">Pending payment for recent GRNs</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Petty Cash Outflows</div>
          <div className="text-2xl font-black text-slate-900 mt-2">LKR 2,450.00</div>
          <p className="text-xs text-slate-500 mt-1">Shift expense drops</p>
        </div>
      </div>
    </div>
  );
}
