'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Coins,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Plus,
  Users,
  Clock,
  Building2,
  UploadCloud,
  X,
  Sparkles,
  FileText,
  Filter,
  ShieldCheck,
  TrendingDown,
  CalendarCheck,
  Wallet,
} from 'lucide-react';
import {
  payrollApi,
  type EmployeeSalaryProfileDto,
  type StaffAttendanceLogDto,
  type CashierShortageLedgerDto,
  type SalaryAdvanceDto,
  type PayrollHolidayDto,
} from '../../../lib/payroll-api';

function formatLKR(val: number | undefined | null): string {
  const num = Number(val || 0);
  return 'LKR ' + num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getColomboToday(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const iso = new Date().toISOString();
    return iso.split('T')[0] || '2026-11-21';
  }
}

function getColomboCurrentMonth(): string {
  const today = getColomboToday();
  return today.substring(0, 7); // YYYY-MM
}

function formatMonthLabel(monthYear: string): string {
  if (!monthYear) return '';
  const [yStr, mStr] = monthYear.split('-');
  const y = parseInt(yStr || '2026', 10);
  const m = parseInt(mStr || '1', 10) - 1;
  const date = new Date(y, m, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ----------------------------------------------------------------------------
// MAIN PAYROLL HUB INNER COMPONENT
// ----------------------------------------------------------------------------

function PayrollHubContent() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'deductions' | 'attendance' | 'profiles' | 'runs'>(() => {
    if (initialTabParam === 'attendance') return 'attendance';
    if (initialTabParam === 'profiles') return 'profiles';
    if (initialTabParam === 'runs') return 'runs';
    return 'deductions'; // default to Shortages & Advances Ledger
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(getColomboCurrentMonth);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data States
  const [shortages, setShortages] = useState<CashierShortageLedgerDto[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvanceDto[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<StaffAttendanceLogDto[]>([]);
  const [salaryProfiles, setSalaryProfiles] = useState<EmployeeSalaryProfileDto[]>([]);
  const [holidays, setHolidays] = useState<PayrollHolidayDto[]>([]);

  // Shortage status filter
  const [shortageStatusFilter, setShortageStatusFilter] = useState<'ALL' | 'pending' | 'deducted' | 'waived' | 'deferred'>('ALL');

  // Modals
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EmployeeSalaryProfileDto | null>(null);

  // New Advance Form State
  const [advUserId, setAdvUserId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState(getColomboToday);
  const [advReason, setAdvReason] = useState('');
  const [advSubmitting, setAdvSubmitting] = useState(false);

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvParsing, setCsvParsing] = useState(false);
  const [parsedCsvRows, setParsedCsvRows] = useState<Array<Partial<StaffAttendanceLogDto>>>([]);

  // Quick Attendance Date
  const [attendanceDate, setAttendanceDate] = useState(getColomboToday);

  // New Holiday Form State
  const [newHolidayDate, setNewHolidayDate] = useState(getColomboToday);
  const [newHolidayName, setNewHolidayName] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch all data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [shortagesData, advancesData, attendanceData, profilesData, holidaysData] = await Promise.all([
        payrollApi.getCashierShortagesLedger(selectedMonth, selectedBranchId),
        payrollApi.getSalaryAdvances(selectedMonth, selectedBranchId),
        payrollApi.getAttendanceLogs(selectedMonth, selectedBranchId),
        payrollApi.getEmployeeSalaryProfiles(),
        payrollApi.getHolidayCalendar(parseInt(selectedMonth.split('-')[0] || '2026', 10)),
      ]);

      setShortages(shortagesData);
      setAdvances(advancesData);
      setAttendanceLogs(attendanceData);
      setSalaryProfiles(profilesData);
      setHolidays(holidaysData);
    } catch (err: any) {
      console.error('[PayrollHub] Failed to load payroll data:', err);
      showToast('Error loading payroll records. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, selectedBranchId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr || '2026', 10);
    let m = parseInt(mStr || '1', 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr || '2026', 10);
    let m = parseInt(mStr || '1', 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  // Branch mapping
  const branchOptions = useMemo(() => [
    { id: 'ALL', name: 'All Branches' },
    { id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54', name: 'Alawwa' },
    { id: 'fa68e4a0-a515-44c8-a082-5b5590366658', name: 'Dambadeniya' },
    { id: '197693d6-4247-48df-b614-6fcde9e34f7d', name: 'Giriulla' },
    { id: '133eeaec-5726-4702-a819-8423750db203', name: 'Main Store' },
  ], []);

  // Filtered Shortages
  const filteredShortages = useMemo(() => {
    return shortages.filter((s) => {
      if (shortageStatusFilter !== 'ALL' && s.status !== shortageStatusFilter) return false;
      return true;
    });
  }, [shortages, shortageStatusFilter]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const pendingShortagesAmt = shortages
      .filter((s) => s.status === 'pending')
      .reduce((sum, s) => sum + s.amount, 0);

    const waivedDeferredCount = shortages
      .filter((s) => s.status === 'waived' || s.status === 'deferred').length;

    const waivedDeferredAmt = shortages
      .filter((s) => s.status === 'waived' || s.status === 'deferred')
      .reduce((sum, s) => sum + s.amount, 0);

    const pendingAdvancesAmt = advances
      .filter((a) => a.status === 'pending')
      .reduce((sum, a) => sum + a.amount, 0);

    const totalDeductible = pendingShortagesAmt + pendingAdvancesAmt;

    const normalOtHours = attendanceLogs.reduce((sum, a) => sum + a.normal_ot_hours, 0);
    const doubleOtHours = attendanceLogs.reduce((sum, a) => sum + a.double_ot_hours, 0);
    const presentCount = attendanceLogs.filter((a) => a.status === 'present').length;

    return {
      pendingShortagesAmt,
      waivedDeferredCount,
      waivedDeferredAmt,
      pendingAdvancesAmt,
      totalDeductible,
      normalOtHours,
      doubleOtHours,
      presentCount,
    };
  }, [shortages, advances, attendanceLogs]);

  // Shortage status update
  const handleUpdateShortageStatus = async (
    id: string,
    newStatus: 'pending' | 'waived' | 'deferred' | 'deducted'
  ) => {
    try {
      await payrollApi.updateShortageStatus(id, newStatus);
      setShortages((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
      showToast(`Shortage status updated to "${newStatus}".`);
    } catch {
      showToast('Failed to update shortage status.');
    }
  };

  // Record Advance
  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advUserId || !advAmount || Number(advAmount) <= 0) {
      showToast('Please select an employee and enter a valid advance amount.');
      return;
    }
    setAdvSubmitting(true);
    try {
      const selectedEmp = salaryProfiles.find((p) => p.user_id === advUserId);
      await payrollApi.createSalaryAdvance({
        user_id: advUserId,
        branch_id: selectedEmp?.branch_id || null,
        advance_date: advDate,
        amount: Number(advAmount),
        reason: advReason || undefined,
      });
      setIsAdvanceModalOpen(false);
      setAdvAmount('');
      setAdvReason('');
      showToast('Salary advance recorded successfully.');
      loadData(true);
    } catch {
      showToast('Failed to record salary advance.');
    } finally {
      setAdvSubmitting(false);
    }
  };

  // Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) {
      showToast('Please specify holiday date and title.');
      return;
    }
    try {
      await payrollApi.addHoliday(newHolidayDate, newHolidayName.trim(), 2.0);
      setNewHolidayName('');
      showToast('Holiday registered with 2.0x Double OT multiplier.');
      loadData(true);
    } catch {
      showToast('Failed to register holiday.');
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (date: string) => {
    try {
      await payrollApi.deleteHoliday(date);
      setHolidays((prev) => prev.filter((h) => h.holiday_date !== date));
      showToast('Holiday removed.');
    } catch {
      showToast('Failed to delete holiday.');
    }
  };

  // Save Salary Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    try {
      await payrollApi.upsertEmployeeSalaryProfile(editingProfile);
      setSalaryProfiles((prev) =>
        prev.map((p) => (p.id === editingProfile.id ? { ...editingProfile } : p))
      );
      setEditingProfile(null);
      showToast(`Salary profile for ${editingProfile.full_name} updated successfully.`);
    } catch {
      showToast('Failed to update salary profile.');
    }
  };

  // CSV Import Parse
  const handleParseCsv = () => {
    if (!csvText.trim()) return;
    setCsvParsing(true);
    try {
      const lines = csvText.trim().split('\n');
      const rows: Array<Partial<StaffAttendanceLogDto>> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line || (i === 0 && line.toLowerCase().includes('employee'))) continue;
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 2) continue;

        const empIdentifier = parts[0] || '';
        const dateStr = parts[1] || '';
        const clockInStr = parts[2] || '';
        const clockOutStr = parts[3] || '';
        const statusStr = parts[4] || '';

        // Match user by code or name
        const emp = salaryProfiles.find(
          (p) =>
            p.employee_code?.toLowerCase() === empIdentifier.toLowerCase() ||
            p.full_name?.toLowerCase().includes(empIdentifier.toLowerCase())
        );

        if (!emp || !dateStr) continue;

        const isDoubleOtDay = holidays.some((h) => h.holiday_date === dateStr);

        // Simple hour calculation: assuming 8 standard hours
        let normOt = 0;
        let dblOt = 0;
        if (clockInStr && clockOutStr) {
          const inParts = clockInStr.split(':');
          const inH = Number(inParts[0] || 0);
          const inM = Number(inParts[1] || 0);
          const outParts = clockOutStr.split(':');
          const outH = Number(outParts[0] || 0);
          const outM = Number(outParts[1] || 0);

          if (!isNaN(inH) && !isNaN(outH)) {
            const totalHrs = Math.max(0, (outH + outM / 60) - (inH + inM / 60) - 1); // 1 hr break
            const extra = Math.max(0, totalHrs - (emp.standard_daily_hours || 8));
            if (isDoubleOtDay) {
              dblOt = Math.round(extra * 100) / 100;
            } else {
              normOt = Math.round(extra * 100) / 100;
            }
          }
        }

        rows.push({
          user_id: emp.user_id,
          branch_id: emp.branch_id,
          work_date: dateStr,
          clock_in: clockInStr || null,
          clock_out: clockOutStr || null,
          status: (statusStr?.toLowerCase() as any) || 'present',
          normal_ot_hours: normOt,
          double_ot_hours: dblOt,
          is_double_ot_day: isDoubleOtDay,
          full_name: emp.full_name,
          employee_code: emp.employee_code || 'EMP',
        });
      }

      setParsedCsvRows(rows);
    } catch {
      showToast('Error parsing CSV. Please check formatting.');
    } finally {
      setCsvParsing(false);
    }
  };

  const handleCommitCsvImport = async () => {
    if (parsedCsvRows.length === 0) return;
    try {
      const count = await payrollApi.bulkImportAttendanceLogs(parsedCsvRows);
      setIsCsvModalOpen(false);
      setCsvText('');
      setParsedCsvRows([]);
      showToast(`Successfully imported ${count} attendance record(s).`);
      loadData(true);
    } catch {
      showToast('Failed to save imported records.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Payroll & HR Executive Hub
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Part 1
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Deegayu Weda Madhura • Sri Lanka Statutory EPF/ETF & Overtime Engine
              </p>
            </div>
          </div>
        </div>

        {/* Global Month & Branch Selector Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold font-mono text-slate-200">
                {formatMonthLabel(selectedMonth)}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Building2 className="w-4 h-4 text-slate-400 mr-2" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-hidden cursor-pointer"
            >
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition shadow-sm"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mt-6 border-b border-slate-800/80 no-scrollbar">
        <button
          onClick={() => setActiveTab('deductions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'deductions'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Shortages & Advances Ledger
          {kpis.pendingShortagesAmt > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full">
              {formatLKR(kpis.pendingShortagesAmt)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-emerald-400" />
          Attendance & Overtime (1.5x / 2.0x)
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'profiles'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4 text-sky-400" />
          Employee Salary Profiles ({salaryProfiles.length})
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'runs'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4 text-violet-400" />
          Monthly Payroll & Salary Slips
        </button>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Loading Deegayu Weda Madhura Payroll Records...
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* ==================================================================== */}
          {/* TAB 1: SHORTAGES & ADVANCES LEDGER                                   */}
          {/* ==================================================================== */}
          {activeTab === 'deductions' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-900/40 bg-gradient-to-br from-slate-900 to-rose-950/20 shadow-lg">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-400">
                    <span>Pending Shift Shortages</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black font-mono text-rose-400">
                    {formatLKR(kpis.pendingShortagesAmt)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Queued to deduct in monthly payroll
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-900/40 bg-gradient-to-br from-slate-900 to-amber-950/20 shadow-lg">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-400">
                    <span>Waived / Deferred</span>
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black font-mono text-amber-400">
                    {formatLKR(kpis.waivedDeferredAmt)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {kpis.waivedDeferredCount} recorded cases exempt/delayed
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-900/40 bg-gradient-to-br from-slate-900 to-indigo-950/20 shadow-lg">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-400">
                    <span>Active Salary Advances</span>
                    <Wallet className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black font-mono text-indigo-400">
                    {formatLKR(kpis.pendingAdvancesAmt)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {advances.filter((a) => a.status === 'pending').length} pending cash advances
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-900/40 bg-gradient-to-br from-slate-900 to-emerald-950/20 shadow-lg">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <span>Total Deductible</span>
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black font-mono text-emerald-400">
                    {formatLKR(kpis.totalDeductible)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Shortages + Advances for {formatMonthLabel(selectedMonth)}
                  </p>
                </div>
              </div>

              {/* ACTION TOOLBAR */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400 ml-1" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  {(['ALL', 'pending', 'waived', 'deferred', 'deducted'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setShortageStatusFilter(st)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition capitalize ${
                        shortageStatusFilter === st
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsAdvanceModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  + Record Salary Advance
                </button>
              </div>

              {/* CASHIER SHIFT SHORTAGES TABLE */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Live Cashier Shift Shortages Ledger ({filteredShortages.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Linked to cashier shift reconciliation financial adjustments
                  </span>
                </div>

                {filteredShortages.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No cashier shortages recorded for {formatMonthLabel(selectedMonth)} under current filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Branch</th>
                          <th className="py-3 px-4">Shift</th>
                          <th className="py-3 px-4">Shortage Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Remarks</th>
                          <th className="py-3 px-4 text-right">Owner Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {filteredShortages.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                              {item.adjustment_date}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                              {item.employee_name}
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                              {item.branch_name}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                                Shift {item.shift_number === 1 ? 'A' : 'B'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-rose-400 whitespace-nowrap">
                              {formatLKR(item.amount)}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  item.status === 'pending'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : item.status === 'waived'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : item.status === 'deferred'
                                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                              {item.notes || 'End-of-shift drawer count variance'}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.status !== 'pending' && (
                                  <button
                                    onClick={() => handleUpdateShortageStatus(item.id, 'pending')}
                                    className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-600/30 rounded text-[10px] font-bold transition cursor-pointer"
                                    title="Queue to deduct in next payroll"
                                  >
                                    Deduct in Payroll
                                  </button>
                                )}
                                {item.status !== 'waived' && (
                                  <button
                                    onClick={() => handleUpdateShortageStatus(item.id, 'waived')}
                                    className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-600/30 rounded text-[10px] font-bold transition cursor-pointer"
                                    title="Waive penalty for cashier"
                                  >
                                    Waive
                                  </button>
                                )}
                                {item.status !== 'deferred' && (
                                  <button
                                    onClick={() => handleUpdateShortageStatus(item.id, 'deferred')}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[10px] font-bold transition cursor-pointer"
                                    title="Defer to subsequent cycle"
                                  >
                                    Defer
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SALARY ADVANCES TABLE */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Staff Salary Advances ({advances.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Cash advances granted mid-month to be recovered from payroll
                  </span>
                </div>

                {advances.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No salary advances recorded for {formatMonthLabel(selectedMonth)}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Branch</th>
                          <th className="py-3 px-4">Advance Amount</th>
                          <th className="py-3 px-4">Reason / Purpose</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {advances.map((adv) => (
                          <tr key={adv.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                              {adv.advance_date}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                              {adv.full_name} <span className="text-slate-500 text-[10px]">({adv.employee_code})</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                              {adv.branch_name}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-400 whitespace-nowrap">
                              {formatLKR(adv.amount)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                              {adv.reason || 'Personal advance'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  adv.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {adv.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {adv.status === 'pending' ? (
                                <button
                                  onClick={async () => {
                                    await payrollApi.updateSalaryAdvanceStatus(adv.id, 'deducted');
                                    setAdvances((prev) =>
                                      prev.map((a) => (a.id === adv.id ? { ...a, status: 'deducted' } : a))
                                    );
                                    showToast('Marked advance as deducted.');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-600/30 rounded text-[10px] font-bold transition cursor-pointer"
                                >
                                  Mark Deducted
                                </button>
                              ) : (
                                <span className="text-slate-500 text-[10px]">Settled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 2: ATTENDANCE & OVERTIME (1.5x / 2.0x)                           */}
          {/* ==================================================================== */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Top Controls & KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Total Present Records
                  </div>
                  <div className="mt-1.5 text-2xl font-black font-mono text-emerald-400">
                    {kpis.presentCount}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Normal OT (1.5x) Hours
                  </div>
                  <div className="mt-1.5 text-2xl font-black font-mono text-indigo-400">
                    {kpis.normalOtHours.toFixed(2)} hrs
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Double OT (2.0x) Hours
                  </div>
                  <div className="mt-1.5 text-2xl font-black font-mono text-amber-400">
                    {kpis.doubleOtHours.toFixed(2)} hrs
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Registered Holidays
                  </div>
                  <div className="mt-1.5 text-2xl font-black font-mono text-rose-400">
                    {holidays.length} days
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400 ml-1" />
                  <span className="text-xs font-bold text-slate-400">Filter Date:</span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs px-2.5 py-1 rounded-lg text-slate-200 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-indigo-400" />
                    Bulk CSV / Excel Import
                  </button>

                  <button
                    onClick={() => setIsHolidayModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 text-amber-300 transition cursor-pointer"
                  >
                    <CalendarCheck className="w-4 h-4 text-amber-400" />
                    Holiday / Double OT Calendar ({holidays.length})
                  </button>
                </div>
              </div>

              {/* ATTENDANCE RECORDS TABLE */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Staff Attendance Logs ({attendanceLogs.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Standard 8.0 hr work shift • Automatic 1.5x Normal OT & 2.0x Double OT calculation
                  </span>
                </div>

                {attendanceLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No attendance logs found for {formatMonthLabel(selectedMonth)}. Use "Bulk CSV / Excel Import" or mark daily attendance.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                          <th className="py-3 px-4">Work Date</th>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Branch</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Clock In</th>
                          <th className="py-3 px-4">Clock Out</th>
                          <th className="py-3 px-4">Normal OT (1.5x)</th>
                          <th className="py-3 px-4">Double OT (2.0x)</th>
                          <th className="py-3 px-4">Holiday / Day Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {attendanceLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                              {log.work_date}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                              {log.full_name} <span className="text-slate-500 text-[10px]">({log.employee_code})</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                              {log.branch_name}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  log.status === 'present'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : log.status === 'half_day'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              {log.clock_in || '--:--'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              {log.clock_out || '--:--'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                              {log.normal_ot_hours > 0 ? `${log.normal_ot_hours.toFixed(2)}h` : '-'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                              {log.double_ot_hours > 0 ? `${log.double_ot_hours.toFixed(2)}h` : '-'}
                            </td>
                            <td className="py-3.5 px-4">
                              {log.is_double_ot_day ? (
                                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                                  Poya / Special Holiday (2.0x)
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">Normal Shift</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 3: EMPLOYEE SALARY PROFILES                                      */}
          {/* ==================================================================== */}
          {activeTab === 'profiles' && (
            <div className="space-y-6">
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-400" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Active Staff Salary & Remuneration Profiles ({salaryProfiles.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Pre-seeded staff profiles (Excluding Owner) • Configurable Basic, Allowances & Bank details
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-4">Assigned Branch</th>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-4">Basic Salary</th>
                        <th className="py-3 px-4">Fixed Allowance</th>
                        <th className="py-3 px-4">Attendance Bonus</th>
                        <th className="py-3 px-4">Normal OT Rate</th>
                        <th className="py-3 px-4">Double OT Rate</th>
                        <th className="py-3 px-4">EPF (8%/12%)</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {salaryProfiles.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-400 whitespace-nowrap">
                            {p.employee_code}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-white">{p.full_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                            {p.branch_name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                            {p.designation}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                            {formatLKR(p.basic_salary)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {formatLKR(p.fixed_allowance)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {formatLKR(p.attendance_bonus)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-indigo-300 whitespace-nowrap">
                            {formatLKR(p.computed_normal_ot_rate)}/hr
                          </td>
                          <td className="py-3.5 px-4 font-mono text-amber-300 whitespace-nowrap">
                            {formatLKR(p.computed_double_ot_rate)}/hr
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.epf_eligible
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {p.epf_eligible ? 'Eligible' : 'Exempt'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => setEditingProfile({ ...p })}
                              className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-600/30 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              Edit Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 4: MONTHLY PAYROLL & SALARY SLIPS                                */}
          {/* ==================================================================== */}
          {activeTab === 'runs' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-900/30 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      Monthly Payroll Generator & Salary Slip Engine
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Ready for Part 2 • Computes automated earnings, EPF 8% / ETF 3%, cashier shortage deductions, and generates printable A4 salary slips.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showToast('Monthly calculation ready. Full Part 2 generator will run approval and printing workflows.')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Preview Calculation for {formatMonthLabel(selectedMonth)}
                    </button>
                  </div>
                </div>

                {/* Pre-flight summary table */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Staff on Payroll
                    </span>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {salaryProfiles.length} Active Employees
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Total Basic Wages
                    </span>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {formatLKR(salaryProfiles.reduce((sum, p) => sum + p.basic_salary, 0))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Pending Shortage Deductions
                    </span>
                    <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                      {formatLKR(kpis.pendingShortagesAmt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: RECORD SALARY ADVANCE                                         */}
      {/* ==================================================================== */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-400" />
                Record Staff Salary Advance
              </h3>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Select Employee</label>
                <select
                  value={advUserId}
                  onChange={(e) => setAdvUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-hidden"
                  required
                >
                  <option value="">-- Choose Staff Member --</option>
                  {salaryProfiles.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.full_name} ({p.employee_code} - {p.branch_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Advance Amount (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5000.00"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Advance Date</label>
                <input
                  type="date"
                  value={advDate}
                  onChange={(e) => setAdvDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Reason / Remarks (Optional)</label>
                <textarea
                  placeholder="e.g. Medical emergency, urgent travel advance"
                  value={advReason}
                  onChange={(e) => setAdvReason(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={advSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  {advSubmitting ? 'Recording...' : 'Record Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: BULK CSV / EXCEL ATTENDANCE IMPORT                            */}
      {/* ==================================================================== */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                Bulk CSV / Excel Attendance Import
              </h3>
              <button
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setParsedCsvRows([]);
                  setCsvText('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                <p className="font-bold text-white mb-1">Expected CSV Format (comma-separated):</p>
                <code className="text-indigo-400 font-mono text-[11px] block">
                  EmployeeCode/Name, WorkDate (YYYY-MM-DD), ClockIn (HH:MM), ClockOut (HH:MM), Status
                </code>
                <p className="text-[10px] text-slate-400 mt-1">
                  Example: <span className="font-mono text-slate-300">EMP-001, 2026-11-20, 08:30, 18:30, present</span>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Paste CSV Contents</label>
                <textarea
                  rows={6}
                  placeholder={`EMP-001, 2026-11-20, 08:30, 18:30, present\nEMP-002, 2026-11-20, 08:30, 17:30, present`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleParseCsv}
                  disabled={csvParsing || !csvText.trim()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition"
                >
                  {csvParsing ? 'Validating...' : 'Parse & Validate Rows'}
                </button>
                {parsedCsvRows.length > 0 && (
                  <span className="text-emerald-400 font-bold">
                    ✓ {parsedCsvRows.length} valid rows recognized
                  </span>
                )}
              </div>

              {/* Parsed Preview Table */}
              {parsedCsvRows.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">In/Out</th>
                        <th className="p-2">Normal OT</th>
                        <th className="p-2">Double OT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {parsedCsvRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="p-2 text-white font-sans">{r.full_name} ({r.employee_code})</td>
                          <td className="p-2">{r.work_date}</td>
                          <td className="p-2">{r.clock_in} - {r.clock_out}</td>
                          <td className="p-2 text-indigo-400">{r.normal_ot_hours}h</td>
                          <td className="p-2 text-amber-400">{r.double_ot_hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvModalOpen(false);
                    setParsedCsvRows([]);
                    setCsvText('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitCsvImport}
                  disabled={parsedCsvRows.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  Import {parsedCsvRows.length} Record(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: HOLIDAY & DOUBLE OT CALENDAR                                  */}
      {/* ==================================================================== */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-amber-400" />
                Sri Lanka Holiday & Double OT Calendar ({holidays.length})
              </h3>
              <button
                onClick={() => setIsHolidayModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Add Holiday Form */}
              <form onSubmit={handleAddHoliday} className="flex items-end gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="grow">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Holiday Date</label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden"
                    required
                  />
                </div>
                <div className="grow-[2]">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Holiday Title / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Bak Full Moon Poya Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition whitespace-nowrap"
                >
                  + Add 2.0x Day
                </button>
              </form>

              {/* Holiday List */}
              <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Holiday Name</th>
                      <th className="py-2 px-3">Multiplier</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {holidays.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-slate-300">{h.holiday_date}</td>
                        <td className="py-2 px-3 text-white font-bold">{h.holiday_name}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px] font-bold">
                            {h.ot_multiplier.toFixed(1)}x OT
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDeleteHoliday(h.holiday_date)}
                            className="text-rose-400 hover:text-rose-300 text-[11px] font-bold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL / DRAWER: EDIT EMPLOYEE SALARY PROFILE                         */}
      {/* ==================================================================== */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  Edit Remuneration Profile: {editingProfile.full_name}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {editingProfile.employee_code} • {editingProfile.branch_name}
                </span>
              </div>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Basic Salary (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.basic_salary}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        basic_salary: Number(e.target.value),
                        computed_normal_ot_rate: Math.round(((Number(e.target.value) / 240) * 1.5) * 100) / 100,
                        computed_double_ot_rate: Math.round(((Number(e.target.value) / 240) * 2.0) * 100) / 100,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Fixed Allowance (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.fixed_allowance}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        fixed_allowance: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Attendance Bonus (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProfile.attendance_bonus}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        attendance_bonus: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editingProfile.designation}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        designation: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Live OT Formula Preview */}
              <div className="p-3 bg-slate-950 rounded-xl border border-indigo-900/30">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                  Live Overtime Calculations (Basic ÷ 240 hours)
                </span>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-slate-400">Normal OT (1.5x):</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {formatLKR(editingProfile.computed_normal_ot_rate)}/hr
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-0.5">
                  <span className="text-slate-400">Double OT (2.0x):</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatLKR(editingProfile.computed_double_ot_rate)}/hr
                  </span>
                </div>
              </div>

              {/* Bank Details */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-400 text-[10px] mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. BOC"
                    value={editingProfile.bank_name || ''}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, bank_name: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 text-[10px] mb-1">Bank Branch</label>
                  <input
                    type="text"
                    placeholder="Branch"
                    value={editingProfile.bank_branch || ''}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, bank_branch: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 text-[10px] mb-1">Account No.</label>
                  <input
                    type="text"
                    placeholder="Account #"
                    value={editingProfile.bank_account_no || ''}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, bank_account_no: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="epf_checkbox"
                  checked={editingProfile.epf_eligible}
                  onChange={(e) =>
                    setEditingProfile({ ...editingProfile, epf_eligible: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-0 w-4 h-4"
                />
                <label htmlFor="epf_checkbox" className="font-bold text-slate-300">
                  Eligible for Sri Lanka Statutory EPF (8% employee / 12% employer) & ETF (3%)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  Save Salary Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ROOT EXPORT WRAPPED IN SUSPENSE FOR NEXT.JS STATIC EXPORT COMPATIBILITY
// ----------------------------------------------------------------------------

export default function PayrollDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-widest">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            Loading Deegayu Weda Madhura Payroll Hub...
          </div>
        </div>
      }
    >
      <PayrollHubContent />
    </Suspense>
  );
}
