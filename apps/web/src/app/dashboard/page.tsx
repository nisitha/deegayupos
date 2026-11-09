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
  FileText,
  Boxes,
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
  const { selectedBranchId, currency } = useTenantBranch();

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Command Center
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time branch telemetry, sales volume, register activity, and inventory health.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Launch POS</span>
            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold text-white/90">
              F1
            </kbd>
          </Link>
        </div>
      </div>

      {/* 1. Top KPI Telemetry Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Sales */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-blue-400/50 hover:shadow-pos-card-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Sales</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(metrics?.todaySales)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {metrics?.salesGrowthPercent ?? 0}%
              </span>
              <span>vs yesterday</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-emerald-400/50 hover:shadow-pos-card-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Orders</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.transactionCount ?? 0}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-slate-700 font-medium font-mono">
                {metrics?.activeRegistersCount ?? 0} operational
              </span>
              <span>register(s)</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Order Value */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-blue-400/50 hover:shadow-pos-card-hover transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Ticket</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(metrics?.avgTransactionValue)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Per customer checkout</div>
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
                <span className="text-amber-600 font-semibold">Reorder needed</span>
              ) : (
                <span className="text-emerald-600 font-semibold">Stock levels healthy</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Analytics Grid: Sales Trend Chart & Payment Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sales & Revenue Timeline</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Past 7 days gross revenue distribution
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
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
                      <stop offset="5%" stopColor="#2F65F6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2F65F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="date"
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
                    tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '12px',
                      color: '#0F172A',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
                    }}
                    formatter={(value: unknown) => [
                      formatCurrency(Number(value) || 0),
                      'Revenue',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2F65F6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
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
                <h2 className="text-sm font-bold text-slate-900">Payment Methods</h2>
                <p className="text-xs text-slate-500 mt-0.5">Distribution by transaction type</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-4 mt-2">
              {charts?.paymentMix && charts.paymentMix.length > 0 ? (
                charts.paymentMix.map((pm) => (
                  <div key={pm.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 capitalize">
                        {pm.method.replace('_', ' ').toLowerCase()}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(pm.total)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                        style={{
                          width: `${pm.total > 0 ? Math.min(100, Math.max(10, pm.total)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No payment data available
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Supported Gateways</span>
            <span className="text-blue-600 font-semibold font-mono">Cash • Card • LankaQR</span>
          </div>
        </div>
      </div>

      {/* 3. Secondary Grid: Quick Actions & Live Chronological Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Action Shortcuts (1 Col) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Common operational shortcuts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {/* Action 1: Open POS Terminal */}
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

            {/* Action 2: Add New Product */}
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
                  <div className="text-[11px] text-slate-500">SKUs, Barcodes & Variants</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </Link>

            {/* Action 3: View Stock Alerts */}
            <Link
              href="/dashboard/inventory"
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

            {/* Action 4: Daily Sales Report */}
            <Link
              href="/dashboard/sales"
              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    Daily Sales Report
                  </div>
                  <div className="text-[11px] text-slate-500">Receipts & Invoices</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
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
