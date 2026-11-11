'use client';

import React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';

export default function RevenueDeskPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Revenue Desk & Financial Reporting</h1>
            <p className="text-xs text-slate-500">Gross revenue, net margin, daily collections, and sales breakdown</p>
          </div>
        </div>
        <Link
          href="/dashboard/sales"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Sales Register &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Sales (Today)</div>
          <div className="text-2xl font-black text-slate-900 mt-2">LKR 148,500.00</div>
          <p className="text-xs text-emerald-600 font-medium mt-1">+14.2% vs previous period</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash vs Card Ratio</div>
          <div className="text-2xl font-black text-slate-900 mt-2">68% / 32%</div>
          <p className="text-xs text-slate-500 mt-1">LKR 101,000 Cash • LKR 47,500 Card</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Credit Debt</div>
          <div className="text-2xl font-black text-sky-600 mt-2">LKR 34,200.00</div>
          <p className="text-xs text-slate-500 mt-1">Outstanding Khata receivables</p>
        </div>
      </div>
    </div>
  );
}
