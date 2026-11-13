'use client';

import React from 'react';
import Link from 'next/link';
import {
  Store,
  Zap,
  Printer,
  Truck,
  CreditCard,
  UserCheck,
  Package,
  Receipt,
  ArrowRight,
  Search,
  Sparkles,
  CheckCircle2,
  Settings,
  Plus,
  Building2,
} from 'lucide-react';

export default function HomePage() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3FF] via-[#F8FAFC] to-[#EEF2FF] text-slate-900 antialiased selection:bg-[#7052FF]/20 selection:text-[#5E3FE6]">
      {/* 1. Floating Top Navigation Bar */}
      <header className="sticky top-0 z-50 pt-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <nav className="bg-white/90 backdrop-blur-md border border-slate-200/80 px-4 sm:px-6 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-4">
            {/* Left Monogram & Brand */}
            <Link href="/" className="flex items-center gap-3 group shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#7052FF] text-white font-black text-xl flex items-center justify-center shadow-md shadow-[#7052FF]/25 group-hover:bg-[#5E3FE6] group-hover:scale-105 transition-all">
                P
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-950 text-base tracking-tight">PixelCraft POS</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#5E3FE6] border border-[#DDD6FE]">
                    v2.4
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:block -mt-0.5 font-medium">
                  Enterprise Retail & Pharmacy OS
                </span>
              </div>
            </Link>

            {/* Center Navigation Links */}
            <div className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600">
              <a
                href="#features"
                className="px-3.5 py-2 rounded-xl hover:text-slate-950 hover:bg-slate-100/70 transition-colors"
              >
                Features
              </a>
              <a
                href="#pharmacy-retail"
                className="px-3.5 py-2 rounded-xl hover:text-slate-950 hover:bg-slate-100/70 transition-colors"
              >
                Pharmacy & Retail
              </a>
              <a
                href="#hardware-receipts"
                className="px-3.5 py-2 rounded-xl hover:text-slate-950 hover:bg-slate-100/70 transition-colors"
              >
                Hardware & Receipts
              </a>
              <a
                href="#multi-branch"
                className="px-3.5 py-2 rounded-xl hover:text-slate-950 hover:bg-slate-100/70 transition-colors"
              >
                Multi-Branch
              </a>
            </div>

            {/* Right Action CTAs */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/dashboard"
                className="text-slate-700 hover:text-slate-950 hover:bg-slate-100/80 font-semibold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/pos"
                className="bg-[#7052FF] hover:bg-[#5E3FE6] text-white font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-md shadow-[#7052FF]/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Store className="w-4 h-4" />
                <span className="hidden xs:inline">Launch POS Terminal</span>
                <span className="xs:hidden">POS</span>
                <kbd className="hidden md:inline-block text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                  F1
                </kbd>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24 space-y-16">
        {/* 2. Hero Section */}
        <section className="text-center space-y-6 max-w-4xl mx-auto pt-4">
          {/* Badge Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EDE9FE] text-[#5E3FE6] text-xs font-bold border border-[#DDD6FE]/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#7052FF]" />
            <span>Next-Gen Cloud POS • Built for Sri Lankan Retail & Pharmacies</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 leading-[1.08]">
            Modern Retail & Pharmacy POS Engineered for{' '}
            <span className="text-[#7052FF] relative inline-block">
              0ms Speed.
              <svg
                className="absolute -bottom-2 left-0 w-full text-[#7052FF]/20"
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
              >
                <path d="M0,10 Q50,0 100,10" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
            Manage 3,000+ SKUs, multi-branch inventory, 80mm thermal ESC/POS receipts, supplier GRNs, and customer credit ledgers inside one effortless floating workspace.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              href="/dashboard/pos"
              className="bg-[#7052FF] hover:bg-[#5E3FE6] text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-3.5 rounded-2xl shadow-lg shadow-[#7052FF]/25 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 group"
            >
              <Store className="w-5 h-5 group-hover:rotate-6 transition-transform" />
              <span>Open POS Terminal</span>
              <kbd className="hidden sm:inline-block text-xs bg-white/20 px-2 py-0.5 rounded font-mono font-bold text-white/95">
                F1
              </kbd>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/dashboard"
              className="bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-950 border border-slate-200/90 font-bold text-sm sm:text-base px-6 sm:px-7 py-3.5 rounded-2xl shadow-sm transition-all hover:border-slate-300"
            >
              Management Dashboard
            </Link>
          </div>

          {/* Quick Metrics Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>0ms IndexedDB Catalog Cache</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ESC/POS 80mm & 58mm Thermal Print</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Customer Khata Credit CRM</span>
            </div>
          </div>
        </section>

        {/* Floating Interactive Dashboard Preview Frame */}
        <section className="relative mx-auto max-w-6xl">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-indigo-950/10 overflow-hidden">
            {/* Mock App Window Top Bar */}
            <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
                <span className="text-xs font-bold text-slate-700 hidden sm:inline-flex items-center gap-1.5 font-mono">
                  pos.pixelcraftlk.com/dashboard/pos
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE • 0ms Cache
                </span>
                <span className="text-slate-500 hidden md:inline">
                  Cashier: <strong className="text-slate-800">Kamal Perera</strong>
                </span>
              </div>
            </div>

            {/* Mock 3-Column POS Terminal Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px] bg-slate-50/30">
              {/* Mini Sidebar Preview (1 Col) */}
              <div className="hidden lg:flex lg:col-span-1 border-r border-slate-200/80 bg-white p-3 flex-col items-center justify-between py-6">
                <div className="space-y-4">
                  <div className="w-9 h-9 rounded-xl bg-[#7052FF] text-white flex items-center justify-center shadow-md">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 cursor-pointer">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 cursor-pointer">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 cursor-pointer">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
              </div>

              {/* Center Catalog Grid Preview (7 Cols) */}
              <div className="lg:col-span-7 p-4 sm:p-6 space-y-4 border-r border-slate-200/80">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    readOnly
                    value="Deegayu Maha Siddhartha Thailaya"
                    className="w-full pl-10 pr-20 py-2.5 text-xs bg-white rounded-xl border border-slate-200/90 font-medium text-slate-800 shadow-2xs"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                    F2
                  </span>
                </div>

                {/* Department Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                  <span className="px-3 py-1 rounded-lg bg-[#7052FF] text-white shrink-0">
                    All Items (3,120)
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                    Thaila & Oils (412)
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                    Asava & Arishta (280)
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                    Capsules & Tablets
                  </span>
                </div>

                {/* Product Cards Grid Preview */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Card 1 */}
                  <div className="p-3 bg-white rounded-2xl border-2 border-indigo-300 shadow-sm space-y-2 relative group">
                    <div className="h-20 rounded-xl bg-gradient-to-tr from-amber-50 to-orange-50 flex items-center justify-center border border-amber-100 text-amber-700 font-bold text-xs">
                      Thaila Oil
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-[#7052FF] uppercase tracking-wider">
                        Oils & Balms
                      </div>
                      <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        Maha Siddhartha Thailaya (100ml)
                      </div>
                      <div className="text-xs font-black font-mono text-slate-950 mt-1">
                        LKR 850.00
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-[#7052FF] text-white flex items-center justify-center absolute bottom-3 right-3 shadow-sm">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative">
                    <div className="h-20 rounded-xl bg-gradient-to-tr from-emerald-50 to-teal-50 flex items-center justify-center border border-emerald-100 text-emerald-700 font-bold text-xs">
                      Ashwagandha
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                        Capsules
                      </div>
                      <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        Ashwagandha Capsules (60s)
                      </div>
                      <div className="text-xs font-black font-mono text-slate-950 mt-1">
                        LKR 1,450.00
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center absolute bottom-3 right-3">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative">
                    <div className="h-20 rounded-xl bg-gradient-to-tr from-purple-50 to-indigo-50 flex items-center justify-center border border-purple-100 text-purple-700 font-bold text-xs">
                      Triphala
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                        Powders
                      </div>
                      <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        Triphala Churnaya (100g)
                      </div>
                      <div className="text-xs font-black font-mono text-slate-950 mt-1">
                        LKR 480.00
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center absolute bottom-3 right-3">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Order Summary Rail Preview (4 Cols) */}
              <div className="lg:col-span-4 p-4 sm:p-6 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Customer Banner */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">Kavindu Senanayake</div>
                      <div className="text-[11px] text-emerald-600 font-semibold font-mono">
                        Khata: LKR 12,500.00 Limit
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      VIP
                    </span>
                  </div>

                  {/* Cart Items List */}
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Maha Siddhartha Thailaya</div>
                        <div className="text-[11px] text-slate-400">1 x LKR 850.00</div>
                      </div>
                      <div className="font-mono font-bold text-slate-900">LKR 850.00</div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Ashwagandha Capsules (60s)</div>
                        <div className="text-[11px] text-slate-400">1 x LKR 1,450.00</div>
                      </div>
                      <div className="font-mono font-bold text-slate-900">LKR 1,450.00</div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">Triphala Churnaya (100g)</div>
                        <div className="text-[11px] text-slate-400">1 x LKR 480.00</div>
                      </div>
                      <div className="font-mono font-bold text-slate-900">LKR 480.00</div>
                    </div>
                  </div>
                </div>

                {/* Totals & Charge CTA */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold text-slate-800">LKR 2,780.00</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Member Discount (12%)</span>
                      <span className="font-mono">-LKR 330.00</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-100">
                      <span>Total Amount</span>
                      <span className="font-mono text-base text-slate-950 font-black">LKR 2,450.00</span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard/pos"
                    className="w-full bg-[#7052FF] hover:bg-[#5E3FE6] text-white font-black text-sm py-3.5 rounded-xl shadow-lg shadow-[#7052FF]/20 flex items-center justify-center gap-2 transition-transform active:scale-98"
                  >
                    <span>Charge LKR 2,450.00</span>
                    <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      SPACE
                    </kbd>
                  </Link>

                  <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-400">
                    <span>💵 Cash</span>
                    <span>💳 Card POS</span>
                    <span>📱 LankaQR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Active Workspace Quick-Access Strip */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl shadow-indigo-950/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7052FF]">Active Organization</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Tenant: deegayu
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
                Deegayu Ayurvedic Products & Health Care
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="text-xs font-bold text-[#7052FF] hover:text-[#5E3FE6] flex items-center gap-1.5 group"
            >
              <span>Open Complete Management Workspace</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-6">
            {/* Quick Link 1: POS Terminal */}
            <Link
              href="/dashboard/pos"
              className="p-4 rounded-2xl bg-gradient-to-br from-[#F5F3FF] to-white border border-[#DDD6FE] hover:border-[#7052FF] shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#7052FF] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Store className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-[#7052FF] transition-colors">
                  POS Terminal
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Rapid Barcode Checkout [F1]</div>
              </div>
            </Link>

            {/* Quick Link 2: Products Catalog */}
            <Link
              href="/dashboard/products"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Products & Catalog
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">3,120 Ayurvedic SKUs</div>
              </div>
            </Link>

            {/* Quick Link 3: Sales & Bills */}
            <Link
              href="/dashboard/orders"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Sales & Bills History
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Thermal Reprints & Voids</div>
              </div>
            </Link>

            {/* Quick Link 4: Suppliers & GRN */}
            <Link
              href="/dashboard/purchases"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-amber-800 transition-colors">
                  Suppliers & GRN
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">94 Vendors & Purchases</div>
              </div>
            </Link>

            {/* Quick Link 5: Settings */}
            <Link
              href="/dashboard/settings"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-400 shadow-2xs hover:shadow-md transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Settings className="w-4 h-4" />
              </div>
              <div className="mt-3">
                <div className="text-xs font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors">
                  Store & Hardware
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Logo, 80mm Slips & Ports</div>
              </div>
            </Link>
          </div>
        </section>

        {/* 4. Bento Feature Grid (6 Core Enterprise Capabilities) */}
        <section id="features" className="space-y-8 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7052FF]">
              Enterprise POS Infrastructure
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Six Core Pillars Built for Sri Lankan Retail
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Engineered with pure vector thermal printing, lightning client search, and atomic inventory ledger tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Bento 1: 0ms Catalog & Search */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-pos-card hover:border-[#7052FF]/50 hover:shadow-lg transition-all space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#EDE9FE] text-[#7052FF] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                0ms Instant Catalog & Barcode Search
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Client-side IndexedDB caching delivers sub-15ms startup times across 3,120+ Ayurvedic products. Press <kbd className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200">F2</kbd> or trigger scanner gun for 0ms lookups.
              </p>
            </div>

            {/* Bento 2: Multi-Branch Stock & Transfers */}
            <div id="multi-branch" className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-pos-card hover:border-emerald-300 hover:shadow-lg transition-all space-y-3.5 scroll-mt-24">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                Multi-Branch Stock & Transfers
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Manage stock across Colombo, Kandy, and Galle dispensaries. Real-time quantity-on-hand tracking, low-stock reorder thresholds, and inter-branch transit logging.
              </p>
            </div>

            {/* Bento 3: 80mm / 58mm Thermal Printing */}
            <div id="hardware-receipts" className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-pos-card hover:border-blue-300 hover:shadow-lg transition-all space-y-3.5 scroll-mt-24">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                80mm / 58mm Thermal ESC/POS Printing
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Generate authentic vector Code128 barcodes matching invoice numbers, scannable digital receipt verification QR codes, and auto cash-drawer kick pulses.
              </p>
            </div>

            {/* Bento 4: Suppliers, PO & GRN */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-pos-card hover:border-amber-300 hover:shadow-lg transition-all space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                Suppliers, PO & GRN Engine
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Complete procurement workflow supporting 94 registered Ayurvedic herbal suppliers. Issue Purchase Orders, inspect Goods Received Notes, and track batches.
              </p>
            </div>

            {/* Bento 5: Customer Khata Credit CRM */}
            <div id="pharmacy-retail" className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-pos-card hover:border-purple-300 hover:shadow-lg transition-all space-y-3.5 scroll-mt-24">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                Customer Credit Ledger (Khata)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enforce credit limits for trusted patrons and doctors. Keep automated running ledger balances, track partial payments, and issue bilingual statements in Sinhala and English.
              </p>
            </div>

            {/* Bento 6: Staff RBAC & Shift Reconciliation */}
            <div className="p-7 rounded-3xl bg-white border border-slate-200/80 shadow-pos-card hover:border-indigo-300 hover:shadow-lg transition-all space-y-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                Staff RBAC & Shift Reconciliation
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Role-based access control (<code className="font-mono text-[11px] text-[#7052FF]">OWNER</code>, <code className="font-mono text-[11px] text-blue-600">MANAGER</code>, <code className="font-mono text-[11px] text-emerald-600">CASHIER</code>), 4-digit PIN quick-switch, and end-of-day X/Z cash balancing.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Minimalist Commercial Footer */}
        <footer className="pt-12 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#7052FF] text-white font-bold flex items-center justify-center text-xs">
              P
            </div>
            <span>
              <strong>PixelCraft POS</strong> • Enterprise Retail & Pharmacy OS • Powered by Pixel Craft Studios
            </span>
          </div>

          <div className="flex items-center gap-4 font-semibold text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-950 transition-colors">
              Command Dashboard
            </Link>
            <span>•</span>
            <Link href="/dashboard/pos" className="hover:text-[#7052FF] transition-colors">
              POS Terminal
            </Link>
            <span>•</span>
            <Link href="/dashboard/settings" className="hover:text-slate-950 transition-colors">
              Hardware Settings
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
