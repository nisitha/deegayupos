'use client';

import React from 'react';
import Link from 'next/link';
import { Tag } from 'lucide-react';

export default function PricingEnginePage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#7052FF] flex items-center justify-center border border-purple-100">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pricing & Tier Engine</h1>
            <p className="text-xs text-slate-500">Configure retail, wholesale, and tiered discount pricing rules</p>
          </div>
        </div>
        <Link
          href="/dashboard/products"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View Product Catalog &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retail Standard</div>
          <div className="text-2xl font-black text-slate-900 mt-2">100% MSP</div>
          <p className="text-xs text-slate-500 mt-1">Default markup for counter walk-ins</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wholesale Tier</div>
          <div className="text-2xl font-black text-emerald-600 mt-2">-15% to -25%</div>
          <p className="text-xs text-slate-500 mt-1">Automatic tier for verified pharmacy dealers</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ayurvedic Clinic Tier</div>
          <div className="text-2xl font-black text-purple-600 mt-2">-20% Flat</div>
          <p className="text-xs text-slate-500 mt-1">Special dispensary rate for licensed Weda Mahaththaya</p>
        </div>
      </div>
    </div>
  );
}
