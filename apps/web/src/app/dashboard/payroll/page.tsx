'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Coins,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Printer,
  Search,
  FileText,
  Check,
  X,
  Zap,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import {
  payrollRunsApi,
  payrollEmployeesApi,
  DetailedPayrollRun,
} from '../../../lib/payroll-api';
import { roundCurrency } from '../../../lib/payroll-calculator';

// Format currency into Sri Lankan Rupees (e.g. "Rs. 45,200.00")
function formatLKR(val: number | undefined | null): string {
  const num = Number(val || 0);
  return 'Rs. ' + num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getColomboCurrentMonth(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
    });
    return formatter.format(now);
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

function formatMonthLabel(monthYear: string): string {
  if (!monthYear) return '';
  const [yStr, mStr] = monthYear.split('-');
  const y = parseInt(yStr || '2026', 10);
  const m = parseInt(mStr || '1', 10) - 1;
  const date = new Date(y, m, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function MonthlyPayrollDashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(getColomboCurrentMonth);
  const [runs, setRuns] = useState<DetailedPayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PAID'>('ALL');

  // Editable row states for Advances/Deductions
  const [editingAdvances, setEditingAdvances] = useState<{ [runId: string]: string }>({});
  const [savingRunId, setSavingRunId] = useState<string | null>(null);

  // Printable Salary Slip Modal state
  const [selectedSlipRun, setSelectedSlipRun] = useState<DetailedPayrollRun | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Shortage check state per employee
  const [pullingShortageId, setPullingShortageId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  }, []);

  // 1. Load Payroll Runs for Selected Month
  const loadMonthData = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      try {
        const data = await payrollRunsApi.getByMonth(selectedMonth);
        setRuns(data);

        // Pre-fill local editable advances state
        const advancesMap: { [runId: string]: string } = {};
        data.forEach((r) => {
          if (r.id) {
            advancesMap[r.id] = (r.advances_deducted || 0).toString();
          }
        });
        setEditingAdvances(advancesMap);
      } catch (err: any) {
        console.error('[MonthlyPayroll] Load error:', err);
        showToast('Error loading payroll runs. Please try again.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedMonth, showToast]
  );

  useEffect(() => {
    loadMonthData(false);
  }, [loadMonthData]);

  // 2. Month Navigation Handlers
  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr || '2026', 10);
    let m = parseInt(mStr || '1', 10);
    if (m === 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr || '2026', 10);
    let m = parseInt(mStr || '1', 10);
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  // 3. Batch Calculate / Refresh Monthly Payroll
  const handleCalculateAll = async () => {
    setIsCalculating(true);
    try {
      const activeEmps = await payrollEmployeesApi.getAll('ACTIVE');
      if (activeEmps.length === 0) {
        showToast('No active employees registered to calculate.');
        return;
      }

      await payrollRunsApi.generateAllForMonth(selectedMonth);
      await loadMonthData(true);
      showToast(`Payroll calculated successfully for ${formatMonthLabel(selectedMonth)}.`);
    } catch (err: any) {
      console.error('[MonthlyPayroll] Calculation failed:', err);
      alert(`Calculation error: ${err.message || 'Check database connection'}`);
    } finally {
      setIsCalculating(false);
    }
  };

  // 4. Update Advance / Deduction inline
  const handleAdvanceChange = (runId: string, val: string) => {
    setEditingAdvances((prev) => ({
      ...prev,
      [runId]: val,
    }));
  };

  const handleSaveAdvance = async (run: DetailedPayrollRun) => {
    if (!run.id) return;
    const rawVal = editingAdvances[run.id] ?? `${run.advances_deducted || 0}`;
    const newAdvance = Math.max(0, parseFloat(rawVal) || 0);

    const grossPay =
      Number(run.base_pay || 0) +
      Number(run.holiday_pay || 0) +
      Number(run.normal_ot_pay || 0) +
      Number(run.double_ot_pay || 0);

    const employeeEpf8 = Number(run.employee_epf_8 || 0);
    const newNetSalary = roundCurrency(Math.max(0, grossPay - employeeEpf8 - newAdvance));

    setSavingRunId(run.id);
    try {
      await payrollRunsApi.updateAdvances(run.id, newAdvance, newNetSalary);
      // Update local runs state directly
      setRuns((prev) =>
        prev.map((item) =>
          item.id === run.id
            ? {
                ...item,
                advances_deducted: newAdvance,
                net_salary: newNetSalary,
              }
            : item
        )
      );
      showToast(`Advances updated for ${run.employee_name || 'employee'}.`);
    } catch (err: any) {
      console.error('[MonthlyPayroll] Failed to save advances:', err);
      alert(`Failed to save advance: ${err.message}`);
    } finally {
      setSavingRunId(null);
    }
  };

  // 5. Pull POS Shortages Helper
  const handlePullShortages = async (run: DetailedPayrollRun) => {
    if (!run.id || !run.employee_name) return;
    setPullingShortageId(run.id);

    try {
      const res = await payrollRunsApi.getPendingShortages(run.employee_name, selectedMonth);
      if (res.totalShortage > 0) {
        const rounded = roundCurrency(res.totalShortage);
        setEditingAdvances((prev) => ({
          ...prev,
          [run.id!]: rounded.toString(),
        }));

        const grossPay =
          Number(run.base_pay || 0) +
          Number(run.holiday_pay || 0) +
          Number(run.normal_ot_pay || 0) +
          Number(run.double_ot_pay || 0);
        const employeeEpf8 = Number(run.employee_epf_8 || 0);
        const newNetSalary = roundCurrency(Math.max(0, grossPay - employeeEpf8 - rounded));

        await payrollRunsApi.updateAdvances(run.id, rounded, newNetSalary);
        setRuns((prev) =>
          prev.map((item) =>
            item.id === run.id
              ? {
                  ...item,
                  advances_deducted: rounded,
                  net_salary: newNetSalary,
                }
              : item
          )
        );

        showToast(
          `Detected ${formatLKR(rounded)} in recorded shift shortages for ${run.employee_name}.`
        );
      } else {
        showToast(`No pending cash shortages found for ${run.employee_name} in this month.`);
      }
    } catch (err: any) {
      console.error('[MonthlyPayroll] Shortage check failed:', err);
      showToast('Could not query shift shortages.');
    } finally {
      setPullingShortageId(null);
    }
  };

  // 6. Status Toggle (DRAFT <-> PAID)
  const handleToggleStatus = async (run: DetailedPayrollRun) => {
    if (!run.id) return;
    const nextStatus = run.status === 'PAID' ? 'DRAFT' : 'PAID';

    try {
      await payrollRunsApi.updateStatus(run.id, nextStatus);
      setRuns((prev) =>
        prev.map((item) => (item.id === run.id ? { ...item, status: nextStatus } : item))
      );
      showToast(`Marked ${run.employee_name} as ${nextStatus}.`);
    } catch (err: any) {
      console.error('[MonthlyPayroll] Status update failed:', err);
      alert(`Could not update status: ${err.message}`);
    }
  };

  // 7. Open Salary Slip Modal
  const handleOpenSalarySlip = (run: DetailedPayrollRun) => {
    setSelectedSlipRun(run);
    setIsSlipModalOpen(true);
  };

  // 8. Trigger Print
  const handlePrintSlip = () => {
    window.print();
  };

  // 9. Executive KPI Calculations
  const kpiStats = useMemo(() => {
    let totalNetPayable = 0;
    let totalEmployeeEpf8 = 0;
    let totalEmployerEpf12 = 0;
    let totalEmployerEtf3 = 0;
    let totalAdvances = 0;
    let totalGrossPay = 0;

    runs.forEach((r) => {
      const gross =
        Number(r.base_pay || 0) +
        Number(r.holiday_pay || 0) +
        Number(r.normal_ot_pay || 0) +
        Number(r.double_ot_pay || 0);

      totalGrossPay += gross;
      totalNetPayable += Number(r.net_salary || 0);
      totalEmployeeEpf8 += Number(r.employee_epf_8 || 0);
      totalEmployerEpf12 += Number(r.employer_epf_12 || 0);
      totalEmployerEtf3 += Number(r.employer_etf_3 || 0);
      totalAdvances += Number(r.advances_deducted || 0);
    });

    const totalCFormRemittance20 = roundCurrency(totalEmployeeEpf8 + totalEmployerEpf12);
    const totalCompanyOutflow = roundCurrency(totalGrossPay + totalEmployerEpf12 + totalEmployerEtf3);

    return {
      totalNetPayable: roundCurrency(totalNetPayable),
      totalEmployeeEpf8: roundCurrency(totalEmployeeEpf8),
      totalEmployerEpf12: roundCurrency(totalEmployerEpf12),
      totalEmployerEtf3: roundCurrency(totalEmployerEtf3),
      totalCFormRemittance20,
      totalCompanyOutflow,
      totalAdvances: roundCurrency(totalAdvances),
      totalGrossPay: roundCurrency(totalGrossPay),
    };
  }, [runs]);

  // 10. Filtered Runs for Table
  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (r.employee_name || '').toLowerCase().includes(q);
        const matchesCode = (r.emp_code || '').toLowerCase().includes(q);
        const matchesBranch = (r.branch_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesBranch) return false;
      }
      return true;
    });
  }, [runs, statusFilter, searchQuery]);

  // Max Company Cost across employees for relative bar scaling in chart
  const maxCompanyCost = useMemo(() => {
    if (runs.length === 0) return 1;
    return Math.max(...runs.map((r) => Number(r.total_company_cost || 1)), 1);
  }, [runs]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-250 no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Strict @media print CSS: Ensures only #printable-salary-slip is printed */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav,
          header,
          aside,
          .no-print,
          button,
          input,
          footer {
            display: none !important;
          }
          #printable-salary-slip,
          #printable-salary-slip * {
            visibility: visible !important;
          }
          #printable-salary-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px 32px !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Obsidian Header Banner */}
      <div className="bg-[#0F172A] text-white border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Deegayu Weda Madhura
                </span>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-slate-400 text-xs font-medium">
                  Payroll & Human Resources Desk
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Coins className="w-8 h-8 text-emerald-400" />
                Monthly Payroll & Remittances
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                Execute monthly salary runs, inspect Sri Lanka statutory EPF/ETF (20% C-Form) company outflows, deduct shift cash shortages, and issue printable employee salary slips.
              </p>
            </div>

            {/* Top Toolbar: Month Picker & Calculate Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Month Selector Pill */}
              <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 shadow-inner">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 px-3 py-1">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => loadMonthData(true)}
                disabled={isRefreshing || loading}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Primary Batch Calculation Button */}
              <button
                type="button"
                onClick={handleCalculateAll}
                disabled={isCalculating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
              >
                {isCalculating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-emerald-200" />
                    <span>Calculate Monthly Payroll</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 no-print">
        {/* ==================================================================== */}
        {/* EXECUTIVE KPI STRIP                                                  */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* 1. Total Net Salary Payable */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Net Salary Payable
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Coins className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 tracking-tight">
              {formatLKR(kpiStats.totalNetPayable)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Direct employee take-home cash</p>
          </div>

          {/* 2. Employee EPF (8%) */}
          <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Employee EPF (8%)
              </span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-extrabold text-[10px]">
                8%
              </span>
            </div>
            <div className="text-xl font-extrabold text-blue-700 tracking-tight">
              {formatLKR(kpiStats.totalEmployeeEpf8)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Deducted from gross wages</p>
          </div>

          {/* 3. Employer EPF (12%) */}
          <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Employer EPF (12%)
              </span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-extrabold text-[10px]">
                12%
              </span>
            </div>
            <div className="text-xl font-extrabold text-indigo-700 tracking-tight">
              {formatLKR(kpiStats.totalEmployerEpf12)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Company statutory contribution</p>
          </div>

          {/* 4. Employer ETF (3%) */}
          <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Employer ETF (3%)
              </span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 font-extrabold text-[10px]">
                3%
              </span>
            </div>
            <div className="text-xl font-extrabold text-amber-700 tracking-tight">
              {formatLKR(kpiStats.totalEmployerEtf3)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Company statutory contribution</p>
          </div>

          {/* 5. Total C-Form Remittance (20%) */}
          <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                C-Form Total (20%)
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-extrabold text-[10px] border border-purple-200">
                8 + 12 = 20%
              </span>
            </div>
            <div className="text-xl font-extrabold text-purple-800 tracking-tight">
              {formatLKR(kpiStats.totalCFormRemittance20)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total EPF Department remittance</p>
          </div>

          {/* 6. Total Company Outflow */}
          <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Company Outflow
              </span>
              <span className="p-1.5 rounded-lg bg-slate-800 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl font-extrabold text-white tracking-tight">
              {formatLKR(kpiStats.totalCompanyOutflow)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Gross Wages + 15% EPF/ETF</p>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* HR COMPANY PAYOUT CHART                                              */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  HR Company Payout & Remittance Breakdown ({formatMonthLabel(selectedMonth)})
                </h2>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Stacked visual representation of Net Salary, Employer EPF (12%), and Employer ETF (3%) per employee.
              </p>
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-slate-600">Net Take-Home Salary</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-indigo-500" />
                <span className="text-slate-600">Company EPF (12%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-amber-500" />
                <span className="text-slate-600">Company ETF (3%)</span>
              </div>
            </div>
          </div>

          {runs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Payroll Runs Generated Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Click &quot;Calculate Monthly Payroll&quot; above to process attendance records and calculate statutory EPF/ETF contributions for {formatMonthLabel(selectedMonth)}.
              </p>
              <button
                type="button"
                onClick={handleCalculateAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Calculate Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((r) => {
                const net = Number(r.net_salary || 0);
                const epf12 = Number(r.employer_epf_12 || 0);
                const etf3 = Number(r.employer_etf_3 || 0);
                const empCost = Number(r.total_company_cost || net + epf12 + etf3);

                // Relative bar length compared to the max cost in this month
                const relativeWidthPct = Math.min(100, Math.max(10, (empCost / maxCompanyCost) * 100));

                const netPct = empCost > 0 ? (net / empCost) * 100 : 0;
                const epfPct = empCost > 0 ? (epf12 / empCost) * 100 : 0;
                const etfPct = empCost > 0 ? (etf3 / empCost) * 100 : 0;

                return (
                  <div key={r.id || r.employee_id} className="group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs mb-1.5 gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {r.employee_name || 'Staff Member'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">
                          {r.emp_code}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          • {r.branch_name || 'Main Dispensary'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-semibold">
                        <span className="text-slate-500">
                          Total Outflow:{' '}
                          <span className="text-slate-900 font-bold">{formatLKR(empCost)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Stacked Bar */}
                    <div className="w-full bg-slate-100 rounded-lg h-5 overflow-hidden flex shadow-inner">
                      <div
                        style={{ width: `${relativeWidthPct}%` }}
                        className="h-full flex transition-all duration-300"
                      >
                        <div
                          style={{ width: `${netPct}%` }}
                          className="bg-emerald-500 hover:bg-emerald-600 transition-colors h-full flex items-center justify-center text-[10px] text-white font-bold px-1 overflow-hidden"
                          title={`Net Salary: ${formatLKR(net)} (${netPct.toFixed(1)}%)`}
                        >
                          {netPct > 20 && <span>{formatLKR(net)}</span>}
                        </div>
                        <div
                          style={{ width: `${epfPct}%` }}
                          className="bg-indigo-500 hover:bg-indigo-600 transition-colors h-full flex items-center justify-center text-[10px] text-white font-bold px-1 overflow-hidden"
                          title={`Employer EPF (12%): ${formatLKR(epf12)} (${epfPct.toFixed(1)}%)`}
                        >
                          {epfPct > 12 && <span>{formatLKR(epf12)}</span>}
                        </div>
                        <div
                          style={{ width: `${etfPct}%` }}
                          className="bg-amber-500 hover:bg-amber-600 transition-colors h-full flex items-center justify-center text-[10px] text-white font-bold px-1 overflow-hidden"
                          title={`Employer ETF (3%): ${formatLKR(etf3)} (${etfPct.toFixed(1)}%)`}
                        >
                          {etfPct > 8 && <span>{formatLKR(etf3)}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Subtext info */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 pl-0.5">
                      <span className="text-emerald-700 font-medium">Take-Home: {formatLKR(net)}</span>
                      <span>•</span>
                      <span className="text-indigo-700 font-medium">EPF 12%: {formatLKR(epf12)}</span>
                      <span>•</span>
                      <span className="text-amber-700 font-medium">ETF 3%: {formatLKR(etf3)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* MONTHLY PAYROLL LEDGER TABLE                                         */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Monthly Payroll Ledger & Deduction Control
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review work days, regular & double overtime hours, adjust cash advances/shortages, and print official slips.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff name, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-52"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Statuses ({runs.length})</option>
                <option value="DRAFT">Draft Only</option>
                <option value="PAID">Paid Only</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-3">Days Worked</th>
                  <th className="py-3.5 px-3">Overtime</th>
                  <th className="py-3.5 px-4">Gross Earnings</th>
                  <th className="py-3.5 px-3">EPF 8%</th>
                  <th className="py-3.5 px-3">Advances / Shortages</th>
                  <th className="py-3.5 px-4">Net Salary</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Loading monthly payroll ledger...
                    </td>
                  </tr>
                ) : filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No payroll records found for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => {
                    const gross =
                      Number(run.base_pay || 0) +
                      Number(run.holiday_pay || 0) +
                      Number(run.normal_ot_pay || 0) +
                      Number(run.double_ot_pay || 0);

                    const isSavingThis = savingRunId === run.id;
                    const isPullingThis = pullingShortageId === run.id;
                    const isPaid = run.status === 'PAID';

                    return (
                      <tr
                        key={run.id || run.employee_id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Employee Details */}
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">
                            {run.employee_name || 'Staff Member'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-slate-500">
                              {run.emp_code}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {run.salary_type || 'DAILY'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {run.branch_name || 'Main Dispensary'}
                          </div>
                        </td>

                        {/* Days Worked */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-800">
                            {Number(run.normal_days_worked || 0) +
                              Number(run.holiday_days_worked || 0)}{' '}
                            days
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Reg: {run.normal_days_worked} | Hol: {run.holiday_days_worked}
                          </div>
                        </td>

                        {/* Overtime */}
                        <td className="py-3.5 px-3">
                          <div className="text-slate-800">
                            <span className="font-bold">{run.total_normal_ot_hours || 0}h</span>{' '}
                            <span className="text-[10px] text-slate-500">(1.5x)</span>
                          </div>
                          <div className="text-slate-800">
                            <span className="font-bold text-amber-700">
                              {run.total_double_ot_hours || 0}h
                            </span>{' '}
                            <span className="text-[10px] text-amber-600">(2.0x)</span>
                          </div>
                        </td>

                        {/* Gross Earnings Breakdown */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{formatLKR(gross)}</div>
                          <div className="text-[10px] text-slate-500 space-y-0.5 mt-0.5">
                            <div>Base: {formatLKR(run.base_pay)}</div>
                            {Number(run.holiday_pay || 0) > 0 && (
                              <div className="text-indigo-600">
                                Hol: {formatLKR(run.holiday_pay)}
                              </div>
                            )}
                            {(Number(run.normal_ot_pay || 0) > 0 ||
                              Number(run.double_ot_pay || 0) > 0) && (
                              <div className="text-emerald-700">
                                OT: {formatLKR(Number(run.normal_ot_pay || 0) + Number(run.double_ot_pay || 0))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Employee EPF 8% */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-blue-700">
                            {formatLKR(run.employee_epf_8)}
                          </div>
                          <div className="text-[10px] text-slate-400">8% Deducted</div>
                        </td>

                        {/* Advances / Deductions Input + Shortage Button */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="relative w-28">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">
                                Rs.
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={editingAdvances[run.id || ''] ?? (run.advances_deducted || 0)}
                                onChange={(e) => handleAdvanceChange(run.id || '', e.target.value)}
                                onBlur={() => handleSaveAdvance(run)}
                                className="w-full pl-7 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>

                            {/* Pull Shortage Helper Button */}
                            <button
                              type="button"
                              onClick={() => handlePullShortages(run)}
                              disabled={isPullingThis}
                              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                              title="Pull recorded POS shift cash shortages for this staff member"
                            >
                              <Zap className={`w-3.5 h-3.5 ${isPullingThis ? 'animate-bounce' : ''}`} />
                            </button>

                            {/* Save button */}
                            <button
                              type="button"
                              onClick={() => handleSaveAdvance(run)}
                              disabled={isSavingThis}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                              title="Save advance / deduction"
                            >
                              {isSavingThis ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Shift shortages & salary advances
                          </div>
                        </td>

                        {/* Net Salary Payable */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-sm tracking-tight">
                            {formatLKR(run.net_salary)}
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(run)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all active:scale-95 border ${
                              isPaid
                                ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Paid</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Draft</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions: Print Salary Slip */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenSalarySlip(run)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-all active:scale-95"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>Salary Slip</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* OFFICIAL PRINTABLE SALARY SLIP MODAL                                 */}
      {/* ==================================================================== */}
      {isSlipModalOpen && selectedSlipRun && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Action Bar (Hidden on Print) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Official Salary Slip Preview • {selectedSlipRun.employee_name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-md transition-colors"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Print Slip Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSlipModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINT CONTAINER (#printable-salary-slip) */}
            <div
              id="printable-salary-slip"
              className="p-8 sm:p-10 bg-white text-slate-900 page-break-avoid"
            >
              {/* Official Letterhead */}
              <div className="text-center pb-6 border-b-2 border-slate-900 mb-6">
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-slate-950 font-serif">
                  DEEGAYU WEDA MADHURA
                </h1>
                <p className="text-xs font-bold text-slate-700 tracking-wide mt-1">
                  Ayurvedic Medical Center & Herbal Pharmaceuticals
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Registered Ayurvedic Dispensary • Sri Lanka • Official Remittance Advice
                </p>
                <div className="mt-3 inline-block px-4 py-1 rounded-full border border-slate-800 text-xs font-black uppercase tracking-widest text-slate-900">
                  MONTHLY SALARY SLIP — {formatMonthLabel(selectedSlipRun.month_year).toUpperCase()}
                </div>
              </div>

              {/* Employee & Pay Details Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs border border-slate-200 rounded-xl p-4 bg-slate-50/50 mb-6">
                <div>
                  <span className="text-slate-500 font-medium">Employee Name:</span>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {selectedSlipRun.employee_name}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Employee Code:</span>
                  <div className="font-mono font-bold text-slate-900">
                    {selectedSlipRun.emp_code}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">National Identity Card (NIC):</span>
                  <div className="font-medium text-slate-800">
                    {selectedSlipRun.employee_nic || 'N/A on file'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Assigned Branch / Location:</span>
                  <div className="font-bold text-slate-800">
                    {selectedSlipRun.branch_name || 'Main Dispensary'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Remuneration Structure:</span>
                  <div className="font-semibold text-slate-800">
                    {selectedSlipRun.salary_type === 'DAILY'
                      ? `DAILY WAGE (Normal: Rs. ${selectedSlipRun.normal_daily_rate?.toFixed(2)} | Holiday: Rs. ${selectedSlipRun.holiday_daily_rate?.toFixed(2)})`
                      : `MONTHLY SALARY (Basic: Rs. ${selectedSlipRun.basic_salary?.toFixed(2)})`}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Payment Status:</span>
                  <div className="font-bold">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase ${
                        selectedSlipRun.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {selectedSlipRun.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attendance & Shift Breakdown Strip */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs border border-slate-200 rounded-xl p-3 bg-white mb-6">
                <div className="border-r border-slate-100 pr-2">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Normal Days
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {selectedSlipRun.normal_days_worked}
                  </div>
                </div>
                <div className="border-r border-slate-100 px-2">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Holiday Days
                  </div>
                  <div className="font-extrabold text-indigo-700 text-sm">
                    {selectedSlipRun.holiday_days_worked}
                  </div>
                </div>
                <div className="border-r border-slate-100 px-2">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Normal OT (1.5x)
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {selectedSlipRun.total_normal_ot_hours} hrs
                  </div>
                </div>
                <div className="pl-2">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Double OT (2.0x)
                  </div>
                  <div className="font-extrabold text-amber-700 text-sm">
                    {selectedSlipRun.total_double_ot_hours} hrs
                  </div>
                </div>
              </div>

              {/* Side-by-Side Itemized Earnings & Deductions */}
              <div className="grid grid-cols-2 gap-6 text-xs mb-6">
                {/* Earnings Column */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                    Earnings
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Base / Normal Pay</span>
                      <span className="font-semibold text-slate-900">
                        {formatLKR(selectedSlipRun.base_pay)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Holiday Shift Pay</span>
                      <span className="font-semibold text-slate-900">
                        {formatLKR(selectedSlipRun.holiday_pay)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Normal Overtime (1.5x)</span>
                      <span className="font-semibold text-slate-900">
                        {formatLKR(selectedSlipRun.normal_ot_pay)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Double Overtime (2.0x)</span>
                      <span className="font-semibold text-slate-900">
                        {formatLKR(selectedSlipRun.double_ot_pay)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 font-extrabold text-slate-950 text-sm">
                      <span>Total Gross Earnings</span>
                      <span>
                        {formatLKR(
                          Number(selectedSlipRun.base_pay || 0) +
                            Number(selectedSlipRun.holiday_pay || 0) +
                            Number(selectedSlipRun.normal_ot_pay || 0) +
                            Number(selectedSlipRun.double_ot_pay || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                    Deductions
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Employee EPF Contribution (8%)</span>
                      <span className="font-semibold text-rose-600">
                        {formatLKR(selectedSlipRun.employee_epf_8)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Advances / Shortage Deductions</span>
                      <span className="font-semibold text-rose-600">
                        {formatLKR(selectedSlipRun.advances_deducted)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 font-extrabold text-rose-700 text-sm">
                      <span>Total Deductions</span>
                      <span>
                        {formatLKR(
                          Number(selectedSlipRun.employee_epf_8 || 0) +
                            Number(selectedSlipRun.advances_deducted || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bold Net Salary Box */}
              <div className="border-2 border-emerald-600 bg-emerald-50/60 rounded-xl p-4 flex items-center justify-between mb-6">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    Net Salary Payable
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    Net cash / bank transfer amount for {formatMonthLabel(selectedSlipRun.month_year)}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight">
                  {formatLKR(selectedSlipRun.net_salary)}
                </div>
              </div>

              {/* Statutory Employer Contributions Footnote */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-[11px] text-slate-600 mb-8 space-y-1">
                <div className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">
                  Statutory Employer Remittance Information (Statutory Record):
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 font-medium">
                  <div>
                    Employer EPF (12%):{' '}
                    <span className="font-bold text-slate-800">
                      {formatLKR(selectedSlipRun.employer_epf_12)}
                    </span>
                  </div>
                  <div>
                    Employer ETF (3%):{' '}
                    <span className="font-bold text-slate-800">
                      {formatLKR(selectedSlipRun.employer_etf_3)}
                    </span>
                  </div>
                  <div>
                    Total Company Cost:{' '}
                    <span className="font-bold text-slate-800">
                      {formatLKR(selectedSlipRun.total_company_cost)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual Signature Block */}
              <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-300 text-xs">
                <div className="text-center">
                  <div className="h-12 border-b border-dashed border-slate-400 mb-2" />
                  <div className="font-extrabold text-slate-900">Employee Signature</div>
                  <div className="text-[10px] text-slate-500">Received payment in full & verified</div>
                </div>
                <div className="text-center">
                  <div className="h-12 border-b border-dashed border-slate-400 mb-2" />
                  <div className="font-extrabold text-slate-900">Authorized Signature</div>
                  <div className="text-[10px] text-slate-500">For Deegayu Weda Madhura</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
