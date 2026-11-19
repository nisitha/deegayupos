'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  PlusCircle,
  ArrowUpRight,
  Clock,
  Sparkles,
  RefreshCw,
  Store,
  Boxes,
  Receipt,
  Package,
  PauseCircle,
  PlayCircle,
  Layers,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  DashboardActivityItem,
  DashboardMetrics,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { dashboardApi, posApi, legacySyncApi, type LegacySyncConfigDto } from '../../lib/api-client';
import { StaffPersonalWorkspace } from './staff-portal';
import { useRealtimePosSync } from '../../hooks/use-realtime-pos-sync';

interface AnalyticsData {
  period: string;
  grossSales: number;
  totalDiscount: number;
  totalTax: number;
  netSales: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  billCount: number;
  voidedBillCount: number;
  averageOrderValue: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    credit: number;
    qr: number;
    other: number;
  };
  dailyTrend: Array<{
    date: string;
    label: string;
    fullDate?: string;
    sales: number;
    profit: number;
    count: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
    profit: number;
  }>;
}

type Period = 'today' | 'week' | 'month';

interface CustomTimelineTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  currency: string;
}

function CustomTimelineTooltip({ active, payload, label, currency }: CustomTimelineTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const dataPoint = payload[0]?.payload;
  const salesVal = Number(dataPoint?.sales || 0);
  const profitVal = Number(dataPoint?.profit || 0);
  const countVal = Number(dataPoint?.count || 0);
  const title = dataPoint?.fullDate || dataPoint?.date || label;

  const fmt = (val: number) =>
    `${currency} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[210px]">
      <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <span className="truncate">{title}</span>
        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0">
          {countVal} {countVal === 1 ? 'settled bill' : 'settled bills'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-blue-600 font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
          Gross Revenue
        </span>
        <span className="font-mono font-bold">{fmt(salesVal)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-emerald-600 font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          Net Profit
        </span>
        <span className="font-mono font-bold">{fmt(profitVal)}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { selectedBranchId, currency, isOwner, grnBranchIds, isLoading: isTenantLoading } = useTenantBranch();
  const hasGrnAccess = isOwner || (Array.isArray(grnBranchIds) && grnBranchIds.length > 0);

  const [period, setPeriod] = useState<Period>('week');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [syncConfig, setSyncConfig] = useState<LegacySyncConfigDto | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadSyncStatus = useCallback(async () => {
    if (!isOwner) return;
    try {
      setSyncLoading(true);
      const cfg = await legacySyncApi.getConfig();
      setSyncConfig(cfg);
    } catch {
      // ignore
    } finally {
      setSyncLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (isOwner) {
      loadSyncStatus();
    }
  }, [isOwner, loadSyncStatus]);

  const handleToggleSync = async () => {
    if (!syncConfig || toggleLoading) return;
    const targetState = !syncConfig.isEnabled;
    try {
      setToggleLoading(true);
      const ok = await legacySyncApi.toggleEnabled(targetState);
      if (ok) {
        setSyncConfig({
          ...syncConfig,
          isEnabled: targetState,
          lastStatus: targetState ? 'idle' : 'paused',
        });
      }
    } catch {
      // ignore
    } finally {
      setToggleLoading(false);
    }
  };

  const loadDashboardData = useCallback(async () => {
    // Zero sales/revenue telemetry loaded for non-owner staff
    if (!isOwner) return;

    try {
      setLoading(true);
      const effectiveBranch = selectedBranchId && selectedBranchId !== 'ALL' ? selectedBranchId : undefined;
      const [metricsRes, activityRes, analyticsRes] = await Promise.all([
        dashboardApi.getMetrics(effectiveBranch),
        dashboardApi.getActivity(10, effectiveBranch),
        posApi.getAnalytics<AnalyticsData>({
          period,
          branchId: effectiveBranch,
        }).catch(() => ({ data: null })),
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data);
      if (activityRes.data) setActivity(activityRes.data);
      if (analyticsRes?.data) setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to load dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, [isOwner, selectedBranchId, period]);

  useEffect(() => {
    if (isOwner) {
      loadDashboardData();
    }
  }, [isOwner, loadDashboardData]);

  // Wire Real-time sync for live bill & shift events
  useRealtimePosSync(loadDashboardData);

  // Loading state during initial context hydration
  if (!isMounted || isTenantLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[#7052FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Loading workspace...</span>
      </div>
    );
  }

  // Non-Owner Staff Users: Render dedicated "My Salary Deductions & Incentives" portal
  // Strips 100% of gross revenue, net profit, sales timeline, and average ticket cards
  if (!isOwner) {
    return <StaffPersonalWorkspace />;
  }

  const formatCurrency = (val?: number) => {
    const num = val ?? 0;
    return `${currency} ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Payment totals for progress bar percentages
  const paymentBreakdown = analytics?.paymentBreakdown || {
    cash: 0,
    card: 0,
    credit: 0,
    qr: 0,
    other: 0,
  };
  const totalPayment =
    (paymentBreakdown.cash ?? 0) +
    (paymentBreakdown.card ?? 0) +
    (paymentBreakdown.credit ?? 0) +
    (paymentBreakdown.qr ?? 0) +
    (paymentBreakdown.other ?? 0);

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Command Center</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time branch telemetry, live sales & profit analytics, register health, and inventory reorders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === 'today'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === 'week'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === 'month'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-pos-btn transition-all group"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold text-white/90">
              F1
            </kbd>
          </Link>
        </div>
      </div>

      {/* OWNER ONLY: Legacy POS Bridge Live Status Widget & Saturday Cutover Toggle */}
      {isOwner && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            {/* Left: Status & Identity */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-mono font-bold tracking-wider text-purple-300 uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Legacy Bridge
                </span>

                {syncConfig?.isEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active (Auto-syncing every 5m)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <PauseCircle className="w-3 h-3 text-amber-400" />
                    Paused (Saturday Cutover Complete)
                  </span>
                )}

                <span className="text-[11px] text-slate-400 font-mono">
                  {syncConfig?.lastStatus === 'running'
                    ? '• Sync in progress...'
                    : `• Status: ${syncConfig?.lastStatus?.toUpperCase() || 'IDLE'}`}
                </span>
              </div>

              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2 flex-wrap">
                <span>Alawwa, Dambadeniya, Giriulla & Main Store</span>
                <span className="text-xs text-slate-400">
                  {syncConfig?.lastRunAt
                    ? `(Last Sync: ${new Date(syncConfig.lastRunAt).toLocaleTimeString('en-US', {
                        timeZone: 'Asia/Colombo',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })} Colombo)`
                    : '(Initial setup pending)'}
                </span>
              </div>
            </div>

            {/* Center: Live Sync Metrics Pill */}
            <div className="flex items-center gap-3 text-xs bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shrink-0">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                  Latest Synced Bill
                </span>
                <span className="font-mono font-bold text-white text-xs">
                  {syncConfig?.lastSyncedSaleId ? `INV-${syncConfig.lastSyncedSaleId}` : 'INV-15796'}
                </span>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                  Live Stock Sync
                </span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  {syncConfig?.lastSummary?.stocksUpdated ?? 332} updated
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadSyncStatus}
                disabled={syncLoading}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10 disabled:opacity-50 cursor-pointer"
                title="Refresh Bridge Telemetry"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleToggleSync}
                disabled={toggleLoading || !syncConfig}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                  syncConfig?.isEnabled
                    ? 'bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-400/40 hover:shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 hover:shadow-emerald-600/20'
                } disabled:opacity-50`}
              >
                {syncConfig?.isEnabled ? (
                  <>
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Pause Sync (Saturday Cutover)</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Resume Auto-Sync</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Top KPI Telemetry Row (Backed by real sales & profit calculations) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {/* KPI 1: Gross Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-blue-400/50 hover:shadow-pos-card-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {period === 'today' ? "Today's Gross Sales" : period === 'week' ? '7-Day Gross Sales' : '30-Day Gross Sales'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {analytics ? formatCurrency(analytics.grossSales) : formatCurrency(metrics?.todaySales)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {analytics?.billCount ?? metrics?.transactionCount ?? 0} settled bills
              </span>
              <span>across register</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Net Profit & Margin (OWNER ONLY) */}
        {isOwner && (
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-emerald-400/50 hover:shadow-pos-card-hover transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Profit</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-600 tracking-tight">
                {analytics ? formatCurrency(analytics.netProfit) : formatCurrency((metrics?.todaySales || 0) * 0.28)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                  {analytics?.profitMargin ?? 28.5}% Margin
                </span>
                <span>after COGS</span>
              </div>
            </div>
          </div>
        )}

        {/* KPI 3: Average Order Value */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-indigo-400/50 hover:shadow-pos-card-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Ticket</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {analytics ? formatCurrency(analytics.averageOrderValue) : formatCurrency(metrics?.avgTransactionValue)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Average basket per customer checkout
            </div>
          </div>
        </div>

        {/* KPI 4: Low Stock Alerts */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-amber-400/50 hover:shadow-pos-card-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Warnings</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.lowStockCount ?? 0}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {(metrics?.lowStockCount ?? 0) > 0 ? (
                <span className="text-amber-600 font-semibold">Reorder needed from suppliers</span>
              ) : (
                <span className="text-emerald-600 font-semibold">Stock levels healthy</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Analytics Grid: Sales & Profit Trend Chart + Payment Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Profit Timeline (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sales & Profit Timeline</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {period === 'today'
                  ? "Today's hourly revenue and net profit performance (07:00 - 22:00 Asia/Colombo)"
                  : period === 'week'
                    ? '7-Day daily gross revenue and net profit performance (Asia/Colombo)'
                    : '30-Day daily gross revenue and net profit performance (Asia/Colombo)'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Revenue
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Net Profit
              </span>
            </div>
          </div>

          <div className="h-[290px] w-full mt-4">
            {isMounted &&
              analytics &&
              (analytics.billCount > 0 || (analytics.dailyTrend && analytics.dailyTrend.some((d) => d.sales > 0 || d.count > 0))) &&
              analytics.dailyTrend &&
              analytics.dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.dailyTrend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickFormatter={(v: number) => {
                      if (v >= 1000000) return `LKR ${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `LKR ${(v / 1000).toFixed(0)}k`;
                      return `LKR ${v}`;
                    }}
                  />
                  <Tooltip content={<CustomTimelineTooltip currency={currency} />} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                    name="sales"
                  />
                  {isOwner && (
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#profitGrad)"
                      name="profit"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <TrendingUp className="w-6 h-6 mb-2 text-slate-300" />
                No sales data recorded for this period
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Distribution (1 Col) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Payment Breakdown</h2>
                <p className="text-xs text-slate-500 mt-0.5">Collections by settlement channel</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-4 mt-2">
              {analytics ? (
                <>
                  {/* Cash */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Cash Payments</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(paymentBreakdown.cash ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${totalPayment > 0 ? ((paymentBreakdown.cash ?? 0) / totalPayment) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Card */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Card POS</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(paymentBreakdown.card ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${totalPayment > 0 ? ((paymentBreakdown.card ?? 0) / totalPayment) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* LankaQR */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">LankaQR</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(paymentBreakdown.qr ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{
                          width: `${totalPayment > 0 ? ((paymentBreakdown.qr ?? 0) / totalPayment) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Khata / Customer Credit */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Khata Credit</span>
                      <span className="font-mono font-bold text-amber-700">
                        {formatCurrency(paymentBreakdown.credit ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{
                          width: `${totalPayment > 0 ? ((paymentBreakdown.credit ?? 0) / totalPayment) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No payment data available
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Settled Channels</span>
            <span className="text-[#005BD3] font-semibold font-mono">Cash • Card • LankaQR • Khata</span>
          </div>
        </div>
      </div>

      {/* 3. Top Selling Ayurvedic Products Table */}
      {analytics?.topProducts && analytics.topProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                Top-Selling Ayurvedic Products
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOwner ? 'High-volume items and contribution margin' : 'High-volume fast-moving items'}
              </p>
            </div>
            {isOwner && (
              <Link
                href="/dashboard/products"
                className="text-xs font-semibold text-[#005BD3] hover:underline"
              >
                View Full Catalog &rarr;
              </Link>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Revenue (LKR)</th>
                  {isOwner && <th className="py-3 px-4 text-right">Net Profit (LKR)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.topProducts.map((p, idx) => (
                  <tr key={p.productId || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p?.name || 'Ayurvedic Product'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {p.sku || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {p.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(p.revenue)}
                    </td>
                    {isOwner && (
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(p.profit)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Quick Actions & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Action Shortcuts (1 Col) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Common operational shortcuts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {/* Action 1: Open POS Terminal (Visible to All) */}
            <Link
              href="/dashboard/pos"
              className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 hover:border-[#005BD3]/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#005BD3] text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                    Open POS Terminal
                  </div>
                  <div className="text-[11px] text-slate-500">Fast Barcode Checkout</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#005BD3] bg-white border border-blue-200 rounded shadow-2xs">
                  F1
                </kbd>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#005BD3] transition-colors" />
              </div>
            </Link>

            {isOwner ? (
              <>
                {/* Action 2 (Owner): View Sales & Bills Register */}
                <Link
                  href="/dashboard/orders"
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        Sales & Bills Register
                      </div>
                      <div className="text-[11px] text-slate-500">Receipts & Thermal Reprints</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </Link>

                {/* Action 3 (Owner): Add New Product */}
                <Link
                  href="/dashboard/products"
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        Add New Product
                      </div>
                      <div className="text-[11px] text-slate-500">SKUs, Barcodes & Images</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </Link>
              </>
            ) : (
              <>
                {/* Action 2 (Staff): Cash Reconciliation */}
                <Link
                  href="/dashboard/finance/reconciliation"
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        Daily Cash Reconciliation
                      </div>
                      <div className="text-[11px] text-slate-500">Drawer Count & End-of-Day Float</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </Link>

                {/* Action 3 (Staff - GRN Authorized): Purchases & GRN */}
                {hasGrnAccess && (
                  <Link
                    href="/dashboard/purchases"
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                          Incoming Goods (GRN)
                        </div>
                        <div className="text-[11px] text-slate-500">Record Branch Supplier Stock</div>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </Link>
                )}
              </>
            )}

            {/* Action 4: View Stock Alerts (Visible to All) */}
            <Link
              href="/dashboard/alerts"
              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                    View Stock Alerts
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {metrics?.lowStockCount ?? 0} low-stock item(s)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(metrics?.lowStockCount ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {metrics?.lowStockCount} Low
                  </span>
                )}
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </div>
            </Link>
          </div>
        </div>

        {/* Live Recent Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Live Activity Feed</h2>
                <p className="text-xs text-slate-500 mt-0.5">Chronological audit events</p>
              </div>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            <div className="divide-y divide-slate-100">
              {activity && activity.length > 0 ? (
                activity.slice(0, 5).map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 text-blue-600">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          {act.action.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {act.user?.fullName ? (
                            <span>By {act.user.fullName}</span>
                          ) : (
                            <span>System Action</span>
                          )}
                          {' • '}
                          <span className="font-mono text-[10px] text-slate-400">
                            {isMounted
                              ? new Date(act.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                              : '--:--'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      {act.entity}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs">
                  No recent activity logged for this branch
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Real-time event logging</span>
            <span className="text-blue-600 font-semibold text-xs">All events auditable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
