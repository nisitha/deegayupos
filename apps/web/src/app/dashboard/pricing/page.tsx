'use client';

import React from 'react';
import Link from 'next/link';
import { Tag, Building2, Stethoscope, ArrowRight } from 'lucide-react';
import {
  MotionPageShell,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '../../../components/ui/motion-primitives';

export default function PricingEnginePage() {
  return (
    <MotionPageShell className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100 shadow-sm">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pricing & Tier Engine</h1>
            <p className="text-xs text-slate-500">Configure retail, wholesale, and dispensary tiered pricing rules</p>
          </div>
        </div>
        <Link
          href="/dashboard/products"
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
        >
          <span>View Product Catalog</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>

      {/* Modern Split-Accent Pricing Cards — Botanical Emerald & Saffron Gold */}
      <MotionStaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Tier 1: Retail Standard */}
        <MotionStaggerItem>
          <div className="rounded-2xl border border-emerald-200/80 bg-white overflow-hidden shadow-md shadow-emerald-900/5 flex flex-col justify-between h-full">
            <div className="p-5 bg-gradient-to-br from-[#059669] to-[#047857] text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">
                  Tier 1 • Counter Walk-Ins
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  Active Default
                </span>
              </div>
              <div className="text-2xl font-black mt-2">Retail Standard (MSP)</div>
              <p className="text-xs text-emerald-100 mt-1">100% Maximum Suggested Price for walk-in retail customers</p>
            </div>
            <div className="p-5 space-y-3 bg-white text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Markup Formula:</span>
                <span className="font-mono font-bold text-slate-900">100% Base MSP</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">VAT Status:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Exempt (Ayurvedic)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Application:</span>
                <span className="font-medium text-slate-700">All 3 Branches Counter POS</span>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* Tier 2: Wholesale Dealer */}
        <MotionStaggerItem>
          <div className="rounded-2xl border border-amber-200/80 bg-white overflow-hidden shadow-md shadow-amber-900/5 flex flex-col justify-between h-full">
            <div className="p-5 bg-gradient-to-br from-[#D97706] to-[#B45309] text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-100 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Tier 2 • Pharmacy Wholesale</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  B2B
                </span>
              </div>
              <div className="text-2xl font-black mt-2">-15% to -25% Off MSP</div>
              <p className="text-xs text-amber-100 mt-1">Automatic wholesale rate applied to verified retail pharmacies</p>
            </div>
            <div className="p-5 space-y-3 bg-white text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Minimum Order:</span>
                <span className="font-mono font-bold text-slate-900">20 Units / Item</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Credit Term:</span>
                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Net 14 / Net 30</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Application:</span>
                <span className="font-medium text-slate-700">Authorized Dealer Accounts</span>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* Tier 3: Weda Mahaththaya Clinic Tier */}
        <MotionStaggerItem>
          <div className="rounded-2xl border border-emerald-300/80 bg-white overflow-hidden shadow-md shadow-emerald-900/5 flex flex-col justify-between h-full">
            <div className="p-5 bg-gradient-to-br from-[#065F46] to-[#064E3B] text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Tier 3 • Ayurvedic Dispensary</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  Practitioner
                </span>
              </div>
              <div className="text-2xl font-black mt-2">-20% Flat Discount</div>
              <p className="text-xs text-emerald-200 mt-1">Special dispensary preparation rate for licensed Weda Mahaththaya</p>
            </div>
            <div className="p-5 space-y-3 bg-white text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Qualification:</span>
                <span className="font-mono font-bold text-slate-900">Ayurvedic Council Reg</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Dispensing Form:</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">Bulk Packs & Arishta</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Verification:</span>
                <span className="font-medium text-slate-700">Practitioner PIN Linked</span>
              </div>
            </div>
          </div>
        </MotionStaggerItem>
      </MotionStaggerGrid>
    </MotionPageShell>
  );
}
