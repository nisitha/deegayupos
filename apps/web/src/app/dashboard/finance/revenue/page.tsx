'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Download,
  RefreshCw,
  TrendingUp,
  DollarSign,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  Package,
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
import { useTenantBranch } from '../../../../context/tenant-branch-context';
import { posApi } from '../../../../lib/api-client';

type Period = 'today' | 'week' | 'month';

interface AnalyticsData {
  period: string;
  startDate: string;
  endDate: string;
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

export default function RevenueDeskPage() {
  const { currency, selectedBranchId } = useTenantBranch();
  const [period, setPeriod] = useState<Period>('month');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchRevenueData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await posApi.getAnalytics<AnalyticsData>({
        period,
        branchId: selectedBranchId && selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
      });
      if (res.data) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error('Failed to load revenue analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedBranchId]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const formatCurrency = (val?: number) => {
    const num = val ?? 0;
    return `${currency} ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleExportCsv = () => {
    if (!analytics) return;

    const summaryHeaders = ['Metric', 'Value'];
    const summaryRows = [
      ['Report Period', analytics.period.toUpperCase()],
      ['Start Date', analytics.startDate],
      ['End Date', analytics.endDate],
      ['Gross Sales (LKR)', analytics.grossSales.toFixed(2)],
      ['Total Discounts (LKR)', analytics.totalDiscount.toFixed(2)],
      ['Total Tax (LKR)', analytics.totalTax.toFixed(2)],
      ['Cost of Goods Sold (LKR)', analytics.totalCost.toFixed(2)],
      ['Net Profit (LKR)', analytics.netProfit.toFixed(2)],
      ['Profit Margin (%)', `${analytics.profitMargin}%`],
      ['Completed Bills', analytics.billCount.toString()],
      ['Voided Bills', analytics.voidedBillCount.toString()],
      ['Average Order Value (LKR)', analytics.averageOrderValue.toFixed(2)],
      ['Cash Collections (LKR)', (analytics.paymentBreakdown?.cash ?? 0).toFixed(2)],
      ['Card POS Collections (LKR)', (analytics.paymentBreakdown?.card ?? 0).toFixed(2)],
      ['LankaQR Collections (LKR)', (analytics.paymentBreakdown?.qr ?? 0).toFixed(2)],
      ['Customer Khata Credit (LKR)', (analytics.paymentBreakdown?.credit ?? 0).toFixed(2)],
    ];

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += '--- FINANCIAL SUMMARY ---\n';
    csvContent += summaryHeaders.join(',') + '\n';
    csvContent += summaryRows.map((r) => r.join(',')).join('\n') + '\n\n';

    if (analytics.topProducts && analytics.topProducts.length > 0) {
      csvContent += '--- TOP PRODUCTS PERFORMANCE ---\n';
      const prodHeaders = ['Product Name', 'SKU', 'Units Sold', 'Revenue (LKR)', 'Profit (LKR)'];
      csvContent += prodHeaders.join(',') + '\n';
      csvContent +=
        analytics.topProducts
          .map((p) =>
            [
              `"${p.name.replace(/"/g, '""')}"`,
              p.sku || 'N/A',
              p.quantity,
              p.revenue.toFixed(2),
              p.profit.toFixed(2),
            ].join(','),
          )
          .join('\n') + '\n';
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pixelcraft-revenue-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pb = analytics?.paymentBreakdown || { cash: 0, card: 0, credit: 0, qr: 0, other: 0 };
  const totalPayments =
    (pb.cash ?? 0) +
    (pb.card ?? 0) +
    (pb.credit ?? 0) +
    (pb.qr ?? 0) +
    (pb.other ?? 0);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Revenue Desk</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 font-sinhala">
                ආදායම් සහ මූල්‍ය වාර්තා
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live gross revenue, net profit margins, payment distributions, and audited financial statements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'today'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={fetchRevenueData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh financial data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!analytics}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
            title="Export full financial summary to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/dashboard/orders"
            className="px-3.5 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-pos-btn transition-all"
          >
            Sales Register &rarr;
          </Link>
        </div>
      </div>

      {/* 4 Core Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Sales</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(analytics?.grossSales)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {analytics?.billCount ?? 0} settled transactions
            </div>
          </div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total COGS</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(analytics?.totalCost)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Direct inventory procurement cost
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {formatCurrency(analytics?.netProfit)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                {analytics?.profitMargin ?? 0}%
              </span>
              <span>Profit Margin</span>
            </div>
          </div>
        </div>

        {/* Khata Credit Outstanding */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khata Receivables</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-purple-700 tracking-tight">
              {formatCurrency(analytics?.paymentBreakdown.credit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Pending credit settlement
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Profit Timeline Chart */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Revenue & Profit Progression</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily revenue volume vs net margin across the selected window
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded-full bg-[#005BD3]" /> Gross Sales
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-3 h-3 rounded-full bg-emerald-500" /> Net Profit
            </span>
          </div>
        </div>

        <div className="w-full h-80 mt-2">
          {isMounted && analytics?.dailyTrend && analytics.dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analytics.dailyTrend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#005BD3" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#005BD3" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
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
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
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
                  formatter={(value: unknown, name: unknown) => [
                    formatCurrency(Number(value) || 0),
                    name === 'sales' ? 'Gross Sales' : 'Net Profit',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#005BD3"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesGrad)"
                  name="sales"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#netGrad)"
                  name="profit"
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

      {/* Payment Gateway Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <span>Cash Tendered</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {formatCurrency(pb.cash ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalPayments > 0
              ? `${(((pb.cash ?? 0) / totalPayments) * 100).toFixed(1)}% of total collections`
              : '0%'}
          </div>
        </div>

        {/* Card */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>Card POS Terminal</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {formatCurrency(pb.card ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalPayments > 0
              ? `${(((pb.card ?? 0) / totalPayments) * 100).toFixed(1)}% of total collections`
              : '0%'}
          </div>
        </div>

        {/* LankaQR */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>LankaQR Digital</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {formatCurrency(pb.qr ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalPayments > 0
              ? `${(((pb.qr ?? 0) / totalPayments) * 100).toFixed(1)}% of total collections`
              : '0%'}
          </div>
        </div>

        {/* Khata Credit */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
            <UserCheck className="w-4 h-4 text-amber-600" />
            <span>Customer Credit (Khata)</span>
          </div>
          <div className="text-xl font-bold text-amber-800 mt-2">
            {formatCurrency(pb.credit ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalPayments > 0
              ? `${(((pb.credit ?? 0) / totalPayments) * 100).toFixed(1)}% of total collections`
              : '0%'}
          </div>
        </div>
      </div>

      {/* Top Margin Products Table */}
      {analytics?.topProducts && analytics.topProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Highest Profit Contributors</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ayurvedic items generating greatest net earnings</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Top 10 SKUs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Revenue (LKR)</th>
                  <th className="py-3 px-4 text-right">Net Profit (LKR)</th>
                  <th className="py-3 px-4 text-right">Contribution %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.topProducts.map((p, idx) => (
                  <tr key={p.productId || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p?.name || 'Product'}
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
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(p.profit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {analytics.grossSales > 0
                        ? `${((p.revenue / analytics.grossSales) * 100).toFixed(1)}%`
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
