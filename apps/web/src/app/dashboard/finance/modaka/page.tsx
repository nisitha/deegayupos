'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Building2,
  Users,
  Coins,
  Receipt,
  Download,
  Printer,
  Edit3,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useTenantBranch } from '../../../../context/tenant-branch-context';
import {
  shiftsApi,
  productsApi,
  formatShiftLabel,
  CashierShiftDto,
  ModakaItemConfigDto,
} from '../../../../lib/api-client';
import { useRealtimePosSync } from '../../../../hooks/use-realtime-pos-sync';

function getTodaySriLanka(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function ModakaLedgerPage() {
  const { isOwner, branches } = useTenantBranch();

  // Filters state
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodaySriLanka());
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');

  // Data state
  const [shifts, setShifts] = useState<CashierShiftDto[]>([]);
  const [configs, setConfigs] = useState<ModakaItemConfigDto[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<
    { id: string; name: string; sku: string; price: number }[]
  >([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Config modal state
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [editingConfigs, setEditingConfigs] = useState<
    { id?: string; productId: string; productName: string; sortOrder: number; customRate: number; isActive: boolean }[]
  >([]);
  const [isSavingConfigs, setIsSavingConfigs] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Load shifts & configs
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setIsLoading(true);
      }
      try {
        const [shiftsRes, configsRes] = await Promise.all([
          shiftsApi.getShiftLedgers({
            branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
            shiftDate: selectedDate,
            cashierId: selectedCashierId !== 'all' ? selectedCashierId : undefined,
          }),
          shiftsApi.getModakaConfigs(),
        ]);

        if (shiftsRes.success) {
          setShifts((prev) =>
            JSON.stringify(prev) !== JSON.stringify(shiftsRes.data) ? shiftsRes.data : prev
          );

          // Extract unique staff members from shifts
          const uniqueStaff = new Map<string, string>();
          shiftsRes.data.forEach((s) => {
            if (s.cashierId && s.cashierName) {
              uniqueStaff.set(s.cashierId, s.cashierName);
            }
          });
          const newStaff = Array.from(uniqueStaff.entries()).map(([id, name]) => ({ id, name }));
          setStaffList((prev) =>
            JSON.stringify(prev) !== JSON.stringify(newStaff) ? newStaff : prev
          );
        }

        if (configsRes.success) {
          setConfigs((prev) =>
            JSON.stringify(prev) !== JSON.stringify(configsRes.data) ? configsRes.data : prev
          );
        }
      } catch (err) {
        console.error('[ModakaLedgerPage] loadData error:', err);
      } finally {
        if (!isBackground) {
          setIsLoading(false);
        }
      }
    },
    [selectedBranchId, selectedDate, selectedCashierId]
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Wire Real-time sync for live bill & shift events silently in the background
  useRealtimePosSync((isBg) => loadData(isBg ?? true));

  // Load catalog products for config modal
  useEffect(() => {
    if (isConfigModalOpen && catalogProducts.length === 0) {
      productsApi.getAll().then((res) => {
        const prods = res.data?.items || [];
        if (prods.length > 0) {
          setCatalogProducts(
            prods.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku || '',
              price: Number(p.retailPrice || 0),
            }))
          );
        }
      });
    }
  }, [isConfigModalOpen, catalogProducts.length]);

  // Quick date shifts
  const shiftDateBy = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Open config modal
  const handleOpenConfigModal = () => {
    setEditingConfigs(
      configs.map((c) => ({
        id: c.id,
        productId: c.productId,
        productName: c.productName,
        sortOrder: c.sortOrder,
        customRate: c.customRate,
        isActive: c.isActive,
      }))
    );
    setConfigSuccessMsg(null);
    setIsConfigModalOpen(true);
  };

  // Save configs
  const handleSaveConfigs = async () => {
    setIsSavingConfigs(true);
    setConfigSuccessMsg(null);
    const res = await shiftsApi.updateModakaConfigs(editingConfigs);
    setIsSavingConfigs(false);

    if (res.success) {
      setConfigSuccessMsg('Special rates & variety configs saved successfully.');
      setTimeout(() => {
        setIsConfigModalOpen(false);
        loadData();
      }, 1000);
    }
  };

  // Summary Metrics across all shifts visible on page
  const metrics = useMemo(() => {
    let totalGrossSales = 0;
    let totalCashSales = 0;
    let totalModakaUnits = 0;
    let totalModakaAmount = 0;
    let totalBanked = 0;
    let netVariance = 0;

    shifts.forEach((s) => {
      totalGrossSales += Number(s.posGrossSales || 0);
      totalCashSales += Number(s.posCashSales || 0);
      totalModakaUnits += Number(s.modakaTotalSoldQty || 0);
      totalModakaAmount += Number(s.modakaTotalAmount || 0);
      totalBanked += Number(s.bankedAmount || 0);
      netVariance += Number(s.cashVariance || 0);
    });

    return {
      shiftCount: shifts.length,
      totalGrossSales,
      totalCashSales,
      totalModakaUnits,
      totalModakaAmount,
      totalBanked,
      netVariance,
    };
  }, [shifts]);

  // Export to CSV
  const handleExportCSV = () => {
    if (shifts.length === 0) return;

    const headers = [
      'Shift Date',
      'Branch',
      'Shift Number',
      'Cashier',
      'Status',
      'Special Item #',
      'Special Item Name',
      'Opening (A)',
      'In (B)',
      'Total Available (C)',
      'Sold (D)',
      'Closing (E)',
      'Applied Rate (LKR)',
      'Total Amount (F)',
      'Opening Float',
      'Declared Shift Sale',
      'Total Cash Available',
      'Goods Purchased Paid',
      'Other Expenses',
      'Expected Cash Before Bank',
      'Counted Drawer Cash',
      'Cash Variance',
      'Banked Amount',
      'Closing Drawer Float',
      'Handover Notes',
    ];

    const rows: string[][] = [];

    shifts.forEach((s) => {
      const entries = s.modakaEntries || [];
      if (entries.length === 0) {
        rows.push([
          s.shiftDate,
          s.branchName || '',
          formatShiftLabel(s.shiftNumber),
          s.cashierName || '',
          s.status,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          s.openingFloat.toFixed(2),
          s.declaredShiftSale.toFixed(2),
          s.totalCashAvailable.toFixed(2),
          s.goodsPurchasedPaid.toFixed(2),
          s.otherExpenses.toFixed(2),
          s.expectedCashBeforeBank.toFixed(2),
          s.countedDrawerCash.toFixed(2),
          s.cashVariance.toFixed(2),
          s.bankedAmount.toFixed(2),
          s.closingDrawerFloat.toFixed(2),
          `"${(s.handoverNotes || '').replace(/"/g, '""')}"`,
        ]);
      } else {
        entries.forEach((e, idx) => {
          rows.push([
            s.shiftDate,
            s.branchName || '',
            formatShiftLabel(s.shiftNumber),
            s.cashierName || '',
            s.status,
            String(idx + 1),
            `"${e.productName || ''}"`,
            String(e.openingQty),
            String(e.inQty),
            String(e.totalAvailableQty),
            String(e.soldQty),
            String(e.closingQty),
            e.appliedRate.toFixed(2),
            e.totalAmount.toFixed(2),
            idx === 0 ? s.openingFloat.toFixed(2) : '',
            idx === 0 ? s.declaredShiftSale.toFixed(2) : '',
            idx === 0 ? s.totalCashAvailable.toFixed(2) : '',
            idx === 0 ? s.goodsPurchasedPaid.toFixed(2) : '',
            idx === 0 ? s.otherExpenses.toFixed(2) : '',
            idx === 0 ? s.expectedCashBeforeBank.toFixed(2) : '',
            idx === 0 ? s.countedDrawerCash.toFixed(2) : '',
            idx === 0 ? s.cashVariance.toFixed(2) : '',
            idx === 0 ? s.bankedAmount.toFixed(2) : '',
            idx === 0 ? s.closingDrawerFloat.toFixed(2) : '',
            idx === 0 ? `"${(s.handoverNotes || '').replace(/"/g, '""')}"` : '',
          ]);
        });
      }
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `deegayu_special_stock_ledger_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Non-Owner Access Guard
  if (!isOwner) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Restricted Access</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The <strong>Shift & Special Stock Ledger</strong> is confidential and strictly accessible to the
            Owner & General Management.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/pos"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5B46F6] text-white text-xs font-bold shadow-md hover:bg-[#4D38E0] transition-colors"
            >
              <span>Return to POS Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 print:p-0 print:space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Special Sales & Stock Summary
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Multi-shift handover records, Special Stock sales ledger, drawer cash & expense breakdown
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleOpenConfigModal}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-600" />
            <span>Edit Special Items & Rates</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={shifts.length === 0}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Branch Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Dispensary Branch
            </label>
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:bg-white focus:outline-none focus:border-purple-500 pr-8"
              >
                <option value="all">All Branches (Consolidated)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Date Picker with Quick Controls */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Ledger Date (Asia/Colombo)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftDateBy(-1)}
                className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors shrink-0"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-bold font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => shiftDateBy(1)}
                className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors shrink-0"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Staff Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Staff Cashier
            </label>
            <div className="relative">
              <select
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:bg-white focus:outline-none focus:border-purple-500 pr-8"
              >
                <option value="all">All Cashiers</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <Users className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Refresh Action */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={isLoading}
              className="w-full py-2 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 print:hidden">
        {/* Metric 1 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Recorded Shifts
          </span>
          <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
            {metrics.shiftCount} Shifts
          </span>
          <span className="text-[10px] text-slate-500">Day & Evening shifts</span>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
            Special Units Sold
          </span>
          <span className="text-xl font-black font-mono text-purple-700 mt-1 block">
            {metrics.totalModakaUnits} units
          </span>
          <span className="text-[10px] text-slate-500">Across active special varieties</span>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">
            Special Sales Value
          </span>
          <span className="text-xl font-black font-mono text-purple-700 mt-1 block">
            LKR {metrics.totalModakaAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-purple-600 font-bold">Total (Σ F)</span>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            POS Gross Sales
          </span>
          <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
            LKR {metrics.totalGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">
            Cash: LKR {metrics.totalCashSales.toFixed(0)}
          </span>
        </div>

        {/* Metric 5 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Banked Amount
          </span>
          <span className="text-xl font-black font-mono text-indigo-700 mt-1 block">
            LKR {metrics.totalBanked.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500">Deposited to company</span>
        </div>

        {/* Metric 6 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Cash Variance
          </span>
          <span
            className={`text-xl font-black font-mono mt-1 block ${
              metrics.netVariance === 0
                ? 'text-slate-800'
                : metrics.netVariance > 0
                ? 'text-emerald-700'
                : 'text-rose-600'
            }`}
          >
            {metrics.netVariance > 0 ? '+' : ''}
            LKR {metrics.netVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span
            className={`text-[10px] font-bold ${
              metrics.netVariance === 0
                ? 'text-slate-500'
                : metrics.netVariance > 0
                ? 'text-emerald-600'
                : 'text-rose-600'
            }`}
          >
            {metrics.netVariance === 0
              ? 'Balanced'
              : metrics.netVariance > 0
              ? 'Net Excess'
              : 'Net Shortage'}
          </span>
        </div>
      </div>

      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h2 className="text-2xl font-black text-slate-900 uppercase">
          Deegayu Weda Madhura (Pvt) Ltd
        </h2>
        <p className="text-sm font-bold text-slate-700">
          Daily Shift Handover & Special Sales Summary
        </p>
        <p className="text-xs text-slate-500 font-mono mt-1">
          Date: {selectedDate} • Generated: {new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}
        </p>
      </div>

      {/* Shifts List: Side-by-Side or Responsive Stacked Shift Cards */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">Loading Shift & Special Stock Ledgers...</h4>
          <p className="text-xs text-slate-400">Fetching records for {selectedDate}</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            No Shift Records Found for {selectedDate}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No cashiers have logged shifts or submitted handover reports for this branch on this date yet. Shifts automatically open when a cashier accesses the POS terminal.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSelectedDate(getTodaySriLanka())}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Jump to Today
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {shifts.map((shift) => {
            const entries = shift.modakaEntries || [];
            let totalModakaValue = 0;
            entries.forEach((e) => (totalModakaValue += e.totalAmount));

            return (
              <div
                key={shift.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden break-inside-avoid print:shadow-none print:border-slate-300"
              >
                {/* Shift Card Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-mono font-black text-xs text-purple-300 shadow-inner px-1 text-center">
                      {formatShiftLabel(shift.shiftNumber)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black tracking-tight text-white">
                          {formatShiftLabel(shift.shiftNumber)} Handover Sheet
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            shift.status === 'closed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          }`}
                        >
                          {shift.status === 'closed' ? 'Closed & Reconciled' : 'In Progress (Open)'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {shift.branchName} • Cashier:{' '}
                        <strong className="text-white">{shift.cashierName}</strong> • Date:{' '}
                        <span className="font-mono">{shift.shiftDate}</span>
                      </p>
                    </div>
                  </div>

                  {/* Telemetry Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs text-xs font-mono text-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase mr-1">POS Sales:</span>
                      <strong>LKR {shift.posGrossSales.toFixed(2)}</strong> ({shift.posTotalBills} bills)
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-400/30 text-xs font-mono text-purple-200">
                      <span className="text-[10px] text-purple-300 uppercase mr-1">Special Sales Total:</span>
                      <strong>LKR {totalModakaValue.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {/* 2-Column Ledger Layout matching Owner's Manual Book */}
                <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
                  {/* LEFT COLUMN: SPECIAL STOCK TABLE (Span 7) */}
                  <div className="xl:col-span-7 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                        <span>Special Stock & Sales Summary</span>
                      </h4>
                      <span className="text-xs font-mono font-bold text-purple-700">
                        Sold: {shift.modakaTotalSoldQty} units
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-2 text-center w-7">#</th>
                            <th className="py-2 px-2.5">Special Item</th>
                            <th className="py-2 px-1.5 text-center w-12">A: Open</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-amber-50 text-amber-900">+ B</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-slate-50">= C</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-purple-50 text-purple-900">- D</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-emerald-50 text-emerald-900">= E</th>
                            <th className="py-2 px-2 text-right w-16">Rate</th>
                            <th className="py-2 px-2.5 text-right w-24 bg-purple-100/60 text-purple-950 font-black">
                              F: Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entries.map((entry, idx) => (
                            <tr key={entry.productId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-2 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2.5">
                                <span className="font-bold text-slate-800 block text-xs">
                                  {entry.productName}
                                </span>
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-600">
                                {entry.openingQty}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono font-bold text-amber-700 bg-amber-50/40">
                                {entry.inQty > 0 ? `+${entry.inQty}` : '0'}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-700 bg-slate-50/40">
                                {entry.totalAvailableQty}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono font-bold text-purple-700 bg-purple-50/40">
                                {entry.soldQty}
                              </td>
                              <td className="py-2 px-1.5 text-center font-mono font-black text-emerald-700 bg-emerald-50/40">
                                {entry.closingQty}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-600">
                                {entry.appliedRate.toFixed(0)}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-black text-purple-900 bg-purple-50/70">
                                {entry.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 text-xs border-t-2 border-slate-300">
                          <tr>
                            <td colSpan={2} className="py-2 px-2.5 uppercase text-[10px] text-slate-600">
                              Totals
                            </td>
                            <td className="py-2 px-1.5 text-center">
                              {entries.reduce((acc, e) => acc + e.openingQty, 0)}
                            </td>
                            <td className="py-2 px-1.5 text-center text-amber-800">
                              +{entries.reduce((acc, e) => acc + e.inQty, 0)}
                            </td>
                            <td className="py-2 px-1.5 text-center">
                              {entries.reduce((acc, e) => acc + e.totalAvailableQty, 0)}
                            </td>
                            <td className="py-2 px-1.5 text-center text-purple-800">
                              {entries.reduce((acc, e) => acc + e.soldQty, 0)}
                            </td>
                            <td className="py-2 px-1.5 text-center text-emerald-800">
                              {entries.reduce((acc, e) => acc + e.closingQty, 0)}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-500">—</td>
                            <td className="py-2 px-2.5 text-right font-black text-purple-950 bg-purple-200/60">
                              LKR {totalModakaValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Bottom Special Sales Value Callout */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-purple-600" />
                        <div>
                          <span className="text-xs font-bold text-purple-950 uppercase tracking-wide block">
                            Special Sales Balance
                          </span>
                          <span className="text-[10px] text-purple-700">
                            Calculated value of special units sold during {formatShiftLabel(shift.shiftNumber)}
                          </span>
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono text-purple-900">
                        LKR {totalModakaValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: EXPENSE SUMMARY (Span 5) */}
                  <div className="xl:col-span-5 p-5 space-y-3.5 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        <span>Shift Expense & Cash Reconciliation</span>
                      </h4>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 divide-y divide-slate-100 text-xs">
                      {/* 1. Opening Float */}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-slate-600">1. Opening Drawer Float</span>
                        <span className="font-mono font-bold text-slate-800">
                          LKR {shift.openingFloat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* 2. Declared Shift Sale */}
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <span className="text-slate-600 block">2. Shift Sale Amount</span>
                          <span className="text-[10px] text-purple-600 font-mono">
                            POS Cash: LKR {shift.posCashSales.toFixed(2)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-purple-700">
                          LKR {shift.declaredShiftSale.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Total Cash Available */}
                      <div className="flex items-center justify-between pt-2 font-bold bg-slate-50/80 p-2 rounded-xl">
                        <span className="text-slate-800">Total Cash Available</span>
                        <span className="font-mono text-slate-950 font-black">
                          LKR {shift.totalCashAvailable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Less: Goods Purchased */}
                      <div className="flex items-center justify-between pt-2 text-rose-700">
                        <span>3. Less: Goods Purchased Paid</span>
                        <span className="font-mono font-bold">
                          - LKR {shift.goodsPurchasedPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Less: Other Expenses */}
                      <div className="flex items-center justify-between pt-2 text-rose-700">
                        <span>4. Less: Other Expenses</span>
                        <span className="font-mono font-bold">
                          - LKR {shift.otherExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Expected Cash */}
                      <div className="flex items-center justify-between pt-2 font-bold bg-amber-50/70 p-2 rounded-xl text-amber-950">
                        <span>Expected Cash Before Bank</span>
                        <span className="font-mono font-black text-amber-900">
                          LKR {shift.expectedCashBeforeBank.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Counted Cash */}
                      <div className="flex items-center justify-between pt-2 text-emerald-800 font-bold">
                        <span>Actual Counted Drawer Cash</span>
                        <span className="font-mono font-black text-emerald-700 text-sm">
                          LKR {shift.countedDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Cash Variance */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl font-bold ${
                          shift.cashVariance === 0
                            ? 'bg-slate-100 text-slate-800'
                            : shift.cashVariance > 0
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        <span>
                          Cash Variance:{' '}
                          {shift.cashVariance === 0
                            ? 'Balanced'
                            : shift.cashVariance > 0
                            ? 'Excess (+)'
                            : 'Shortage (-)'}
                        </span>
                        <span className="font-mono">
                          {shift.cashVariance > 0 ? '+' : ''}
                          LKR {shift.cashVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Banked Amount */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-slate-600">5. Banked Amount</span>
                        <span className="font-mono font-bold text-indigo-700">
                          LKR {shift.bankedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Closing Float for Next Shift */}
                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shadow-2xs">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider block">
                            Closing Drawer Float for Next Shift
                          </span>
                          <span className="text-[9px] text-emerald-100">
                            Carries forward as {formatShiftLabel((shift.shiftNumber || 1) + 1)} Opening Float
                          </span>
                        </div>
                        <span className="text-base font-black font-mono">
                          LKR {shift.closingDrawerFloat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Denominations breakdown if present */}
                      {shift.denominationsJson && Object.keys(shift.denominationsJson).length > 0 && (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Counted Denominations
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(shift.denominationsJson).map(([denom, cnt]) => {
                              const numCnt = Number(cnt);
                              if (numCnt <= 0) return null;
                              return (
                                <span
                                  key={denom}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-medium border border-slate-200"
                                >
                                  {Number(denom).toLocaleString()} × {numCnt}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Handover notes */}
                      {shift.handoverNotes && (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Handover Notes / Remarks
                          </span>
                          <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] whitespace-pre-line leading-relaxed font-sans">
                            {shift.handoverNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modaka Rates & Items Modal (OWNER ONLY) */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-[95vw] max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-white shadow-inner">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    Edit Special Items & Rates
                  </h3>
                  <p className="text-xs text-purple-200">
                    Configure standard selling rates and catalog item mapping
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {configSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{configSuccessMsg}</span>
                </div>
              )}

              <p className="text-xs text-slate-500">
                These items populate the Special Stock Ledger on all cashier terminals. Updating rates here applies to new shift handovers and calculations.
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Catalog Item</th>
                      <th className="py-2.5 px-3 text-right w-32">Rate (LKR)</th>
                      <th className="py-2.5 px-3 text-center w-16">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editingConfigs.map((cfg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {cfg.sortOrder}
                        </td>
                        <td className="py-2.5 px-3">
                          {catalogProducts.length > 0 ? (
                            <select
                              value={cfg.productId}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const prod = catalogProducts.find((p) => p.id === newId);
                                setEditingConfigs((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          productId: newId,
                                          productName: prod?.name || item.productName,
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                            >
                              {catalogProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku || 'No SKU'})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-bold text-slate-800">{cfg.productName}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 font-bold">LKR</span>
                            <input
                              type="number"
                              step="1"
                              value={cfg.customRate}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value) || 0;
                                setEditingConfigs((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, customRate: rate } : item
                                  )
                                );
                              }}
                              className="w-20 px-2 py-1 text-right font-mono font-bold text-xs bg-white border border-purple-300 rounded-lg focus:border-purple-600 focus:outline-none"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={cfg.isActive}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEditingConfigs((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, isActive: checked } : item
                                )
                              );
                            }}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                disabled={isSavingConfigs}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfigs}
                disabled={isSavingConfigs}
                className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSavingConfigs ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Rates...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Special Rates
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
