'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Sparkles,
  Wallet,
  Building2,
  Store,
  Banknote,
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Award,
  Layers,
  ChevronRight,
  Calendar,
  FileText,
} from 'lucide-react';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { incentivesApi } from '../../lib/api-client';
import { supabase } from '../../lib/supabase';
import type { CashierShortageDto, StaffIncentiveDto } from '@pixelcraft/types';

export function StaffPersonalWorkspace() {
  const { user, branches, selectedBranchId, currency, grnBranchIds } = useTenantBranch();
  const hasGrnAccess = Array.isArray(grnBranchIds) && grnBranchIds.length > 0;

  const [shortages, setShortages] = useState<CashierShortageDto[]>([]);
  const [incentives, setIncentives] = useState<StaffIncentiveDto[]>([]);
  const [todayReconciliation, setTodayReconciliation] = useState<{
    id: string;
    status: string;
    reconciliation_date: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [shortageFilter, setShortageFilter] = useState<'all' | 'pending_payroll' | 'deducted'>('all');
  const [incentiveFilter, setIncentiveFilter] = useState<'all' | 'approved' | 'paid'>('all');

  // Sri Lanka current date
  const todayStr = useMemo(() => {
    try {
      const now = new Date();
      // UTC+5:30 offset
      const slDate = new Date(now.getTime() + (5.5 * 60 + now.getTimezoneOffset()) * 60000);
      return slDate.toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  const currentMonth = todayStr.slice(0, 7); // e.g. "2026-11"
  const monthName = useMemo(() => {
    try {
      const [year, month] = currentMonth.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return currentMonth;
    }
  }, [currentMonth]);

  // Active branch details
  const activeBranch = useMemo(() => {
    return (
      branches.find((b) => b.id === selectedBranchId) ||
      branches[0] || { id: '', name: 'Dispensary Branch' }
    );
  }, [branches, selectedBranchId]);

  // Fetch staff records
  const loadStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const [shortagesRes, incentivesRes] = await Promise.all([
        incentivesApi.getStaffShortages({
          staffId: user?.id,
          cashierName: user?.fullName,
        }),
        incentivesApi.getStaffIncentives({
          staffId: user?.id,
        }),
      ]);

      if (shortagesRes.data) {
        setShortages(shortagesRes.data);
      }
      if (incentivesRes.data) {
        setIncentives(incentivesRes.data);
      }

      // Check today's reconciliation for active branch
      if (activeBranch.id) {
        const { data: recData } = await supabase
          .from('daily_cash_reconciliations')
          .select('id, status, reconciliation_date')
          .eq('branch_id', activeBranch.id)
          .eq('reconciliation_date', todayStr)
          .maybeSingle();

        if (recData) {
          setTodayReconciliation({
            id: recData.id,
            status: recData.status,
            reconciliation_date: recData.reconciliation_date,
          });
        } else {
          setTodayReconciliation(null);
        }
      }
    } catch (err) {
      console.error('Failed to load staff personal metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.fullName, activeBranch.id, todayStr]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  // Metrics computation
  const pendingShortages = useMemo(
    () => shortages.filter((s) => s.deductionStatus === 'pending_payroll'),
    [shortages]
  );
  const pendingDeductionsTotal = useMemo(
    () => pendingShortages.reduce((sum, s) => sum + s.amount, 0),
    [pendingShortages]
  );

  const thisMonthIncentives = useMemo(
    () => incentives.filter((i) => i.incentiveDate.startsWith(currentMonth)),
    [incentives, currentMonth]
  );
  const totalIncentivesThisMonth = useMemo(
    () => thisMonthIncentives.reduce((sum, i) => sum + i.amount, 0),
    [thisMonthIncentives]
  );

  const netPayrollAdjustment = totalIncentivesThisMonth - pendingDeductionsTotal;
  const isNetPositive = netPayrollAdjustment >= 0;

  // Filtered lists for display
  const displayedShortages = useMemo(() => {
    if (shortageFilter === 'all') return shortages;
    return shortages.filter((s) => s.deductionStatus === shortageFilter);
  }, [shortages, shortageFilter]);

  const displayedIncentives = useMemo(() => {
    if (incentiveFilter === 'all') return incentives;
    return incentives.filter((i) => i.status === incentiveFilter);
  }, [incentives, incentiveFilter]);

  const formatLkr = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Staff Shift & Payroll Workspace
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Shift Active
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800 font-semibold">{user?.fullName || 'Dispensary Staff'}</strong>. Track your personal salary deductions, awarded bonuses, and shift reconciliations.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Assigned Branch: <strong>{activeBranch.name}</strong></span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-700">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Role: Dispensary Cashier</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{todayStr}</span>
            </div>
          </div>
        </div>

        {/* Operational Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <button
            onClick={loadStaffData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Refresh shift & payroll figures"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#7052FF]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/dashboard/finance/reconciliation"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Banknote className="w-4 h-4 text-emerald-600" />
            <span>Daily Cash Reconciliation</span>
            {todayReconciliation ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Submitted for today" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Due today" />
            )}
          </Link>

          {hasGrnAccess && (
            <Link
              href="/dashboard/purchases"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-2xs transition-colors"
            >
              <ClipboardCheck className="w-4 h-4 text-indigo-600" />
              <span>Purchases & GRN</span>
            </Link>
          )}

          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-bold text-xs shadow-pos-btn transition-all group"
          >
            <Store className="w-4 h-4" />
            <span>Open POS Terminal</span>
            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold text-white/90">
              F1
            </kbd>
          </Link>
        </div>
      </div>

      {/* 2. Four Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Salary Deductions */}
        <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-2xs relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Deductions
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 tracking-tight">
              {formatLkr(pendingDeductionsTotal)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-rose-600">
                {pendingShortages.length} pending till shortage(s)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            Deducted from monthly payroll
          </div>
        </div>

        {/* Card 2: Incentives & Bonuses (This Month) */}
        <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Incentives Earned
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {formatLkr(totalIncentivesThisMonth)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {thisMonthIncentives.length} bonus award(s)
              </span>
              <span>• {monthName}</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            Target & accuracy incentives
          </div>
        </div>

        {/* Card 3: Net Payroll Adjustment */}
        <div
          className={`p-5 rounded-2xl bg-white border shadow-2xs relative overflow-hidden transition-all ${
            isNetPositive
              ? 'border-emerald-300 hover:border-emerald-400'
              : 'border-rose-300 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Payroll Adjustment
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold ${
                isNetPositive
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-rose-50 text-rose-600 border-rose-100'
              }`}
            >
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight ${
                isNetPositive ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {isNetPositive ? '+' : '-'}{formatLkr(Math.abs(netPayrollAdjustment))}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span
                className={`font-bold px-2 py-0.5 rounded-full ${
                  isNetPositive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isNetPositive ? 'Net Bonus to Receive' : 'Net Salary Deduction'}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            Incentives ({formatLkr(totalIncentivesThisMonth)}) - Deductions ({formatLkr(pendingDeductionsTotal)})
          </div>
        </div>

        {/* Card 4: Assigned Branch & EOD Status */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Shift Reconciliation
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-slate-900 truncate">
              {activeBranch.name}
            </div>
            <div className="mt-1.5">
              {todayReconciliation ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Submitted ({todayReconciliation.status.toUpperCase()})</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Due at Shift Close</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <Link
              href="/dashboard/finance/reconciliation"
              className="text-[11px] font-bold text-[#005BD3] hover:text-[#004bb5] flex items-center gap-1"
            >
              <span>{todayReconciliation ? 'Review reconciliation' : 'Submit register close'}</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Two Clean Ledger Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: My Salary Deductions (cashier_shortages) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-slate-900 text-sm">
                  My Salary Deductions (`cashier_shortages`)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Till discrepancies assigned to your register shift during EOD cash balance
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setShortageFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  shortageFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({shortages.length})
              </button>
              <button
                onClick={() => setShortageFilter('pending_payroll')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  shortageFilter === 'pending_payroll'
                    ? 'bg-white text-rose-600 shadow-2xs'
                    : 'text-slate-500 hover:text-rose-600'
                }`}
              >
                Pending ({pendingShortages.length})
              </button>
              <button
                onClick={() => setShortageFilter('deducted')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  shortageFilter === 'deducted'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Deducted
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Reason / Notes</th>
                  <th className="py-3 px-3 text-right">Shortage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedShortages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500/80" />
                        <span className="font-bold text-slate-700 text-xs">No salary deductions recorded</span>
                        <span className="text-[11px] text-slate-400">Your till counts have balanced perfectly. Excellent work!</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedShortages.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {item.shortageDate}
                      </td>
                      <td className="py-3.5 px-3 text-slate-800 font-semibold truncate max-w-[120px]">
                        {item.branchName || 'Dispensary'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 max-w-[180px]">
                        <span className="line-clamp-2">{item.notes || 'End-of-day register variance'}</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-rose-600">
                        {formatLkr(item.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.deductionStatus === 'pending_payroll' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Payroll
                          </span>
                        ) : item.deductionStatus === 'deducted' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Deducted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Waived
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: My Incentives & Bonuses (staff_incentives) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  My Incentives & Bonuses (`staff_incentives`)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target bonuses, punctuality awards, and customer service incentives awarded to you
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setIncentiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  incentiveFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({incentives.length})
              </button>
              <button
                onClick={() => setIncentiveFilter('approved')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  incentiveFilter === 'approved'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setIncentiveFilter('paid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  incentiveFilter === 'paid'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-500 hover:text-blue-700'
                }`}
              >
                Paid
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Incentive Title</th>
                  <th className="py-3 px-3">Awarded By</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedIncentives.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <FileText className="w-7 h-7 text-slate-300" />
                        <span className="font-bold text-slate-700 text-xs">No incentives recorded for this period</span>
                        <span className="text-[11px] text-slate-400">New bonuses awarded by management will appear here automatically.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedIncentives.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {item.incentiveDate}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{item.title}</div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.notes}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {item.creatorName || 'Management'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                        +{formatLkr(item.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.status === 'paid' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Paid on Payroll
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Approved
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
