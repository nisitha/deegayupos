'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CalendarCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
  X,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { z } from 'zod';
import { supabase } from '../../../../lib/supabase';
import { calculateDailyHours } from '../../../../lib/payroll-calculator';

// Privacy-Guarded Non-Sensitive Employee Model
export interface AttendanceStaffMember {
  id: string;
  emp_code: string;
  full_name: string;
  branch_id: string | null;
  branch_name?: string;
  shift_start_time: string;
  shift_end_time: string;
  break_minutes: number;
  status: string;
}

export interface AttendanceRowState {
  employeeId: string;
  empCode: string;
  fullName: string;
  branchName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  breakMinutes: number;
  isPresent: boolean;
  inTime: string; // e.g. "08:30"
  outTime: string; // e.g. "17:30"
  regularHours: number;
  normalOtHours: number;
  doubleOtHours: number;
  totalWorkedHours: number;
  notes: string;
  isDirty?: boolean;
}

const CsvAttendanceRowSchema = z.object({
  emp_code: z.string().min(1, 'Employee code is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  in_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'In time must be HH:MM'),
  out_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Out time must be HH:MM'),
  is_double_ot_day: z.boolean().default(false),
  notes: z.string().optional().default(''),
});

function getColomboTodayString(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch {
    return new Date().toISOString().split('T')[0] || '2026-11-20';
  }
}

export default function PayrollAttendancePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getColomboTodayString);
  const [isDoubleOtDay, setIsDoubleOtDay] = useState(false);
  const [specialDayTitle, setSpecialDayTitle] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<AttendanceStaffMember[]>([]);
  const [rosterRows, setRosterRows] = useState<AttendanceRowState[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // CSV Import Modal State
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load Staff (PRIVACY GUARD: never select wage or NIC columns)
  const loadStaffAndAttendance = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);

      try {
        // Query ONLY non-sensitive employee attributes
        const { data: empData, error: empErr } = await supabase
          .from('payroll_employees')
          .select('id, emp_code, full_name, branch_id, shift_start_time, shift_end_time, break_minutes, status, branches(id, name, code)')
          .eq('status', 'ACTIVE')
          .order('full_name', { ascending: true });

        if (empErr) throw empErr;

        const staffMembers: AttendanceStaffMember[] = (empData || []).map((row: any) => ({
          id: row.id,
          emp_code: row.emp_code,
          full_name: row.full_name,
          branch_id: row.branch_id,
          branch_name: row.branches?.name || 'All Branches',
          shift_start_time: row.shift_start_time || '08:30',
          shift_end_time: row.shift_end_time || '17:30',
          break_minutes: row.break_minutes ?? 60,
          status: row.status,
        }));
        setStaffList(staffMembers);

        // Check if selected date is in public.payroll_special_days
        const { data: specialDayData } = await supabase
          .from('payroll_special_days')
          .select('date, title, holiday_category, day_type')
          .eq('date', selectedDate)
          .maybeSingle();

        const isHoliday = !!specialDayData && specialDayData.day_type === 'DOUBLE_OT';
        setIsDoubleOtDay(isHoliday);
        setSpecialDayTitle(specialDayData ? `${specialDayData.title} (${specialDayData.holiday_category})` : null);

        // Fetch existing attendance records for selectedDate
        const { data: attendanceData, error: attErr } = await supabase
          .from('payroll_attendance')
          .select('*')
          .eq('date', selectedDate);

        if (attErr) throw attErr;

        const attMap = new Map<string, any>();
        (attendanceData || []).forEach((att) => attMap.set(att.employee_id, att));

        // Build roster rows
        const rows: AttendanceRowState[] = staffMembers.map((staff) => {
          const existing = attMap.get(staff.id);
          const isPresent = !!existing ? (existing.regular_hours > 0 || existing.normal_ot_hours > 0 || existing.double_ot_hours > 0 || !!existing.in_time) : true;

          // Format times: either saved or standard shift
          let inTimeStr = staff.shift_start_time.substring(0, 5);
          let outTimeStr = staff.shift_end_time.substring(0, 5);

          if (existing?.in_time) {
            inTimeStr = new Date(existing.in_time).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'Asia/Colombo',
            });
          }
          if (existing?.out_time) {
            outTimeStr = new Date(existing.out_time).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'Asia/Colombo',
            });
          }

          const calc = calculateDailyHours({
            inTime: `${selectedDate}T${inTimeStr}:00`,
            outTime: `${selectedDate}T${outTimeStr}:00`,
            shiftEndTime: staff.shift_end_time,
            breakMinutes: staff.break_minutes,
            isDoubleOtDay: isHoliday,
          });

          return {
            employeeId: staff.id,
            empCode: staff.emp_code,
            fullName: staff.full_name,
            branchName: staff.branch_name || 'All Branches',
            shiftStartTime: staff.shift_start_time.substring(0, 5),
            shiftEndTime: staff.shift_end_time.substring(0, 5),
            breakMinutes: staff.break_minutes,
            isPresent,
            inTime: inTimeStr,
            outTime: outTimeStr,
            regularHours: isPresent ? (existing?.regular_hours ?? calc.regularHours) : 0,
            normalOtHours: isPresent ? (existing?.normal_ot_hours ?? calc.normalOtHours) : 0,
            doubleOtHours: isPresent ? (existing?.double_ot_hours ?? calc.doubleOtHours) : 0,
            totalWorkedHours: isPresent ? calc.totalWorkedHours : 0,
            notes: existing?.notes || '',
            isDirty: false,
          };
        });

        setRosterRows(rows);
      } catch (err: any) {
        console.error('[Attendance] Load error:', err);
        showToast('Error loading attendance roster.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadStaffAndAttendance(false);
  }, [loadStaffAndAttendance]);

  // Recalculate row hours whenever In/Out/Holiday toggles
  const updateRowTime = (
    employeeId: string,
    field: 'inTime' | 'outTime' | 'isPresent' | 'notes',
    value: any
  ) => {
    setRosterRows((prev) =>
      prev.map((row) => {
        if (row.employeeId !== employeeId) return row;

        const updated = { ...row, [field]: value, isDirty: true };

        if (!updated.isPresent) {
          updated.regularHours = 0;
          updated.normalOtHours = 0;
          updated.doubleOtHours = 0;
          updated.totalWorkedHours = 0;
          return updated;
        }

        const calc = calculateDailyHours({
          inTime: `${selectedDate}T${updated.inTime}:00`,
          outTime: `${selectedDate}T${updated.outTime}:00`,
          shiftEndTime: updated.shiftEndTime,
          breakMinutes: updated.breakMinutes,
          isDoubleOtDay,
        });

        updated.regularHours = calc.regularHours;
        updated.normalOtHours = calc.normalOtHours;
        updated.doubleOtHours = calc.doubleOtHours;
        updated.totalWorkedHours = calc.totalWorkedHours;

        return updated;
      })
    );
  };

  // Toggle Double OT Day across the entire roster
  const handleToggleDoubleOt = (checked: boolean) => {
    setIsDoubleOtDay(checked);
    setRosterRows((prev) =>
      prev.map((row) => {
        if (!row.isPresent) return row;
        const calc = calculateDailyHours({
          inTime: `${selectedDate}T${row.inTime}:00`,
          outTime: `${selectedDate}T${row.outTime}:00`,
          shiftEndTime: row.shiftEndTime,
          breakMinutes: row.breakMinutes,
          isDoubleOtDay: checked,
        });

        return {
          ...row,
          regularHours: calc.regularHours,
          normalOtHours: calc.normalOtHours,
          doubleOtHours: calc.doubleOtHours,
          totalWorkedHours: calc.totalWorkedHours,
          isDirty: true,
        };
      })
    );
  };

  // "Apply Standard Shift to All" Action
  const handleApplyStandardShiftToAll = () => {
    setRosterRows((prev) =>
      prev.map((row) => {
        const inStr = row.shiftStartTime;
        const outStr = row.shiftEndTime;

        const calc = calculateDailyHours({
          inTime: `${selectedDate}T${inStr}:00`,
          outTime: `${selectedDate}T${outStr}:00`,
          shiftEndTime: row.shiftEndTime,
          breakMinutes: row.breakMinutes,
          isDoubleOtDay,
        });

        return {
          ...row,
          isPresent: true,
          inTime: inStr,
          outTime: outStr,
          regularHours: calc.regularHours,
          normalOtHours: calc.normalOtHours,
          doubleOtHours: calc.doubleOtHours,
          totalWorkedHours: calc.totalWorkedHours,
          isDirty: true,
        };
      })
    );
    showToast('Applied standard shifts (08:30–17:30) to all active staff.');
  };

  // Save single row
  const handleSaveRow = async (row: AttendanceRowState) => {
    setSavingRowId(row.employeeId);
    try {
      const inTimestamp = row.isPresent ? `${selectedDate}T${row.inTime}:00+05:30` : null;
      const outTimestamp = row.isPresent ? `${selectedDate}T${row.outTime}:00+05:30` : null;

      const { error } = await supabase.from('payroll_attendance').upsert(
        {
          employee_id: row.employeeId,
          date: selectedDate,
          in_time: inTimestamp,
          out_time: outTimestamp,
          regular_hours: row.regularHours,
          normal_ot_hours: row.normalOtHours,
          double_ot_hours: row.doubleOtHours,
          is_double_ot_day: isDoubleOtDay,
          notes: row.notes || null,
        },
        { onConflict: 'employee_id,date' }
      );

      if (error) throw error;

      setRosterRows((prev) =>
        prev.map((r) => (r.employeeId === row.employeeId ? { ...r, isDirty: false } : r))
      );
      showToast(`Saved attendance for ${row.fullName}.`);
    } catch (err: any) {
      console.error('[Attendance] Save row error:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSavingRowId(null);
    }
  };

  // Save All Attendance
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      const recordsToUpsert = rosterRows.map((row) => {
        const inTimestamp = row.isPresent ? `${selectedDate}T${row.inTime}:00+05:30` : null;
        const outTimestamp = row.isPresent ? `${selectedDate}T${row.outTime}:00+05:30` : null;

        return {
          employee_id: row.employeeId,
          date: selectedDate,
          in_time: inTimestamp,
          out_time: outTimestamp,
          regular_hours: row.regularHours,
          normal_ot_hours: row.normalOtHours,
          double_ot_hours: row.doubleOtHours,
          is_double_ot_day: isDoubleOtDay,
          notes: row.notes || null,
        };
      });

      const { error } = await supabase
        .from('payroll_attendance')
        .upsert(recordsToUpsert, { onConflict: 'employee_id,date' });

      if (error) throw error;

      setRosterRows((prev) => prev.map((r) => ({ ...r, isDirty: false })));
      showToast(`Successfully saved attendance for all ${rosterRows.length} staff members.`);
    } catch (err: any) {
      console.error('[Attendance] Save all error:', err);
      alert(`Save all failed: ${err.message}`);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Download Monthly CSV Template
  const handleDownloadCsvTemplate = () => {
    const monthYear = selectedDate.substring(0, 7); // e.g. "2026-11"
    const [yStr, mStr] = monthYear.split('-');
    const year = parseInt(yStr || '2026', 10);
    const month = parseInt(mStr || '11', 10);

    const daysInMonth = new Date(year, month, 0).getDate();

    const headers = ['emp_code', 'full_name', 'date', 'in_time', 'out_time', 'is_double_ot_day', 'notes'];
    const rows: string[] = [];

    staffList.forEach((staff) => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${monthYear}-${String(day).padStart(2, '0')}`;
        rows.push(
          [
            staff.emp_code,
            `"${staff.full_name.replace(/"/g, '""')}"`,
            dateStr,
            staff.shift_start_time.substring(0, 5),
            staff.shift_end_time.substring(0, 5),
            'false',
            '""',
          ].join(',')
        );
      }
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deegayu-attendance-template-${monthYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Summary Metrics
  const presentCount = useMemo(() => rosterRows.filter((r) => r.isPresent).length, [rosterRows]);
  const totalRegularHrs = useMemo(
    () => rosterRows.reduce((sum, r) => sum + r.regularHours, 0),
    [rosterRows]
  );
  const totalNormalOtHrs = useMemo(
    () => rosterRows.reduce((sum, r) => sum + r.normalOtHours, 0),
    [rosterRows]
  );
  const totalDoubleOtHrs = useMemo(
    () => rosterRows.reduce((sum, r) => sum + r.doubleOtHours, 0),
    [rosterRows]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-250">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Obsidian Header Banner */}
      <div className="bg-[#0F172A] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Deegayu Weda Madhura
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-400 text-xs font-medium">Daily Roster & Attendance Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <CalendarCheck className="w-8 h-8 text-indigo-400" />
                Daily Attendance & Timecard Roster
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                Daily clock in/out times, automated 15-minute OT calculations, special holiday Double OT detection, and bulk monthly CSV synchronization.
              </p>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => loadStaffAndAttendance(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-300" />
                <span>Download CSV Template</span>
              </button>

              <button
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 active:bg-purple-600/40 text-purple-300 rounded-lg text-xs font-bold transition border border-purple-500/40 shadow-sm cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>

              <button
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {isSavingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save All Attendance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Date Selector & Special Day Banner */}
        <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Date Picker & Quick Switches */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Attendance Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split('T')[0] || selectedDate);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getColomboTodayString())}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split('T')[0] || selectedDate);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Double OT Toggle Switch */}
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50/70 text-purple-900 text-xs font-bold cursor-pointer hover:bg-purple-50">
                <input
                  type="checkbox"
                  checked={isDoubleOtDay}
                  onChange={(e) => handleToggleDoubleOt(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Mark as Double OT Day (Holiday)</span>
              </label>

              {/* Apply Standard Shift to All */}
              <button
                type="button"
                onClick={handleApplyStandardShiftToAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition border border-indigo-200 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Apply Standard Shift to All</span>
              </button>
            </div>
          </div>

          {/* Holiday Notice if present */}
          {specialDayTitle && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between text-xs text-purple-900">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Special Day Registered: <strong>{specialDayTitle}</strong></span>
              </span>
              <span className="font-semibold text-purple-700">
                First 8h = Holiday Shift Rate • Hours &gt; 8h = Double OT (2.0x)
              </span>
            </div>
          )}
        </section>

        {/* Daily Summary KPIs */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Staff Attendance</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {presentCount} <span className="text-xs font-normal text-slate-400">/ {rosterRows.length} Present</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Active roster count</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Regular Shift Hours</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{totalRegularHrs.toFixed(2)}h</div>
            <p className="text-xs text-slate-400 mt-0.5">Base scheduled hours</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Normal OT (1.5x)</span>
            <div className="text-2xl font-black text-amber-700 mt-1">{totalNormalOtHrs.toFixed(2)}h</div>
            <p className="text-xs text-slate-400 mt-0.5">Time worked past 17:30</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Double OT (2.0x)</span>
            <div className="text-2xl font-black text-purple-700 mt-1">{totalDoubleOtHrs.toFixed(2)}h</div>
            <p className="text-xs text-slate-400 mt-0.5">Holiday hours past 8.0h</p>
          </div>
        </section>

        {/* Attendance Roster Table */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0F172A] text-white uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Staff Member</th>
                  <th className="px-4 py-3.5">Assigned Branch</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">In Time</th>
                  <th className="px-4 py-3.5">Out Time</th>
                  <th className="px-4 py-3.5 text-right">Regular Hrs</th>
                  <th className="px-4 py-3.5 text-right text-amber-700">Normal OT</th>
                  <th className="px-4 py-3.5 text-right text-purple-700">Double OT</th>
                  <th className="px-4 py-3.5">Notes</th>
                  <th className="px-4 py-3.5 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Loading daily roster...</span>
                      </div>
                    </td>
                  </tr>
                ) : rosterRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      No active staff found. Enroll employees in Employee &amp; Wage Setup first.
                    </td>
                  </tr>
                ) : (
                  rosterRows.map((row) => (
                    <tr
                      key={row.employeeId}
                      className={`hover:bg-slate-50/80 transition ${!row.isPresent ? 'bg-slate-50/50 opacity-60' : ''}`}
                    >
                      {/* Staff Member */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{row.fullName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.empCode}</div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        {row.branchName}
                      </td>

                      {/* Present / Absent Toggle */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => updateRowTime(row.employeeId, 'isPresent', !row.isPresent)}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                            row.isPresent
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          {row.isPresent ? 'Present' : 'Absent'}
                        </button>
                      </td>

                      {/* In Time */}
                      <td className="px-4 py-3.5">
                        <input
                          type="time"
                          disabled={!row.isPresent}
                          value={row.inTime}
                          onChange={(e) => updateRowTime(row.employeeId, 'inTime', e.target.value)}
                          className="py-1 px-2 border border-slate-200 rounded font-mono text-xs disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>

                      {/* Out Time */}
                      <td className="px-4 py-3.5">
                        <input
                          type="time"
                          disabled={!row.isPresent}
                          value={row.outTime}
                          onChange={(e) => updateRowTime(row.employeeId, 'outTime', e.target.value)}
                          className="py-1 px-2 border border-slate-200 rounded font-mono text-xs disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>

                      {/* Regular Hours */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {row.regularHours.toFixed(2)}h
                      </td>

                      {/* Normal OT */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-700">
                        {row.normalOtHours > 0 ? `+${row.normalOtHours.toFixed(2)}h` : '0.00h'}
                      </td>

                      {/* Double OT */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-purple-700">
                        {row.doubleOtHours > 0 ? `+${row.doubleOtHours.toFixed(2)}h` : '0.00h'}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => updateRowTime(row.employeeId, 'notes', e.target.value)}
                          placeholder="Note..."
                          className="w-28 sm:w-36 py-1 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </td>

                      {/* Row Save */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveRow(row)}
                          disabled={savingRowId === row.employeeId}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                            row.isDirty
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {savingRowId === row.employeeId ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Save</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ====================================================================
          CSV BULK IMPORT MODAL
      ==================================================================== */}
      {csvModalOpen && (
        <CsvBulkImportModal
          staffList={staffList}
          onClose={() => setCsvModalOpen(false)}
          onSuccess={() => {
            setCsvModalOpen(false);
            showToast('CSV attendance imported and synchronized.');
            loadStaffAndAttendance(true);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// EMBEDDED CSV BULK IMPORT MODAL COMPONENT
// ============================================================================

interface CsvParsedRecord {
  emp_code: string;
  employee_id: string;
  full_name: string;
  date: string;
  in_time: string;
  out_time: string;
  is_double_ot_day: boolean;
  notes: string;
  regular_hours: number;
  normal_ot_hours: number;
  double_ot_hours: number;
  isValid: boolean;
  errorMsg?: string;
}

function CsvBulkImportModal({
  staffList,
  onClose,
  onSuccess,
}: {
  staffList: AttendanceStaffMember[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<CsvParsedRecord[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map emp_code -> staff
  const staffMap = useMemo(() => {
    const map = new Map<string, AttendanceStaffMember>();
    staffList.forEach((s) => map.set(s.emp_code.toUpperCase(), s));
    return map;
  }, [staffList]);

  const handleParseCsv = (text: string) => {
    try {
      setParsingError(null);
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV file contains no data rows.');
      }

      // Split CSV line respecting quotes
      const splitLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let insideQuote = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' || ch === "'") {
            insideQuote = !insideQuote;
          } else if (ch === ',' && !insideQuote) {
            result.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else {
            cur += ch;
          }
        }
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const header = splitLine(lines[0] || '').map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

      const codeIdx = header.findIndex((h) => h.includes('code') || h === 'emp_code');
      const dateIdx = header.findIndex((h) => h.includes('date'));
      const inIdx = header.findIndex((h) => h.includes('in'));
      const outIdx = header.findIndex((h) => h.includes('out'));
      const doubleIdx = header.findIndex((h) => h.includes('double'));
      const notesIdx = header.findIndex((h) => h.includes('note'));

      if (codeIdx === -1 || dateIdx === -1 || inIdx === -1 || outIdx === -1) {
        throw new Error('CSV missing required headers: emp_code, date, in_time, out_time.');
      }

      const records: CsvParsedRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = splitLine(lines[i] || '');
        if (parts.length < 4) continue;

        const empCode = (parts[codeIdx] || '').toUpperCase();
        const dateStr = parts[dateIdx] || '';
        const inStr = (parts[inIdx] || '').substring(0, 5);
        const outStr = (parts[outIdx] || '').substring(0, 5);
        const isDouble = doubleIdx !== -1 ? (parts[doubleIdx] || '').toLowerCase() === 'true' : false;
        const notes = notesIdx !== -1 ? parts[notesIdx] || '' : '';

        const staff = staffMap.get(empCode);

        // Zod validation
        const parseResult = CsvAttendanceRowSchema.safeParse({
          emp_code: empCode,
          date: dateStr,
          in_time: inStr,
          out_time: outStr,
          is_double_ot_day: isDouble,
          notes,
        });

        if (!parseResult.success) {
          records.push({
            emp_code: empCode,
            employee_id: staff?.id || '',
            full_name: staff?.full_name || 'Unknown Staff',
            date: dateStr,
            in_time: inStr,
            out_time: outStr,
            is_double_ot_day: isDouble,
            notes,
            regular_hours: 0,
            normal_ot_hours: 0,
            double_ot_hours: 0,
            isValid: false,
            errorMsg: parseResult.error.issues[0]?.message || 'Validation error',
          });
          continue;
        }

        if (!staff) {
          records.push({
            emp_code: empCode,
            employee_id: '',
            full_name: 'Unrecognized Code',
            date: dateStr,
            in_time: inStr,
            out_time: outStr,
            is_double_ot_day: isDouble,
            notes,
            regular_hours: 0,
            normal_ot_hours: 0,
            double_ot_hours: 0,
            isValid: false,
            errorMsg: `No active staff member matched code "${empCode}"`,
          });
          continue;
        }

        // Calculate hours
        const calc = calculateDailyHours({
          inTime: `${dateStr}T${inStr}:00`,
          outTime: `${dateStr}T${outStr}:00`,
          shiftEndTime: staff.shift_end_time,
          breakMinutes: staff.break_minutes,
          isDoubleOtDay: isDouble,
        });

        records.push({
          emp_code: empCode,
          employee_id: staff.id,
          full_name: staff.full_name,
          date: dateStr,
          in_time: inStr,
          out_time: outStr,
          is_double_ot_day: isDouble,
          notes,
          regular_hours: calc.regularHours,
          normal_ot_hours: calc.normalOtHours,
          double_ot_hours: calc.doubleOtHours,
          isValid: true,
        });
      }

      setParsedRows(records);
    } catch (err: any) {
      setParsingError(err.message || 'Failed to parse CSV');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) handleParseCsv(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) handleParseCsv(content);
    };
    reader.readAsText(file);
  };

  // Upsert all valid records
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid && r.employee_id);
    if (validRows.length === 0) {
      alert('No valid records to import.');
      return;
    }

    setIsUploading(true);
    try {
      const payload = validRows.map((r) => ({
        employee_id: r.employee_id,
        date: r.date,
        in_time: `${r.date}T${r.in_time}:00+05:30`,
        out_time: `${r.date}T${r.out_time}:00+05:30`,
        regular_hours: r.regular_hours,
        normal_ot_hours: r.normal_ot_hours,
        double_ot_hours: r.double_ot_hours,
        is_double_ot_day: r.is_double_ot_day,
        notes: r.notes || null,
      }));

      const { error } = await supabase
        .from('payroll_attendance')
        .upsert(payload, { onConflict: 'employee_id,date' });

      if (error) throw error;

      onSuccess();
    } catch (err: any) {
      console.error('[CSV Import] Upsert error:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Bulk Attendance CSV Uploader
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload monthly clock-in/out records. Rows are automatically validated with employee resolution and zero duplicates.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        {parsedRows.length === 0 ? (
          <div className="py-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                dragOver
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">
                Drag and drop your attendance CSV file here
              </p>
              <p className="text-xs text-slate-500 mt-1">or click to browse your computer</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {parsingError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{parsingError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4 text-xs">
            {/* Import Summary */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800">Total Rows: {parsedRows.length}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {validCount} Valid
                </span>
                {invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    {invalidCount} Invalid
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setParsedRows([])}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Upload Different File
              </button>
            </div>

            {/* Preview Table */}
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0F172A] text-white uppercase text-[10px] font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Code & Name</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">In</th>
                    <th className="px-3 py-2">Out</th>
                    <th className="px-3 py-2 text-right">Regular</th>
                    <th className="px-3 py-2 text-right">OT</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                      <td className="px-3 py-2 font-medium">
                        <span className="font-mono text-[10px] text-slate-500 mr-1.5">{row.emp_code}</span>
                        <span>{row.full_name}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{row.date}</td>
                      <td className="px-3 py-2 font-mono">{row.in_time}</td>
                      <td className="px-3 py-2 font-mono">{row.out_time}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.regular_hours.toFixed(2)}h</td>
                      <td className="px-3 py-2 text-right font-mono text-purple-700">
                        {row.is_double_ot_day
                          ? `2x: ${row.double_ot_hours.toFixed(2)}h`
                          : `1.5x: ${row.normal_ot_hours.toFixed(2)}h`}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.isValid ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Valid
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800" title={row.errorMsg}>
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 50 && (
              <p className="text-[11px] text-slate-400 text-center">
                Showing first 50 rows of {parsedRows.length} total rows.
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isUploading || validCount === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <span>Confirm &amp; Upsert {validCount} Records</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
