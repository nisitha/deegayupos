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
  Layers,
  Sparkles,
  RefreshCw,
  Store,
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
  DashboardChartsData,
  DashboardMetrics,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { dashboardApi } from '../../lib/api-client';

export default function DashboardPage() {
  const { selectedBranchId, currency, hasPermission } =
    useTenantBranch();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [charts, setCharts] = useState<DashboardChartsData | null>(null);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, chartsRes, activityRes] = await Promise.all([
        dashboardApi.getMetrics(selectedBranchId || undefined),
        dashboardApi.getCharts(7, selectedBranchId || undefined),
        dashboardApi.getActivity(10, selectedBranchId || undefined),
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data);
      if (chartsRes.data) setCharts(chartsRes.data);
      if (activityRes.data) setActivity(activityRes.data);
    } catch (err) {
      console.error('Failed to load dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = (val?: number) => {
    const num = val ?? 0;
    return `${currency} ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Command Center
            <span className="text-xs px-2.5 py-0.5 rounded-full font-normal bg-cyan-950/60 text-cyan-400 border border-cyan-500/20">
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time branch telemetry, sales volume, register activity, and inventory health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0E1422] border border-[#1F2C44] text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>

          {hasPermission('pos:access') && (
            <Link
              href="/dashboard/pos"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-semibold text-xs transition-all shadow-md shadow-cyan-950/30"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Launch POS</span>
            </Link>
          )}
        </div>
      </div>

      {/* 1. Top KPI Telemetry Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Sales */}
        <div className="p-4 rounded-xl bg-[#0E1422] border border-[#1F2C44] relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Today&apos;s Sales</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(metrics?.todaySales)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {metrics?.salesGrowthPercent ?? 0}%
              </span>
              <span>vs yesterday</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />
        </div>

        {/* KPI 2: Total Orders */}
        <div className="p-4 rounded-xl bg-[#0E1422] border border-[#1F2C44] relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Completed Orders</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-white tracking-tight">
              {metrics?.transactionCount ?? 0}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="text-zinc-300 font-mono">
                {metrics?.activeRegistersCount ?? 0} operational
              </span>
              <span>register(s)</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
        </div>

        {/* KPI 3: Average Order Value */}
        <div className="p-4 rounded-xl bg-[#0E1422] border border-[#1F2C44] relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Average Ticket Value</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(metrics?.avgTransactionValue)}
            </div>
            <div className="mt-1 text-[11px] text-zinc-400">Per customer checkout</div>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />
        </div>

        {/* KPI 4: Low Stock Alerts */}
        <div className="p-4 rounded-xl bg-[#0E1422] border border-[#1F2C44] relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Low Stock Warnings</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-white tracking-tight">
              {metrics?.lowStockCount ?? 0}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {(metrics?.lowStockCount ?? 0) > 0 ? (
                <span className="text-amber-400 font-medium">Reorder needed</span>
              ) : (
                <span className="text-emerald-400 font-medium">Stock levels healthy</span>
              )}
            </div>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
        </div>
      </div>

      {/* 2. Main Analytics Grid: Sales Trend Chart & Payment Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0E1422] border border-[#1F2C44] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Sales & Revenue Timeline</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Past 7 days gross revenue distribution
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#161F33] text-cyan-400 border border-cyan-500/20">
              Daily
            </span>
          </div>

          <div className="w-full h-64 mt-2">
            {isMounted && charts?.timeline && charts.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={charts.timeline}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2C44" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#1F2C44' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#1F2C44' }}
                    tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0E1422',
                      borderColor: '#1F2C44',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown) => [
                      formatCurrency(Number(value) || 0),
                      'Revenue',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                <TrendingUp className="w-6 h-6 mb-2 text-zinc-600" />
                No sales data recorded for this period
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Distribution (1 Col) */}
        <div className="p-5 rounded-xl bg-[#0E1422] border border-[#1F2C44] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Payment Methods</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Distribution by transaction type</p>
              </div>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="space-y-3.5 mt-2">
              {charts?.paymentMix && charts.paymentMix.length > 0 ? (
                charts.paymentMix.map((pm) => (
                  <div key={pm.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-300 capitalize">
                        {pm.method.replace('_', ' ').toLowerCase()}
                      </span>
                      <span className="font-mono text-zinc-400">{formatCurrency(pm.total)}</span>
                    </div>
                    <div className="h-2 w-full bg-[#161F33] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                        style={{
                          width: `${pm.total > 0 ? Math.min(100, Math.max(10, pm.total)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No payment data available
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F2C44]/60 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Supported Gateways</span>
            <span className="text-cyan-400 font-mono">Cash • Card • LankaQR</span>
          </div>
        </div>
      </div>

      {/* 3. Secondary Grid: Quick Actions & Live Chronological Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Action Shortcuts (1 Col) */}
        <div className="p-5 rounded-xl bg-[#0E1422] border border-[#1F2C44] space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Common operational shortcuts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {hasPermission('pos:access') && (
              <Link
                href="/dashboard/pos"
                className="flex items-center justify-between p-3 rounded-lg bg-[#141C2E]/60 border border-[#1F2C44] hover:border-cyan-500/40 hover:bg-[#141C2E] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Start New Sale</div>
                    <div className="text-[10px] text-zinc-400">Launch POS Checkout</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
              </Link>
            )}

            {hasPermission('inventory:view') && (
              <Link
                href="/dashboard/products"
                className="flex items-center justify-between p-3 rounded-lg bg-[#141C2E]/60 border border-[#1F2C44] hover:border-emerald-500/40 hover:bg-[#141C2E] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Manage Products</div>
                    <div className="text-[10px] text-zinc-400">Catalog & Barcodes</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </Link>
            )}

            {hasPermission('pos:access') && (
              <Link
                href="/dashboard/registers"
                className="flex items-center justify-between p-3 rounded-lg bg-[#141C2E]/60 border border-[#1F2C44] hover:border-cyan-500/40 hover:bg-[#141C2E] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Cash Registers</div>
                    <div className="text-[10px] text-zinc-400">Shifts & Cash Drawer</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
              </Link>
            )}

            {hasPermission('settings:view') && (
              <Link
                href="/dashboard/settings"
                className="flex items-center justify-between p-3 rounded-lg bg-[#141C2E]/60 border border-[#1F2C44] hover:border-zinc-600 hover:bg-[#141C2E] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Business Settings</div>
                    <div className="text-[10px] text-zinc-400">Taxes, Invoices, Branches</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              </Link>
            )}
          </div>
        </div>

        {/* Live Recent Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0E1422] border border-[#1F2C44] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Live Activity Feed</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Chronological audit events</p>
              </div>
              <Clock className="w-4 h-4 text-zinc-400" />
            </div>

            <div className="divide-y divide-[#1F2C44]/60">
              {activity && activity.length > 0 ? (
                activity.slice(0, 5).map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#161F33] border border-[#1F2C44] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-zinc-200">
                          {act.action.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {act.user?.fullName ? (
                            <span>By {act.user.fullName}</span>
                          ) : (
                            <span>System Action</span>
                          )}
                          {' • '}
                          <span className="font-mono text-[10px] text-zinc-500">
                            {new Date(act.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141C2E] text-zinc-400 border border-[#1F2C44] shrink-0">
                      {act.entity}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-zinc-500 text-xs">
                  No recent activity logged for this branch
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1F2C44]/60 flex items-center justify-between text-xs text-zinc-400">
            <span>Real-time event logging</span>
            <span className="text-cyan-400 text-xs">All events auditable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
