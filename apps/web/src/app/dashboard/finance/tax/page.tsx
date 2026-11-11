'use client';

import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function TaxEnginePage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tax Engine (VAT & SSCL)</h1>
            <p className="text-xs text-slate-500">Sri Lankan Inland Revenue Department (IRD) compliance and exemptions</p>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Receipt & Tax Settings &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ayurvedic Exemption</div>
          <div className="text-2xl font-black text-emerald-600 mt-2">0% (VAT Exempt)</div>
          <p className="text-xs text-slate-500 mt-1">Prescription herbal preparations</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Standard FMCG Rate</div>
          <div className="text-2xl font-black text-slate-900 mt-2">18.00% VAT</div>
          <p className="text-xs text-slate-500 mt-1">General cosmetics and packaged drinks</p>
        </div>
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Social Security (SSCL)</div>
          <div className="text-2xl font-black text-slate-900 mt-2">2.50%</div>
          <p className="text-xs text-slate-500 mt-1">Applicable commercial wholesale sales</p>
        </div>
      </div>
    </div>
  );
}
