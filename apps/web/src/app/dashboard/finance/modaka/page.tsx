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
  Clock,
  Copy,
} from 'lucide-react';
import { useTenantBranch } from '../../../../context/tenant-branch-context';
import {
  shiftsApi,
  productsApi,
  formatShiftLabel,
  CashierShiftDto,
  ModakaItemConfigDto,
  sortSpecialStockItems,
  DailySpecialBalanceMatrixResponse,
} from '../../../../lib/api-client';
import { useRealtimePosSync } from '../../../../hooks/use-realtime-pos-sync';
import {
  MotionPageShell,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '../../../../components/ui/motion-primitives';

function getTodaySriLanka(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatShiftTimes(
  startedAt?: string | null,
  endedAt?: string | null,
  status?: string
): { startedText: string; endedText: string; isOvernight: boolean } {
  if (!startedAt) {
    return {
      startedText: 'Started: N/A',
      endedText: status === 'open' ? 'Ended: In Progress' : 'Ended: N/A',
      isOvernight: false,
    };
  }

  const startDate = new Date(startedAt);
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    month: 'short',
    day: 'numeric',
  });

  const colomboDateStr = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const startDay = colomboDateStr(startDate);
  const startTime = timeFormatter.format(startDate);

  if (!endedAt || status === 'open') {
    return {
      startedText: `Started: ${startTime}`,
      endedText: 'Ended: In Progress',
      isOvernight: false,
    };
  }

  const endDate = new Date(endedAt);
  const endDay = colomboDateStr(endDate);
  const endTime = timeFormatter.format(endDate);
  const isOvernight = startDay !== endDay;

  if (isOvernight) {
    const startShortDate = dateFormatter.format(startDate);
    const endShortDate = dateFormatter.format(endDate);
    return {
      startedText: `Started: ${startShortDate}, ${startTime}`,
      endedText: `Ended: ${endShortDate}, ${endTime}`,
      isOvernight: true,
    };
  }

  return {
    startedText: `Started: ${startTime}`,
    endedText: `Ended: ${endTime}`,
    isOvernight: false,
  };
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

  // 11:00 PM Special Balance Matrix state (Owner View)
  const [matrixDate, setMatrixDate] = useState<string>(getTodaySriLanka());
  const [matrixSort, setMatrixSort] = useState<'canonical' | 'stock_desc' | 'stock_asc' | 'name_asc'>('canonical');
  const [matrixData, setMatrixData] = useState<DailySpecialBalanceMatrixResponse | null>(null);
  const [isMatrixLoading, setIsMatrixLoading] = useState<boolean>(true);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Load 11:00 PM matrix data
  const loadMatrixData = useCallback(async (date: string, isBackground = false) => {
    if (!isBackground) setIsMatrixLoading(true);
    try {
      const res = await shiftsApi.getDailySpecialBalanceMatrix(date);
      if (res.success && res.data) {
        setMatrixData(res.data);
      }
    } catch (err) {
      console.error('[ModakaLedgerPage] loadMatrixData error:', err);
    } finally {
      if (!isBackground) setIsMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatrixData(matrixDate, false);
  }, [matrixDate, loadMatrixData]);

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
          const sortedConfigs = sortSpecialStockItems(configsRes.data || []);
          setConfigs((prev) =>
            JSON.stringify(prev) !== JSON.stringify(sortedConfigs) ? sortedConfigs : prev
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
  useRealtimePosSync((isBg) => {
    loadData(isBg ?? true);
    loadMatrixData(matrixDate, true);
  });

  // Load catalog products for config modal
  useEffect(() => {
    if (isConfigModalOpen && catalogProducts.length === 0) {
      productsApi.getAll().then((res) => {
        const prods = res.data?.items || [];
        if (prods.length > 0) {
          setCatalogProducts(
            sortSpecialStockItems(
              prods.map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku || '',
                price: Number(p.retailPrice || 0),
              }))
            )
          );
        }
      });
    }
  }, [isConfigModalOpen, catalogProducts.length]);

  // Quick date shifts for Ledger
  const shiftDateBy = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Quick date shifts for 11:00 PM Matrix
  const shiftMatrixDateBy = (days: number) => {
    const curr = new Date(matrixDate);
    curr.setDate(curr.getDate() + days);
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    setMatrixDate(`${yyyy}-${mm}-${dd}`);
  };

  const getYesterdaySriLanka = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  // Matrix sorting logic
  const sortedMatrixItems = useMemo(() => {
    if (!matrixData?.items) return [];
    const list = [...matrixData.items];
    switch (matrixSort) {
      case 'stock_desc':
        return list.sort((a, b) => b.totalUnits - a.totalUnits);
      case 'stock_asc':
        return list.sort((a, b) => a.totalUnits - b.totalUnits);
      case 'name_asc':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'canonical':
      default:
        return list.sort((a, b) => a.rank - b.rank);
    }
  }, [matrixData?.items, matrixSort]);

  // 1-Tap Copy Summary Handler
  const handleCopyMatrixReport = () => {
    if (!matrixData) return;
    const b = matrixData.branches;
    const text = [
      `*Deegayu Weda Madhura — 11:00 PM Special Stock Balance*`,
      `Date: ${matrixData.targetDate} (Cutoff: 11:00 PM)`,
      ``,
      `Branch Summary:`,
      `• Giriulla: ${b.giriulla.subtitle} — ${b.giriulla.totalUnits.toLocaleString()} units (LKR ${b.giriulla.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
      `• Dambadeniya: ${b.dambadeniya.subtitle} — ${b.dambadeniya.totalUnits.toLocaleString()} units (LKR ${b.dambadeniya.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
      `• Alawwa: ${b.alawwa.subtitle} — ${b.alawwa.totalUnits.toLocaleString()} units (LKR ${b.alawwa.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
      ``,
      `----------------------------------------------------`,
      `# | Special Item | Giriulla | Dambadeniya | Alawwa | All 3 Total`,
      `----------------------------------------------------`,
      ...sortedMatrixItems.map(
        (it) =>
          `#${it.rank} ${it.name} (${it.sku}): GIR: ${it.giriulla} | DAM: ${it.dambadeniya} | ALW: ${it.alawwa} | Total: ${it.totalUnits} units (LKR ${it.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })})`
      ),
      `----------------------------------------------------`,
      `*ALL 3 TOTAL REMAINING STOCK:* ${matrixData.grandTotalUnits.toLocaleString()} units`,
      `*TOTAL RETAIL VALUE:* LKR ${matrixData.grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      ``,
      `Report generated on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    }
  };

  // Open config modal with strict canonical 1-7 sort order
  const handleOpenConfigModal = () => {
    const sorted = sortSpecialStockItems(configs);
    setEditingConfigs(
      sorted.map((c, idx) => ({
        id: c.id,
        productId: c.productId,
        productName: c.productName,
        sortOrder: idx + 1,
        customRate: c.customRate,
        isActive: c.isActive,
      }))
    );
    setConfigSuccessMsg(null);
    setIsConfigModalOpen(true);
  };

  // Save configs enforcing canonical 1-7 sort order
  const handleSaveConfigs = async () => {
    setIsSavingConfigs(true);
    setConfigSuccessMsg(null);
    const configsToSave = editingConfigs.map((c, idx) => ({
      ...c,
      sortOrder: idx + 1,
    }));
    const res = await shiftsApi.updateModakaConfigs(configsToSave);
    setIsSavingConfigs(false);

    if (res.success) {
      setConfigSuccessMsg('Special rates & variety configs saved successfully.');
      setTimeout(() => {
        setIsConfigModalOpen(false);
        loadData(false);
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
      const entries = sortSpecialStockItems(s.modakaEntries || []);
      if (entries.length === 0) {
        rows.push([
          s.shiftDate,
          s.branchName || '',
          formatShiftLabel(s.shiftNumber, s.cashierName),
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
            formatShiftLabel(s.shiftNumber, s.cashierName),
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
    <MotionPageShell className="space-y-6 pb-16 print:p-0 print:space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-[#C026D3] flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <FileSpreadsheet className="w-5 h-5 text-amber-300" />
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
            <Edit3 className="w-3.5 h-3.5 text-[#7C3AED]" />
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

      {/* KPI Highlights Bar (Treasury Palette: Royal Purple, Magenta, Gold) */}
      <MotionStaggerGrid className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 print:hidden">
        {/* Metric 1 */}
        <MotionStaggerItem>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white shadow-lg shadow-purple-500/10 h-full flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-100 block">
                Recorded Shifts
              </span>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                {metrics.shiftCount} Shifts
              </span>
            </div>
            <span className="text-[10px] text-purple-200 mt-2 block">Day & Evening shifts</span>
          </div>
        </MotionStaggerItem>

        {/* Metric 2 */}
        <MotionStaggerItem>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#C026D3] to-[#A21CAF] text-white shadow-lg shadow-fuchsia-500/10 h-full flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-100 block">
                Special Units Sold
              </span>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                {metrics.totalModakaUnits} units
              </span>
            </div>
            <span className="text-[10px] text-fuchsia-200 mt-2 block">Across active varieties</span>
          </div>
        </MotionStaggerItem>

        {/* Metric 3 */}
        <MotionStaggerItem>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EAB308] to-[#CA8A04] text-white shadow-lg shadow-amber-500/10 h-full flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100 block">
                Special Sales Value
              </span>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                LKR {metrics.totalModakaAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[10px] text-amber-100 font-bold mt-2 block">Total Special (Σ F)</span>
          </div>
        </MotionStaggerItem>

        {/* Metric 4 */}
        <MotionStaggerItem>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#059669] to-[#047857] text-white shadow-lg shadow-emerald-500/10 h-full flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 block">
                POS Gross Sales
              </span>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                LKR {metrics.totalGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[10px] text-emerald-100 font-semibold mt-2 block">
              Cash: LKR {metrics.totalCashSales.toFixed(0)}
            </span>
          </div>
        </MotionStaggerItem>

        {/* Metric 5 */}
        <MotionStaggerItem>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#172554] text-white shadow-lg shadow-blue-900/10 h-full flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
                Banked Amount
              </span>
              <span className="text-xl font-black font-mono text-white mt-1 block">
                LKR {metrics.totalBanked.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[10px] text-blue-200 mt-2 block">Deposited to company</span>
          </div>
        </MotionStaggerItem>

        {/* Metric 6 */}
        <MotionStaggerItem>
          <div className={`p-4 rounded-2xl text-white shadow-lg h-full flex flex-col justify-between ${
            metrics.netVariance === 0
              ? 'bg-gradient-to-br from-slate-700 to-slate-800'
              : metrics.netVariance > 0
              ? 'bg-gradient-to-br from-[#059669] to-[#047857]'
              : 'bg-gradient-to-br from-[#E11D48] to-[#BE123C]'
          }`}>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
                Cash Variance
              </span>
              <span className="text-xl font-black font-mono mt-1 block text-white">
                {metrics.netVariance > 0 ? '+' : ''}
                LKR {metrics.netVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                metrics.netVariance === 0
                  ? 'bg-white/20 text-white'
                  : metrics.netVariance > 0
                  ? 'bg-emerald-400/30 text-emerald-100'
                  : 'bg-rose-400/30 text-rose-100'
              }`}>
                {metrics.netVariance === 0 ? '✓ Balanced' : metrics.netVariance > 0 ? '▲ Net Excess' : '▼ Net Shortage'}
              </span>
            </div>
          </div>
        </MotionStaggerItem>
      </MotionStaggerGrid>

      {/* 11:00 PM SPECIAL BALANCE CONSOLIDATED 3-BRANCH MATRIX CARD (OWNER VIEW) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden break-inside-avoid print:border-slate-300">
        {/* Card Header & Controls Bar */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-950 via-purple-950 to-indigo-950 text-white flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/30 shrink-0">
              <Clock className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  11:00 PM Special Balance
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Consolidated 3-Branch Matrix
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Cutoff: 11:00 PM
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                End-of-day remaining stock across Giriulla, Dambadeniya & Alawwa for{' '}
                <strong className="text-white font-mono">{matrixDate}</strong>
              </p>
            </div>
          </div>

          {/* Controls: Date Picker, Quick Toggles, Sorting, and 1-Tap Copy */}
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            {/* Quick Date Toggles: Today / Yesterday */}
            <div className="inline-flex rounded-xl bg-white/10 p-0.5 border border-white/15">
              <button
                type="button"
                onClick={() => setMatrixDate(getTodaySriLanka())}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  matrixDate === getTodaySriLanka()
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setMatrixDate(getYesterdaySriLanka())}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  matrixDate === getYesterdaySriLanka()
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => shiftMatrixDateBy(-1)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={matrixDate}
                onChange={(e) => setMatrixDate(e.target.value)}
                className="px-2 py-0.5 text-xs font-bold font-mono bg-transparent text-white border-none focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => shiftMatrixDateBy(1)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="relative">
              <select
                value={matrixSort}
                onChange={(e) => setMatrixSort(e.target.value as any)}
                className="px-3 py-1.5 text-xs font-bold bg-white/10 border border-white/20 rounded-xl text-slate-200 focus:outline-none focus:bg-slate-900 cursor-pointer"
              >
                <option value="canonical" className="bg-slate-900 text-white">Canonical Order (1 → 7)</option>
                <option value="stock_desc" className="bg-slate-900 text-white">Highest Total Stock (High → Low)</option>
                <option value="stock_asc" className="bg-slate-900 text-white">Lowest Total Stock (Low → High)</option>
                <option value="name_asc" className="bg-slate-900 text-white">Item Name (A → Z)</option>
              </select>
            </div>

            {/* 1-Tap Copy Summary Button */}
            <button
              type="button"
              onClick={handleCopyMatrixReport}
              disabled={!matrixData || sortedMatrixItems.length === 0}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs ${
                copiedReport
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Copy 11:00 PM plain text summary to clipboard"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied Report!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-purple-300" />
                  <span>Copy 11:00 PM Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Matrix Table Body */}
        {isMatrixLoading ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Calculating 11:00 PM balances across Giriulla, Dambadeniya & Alawwa...</p>
          </div>
        ) : !matrixData || sortedMatrixItems.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            No Special Stock configurations found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0F172A] text-white uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  {/* Column 1: # */}
                  <th className="py-3 px-3 text-center w-10">#</th>

                  {/* Column 2: Special Item */}
                  <th className="py-3 px-4 min-w-[220px]">
                    <div>Special Item (Canonical 1–7)</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">Catalog Variety & Standard Rate</div>
                  </th>

                  {/* Column 3: Giriulla */}
                  <th className="py-3 px-4 text-center w-36 bg-slate-900 border-x border-slate-800">
                    <div className="font-extrabold text-white text-xs">Giriulla</div>
                    <div className="text-[10px] font-normal text-purple-300 truncate max-w-[140px] mx-auto mt-0.5">
                      {matrixData.branches.giriulla.subtitle}
                    </div>
                    {matrixData.branches.giriulla.isCarriedForward && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        Carried Forward
                      </span>
                    )}
                  </th>

                  {/* Column 4: Dambadeniya */}
                  <th className="py-3 px-4 text-center w-36 bg-slate-900 border-r border-slate-800">
                    <div className="font-extrabold text-white text-xs">Dambadeniya</div>
                    <div className="text-[10px] font-normal text-purple-300 truncate max-w-[140px] mx-auto mt-0.5">
                      {matrixData.branches.dambadeniya.subtitle}
                    </div>
                    {matrixData.branches.dambadeniya.isCarriedForward && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        Carried Forward
                      </span>
                    )}
                  </th>

                  {/* Column 5: Alawwa */}
                  <th className="py-3 px-4 text-center w-36 bg-slate-900 border-r border-slate-800">
                    <div className="font-extrabold text-white text-xs">Alawwa</div>
                    <div className="text-[10px] font-normal text-purple-300 truncate max-w-[140px] mx-auto mt-0.5">
                      {matrixData.branches.alawwa.subtitle}
                    </div>
                    {matrixData.branches.alawwa.isCarriedForward && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        Carried Forward
                      </span>
                    )}
                  </th>

                  {/* Column 6: All 3 Total */}
                  <th className="py-3 px-4 text-center w-40 bg-gradient-to-r from-purple-950 to-indigo-950 text-white border-l border-purple-800">
                    <div className="font-extrabold text-xs text-amber-300">All 3 Total</div>
                    <div className="text-[10px] font-normal text-purple-200 mt-0.5">
                      Combined Balance
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {sortedMatrixItems.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                    {/* # */}
                    <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">
                      #{item.rank}
                    </td>

                    {/* Special Item */}
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                        <span>{item.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                          {item.sku}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Standard Selling Rate: LKR {item.rate}
                      </span>
                    </td>

                    {/* Giriulla */}
                    <td className="py-2.5 px-4 text-center bg-slate-50/40 border-x border-slate-100">
                      <span
                        className={`inline-flex items-center justify-center min-w-[3.5rem] px-2.5 py-1 rounded-lg text-sm font-black tabular-nums font-mono shadow-2xs ring-1 ${
                          item.giriulla > 50
                            ? 'bg-emerald-50 text-emerald-950 ring-emerald-300'
                            : item.giriulla > 0
                            ? 'bg-amber-50 text-amber-950 ring-amber-300'
                            : 'bg-rose-50 text-rose-900 ring-rose-200'
                        }`}
                      >
                        {item.giriulla}
                      </span>
                    </td>

                    {/* Dambadeniya */}
                    <td className="py-2.5 px-4 text-center bg-slate-50/40 border-r border-slate-100">
                      <span
                        className={`inline-flex items-center justify-center min-w-[3.5rem] px-2.5 py-1 rounded-lg text-sm font-black tabular-nums font-mono shadow-2xs ring-1 ${
                          item.dambadeniya > 50
                            ? 'bg-emerald-50 text-emerald-950 ring-emerald-300'
                            : item.dambadeniya > 0
                            ? 'bg-amber-50 text-amber-950 ring-amber-300'
                            : 'bg-rose-50 text-rose-900 ring-rose-200'
                        }`}
                      >
                        {item.dambadeniya}
                      </span>
                    </td>

                    {/* Alawwa */}
                    <td className="py-2.5 px-4 text-center bg-slate-50/40 border-r border-slate-100">
                      <span
                        className={`inline-flex items-center justify-center min-w-[3.5rem] px-2.5 py-1 rounded-lg text-sm font-black tabular-nums font-mono shadow-2xs ring-1 ${
                          item.alawwa > 50
                            ? 'bg-emerald-50 text-emerald-950 ring-emerald-300'
                            : item.alawwa > 0
                            ? 'bg-amber-50 text-amber-950 ring-amber-300'
                            : 'bg-rose-50 text-rose-900 ring-rose-200'
                        }`}
                      >
                        {item.alawwa}
                      </span>
                    </td>

                    {/* All 3 Total */}
                    <td className="py-2.5 px-4 text-center bg-purple-50/60 border-l border-purple-100">
                      <div className="inline-flex items-center justify-center min-w-[4rem] px-3 py-1 rounded-xl bg-purple-600 text-white font-mono font-black text-sm shadow-xs tabular-nums">
                        {item.totalUnits}
                      </div>
                      <div className="text-[10px] text-purple-900 font-mono font-bold mt-0.5">
                        LKR {item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Bottom Accounting Summary Row with Double-Underline Styling */}
              <tfoot className="border-t-2 border-b-4 border-double border-slate-400 bg-slate-100 text-slate-900">
                {/* 1. Total Units Row */}
                <tr>
                  <td colSpan={2} className="py-3 px-4 font-black uppercase text-xs tracking-wider text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-purple-600" />
                      <span>Total Remaining Units (11:00 PM)</span>
                    </div>
                  </td>
                  {/* Giriulla Total Units */}
                  <td className="py-3 px-4 text-center border-x border-slate-300">
                    <span className="font-mono font-black text-base text-slate-900">
                      {matrixData.branches.giriulla.totalUnits.toLocaleString()} units
                    </span>
                  </td>
                  {/* Dambadeniya Total Units */}
                  <td className="py-3 px-4 text-center border-r border-slate-300">
                    <span className="font-mono font-black text-base text-slate-900">
                      {matrixData.branches.dambadeniya.totalUnits.toLocaleString()} units
                    </span>
                  </td>
                  {/* Alawwa Total Units */}
                  <td className="py-3 px-4 text-center border-r border-slate-300">
                    <span className="font-mono font-black text-base text-slate-900">
                      {matrixData.branches.alawwa.totalUnits.toLocaleString()} units
                    </span>
                  </td>
                  {/* All 3 Total Combined Units */}
                  <td className="py-3 px-4 text-center bg-purple-200/80 border-l border-purple-300">
                    <span className="inline-flex items-center justify-center bg-purple-700 text-white font-mono font-black text-base px-3.5 py-1 rounded-xl shadow-xs">
                      {matrixData.grandTotalUnits.toLocaleString()} units
                    </span>
                  </td>
                </tr>

                {/* 2. Total Retail Stock Value Row */}
                <tr className="bg-slate-50 border-t border-slate-200 text-[11px]">
                  <td colSpan={2} className="py-2 px-4 font-bold text-slate-600 uppercase tracking-wide">
                    Total Retail Stock Value (LKR)
                  </td>
                  {/* Giriulla Value */}
                  <td className="py-2 px-4 text-center font-mono font-bold text-slate-700 border-x border-slate-200">
                    LKR {matrixData.branches.giriulla.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  {/* Dambadeniya Value */}
                  <td className="py-2 px-4 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                    LKR {matrixData.branches.dambadeniya.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  {/* Alawwa Value */}
                  <td className="py-2 px-4 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                    LKR {matrixData.branches.alawwa.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  {/* All 3 Total Combined Value */}
                  <td className="py-2 px-4 text-center font-mono font-black text-purple-950 bg-purple-100/70 border-l border-purple-200">
                    LKR {matrixData.grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
            const entries = sortSpecialStockItems(shift.modakaEntries || []);
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
                    <span className="w-auto px-2.5 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-mono font-bold text-xs text-purple-300 shadow-inner text-center">
                      {shift.cashierName ? `Cashier: ${shift.cashierName}` : 'Cashier Shift'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black tracking-tight text-white">
                          {shift.cashierName ? `Shift Handover: ${shift.cashierName}` : 'Cashier Shift Handover'}
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
                      {(() => {
                        const { startedText, endedText, isOvernight } = formatShiftTimes(
                          shift.startedAt || (shift as any).openedAt,
                          shift.endedAt,
                          shift.status
                        );
                        return (
                          <div className="flex items-center gap-2 flex-wrap pt-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-white/10 text-slate-200 border border-white/15 backdrop-blur-xs">
                              <Clock className="w-3 h-3 text-purple-300 shrink-0" />
                              <span>{startedText}</span>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium border backdrop-blur-xs ${
                                shift.status === 'open'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                                  : isOvernight
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-400/30'
                                  : 'bg-white/10 text-slate-200 border-white/15'
                              }`}
                            >
                              <Clock
                                className={`w-3 h-3 shrink-0 ${
                                  shift.status === 'open'
                                    ? 'text-amber-400'
                                    : isOvernight
                                    ? 'text-rose-400'
                                    : 'text-purple-300'
                                }`}
                              />
                              <span>{endedText}</span>
                              {isOvernight && (
                                <span className="ml-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/40">
                                  Overnight
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })()}
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
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                        <span>Special Stock & Sales Summary</span>
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">
                          Sold: {shift.modakaTotalSoldQty} units
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full shadow-2xs">
                          Remaining Balance: {entries.reduce((acc, e) => acc + e.closingQty, 0)} units
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#0F172A] text-white uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-2 text-center w-7">#</th>
                            <th className="py-2 px-2.5">Special Item</th>
                            <th className="py-2 px-1.5 text-center w-12">A: Open</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-amber-50 text-amber-900">+ B</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-slate-50">= C</th>
                            <th className="py-2 px-1.5 text-center w-12 bg-purple-50 text-purple-900">- D</th>
                            <th className="py-2.5 px-2 text-center w-24 bg-emerald-600 text-white font-extrabold tracking-wide shadow-xs border-x border-emerald-700">
                              = E (BAL)
                            </th>
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
                              <td className="py-2 px-1.5 text-center bg-emerald-50/60 border-x border-emerald-100/80">
                                <span
                                  className={`inline-flex items-center justify-center min-w-[3.5rem] px-3 py-1 rounded-lg text-base font-black tabular-nums shadow-sm ring-1 ${
                                    entry.closingQty > 20
                                      ? 'bg-emerald-100 text-emerald-950 ring-emerald-400/80'
                                      : entry.closingQty > 0
                                      ? 'bg-amber-100 text-amber-950 ring-amber-400/80'
                                      : 'bg-rose-100 text-rose-900 ring-rose-400/80'
                                  }`}
                                >
                                  {entry.closingQty}
                                </span>
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
                            <td className="py-2.5 px-1.5 text-center bg-emerald-50 border-x border-emerald-200">
                              <span className="inline-flex items-center justify-center bg-emerald-600 text-white text-lg font-black px-4 py-1.5 rounded-xl shadow-md tabular-nums">
                                {entries.reduce((acc, e) => acc + e.closingQty, 0)}
                              </span>
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
                            Calculated value of special units sold during this shift
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
                          {Number(shift.ownerBillsCount || 0) > 0 && (
                            <span className="text-[10px] text-amber-800 font-semibold block mt-0.5">
                              Includes {shift.ownerBillsCount} Owner-issued bill(s): LKR {Number(shift.ownerBillsTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          )}
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
                            Carries forward as Next Shift Opening Float
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
                  <thead className="bg-[#0F172A] text-white uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
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
    </MotionPageShell>
  );
}
