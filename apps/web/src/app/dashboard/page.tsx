'use client';

import React, { useEffect, useState, useCallback, useMemo, useTransition } from 'react';
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
  PauseCircle,
  PlayCircle,
  Layers,
  Building2,
  Calendar,
  User,
  ArrowUpDown,
  X,
  BarChart3,
  Flame,
  ShieldAlert,
  Search,
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
import type { DashboardActivityItem } from '@pixelcraft/types';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { dashboardApi, legacySyncApi, getColomboDateStr, type LegacySyncConfigDto } from '../../lib/api-client';
import { StaffPersonalWorkspace } from './staff-portal';
import { useRealtimePosSync } from '../../hooks/use-realtime-pos-sync';
import { supabase } from '../../lib/supabase';
import {
  buildColomboTimeline,
  getColomboDateString,
  getColomboHour,
  type TimelineDataPoint,
  type SpecialStockTimelineItem,
} from '../../lib/sales-timeline';

// ============================================================================
// CONSTANTS & 3 OPERATING BRANCHES (NO MAIN STORE)
// ============================================================================
const ACTIVE_BRANCHES = [
  { id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54', name: 'Alawwa', code: 'ALW', warehouseId: '42f1fe9d-7e44-48eb-8eb0-10a6439b5619' },
  { id: 'fa68e4a0-a515-44c8-a082-5b5590366658', name: 'Dambadeniya', code: 'DAM', warehouseId: '6e8904dd-b753-434e-a22d-2d8e428f0a02' },
  { id: '197693d6-4247-48df-b614-6fcde9e34f7d', name: 'Giriulla', code: 'GIR', warehouseId: '5f0f4a53-75d7-411e-be5c-337ff170da50' },
];

const ACTIVE_BRANCH_IDS = ACTIVE_BRANCHES.map((b) => b.id);

const BRANCH_MAP: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': 'Alawwa',
  'fa68e4a0-a515-44c8-a082-5b5590366658': 'Dambadeniya',
  '197693d6-4247-48df-b614-6fcde9e34f7d': 'Giriulla',
};

const BRANCH_TO_WAREHOUSE: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': '42f1fe9d-7e44-48eb-8eb0-10a6439b5619',
  'fa68e4a0-a515-44c8-a082-5b5590366658': '6e8904dd-b753-434e-a22d-2d8e428f0a02',
  '197693d6-4247-48df-b614-6fcde9e34f7d': '5f0f4a53-75d7-411e-be5c-337ff170da50',
};

type DatePreset = 'today' | 'yesterday' | 'this_week' | '7days' | 'this_month' | 'last_month' | '30days' | 'custom';

// ============================================================================
// DATE BOUNDARY HELPER (Asia/Colombo UTC+05:30)
// ============================================================================
function getColomboBounds(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): { from: string; to: string; startDateStr: string; endDateStr: string; daysCount: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(now); // "YYYY-MM-DD"
  const todayParts = todayStr.split('-').map(Number);
  const yearNum = todayParts[0] ?? 2026;
  const monthNum = todayParts[1] ?? 11;
  const dayNum = todayParts[2] ?? 22;

  if (preset === 'today') {
    return {
      from: `${todayStr}T00:00:00.000+05:30`,
      to: `${todayStr}T23:59:59.999+05:30`,
      startDateStr: todayStr,
      endDateStr: todayStr,
      daysCount: 1,
    };
  }

  if (preset === 'yesterday') {
    const d = new Date(Date.UTC(yearNum, monthNum - 1, dayNum - 1));
    const yStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return {
      from: `${yStr}T00:00:00.000+05:30`,
      to: `${yStr}T23:59:59.999+05:30`,
      startDateStr: yStr,
      endDateStr: yStr,
      daysCount: 1,
    };
  }

  if (preset === 'this_week') {
    const todayDate = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    const dayOfWeek = todayDate.getUTCDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monDate = new Date(Date.UTC(yearNum, monthNum - 1, dayNum - diffToMonday));
    const monStr = `${monDate.getUTCFullYear()}-${String(monDate.getUTCMonth() + 1).padStart(2, '0')}-${String(monDate.getUTCDate()).padStart(2, '0')}`;
    return {
      from: `${monStr}T00:00:00.000+05:30`,
      to: `${todayStr}T23:59:59.999+05:30`,
      startDateStr: monStr,
      endDateStr: todayStr,
      daysCount: diffToMonday + 1,
    };
  }

  if (preset === '7days') {
    const d7 = new Date(Date.UTC(yearNum, monthNum - 1, dayNum - 6));
    const s7 = `${d7.getUTCFullYear()}-${String(d7.getUTCMonth() + 1).padStart(2, '0')}-${String(d7.getUTCDate()).padStart(2, '0')}`;
    return {
      from: `${s7}T00:00:00.000+05:30`,
      to: `${todayStr}T23:59:59.999+05:30`,
      startDateStr: s7,
      endDateStr: todayStr,
      daysCount: 7,
    };
  }

  if (preset === 'this_month') {
    const startStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    return {
      from: `${startStr}T00:00:00.000+05:30`,
      to: `${todayStr}T23:59:59.999+05:30`,
      startDateStr: startStr,
      endDateStr: todayStr,
      daysCount: dayNum,
    };
  }

  if (preset === 'last_month') {
    let prevYear = yearNum;
    let prevMonth = monthNum - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const startStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const endStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
    return {
      from: `${startStr}T00:00:00.000+05:30`,
      to: `${endStr}T23:59:59.999+05:30`,
      startDateStr: startStr,
      endDateStr: endStr,
      daysCount: daysInPrevMonth,
    };
  }

  if (preset === '30days') {
    const d30 = new Date(Date.UTC(yearNum, monthNum - 1, dayNum - 29));
    const s30 = `${d30.getUTCFullYear()}-${String(d30.getUTCMonth() + 1).padStart(2, '0')}-${String(d30.getUTCDate()).padStart(2, '0')}`;
    return {
      from: `${s30}T00:00:00.000+05:30`,
      to: `${todayStr}T23:59:59.999+05:30`,
      startDateStr: s30,
      endDateStr: todayStr,
      daysCount: 30,
    };
  }

  // Custom
  const s = customStart || todayStr;
  const e = customEnd || todayStr;
  const diffDays = Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)) + 1);
  return {
    from: `${s}T00:00:00.000+05:30`,
    to: `${e}T23:59:59.999+05:30`,
    startDateStr: s,
    endDateStr: e,
    daysCount: diffDays,
  };
}

// ============================================================================
// DATA TYPES
// ============================================================================
interface RawSale {
  id: string;
  invoice_number: string;
  branch_id: string;
  cashier_id: string;
  cashier_name?: string;
  total_amount: number;
  subtotal: number;
  discount_amount: number;
  payment_method?: string;
  status: string;
  sold_at: string;
  created_at: string;
  shift_id?: string;
  legacy_sale_id?: string;
}

interface RawSaleItem {
  id: string;
  sale_id: string;
  product_id?: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  subtotal?: number;
}

interface RawShift {
  id: string;
  branch_id: string;
  cashier_id: string;
  shift_date: string;
  shift_number: number;
  status: string;
  opening_float?: number;
  closing_float?: number;
  closing_drawer_float?: number;
  modaka_total_sold_qty?: number;
  modaka_total_amount?: number;
  started_at?: string;
  ended_at?: string;
  notes?: string;
  cash_variance?: number;
  users?: any;
}

interface RawModakaEntry {
  id: string;
  shift_id: string;
  branch_id?: string;
  product_id: string;
  opening_qty?: number;
  in_qty?: number;
  total_available_qty?: number;
  sold_qty: number;
  closing_qty?: number;
  applied_rate: number;
  total_amount: number;
  created_at?: string;
  products?: any;
}

interface RawProduct {
  id: string;
  name: string;
  sku: string;
  cost_price: number;
  retail_price: number;
  category_id?: string;
  categories?: { id: string; name: string };
  is_active: boolean;
  alert_quantity?: number;
}

interface RawStockLevel {
  product_id: string;
  warehouse_id: string;
  quantity_on_hand: number;
}

function getShiftCashierName(shift?: any): string {
  if (!shift) return 'Staff Cashier';
  if (Array.isArray(shift.users)) return shift.users[0]?.full_name || 'Staff Cashier';
  return shift.users?.full_name || 'Staff Cashier';
}

function getModakaProduct(entry?: any): { id?: string; name: string; sku: string; cost_price: number } {
  if (!entry) return { name: 'Special Stock Item', sku: 'MODAKA', cost_price: 120 };
  const prod = Array.isArray(entry.products) ? entry.products[0] : entry.products;
  return {
    id: prod?.id,
    name: prod?.name || 'Special Stock Item',
    sku: prod?.sku || 'MODAKA',
    cost_price: Number(prod?.cost_price || 120),
  };
}

interface RawReconciliation {
  id: string;
  branch_id: string;
  cashier_id?: string;
  shift_date: string;
  status: string;
  declared_drawer_cash?: number;
  system_expected_cash?: number;
  drawer_difference?: number;
  shortage_amount?: number;
  excess_amount?: number;
}

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
          {countVal} transactions
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-blue-600 font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
          Combined Revenue
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

// ============================================================================
// MASTER DATA CACHE & PARALLELIZED TELEMETRY ENGINE
// ============================================================================
interface MasterDataCache {
  products: RawProduct[];
  productsMap: Map<string, RawProduct>;
  stockLevels: RawStockLevel[];
  cashierOptions: { id: string; fullName: string }[];
  usersMap: Map<string, any>;
  timestamp: number;
}

let masterDataMemoryCache: MasterDataCache | null = null;
const MASTER_DATA_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchMasterData(forceRefresh = false): Promise<MasterDataCache> {
  const now = Date.now();
  if (!forceRefresh && masterDataMemoryCache && now - masterDataMemoryCache.timestamp < MASTER_DATA_TTL) {
    return masterDataMemoryCache;
  }

  const warehouseIds = ACTIVE_BRANCHES.map((b) => b.warehouseId);

  // Parallel retrieval of product ranges (0..4999), categories, stock levels, and active users
  const [p0, p1, p2, p3, p4, catRes, stockRes, usersRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, category_id, is_active, alert_quantity')
      .range(0, 999),
    supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, category_id, is_active, alert_quantity')
      .range(1000, 1999),
    supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, category_id, is_active, alert_quantity')
      .range(2000, 2999),
    supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, category_id, is_active, alert_quantity')
      .range(3000, 3999),
    supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, category_id, is_active, alert_quantity')
      .range(4000, 4999),
    supabase
      .from('categories')
      .select('id, name'),
    supabase
      .from('stock_levels')
      .select('product_id, warehouse_id, quantity_on_hand')
      .in('warehouse_id', warehouseIds)
      .limit(10000),
    supabase
      .from('users')
      .select('id, full_name, role, assigned_branches')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  const prodMap = new Map<string, RawProduct>();
  [p0.data, p1.data, p2.data, p3.data, p4.data].forEach((chunk) => {
    if (chunk) {
      chunk.forEach((item: any) => prodMap.set(item.id, item));
    }
  });
  const allProducts = Array.from(prodMap.values());

  const categoryNameMap = new Map<string, string>();
  if (catRes.data) {
    catRes.data.forEach((c: any) => categoryNameMap.set(c.id, c.name));
  }
  allProducts.forEach((p) => {
    if (p.category_id && categoryNameMap.has(p.category_id)) {
      p.categories = { id: p.category_id, name: categoryNameMap.get(p.category_id)! };
    }
  });

  const productsMap = new Map<string, RawProduct>();
  allProducts.forEach((p) => productsMap.set(p.id, p));

  const usersMap = new Map<string, any>();
  const cashierOptions: { id: string; fullName: string }[] = [];
  if (usersRes.data) {
    usersRes.data.forEach((u: any) => {
      usersMap.set(u.id, u);
      cashierOptions.push({ id: u.id, fullName: u.full_name || 'Staff Member' });
    });
  }

  const stockLevels: RawStockLevel[] = (stockRes.data as any) || [];

  masterDataMemoryCache = {
    products: allProducts,
    productsMap,
    stockLevels,
    cashierOptions,
    usersMap,
    timestamp: now,
  };

  return masterDataMemoryCache;
}

interface DateRangeDataset {
  sales: RawSale[];
  saleItems: RawSaleItem[];
  shifts: RawShift[];
  modakaEntries: RawModakaEntry[];
  reconciliations: RawReconciliation[];
  activity: DashboardActivityItem[];
  timestamp: number;
}

const dateRangeDatasetCache = new Map<string, DateRangeDataset>();

function getCacheKey(preset: DatePreset, start?: string, end?: string): string {
  if (preset === 'custom') {
    return `custom_${start || ''}_${end || ''}`;
  }
  return preset;
}

async function fetchDateRangeDataset(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  masterData?: MasterDataCache
): Promise<DateRangeDataset> {
  const mData = masterData || (await fetchMasterData());
  const bounds = getColomboBounds(preset, customStart, customEnd);

  // Parallel transaction queries: Sales (ranges 0..999, 1000..1999, 2000..2999), Shifts (0..999, 1000..1999), Reconciliations, and Activity
  const [s0, s1, s2, sh0, sh1, shEnded, recRes, actRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, invoice_number, branch_id, cashier_id, cashier_name, total_amount, subtotal, discount_amount, status, created_at, sold_at, shift_id, legacy_sale_id')
      .gte('sold_at', bounds.from)
      .lte('sold_at', bounds.to)
      .in('branch_id', ACTIVE_BRANCH_IDS)
      .order('sold_at', { ascending: false })
      .range(0, 999),
    supabase
      .from('sales')
      .select('id, invoice_number, branch_id, cashier_id, cashier_name, total_amount, subtotal, discount_amount, status, created_at, sold_at, shift_id, legacy_sale_id')
      .gte('sold_at', bounds.from)
      .lte('sold_at', bounds.to)
      .in('branch_id', ACTIVE_BRANCH_IDS)
      .order('sold_at', { ascending: false })
      .range(1000, 1999),
    supabase
      .from('sales')
      .select('id, invoice_number, branch_id, cashier_id, cashier_name, total_amount, subtotal, discount_amount, status, created_at, sold_at, shift_id, legacy_sale_id')
      .gte('sold_at', bounds.from)
      .lte('sold_at', bounds.to)
      .in('branch_id', ACTIVE_BRANCH_IDS)
      .order('sold_at', { ascending: false })
      .range(2000, 2999),
    supabase
      .from('cashier_shifts')
      .select('id, branch_id, cashier_id, shift_date, shift_number, status, opening_float, closing_float, closing_drawer_float, modaka_total_sold_qty, modaka_total_amount, started_at, ended_at, notes, cash_variance')
      .gte('shift_date', bounds.startDateStr)
      .lte('shift_date', bounds.endDateStr)
      .in('branch_id', ACTIVE_BRANCH_IDS)
      .order('shift_date', { ascending: false })
      .range(0, 999),
    supabase
      .from('cashier_shifts')
      .select('id, branch_id, cashier_id, shift_date, shift_number, status, opening_float, closing_float, closing_drawer_float, modaka_total_sold_qty, modaka_total_amount, started_at, ended_at, notes, cash_variance')
      .gte('shift_date', bounds.startDateStr)
      .lte('shift_date', bounds.endDateStr)
      .in('branch_id', ACTIVE_BRANCH_IDS)
      .order('shift_date', { ascending: false })
      .range(1000, 1999),
    supabase
      .from('cashier_shifts')
      .select('id, branch_id, cashier_id, shift_date, shift_number, status, opening_float, closing_float, closing_drawer_float, modaka_total_sold_qty, modaka_total_amount, started_at, ended_at, notes, cash_variance')
      .gte('ended_at', bounds.from)
      .lte('ended_at', bounds.to)
      .in('branch_id', ACTIVE_BRANCH_IDS)
      .order('ended_at', { ascending: false })
      .range(0, 999),
    supabase
      .from('daily_cash_reconciliations')
      .select('id, branch_id, reconciliation_date, physical_cash_c, system_cash_sales, variance_amount, status, notes, submitted_by')
      .gte('reconciliation_date', bounds.startDateStr)
      .lte('reconciliation_date', bounds.endDateStr)
      .in('branch_id', ACTIVE_BRANCH_IDS),
    dashboardApi.getActivity(10).catch(() => ({ data: [] })),
  ]);

  const salesMap = new Map<string, RawSale>();
  [s0.data, s1.data, s2.data].forEach((chunk) => {
    if (chunk) {
      chunk.forEach((item: any) => salesMap.set(item.id, item));
    }
  });
  const allSales = Array.from(salesMap.values());

  const shiftsMap = new Map<string, RawShift>();
  [sh0.data, sh1.data, shEnded.data].forEach((chunk) => {
    if (chunk) {
      chunk.forEach((item: any) => shiftsMap.set(item.id, item));
    }
  });
  const allShifts = Array.from(shiftsMap.values());

  allShifts.forEach((s) => {
    if (s.status === 'closed' && s.ended_at) {
      const closingDate = getColomboDateStr(new Date(s.ended_at));
      if (closingDate) {
        s.shift_date = closingDate;
      }
    }
    const u = mData.usersMap.get(s.cashier_id);
    s.users = u
      ? { id: u.id, full_name: u.full_name, role: u.role }
      : { id: s.cashier_id, full_name: 'Staff Cashier' };
  });

  const mappedRecs: RawReconciliation[] = ((recRes.data as any[]) || []).map((r: any) => ({
    id: r.id,
    branch_id: r.branch_id,
    cashier_id: r.submitted_by,
    shift_date: r.reconciliation_date,
    status: r.status,
    declared_drawer_cash: Number(r.physical_cash_c || 0),
    system_expected_cash: Number(r.system_cash_sales || 0),
    drawer_difference: Number(r.variance_amount || 0),
    shortage_amount: Number(r.variance_amount || 0) < 0 ? Math.abs(Number(r.variance_amount)) : 0,
    excess_amount: Number(r.variance_amount || 0) > 0 ? Number(r.variance_amount) : 0,
  }));

  // Concurrently fetch all child chunks in parallel!
  const saleIds = allSales.map((s) => s.id);
  const shiftIds = allShifts.map((s) => s.id);

  const saleItemPromises: Promise<any>[] = [];
  const salePaymentPromises: Promise<any>[] = [];
  for (let i = 0; i < saleIds.length; i += 500) {
    const chunk = saleIds.slice(i, i + 500);
    saleItemPromises.push(
      Promise.resolve(
        supabase
          .from('sale_items')
          .select('id, sale_id, product_id, product_name, sku, quantity, unit_price, cost_price, subtotal')
          .in('sale_id', chunk)
      )
    );
    salePaymentPromises.push(
      Promise.resolve(
        supabase
          .from('sale_payments')
          .select('id, sale_id, payment_method, amount, status')
          .in('sale_id', chunk)
      )
    );
  }

  const modakaPromises: Promise<any>[] = [];
  for (let i = 0; i < shiftIds.length; i += 500) {
    const chunk = shiftIds.slice(i, i + 500);
    modakaPromises.push(
      Promise.resolve(
        supabase
          .from('shift_modaka_entries')
          .select('id, shift_id, branch_id, product_id, opening_qty, in_qty, total_available_qty, sold_qty, closing_qty, applied_rate, total_amount, created_at')
          .in('shift_id', chunk)
      )
    );
  }

  const [itemResults, paymentResults, modakaResults] = await Promise.all([
    Promise.all(saleItemPromises),
    Promise.all(salePaymentPromises),
    Promise.all(modakaPromises),
  ]);

  const allSaleItems: RawSaleItem[] = [];
  itemResults.forEach((res) => {
    if (res.data) allSaleItems.push(...(res.data as any));
  });

  const paymentMethodMap = new Map<string, string>();
  paymentResults.forEach((res) => {
    if (res.data) {
      res.data.forEach((p: any) => {
        if (!paymentMethodMap.has(p.sale_id) && p.payment_method) {
          paymentMethodMap.set(p.sale_id, p.payment_method);
        }
      });
    }
  });

  allSales.forEach((s) => {
    s.payment_method = paymentMethodMap.get(s.id) || 'CASH';
  });

  const allModaka: RawModakaEntry[] = [];
  modakaResults.forEach((res) => {
    if (res.data) allModaka.push(...(res.data as any));
  });

  allModaka.forEach((m) => {
    const prod = mData.productsMap.get(m.product_id);
    m.products = prod
      ? { id: prod.id, name: prod.name, sku: prod.sku, cost_price: prod.cost_price }
      : { id: m.product_id, name: 'Special Stock Item', sku: 'MODAKA', cost_price: 120 };
  });

  return {
    sales: allSales,
    saleItems: allSaleItems,
    shifts: allShifts,
    modakaEntries: allModaka,
    reconciliations: mappedRecs,
    activity: (actRes?.data as any) || [],
    timestamp: Date.now(),
  };
}

// ============================================================================
// MAIN EXECUTIVE COMMAND CENTER COMPONENT
// ============================================================================
export default function DashboardPage() {
  const { selectedBranchId, setSelectedBranchId, currency, isOwner, isLoading: isTenantLoading } = useTenantBranch();

  // 1. Date Controls State
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(() => getColomboDateString(new Date()));
  const [customEnd, setCustomEnd] = useState(() => getColomboDateString(new Date()));

  // 2. In-Page Multi-Dimensional Filters (100% In-Memory via useMemo)
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    if (selectedBranchId && ACTIVE_BRANCH_IDS.includes(selectedBranchId)) {
      return selectedBranchId;
    }
    return 'ALL';
  });
  const [selectedShift, setSelectedShift] = useState<string>('ALL'); // 'ALL' | '1' | '2' | '3'
  const [selectedCashier, setSelectedCashier] = useState<string>('ALL');
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | 'POS' | 'SPECIAL'>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL'); // 'ALL' | 'CASH' | 'CARD' | 'QR' | 'CREDIT'

  // 3. Raw Data State
  const [sales, setSales] = useState<RawSale[]>([]);
  const [saleItems, setSaleItems] = useState<RawSaleItem[]>([]);
  const [shifts, setShifts] = useState<RawShift[]>([]);
  const [modakaEntries, setModakaEntries] = useState<RawModakaEntry[]>([]);
  const [products, setProducts] = useState<RawProduct[]>([]);
  const [stockLevels, setStockLevels] = useState<RawStockLevel[]>([]);
  const [reconciliations, setReconciliations] = useState<RawReconciliation[]>([]);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [cashierOptions, setCashierOptions] = useState<{ id: string; fullName: string }[]>([]);

  // 4. UI Auxiliary State & Performance Optimizations
  const [loading, setLoading] = useState(true);
  const [isNavigatingRange, setIsNavigatingRange] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isTabPending, startTabTransition] = useTransition();

  const [isMounted, setIsMounted] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<'BRANCH' | 'SHIFT' | 'CASHIER' | 'PEAK'>('BRANCH');
  const [inventoryBranch, setInventoryBranch] = useState<string>('ALL');
  const [inventoryChannel, setInventoryChannel] = useState<'ALL' | 'POS' | 'SPECIAL'>('ALL');
  const [cashierSortField, setCashierSortField] = useState<'revenue' | 'profit' | 'bills' | 'variance'>('revenue');
  const [cashierSortDir, setCashierSortDir] = useState<'asc' | 'desc'>('desc');

  // Windowing & Search for Large Inventory Tables
  const [fastMovingLimit, setFastMovingLimit] = useState(25);
  const [fastMovingSearch, setFastMovingSearch] = useState('');
  const [slowMovingLimit, setSlowMovingLimit] = useState(25);
  const [slowMovingSearch, setSlowMovingSearch] = useState('');
  const [splitModalLimit, setSplitModalLimit] = useState(25);
  const [splitModalSearch, setSplitModalSearch] = useState('');

  // Legacy sync config
  const [syncConfig, setSyncConfig] = useState<LegacySyncConfigDto | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Bi-directionally sync from global header branch selector
  useEffect(() => {
    if (!isMounted) return;
    const target = selectedBranchId && ACTIVE_BRANCH_IDS.includes(selectedBranchId) ? selectedBranchId : 'ALL';
    setSelectedBranch((prev) => (prev !== target ? target : prev));
  }, [selectedBranchId, isMounted]);

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

  // ============================================================================
  // BULK EXECUTIVE DATA FETCHER (DECOUPLED FROM DIMENSIONAL FILTERS)
  // ============================================================================
  const fetchExecutiveData = useCallback(async (forceRefresh = false) => {
    if (!isOwner) return;

    const cacheKey = getCacheKey(datePreset, customStart, customEnd);
    const cached = dateRangeDatasetCache.get(cacheKey);

    if (!forceRefresh && cached) {
      // 0ms instant render from memory cache
      setSales(cached.sales);
      setSaleItems(cached.saleItems);
      setShifts(cached.shifts);
      setModakaEntries(cached.modakaEntries);
      setReconciliations(cached.reconciliations);
      if (cached.activity) setActivity(cached.activity);
      setLoading(false);

      // Background revalidation if older than 60s
      if (Date.now() - cached.timestamp > 60 * 1000) {
        setIsRevalidating(true);
      } else {
        return;
      }
    } else {
      // Uncached or forced refresh
      setIsNavigatingRange(true);
      // keepPreviousData: only show full loading skeleton if we have no prior data at all
      setSales((prev) => {
        if (!prev || prev.length === 0) setLoading(true);
        return prev;
      });
    }

    try {
      const masterData = await fetchMasterData(forceRefresh);
      setProducts(masterData.products);
      setStockLevels(masterData.stockLevels);
      setCashierOptions(masterData.cashierOptions);

      const dataset = await fetchDateRangeDataset(datePreset, customStart, customEnd, masterData);
      dateRangeDatasetCache.set(cacheKey, dataset);

      setSales(dataset.sales);
      setSaleItems(dataset.saleItems);
      setShifts(dataset.shifts);
      setModakaEntries(dataset.modakaEntries);
      setReconciliations(dataset.reconciliations);
      setActivity(dataset.activity);
    } catch (err) {
      console.error('[Dashboard] Telemetry query error:', err);
    } finally {
      setLoading(false);
      setIsNavigatingRange(false);
      setIsRevalidating(false);
    }
  }, [isOwner, datePreset, customStart, customEnd]);

  useEffect(() => {
    if (isOwner) {
      fetchExecutiveData(false);
    }
  }, [isOwner, fetchExecutiveData]);

  // Background prefetch for common presets ('yesterday', '7days') after initial mount settles
  useEffect(() => {
    if (!isOwner || loading) return;

    const timer = setTimeout(async () => {
      try {
        const mData = await fetchMasterData(false);
        const presetsToPrefetch: DatePreset[] = ['yesterday', '7days'];
        for (const p of presetsToPrefetch) {
          const key = getCacheKey(p);
          if (!dateRangeDatasetCache.has(key)) {
            const ds = await fetchDateRangeDataset(p, undefined, undefined, mData);
            dateRangeDatasetCache.set(key, ds);
          }
        }
      } catch {
        // Silent background prefetch
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isOwner, loading]);

  // Real-time listener: triggers background refresh when sales or shifts change
  useRealtimePosSync(() => fetchExecutiveData(true));

  // ============================================================================
  // DERIVED FILTERING & EXACT PROFIT CALCULATION ENGINE
  // ============================================================================
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.id, Number(p.cost_price || 0));
    });
    return map;
  }, [products]);

  const shiftLookupMap = useMemo(() => {
    const map = new Map<string, RawShift>();
    shifts.forEach((s) => map.set(s.id, s));
    return map;
  }, [shifts]);

  const saleItemsBySaleId = useMemo(() => {
    const map = new Map<string, RawSaleItem[]>();
    saleItems.forEach((item) => {
      const cur = map.get(item.sale_id) || [];
      cur.push(item);
      map.set(item.sale_id, cur);
    });
    return map;
  }, [saleItems]);

  // Filtered POS Sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const isCompleted = s.status !== 'VOIDED' && s.status !== 'voided';
      if (!isCompleted) return false;

      // Branch Filter
      if (selectedBranch !== 'ALL' && s.branch_id !== selectedBranch) return false;

      // Shift Filter (Shift A = 1, Shift B = 2, Shift C = 3)
      if (selectedShift !== 'ALL') {
        const shiftObj = s.shift_id ? shiftLookupMap.get(s.shift_id) : undefined;
        if (shiftObj) {
          if (String(shiftObj.shift_number) !== selectedShift) return false;
        } else {
          // Approximate shift by hour if shift_id is unlinked
          const h = getColomboHour(s.sold_at || s.created_at);
          const derivedShift = h < 14 ? '1' : h < 21 ? '2' : '3';
          if (derivedShift !== selectedShift) return false;
        }
      }

      // Cashier Filter
      if (selectedCashier !== 'ALL') {
        const cName = s.cashier_name || '';
        if (s.cashier_id !== selectedCashier && cName !== selectedCashier) return false;
      }

      // Channel Filter
      if (selectedChannel === 'SPECIAL') return false;

      // Payment Method Filter
      if (selectedMethod !== 'ALL') {
        const pm = (s.payment_method || 'CASH').toUpperCase();
        if (selectedMethod === 'LANKA_QR') {
          if (!pm.includes('QR')) return false;
        } else if (selectedMethod === 'KHATA') {
          if (!pm.includes('CREDIT') && !pm.includes('KHATA')) return false;
        } else if (!pm.includes(selectedMethod)) {
          return false;
        }
      }

      return true;
    });
  }, [sales, selectedBranch, selectedShift, selectedCashier, selectedChannel, selectedMethod, shiftLookupMap]);

  // Filtered Special Stock Entries
  const filteredModakaEntries = useMemo(() => {
    if (selectedChannel === 'POS') return [];

    return modakaEntries.filter((e) => {
      const sold = Number(e.sold_qty || 0);
      if (sold <= 0) return false;

      const shift = shiftLookupMap.get(e.shift_id);
      const bId = e.branch_id || shift?.branch_id;
      if (!bId) return false;

      // Branch Filter
      if (selectedBranch !== 'ALL' && bId !== selectedBranch) return false;

      // Shift Filter
      if (selectedShift !== 'ALL') {
        if (!shift || String(shift.shift_number) !== selectedShift) return false;
      }

      // Cashier Filter
      if (selectedCashier !== 'ALL') {
        const cName = getShiftCashierName(shift);
        if (shift && shift.cashier_id !== selectedCashier && cName !== selectedCashier) return false;
      }

      // Payment Method Filter (Special Stock modaka collections are cash drawer inflows)
      if (selectedMethod !== 'ALL' && selectedMethod !== 'CASH') return false;

      return true;
    });
  }, [modakaEntries, selectedChannel, selectedBranch, selectedShift, selectedCashier, selectedMethod, shiftLookupMap]);

  // Also include shift-level special stock inflows where itemized entries weren't recorded
  const accountedShiftIds = useMemo(() => {
    return new Set(modakaEntries.map((m) => m.shift_id));
  }, [modakaEntries]);

  const aggregateShiftModakaAmount = useMemo(() => {
    if (selectedChannel === 'POS') return 0;
    if (selectedMethod !== 'ALL' && selectedMethod !== 'CASH') return 0;

    let total = 0;
    shifts.forEach((shift) => {
      if (accountedShiftIds.has(shift.id)) return;
      const amt = Number(shift.modaka_total_amount || 0);
      if (amt <= 0) return;

      if (selectedBranch !== 'ALL' && shift.branch_id !== selectedBranch) return;
      if (selectedShift !== 'ALL' && String(shift.shift_number) !== selectedShift) return;
      if (selectedCashier !== 'ALL') {
        const cName = getShiftCashierName(shift);
        if (shift.cashier_id !== selectedCashier && cName !== selectedCashier) return;
      }

      total += amt;
    });
    return total;
  }, [shifts, accountedShiftIds, selectedChannel, selectedMethod, selectedBranch, selectedShift, selectedCashier]);

  // ============================================================================
  // EXACT COGS & PROFIT AGGREGATION
  // ============================================================================
  const posAnalytics = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    const billsCount = filteredSales.length;

    // Item-level performance accumulator
    const itemMap = new Map<
      string,
      { name: string; sku: string; units: number; revenue: number; cogs: number; profit: number }
    >();

    filteredSales.forEach((sale) => {
      const saleTotal = Number(sale.total_amount || 0);
      revenue += saleTotal;

      const items = saleItemsBySaleId.get(sale.id) || [];
      let saleCost = 0;

      if (items.length > 0) {
        items.forEach((item) => {
          const qty = Number(item.quantity || 1);
          const unitPrice = Number(item.unit_price || 0);
          const lineRevenue = Number(item.subtotal || unitPrice * qty);
          const unitCost = Number(item.cost_price || productCostMap.get(item.product_id || '') || 0);
          const lineCost = unitCost > 0 ? unitCost * qty : lineRevenue * 0.55;
          const lineProfit = lineRevenue - lineCost;

          saleCost += lineCost;

          const key = item.product_id || item.sku || item.product_name || 'unknown';
          const existing = itemMap.get(key) || {
            name: item.product_name || 'Ayurvedic Medicine',
            sku: item.sku || 'SKU',
            units: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
          };
          existing.units += qty;
          existing.revenue += lineRevenue;
          existing.cogs += lineCost;
          existing.profit += lineProfit;
          itemMap.set(key, existing);
        });
      } else {
        // Fallback for bills with no child lines
        saleCost = saleTotal * 0.55;
      }

      cogs += saleCost;
    });

    const netProfit = revenue - cogs;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue);

    return {
      revenue,
      cogs,
      netProfit,
      margin,
      billsCount,
      topItems,
    };
  }, [filteredSales, saleItemsBySaleId, productCostMap]);

  const specialAnalytics = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    let units = 0;

    const itemMap = new Map<
      string,
      { name: string; sku: string; units: number; rate: number; revenue: number; cogs: number; profit: number }
    >();

    filteredModakaEntries.forEach((entry) => {
      const qty = Number(entry.sold_qty || 0);
      const rate = Number(entry.applied_rate || 250);
      const entryRevenue = Number(entry.total_amount || qty * rate);
      const modakaProd = getModakaProduct(entry);
      const unitCost = Number(modakaProd.cost_price || productCostMap.get(entry.product_id) || 120);
      const entryCost = qty * unitCost;
      const entryProfit = entryRevenue - entryCost;

      revenue += entryRevenue;
      cogs += entryCost;
      units += qty;

      const key = entry.product_id || modakaProd.sku || 'modaka-item';
      const existing = itemMap.get(key) || {
        name: modakaProd.name || 'Special Stock Pill',
        sku: modakaProd.sku || 'MODAKA',
        units: 0,
        rate,
        revenue: 0,
        cogs: 0,
        profit: 0,
      };
      existing.units += qty;
      existing.revenue += entryRevenue;
      existing.cogs += entryCost;
      existing.profit += entryProfit;
      itemMap.set(key, existing);
    });

    // Add aggregate shifts modaka revenue if any
    if (aggregateShiftModakaAmount > 0) {
      revenue += aggregateShiftModakaAmount;
      const aggCost = aggregateShiftModakaAmount * 0.5; // ~50% cost estimate
      cogs += aggCost;
    }

    const netProfit = revenue - cogs;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue);

    return {
      revenue,
      cogs,
      netProfit,
      margin,
      units,
      topItems,
    };
  }, [filteredModakaEntries, aggregateShiftModakaAmount, productCostMap]);

  // Combined Top-Level Totals
  const combinedGross = posAnalytics.revenue + specialAnalytics.revenue;
  const combinedCOGS = posAnalytics.cogs + specialAnalytics.cogs;
  const combinedNetProfit = combinedGross - combinedCOGS;
  const combinedMargin = combinedGross > 0 ? (combinedNetProfit / combinedGross) * 100 : 0;
  const combinedBills = posAnalytics.billsCount;
  const avgBasket = combinedBills > 0 ? posAnalytics.revenue / combinedBills : 0;

  // Active Branch Low Stock Warning Count
  const branchLowStockCount = useMemo(() => {
    const activeWarehouse =
      selectedBranch !== 'ALL'
        ? BRANCH_TO_WAREHOUSE[selectedBranch]
        : undefined;

    return stockLevels.filter((s) => {
      if (activeWarehouse && s.warehouse_id !== activeWarehouse) return false;
      return Number(s.quantity_on_hand || 0) <= 5;
    }).length;
  }, [stockLevels, selectedBranch]);

  // ============================================================================
  // COMBINED SALES & PROFIT TIMELINE DATA
  // ============================================================================
  const timelineData: TimelineDataPoint[] = useMemo(() => {
    const specialTimelineItems: SpecialStockTimelineItem[] = [];

    filteredModakaEntries.forEach((entry) => {
      const shift = shiftLookupMap.get(entry.shift_id);
      const shiftDate = shift?.shift_date || getColomboDateString(new Date());
      const amt = Number(entry.total_amount || Number(entry.sold_qty || 0) * Number(entry.applied_rate || 250));
      const modakaProd = getModakaProduct(entry);
      const cost = Number(entry.sold_qty || 0) * Number(modakaProd.cost_price || productCostMap.get(entry.product_id) || 120);

      specialTimelineItems.push({
        date: shiftDate,
        amount: amt,
        profit: amt - cost,
        qty: Number(entry.sold_qty || 0),
        createdAt: entry.created_at || (shift?.started_at ? shift.started_at : `${shiftDate}T12:00:00+05:30`),
      });
    });

    const periodKey = datePreset === 'today' ? 'today' : datePreset === '30days' || datePreset === 'this_month' || datePreset === 'last_month' ? 'month' : 'week';
    return buildColomboTimeline(filteredSales as any, periodKey, specialTimelineItems);
  }, [filteredSales, filteredModakaEntries, shiftLookupMap, productCostMap, datePreset]);

  // Payment Breakdown Summary
  const paymentBreakdown = useMemo(() => {
    let cash = specialAnalytics.revenue; // Modaka special stock is all cash drawer collections
    let card = 0;
    let qr = 0;
    let credit = 0;

    filteredSales.forEach((s) => {
      const pm = (s.payment_method || 'CASH').toUpperCase();
      const amt = Number(s.total_amount || 0);
      if (pm.includes('CARD')) card += amt;
      else if (pm.includes('QR')) qr += amt;
      else if (pm.includes('CREDIT') || pm.includes('KHATA')) credit += amt;
      else cash += amt;
    });

    const total = cash + card + qr + credit;
    return { cash, card, qr, credit, total };
  }, [filteredSales, specialAnalytics.revenue]);

  // ============================================================================
  // PERFORMANCE BREAKDOWN HUB: 4 TABS COMPUTATION
  // ============================================================================
  // Tab 1: Branch-Wise
  const branchBreakdown = useMemo(() => {
    return ACTIVE_BRANCHES.map((b) => {
      const bSales = filteredSales.filter((s) => s.branch_id === b.id);
      const bModaka = filteredModakaEntries.filter((m) => {
        const shift = shiftLookupMap.get(m.shift_id);
        return m.branch_id === b.id || shift?.branch_id === b.id;
      });

      const posRev = bSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      let posCost = 0;
      bSales.forEach((s) => {
        const items = saleItemsBySaleId.get(s.id) || [];
        if (items.length > 0) {
          items.forEach((i) => {
            const cost = Number(i.cost_price || productCostMap.get(i.product_id || '') || 0);
            posCost += cost > 0 ? cost * Number(i.quantity || 1) : Number(i.subtotal || 0) * 0.55;
          });
        } else {
          posCost += Number(s.total_amount || 0) * 0.55;
        }
      });

      const specialRev = bModaka.reduce((acc, m) => acc + Number(m.total_amount || Number(m.sold_qty || 0) * Number(m.applied_rate || 250)), 0);
      let specialCost = 0;
      bModaka.forEach((m) => {
        const modakaProd = getModakaProduct(m);
        const uCost = Number(modakaProd.cost_price || productCostMap.get(m.product_id) || 120);
        specialCost += Number(m.sold_qty || 0) * uCost;
      });

      const totalRev = posRev + specialRev;
      const totalCost = posCost + specialCost;
      const netProfit = totalRev - totalCost;
      const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
      const transactions = bSales.length + bModaka.length;
      const share = combinedGross > 0 ? (totalRev / combinedGross) * 100 : 0;

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        posRev,
        specialRev,
        totalRev,
        totalCost,
        netProfit,
        margin,
        transactions,
        share,
      };
    });
  }, [filteredSales, filteredModakaEntries, shiftLookupMap, saleItemsBySaleId, productCostMap, combinedGross]);

  // Tab 2: Shift-Wise
  const shiftBreakdown = useMemo(() => {
    const shiftConfigs = [
      { num: 1, name: 'Morning Roster', timing: '07:00 – 14:30' },
      { num: 2, name: 'Evening Roster', timing: '14:30 – 21:00' },
      { num: 3, name: 'Night / Cutover', timing: '21:00 – Late' },
    ];

    return shiftConfigs.map((sc) => {
      const sSales = filteredSales.filter((s) => {
        const shiftObj = s.shift_id ? shiftLookupMap.get(s.shift_id) : undefined;
        if (shiftObj) return shiftObj.shift_number === sc.num;
        const h = getColomboHour(s.sold_at || s.created_at);
        const derived = h < 14 ? 1 : h < 21 ? 2 : 3;
        return derived === sc.num;
      });

      const sModaka = filteredModakaEntries.filter((m) => {
        const shiftObj = shiftLookupMap.get(m.shift_id);
        return shiftObj?.shift_number === sc.num;
      });

      const posRev = sSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const specialRev = sModaka.reduce((acc, m) => acc + Number(m.total_amount || Number(m.sold_qty || 0) * Number(m.applied_rate || 250)), 0);
      const totalRev = posRev + specialRev;
      const totalCost = totalRev * 0.55; // estimated 55% COGS
      const netProfit = totalRev - totalCost;
      const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

      // Opening float & variances from cashier shifts
      const relevantShifts = shifts.filter((s) => s.shift_number === sc.num && (selectedBranch === 'ALL' || s.branch_id === selectedBranch));
      const totalOpeningFloat = relevantShifts.reduce((acc, s) => acc + Number(s.opening_float || 0), 0);

      // Variance from reconciliations
      const shiftDates = new Set(relevantShifts.map((s) => s.shift_date));
      const relevantRecs = reconciliations.filter((r) => shiftDates.has(r.shift_date) && (selectedBranch === 'ALL' || r.branch_id === selectedBranch));
      const netVariance = relevantRecs.reduce((acc, r) => acc + Number(r.drawer_difference || (r.excess_amount || 0) - (r.shortage_amount || 0)), 0);

      return {
        num: sc.num,
        name: sc.name,
        timing: sc.timing,
        posRev,
        specialRev,
        totalRev,
        totalCost,
        netProfit,
        margin,
        openingFloat: totalOpeningFloat,
        netVariance,
        shiftCount: relevantShifts.length,
      };
    });
  }, [filteredSales, filteredModakaEntries, shiftLookupMap, shifts, reconciliations, selectedBranch]);

  // Tab 3: Cashier-Wise
  const cashierBreakdown = useMemo(() => {
    const cashierMap = new Map<
      string,
      {
        name: string;
        posRev: number;
        posBills: number;
        specialRev: number;
        totalRev: number;
        netProfit: number;
        voidedBills: number;
        variance: number;
      }
    >();

    filteredSales.forEach((s) => {
      const name = s.cashier_name || 'Staff Cashier';
      const cur = cashierMap.get(name) || {
        name,
        posRev: 0,
        posBills: 0,
        specialRev: 0,
        totalRev: 0,
        netProfit: 0,
        voidedBills: 0,
        variance: 0,
      };

      const amt = Number(s.total_amount || 0);
      cur.posRev += amt;
      cur.posBills += 1;
      cur.totalRev += amt;
      cur.netProfit += amt * 0.45; // ~45% net profit margin
      cashierMap.set(name, cur);
    });

    filteredModakaEntries.forEach((m) => {
      const shift = shiftLookupMap.get(m.shift_id);
      const name = getShiftCashierName(shift);
      const cur = cashierMap.get(name) || {
        name,
        posRev: 0,
        posBills: 0,
        specialRev: 0,
        totalRev: 0,
        netProfit: 0,
        voidedBills: 0,
        variance: 0,
      };

      const amt = Number(m.total_amount || Number(m.sold_qty || 0) * Number(m.applied_rate || 250));
      cur.specialRev += amt;
      cur.totalRev += amt;
      cur.netProfit += amt * 0.52; // Special stock high margin (~52%)
      cashierMap.set(name, cur);
    });

    // Map reconciliations variance
    reconciliations.forEach((r) => {
      const matchedUser = cashierOptions.find((u) => u.id === r.cashier_id);
      const name = matchedUser?.fullName;
      if (name && cashierMap.has(name)) {
        const entry = cashierMap.get(name)!;
        entry.variance += Number(r.drawer_difference || (r.excess_amount || 0) - (r.shortage_amount || 0));
      }
    });

    return Array.from(cashierMap.values()).sort((a, b) => {
      if (cashierSortField === 'profit') {
        return cashierSortDir === 'desc' ? b.netProfit - a.netProfit : a.netProfit - b.netProfit;
      }
      if (cashierSortField === 'bills') {
        return cashierSortDir === 'desc' ? b.posBills - a.posBills : a.posBills - b.posBills;
      }
      if (cashierSortField === 'variance') {
        return cashierSortDir === 'desc' ? b.variance - a.variance : a.variance - b.variance;
      }
      return cashierSortDir === 'desc' ? b.totalRev - a.totalRev : a.totalRev - b.totalRev;
    });
  }, [filteredSales, filteredModakaEntries, shiftLookupMap, reconciliations, cashierOptions, cashierSortField, cashierSortDir]);

  // Tab 4: Hourly Peak & Categories
  const hourlyPeakBreakdown = useMemo(() => {
    const hours: { hour: number; label: string; revenue: number; txCount: number }[] = [];
    for (let h = 7; h <= 22; h++) {
      const label = h <= 12 ? `${h} AM` : `${h - 12} PM`;
      hours.push({ hour: h, label, revenue: 0, txCount: 0 });
    }

    filteredSales.forEach((s) => {
      let h = getColomboHour(s.sold_at || s.created_at);
      if (h < 7) h = 7;
      if (h > 22) h = 22;
      const target = hours.find((item) => item.hour === h);
      if (target) {
        target.revenue += Number(s.total_amount || 0);
        target.txCount += 1;
      }
    });

    filteredModakaEntries.forEach((m) => {
      const shift = shiftLookupMap.get(m.shift_id);
      const h = shift?.started_at ? getColomboHour(shift.started_at) : 14;
      const target = hours.find((item) => item.hour === (h >= 7 && h <= 22 ? h : 14));
      if (target) {
        target.revenue += Number(m.total_amount || 0);
        target.txCount += 1;
      }
    });

    return hours;
  }, [filteredSales, filteredModakaEntries, shiftLookupMap]);

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { name: string; revenue: number; units: number; profit: number }>();

    filteredSales.forEach((s) => {
      const items = saleItemsBySaleId.get(s.id) || [];
      items.forEach((i) => {
        const prod = products.find((p) => p.id === i.product_id);
        const catName = prod?.categories?.name || 'General Ayurvedic';
        const cur = catMap.get(catName) || { name: catName, revenue: 0, units: 0, profit: 0 };
        const lineRev = Number(i.subtotal || Number(i.unit_price || 0) * Number(i.quantity || 1));
        const unitCost = Number(i.cost_price || prod?.cost_price || 0);
        const lineCost = unitCost > 0 ? unitCost * Number(i.quantity || 1) : lineRev * 0.55;

        cur.revenue += lineRev;
        cur.units += Number(i.quantity || 1);
        cur.profit += lineRev - lineCost;
        catMap.set(catName, cur);
      });
    });

    if (filteredModakaEntries.length > 0) {
      const cur = catMap.get('Modaka & Special Remedies') || {
        name: 'Modaka & Special Remedies',
        revenue: 0,
        units: 0,
        profit: 0,
      };
      filteredModakaEntries.forEach((m) => {
        const amt = Number(m.total_amount || Number(m.sold_qty || 0) * Number(m.applied_rate || 250));
        const modakaProd = getModakaProduct(m);
        const uCost = Number(modakaProd.cost_price || 120);
        const cost = Number(m.sold_qty || 0) * uCost;
        cur.revenue += amt;
        cur.units += Number(m.sold_qty || 0);
        cur.profit += amt - cost;
      });
      catMap.set('Modaka & Special Remedies', cur);
    }

    return Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filteredSales, saleItemsBySaleId, products, filteredModakaEntries]);

  // ============================================================================
  // FAST-MOVING & SLOW-MOVING INVENTORY INTELLIGENCE (PART 4)
  // ============================================================================
  const inventoryIntelligence = useMemo(() => {
    const bounds = getColomboBounds(datePreset, customStart, customEnd);
    const days = Math.max(1, bounds.daysCount);

    const targetWarehouse =
      inventoryBranch !== 'ALL'
        ? BRANCH_TO_WAREHOUSE[inventoryBranch]
        : undefined;

    // Build branch-filtered stock lookup: productId -> onHand
    const currentStockMap = new Map<string, number>();
    stockLevels.forEach((sl) => {
      if (targetWarehouse && sl.warehouse_id !== targetWarehouse) return;
      currentStockMap.set(sl.product_id, (currentStockMap.get(sl.product_id) || 0) + Number(sl.quantity_on_hand || 0));
    });

    // Velocity & sales per product
    const prodVelocityMap = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        costPrice: number;
        unitsSold: number;
        revenue: number;
        profit: number;
      }
    >();

    // 1. POS Items
    if (inventoryChannel !== 'SPECIAL') {
      filteredSales.forEach((s) => {
        if (inventoryBranch !== 'ALL' && s.branch_id !== inventoryBranch) return;
        const items = saleItemsBySaleId.get(s.id) || [];
        items.forEach((item) => {
          const pId = item.product_id || item.sku || 'unknown';
          const cur = prodVelocityMap.get(pId) || {
            id: pId,
            name: item.product_name || 'Ayurvedic Medicine',
            sku: item.sku || 'SKU',
            costPrice: Number(item.cost_price || productCostMap.get(item.product_id || '') || 0),
            unitsSold: 0,
            revenue: 0,
            profit: 0,
          };
          const qty = Number(item.quantity || 1);
          const lineRev = Number(item.subtotal || Number(item.unit_price || 0) * qty);
          const lineCost = cur.costPrice > 0 ? cur.costPrice * qty : lineRev * 0.55;

          cur.unitsSold += qty;
          cur.revenue += lineRev;
          cur.profit += lineRev - lineCost;
          prodVelocityMap.set(pId, cur);
        });
      });
    }

    // 2. Special Stock Items
    if (inventoryChannel !== 'POS') {
      filteredModakaEntries.forEach((m) => {
        const shift = shiftLookupMap.get(m.shift_id);
        if (inventoryBranch !== 'ALL' && shift?.branch_id !== inventoryBranch) return;

        const pId = m.product_id || 'modaka-item';
        const modakaProd = getModakaProduct(m);
        const cur = prodVelocityMap.get(pId) || {
          id: pId,
          name: modakaProd.name || 'Special Stock Item',
          sku: modakaProd.sku || 'MODAKA',
          costPrice: Number(modakaProd.cost_price || productCostMap.get(m.product_id) || 120),
          unitsSold: 0,
          revenue: 0,
          profit: 0,
        };
        const qty = Number(m.sold_qty || 0);
        const lineRev = Number(m.total_amount || qty * Number(m.applied_rate || 250));
        const lineCost = cur.costPrice * qty;

        cur.unitsSold += qty;
        cur.revenue += lineRev;
        cur.profit += lineRev - lineCost;
        prodVelocityMap.set(pId, cur);
      });
    }

    // Top Fast Moving Products
    const fastMoving = Array.from(prodVelocityMap.values())
      .filter((p) => p.unitsSold > 0)
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .map((p, idx) => {
        const onHand = currentStockMap.get(p.id) || 0;
        const dailyVelocity = p.unitsSold / days;
        const daysLeft = dailyVelocity > 0 ? Math.round(onHand / dailyVelocity) : 999;

        return {
          rank: idx + 1,
          ...p,
          onHand,
          dailyVelocity: Number(dailyVelocity.toFixed(1)),
          daysLeft,
        };
      });

    // Slow Moving / Dead Stock (Current Stock > 0, units sold = 0 or lowest)
    const activeProducts = products.filter((p) => p.is_active);
    const slowMoving = activeProducts
      .map((p) => {
        const onHand = currentStockMap.get(p.id) || 0;
        const velData = prodVelocityMap.get(p.id);
        const sold = velData?.unitsSold || 0;
        const costPrice = Number(p.cost_price || 0);
        const tiedCapital = onHand * costPrice;

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          onHand,
          costPrice,
          tiedCapital,
          unitsSold: sold,
        };
      })
      .filter((p) => p.onHand > 0 && p.unitsSold <= 2)
      .sort((a, b) => b.tiedCapital - a.tiedCapital);

    return { fastMoving, slowMoving };
  }, [
    datePreset,
    customStart,
    customEnd,
    inventoryBranch,
    inventoryChannel,
    stockLevels,
    filteredSales,
    filteredModakaEntries,
    saleItemsBySaleId,
    productCostMap,
    shiftLookupMap,
    products,
  ]);

  // Windowed & Filtered Inventory Lists
  const displayedFastMoving = useMemo(() => {
    let list = inventoryIntelligence.fastMoving;
    if (fastMovingSearch.trim()) {
      const q = fastMovingSearch.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return list;
  }, [inventoryIntelligence.fastMoving, fastMovingSearch]);

  const displayedSlowMoving = useMemo(() => {
    let list = inventoryIntelligence.slowMoving;
    if (slowMovingSearch.trim()) {
      const q = slowMovingSearch.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return list;
  }, [inventoryIntelligence.slowMoving, slowMovingSearch]);

  // Windowed & Filtered Split Modal Lists
  const displayedModalPosItems = useMemo(() => {
    let list = posAnalytics.topItems;
    if (splitModalSearch.trim()) {
      const q = splitModalSearch.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
    }
    return list;
  }, [posAnalytics.topItems, splitModalSearch]);

  const displayedModalSpecialItems = useMemo(() => {
    let list = specialAnalytics.topItems;
    if (splitModalSearch.trim()) {
      const q = splitModalSearch.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }
    return list;
  }, [specialAnalytics.topItems, splitModalSearch]);

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

  const activeBranchName =
    selectedBranch === 'ALL'
      ? 'All Branches'
      : BRANCH_MAP[selectedBranch] || 'Branch';

  return (
    <div className="space-y-6">
      {/* Sleek Top Progress Bar during cache revalidation or date navigation */}
      {(isNavigatingRange || isRevalidating) && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-pulse z-50 pointer-events-none" />
      )}

      {/* =====================================================================
          PAGE TITLE & EXECUTIVE FILTERS BAR (PART 1)
      ===================================================================== */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Command Center</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Multi-Dimensional Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time branch telemetry, exact net profit (Selling − Buying Cost), combined POS & Special Stock, and inventory intelligence.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchExecutiveData(true)}
              disabled={loading || isNavigatingRange}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loading || isNavigatingRange || isRevalidating) ? 'animate-spin text-blue-600' : ''}`} />
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

        {/* Date Filter Pills Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: '7days', label: '7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: '30days', label: '30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDatePreset(preset.id as DatePreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${datePreset === preset.id
                  ? 'bg-[#005BD3] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Selector Dropdowns */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs font-mono bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-800"
              />
              <span className="text-xs text-slate-400 font-semibold">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs font-mono bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Multi-Dimensional Filter Bar (Branch, Shift, Cashier, Channel, Payment Method) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80 text-xs">
          {/* 1. Branch Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Operating Branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBranch(val);
                setSelectedBranchId(val === 'ALL' ? null : val);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Branches (3)</option>
              <option value="00f4cdcb-7d1c-4026-b57a-6e66c33b0c54">Alawwa</option>
              <option value="fa68e4a0-a515-44c8-a082-5b5590366658">Dambadeniya</option>
              <option value="197693d6-4247-48df-b614-6fcde9e34f7d">Giriulla</option>
            </select>
          </div>

          {/* 2. Shift Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Shift Sequence
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Shifts</option>
              <option value="1">Morning (07:00 – 14:30)</option>
              <option value="2">Evening (14:30 – 21:00)</option>
              <option value="3">Night / Cutover (21:00 – Late)</option>
            </select>
          </div>

          {/* 3. Cashier Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Staff Cashier
            </label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500 truncate"
            >
              <option value="ALL">All Cashiers</option>
              {cashierOptions.map((c) => (
                <option key={c.id} value={c.fullName}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Channel Selector (POS vs Special Stock) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Billing Channel
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Sales (POS + Special)</option>
              <option value="POS">POS Catalog Only</option>
              <option value="SPECIAL">Special Stock (Modaka) Only</option>
            </select>
          </div>

          {/* 5. Payment Method Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Payment Method
            </label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash Payments</option>
              <option value="CARD">Card POS</option>
              <option value="QR">LankaQR</option>
              <option value="CREDIT">Khata Credit</option>
            </select>
          </div>
        </div>
      </div>

      {/* OWNER ONLY: Legacy POS Bridge Live Status Widget */}
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
                    Auto-Syncing Active Branches (5m)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <PauseCircle className="w-3 h-3 text-amber-400" />
                    Paused (Production Cutover Ready)
                  </span>
                )}

                <span className="text-[11px] text-slate-400 font-mono">
                  {syncConfig?.lastStatus === 'running'
                    ? '• Sync in progress...'
                    : `• Status: ${syncConfig?.lastStatus?.toUpperCase() || 'IDLE'}`}
                </span>
              </div>

              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2 flex-wrap">
                <span>Alawwa, Dambadeniya & Giriulla</span>
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
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${syncConfig?.isEnabled
                  ? 'bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-400/40 hover:shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 hover:shadow-emerald-600/20'
                  } disabled:opacity-50`}
              >
                {syncConfig?.isEnabled ? (
                  <>
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Pause Sync</span>
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

      {/* =====================================================================
          PART 2: TOP KPI TELEMETRY ROW (COMBINED POS + SPECIAL STOCK)
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: TOTAL GROSS SALES (Combined) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-blue-400/50 hover:shadow-pos-card-hover transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Gross Sales
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCurrency(combinedGross)}
              </div>
              <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap font-medium">
                <span>POS: {formatCurrency(posAnalytics.revenue)}</span>
                <span>•</span>
                <span className="text-purple-700 font-semibold">Special: {formatCurrency(specialAnalytics.revenue)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSplitModalOpen(true)}
              className="text-xs font-bold text-[#005BD3] hover:text-[#004bb5] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>View Split Breakdown &rarr;</span>
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              {combinedBills} Bills • {specialAnalytics.units} Modaka
            </span>
          </div>
        </div>

        {/* KPI 2: TRUE NET PROFIT (Selling − Buying Cost) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-emerald-400/50 hover:shadow-pos-card-hover transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                True Net Profit
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-600 tracking-tight">
                {formatCurrency(combinedNetProfit)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                  {combinedMargin.toFixed(1)}% Margin
                </span>
                <span>after actual COGS</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Buying Cost (COGS):</span>
            <span className="font-bold text-slate-800">{formatCurrency(combinedCOGS)}</span>
          </div>
        </div>

        {/* KPI 3: AVERAGE BASKET & VOLUME */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-indigo-400/50 hover:shadow-pos-card-hover transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Average Basket & Volume
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCurrency(avgBasket)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Average basket per customer checkout
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Volume Sold:</span>
            <span className="font-bold text-indigo-600 font-mono">
              {combinedBills} Bills • {specialAnalytics.units} Units
            </span>
          </div>
        </div>

        {/* KPI 4: LOW STOCK & REORDER ALERTS */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card relative overflow-hidden group hover:border-amber-400/50 hover:shadow-pos-card-hover transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Low Stock Warnings
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {branchLowStockCount}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                {branchLowStockCount > 0 ? (
                  <span className="text-amber-600 font-semibold">SKUs below reorder point</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">Branch stock levels healthy</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 truncate">{activeBranchName}</span>
            <Link
              href="/dashboard/alerts"
              className="text-[#005BD3] font-bold hover:underline shrink-0"
            >
              Inspect &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PART 2: COMBINED SALES & PROFIT TIMELINE & PAYMENT METHOD BREAKDOWN
      ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Combined Sales & Profit Timeline (2 Cols) */}
        <div className="xl:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Sales & Profit Timeline (Combined POS + Special Stock)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {datePreset === 'today'
                  ? "Today's hourly combined revenue and net profit performance (07:00 – 22:00 Asia/Colombo)"
                  : 'Daily combined gross revenue and net profit performance across active days'}
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
            {timelineData.length > 0 && timelineData.some((d) => d.sales > 0 || d.profit > 0 || d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
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
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#profitGrad)"
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

        {/* Payment Breakdown (1 Col) */}
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
              {paymentBreakdown.total > 0 ? (
                <>
                  {/* Cash */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Cash (POS + Special)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(paymentBreakdown.cash)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${paymentBreakdown.total > 0 ? (paymentBreakdown.cash / paymentBreakdown.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Card */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Card POS</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(paymentBreakdown.card)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${paymentBreakdown.total > 0 ? (paymentBreakdown.card / paymentBreakdown.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* LankaQR */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">LankaQR</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(paymentBreakdown.qr)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{
                          width: `${paymentBreakdown.total > 0 ? (paymentBreakdown.qr / paymentBreakdown.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Khata Credit */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Khata Credit</span>
                      <span className="font-mono font-bold text-amber-700">
                        {formatCurrency(paymentBreakdown.credit)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{
                          width: `${paymentBreakdown.total > 0 ? (paymentBreakdown.credit / paymentBreakdown.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No payment data available for this selection
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Total Collections:</span>
            <span className="font-bold text-slate-900">{formatCurrency(paymentBreakdown.total)}</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PART 3: ADVANCED EXECUTIVE PERFORMANCE BREAKDOWN HUB (4 TABS)
      ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Hub Header & Tabs */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Performance Breakdown Hub</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deep multi-dimensional analysis by branch, shift timing, cashier ranking, and peak traffic
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl w-fit">
            {[
              { id: 'BRANCH', label: 'Branch-Wise' },
              { id: 'SHIFT', label: 'Shift-Wise' },
              { id: 'CASHIER', label: 'Cashier-Wise' },
              { id: 'PEAK', label: 'Peak & Categories' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  startTabTransition(() => {
                    setActiveBreakdownTab(tab.id as any);
                  });
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeBreakdownTab === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  } ${isTabPending ? 'opacity-70' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Branch-Wise Comparison */}
        {activeBreakdownTab === 'BRANCH' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Operating Branch</th>
                  <th className="py-3 px-4 text-right">POS Sales</th>
                  <th className="py-3 px-4 text-right">Special Stock</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                  <th className="py-3 px-4 text-right">Buying Cost</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-right">Margin %</th>
                  <th className="py-3 px-4 text-right">Txns</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchBreakdown.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{b.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({b.code})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                      {formatCurrency(b.posRev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-purple-700">
                      {formatCurrency(b.specialRev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(b.totalRev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {formatCurrency(b.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(b.netProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {b.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-600">
                      {b.transactions}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-semibold text-slate-700">{b.share.toFixed(1)}%</span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${b.share}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Shift-Wise Breakdown */}
        {activeBreakdownTab === 'SHIFT' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Shift Sequence</th>
                  <th className="py-3 px-4">Operating Hours</th>
                  <th className="py-3 px-4 text-right">POS Sales</th>
                  <th className="py-3 px-4 text-right">Special Stock</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-right">Margin %</th>
                  <th className="py-3 px-4 text-right">Opening Float</th>
                  <th className="py-3 px-4 text-right">Net Drawer Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftBreakdown.map((s) => (
                  <tr key={s.num} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {s.timing}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatCurrency(s.posRev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-700 font-medium">
                      {formatCurrency(s.specialRev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(s.totalRev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(s.netProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {s.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatCurrency(s.openingFloat)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${s.netVariance === 0
                          ? 'text-emerald-700 bg-emerald-50'
                          : s.netVariance < 0
                            ? 'text-rose-700 bg-rose-50'
                            : 'text-blue-700 bg-blue-50'
                          }`}
                      >
                        {s.netVariance === 0 ? 'LKR 0.00' : formatCurrency(s.netVariance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Cashier-Wise Ranking */}
        {activeBreakdownTab === 'CASHIER' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Cashier Name</th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setCashierSortField('revenue');
                      setCashierSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                    }}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Total Revenue</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setCashierSortField('bills');
                      setCashierSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                    }}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>POS Bills</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Special Sales</th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setCashierSortField('profit');
                      setCashierSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                    }}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Net Profit</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Avg Ticket</th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setCashierSortField('variance');
                      setCashierSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                    }}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Drawer Variance</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashierBreakdown.length > 0 ? (
                  cashierBreakdown.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.name}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(c.totalRev)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {c.posBills}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-700">
                        {formatCurrency(c.specialRev)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(c.netProfit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(c.posBills > 0 ? c.posRev / c.posBills : 0)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${c.variance === 0
                            ? 'text-slate-600 bg-slate-100'
                            : c.variance < 0
                              ? 'text-rose-700 bg-rose-50'
                              : 'text-blue-700 bg-blue-50'
                            }`}
                        >
                          {c.variance === 0 ? 'LKR 0.00' : formatCurrency(c.variance)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No cashier performance records for this selection
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Peak Hours & Categories */}
        {activeBreakdownTab === 'PEAK' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Peak Bar */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Hourly Peak Sales Distribution (07:00 – 22:00 Colombo)
              </h3>
              <div className="space-y-2">
                {hourlyPeakBreakdown.map((slot) => {
                  const maxSlot = Math.max(1, ...hourlyPeakBreakdown.map((s) => s.revenue));
                  const pct = (slot.revenue / maxSlot) * 100;
                  return (
                    <div key={slot.hour} className="flex items-center gap-2 text-xs">
                      <span className="w-12 text-slate-500 font-mono shrink-0">{slot.label}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono font-bold text-slate-800 shrink-0">
                        {formatCurrency(slot.revenue)}
                      </span>
                      <span className="w-10 text-right text-[10px] text-slate-400 shrink-0 font-mono">
                        ({slot.txCount})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Performance */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Top Product Categories by Revenue
              </h3>
              <div className="space-y-3">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{cat.name}</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(cat.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{cat.units} units sold</span>
                      <span className="text-emerald-700 font-bold font-mono">
                        Profit: {formatCurrency(cat.profit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          PART 4: FAST-MOVING & SLOW-MOVING INVENTORY INTELLIGENCE
      ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Section Header with Branch & Channel Selectors */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>Fast-Moving & Slow-Moving Inventory Intelligence</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated sales velocity, stock-out reorder predictions, and dead stock rebalancing
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Branch Selector for Inventory */}
            <select
              value={inventoryBranch}
              onChange={(e) => setInventoryBranch(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Branches</option>
              <option value="00f4cdcb-7d1c-4026-b57a-6e66c33b0c54">Alawwa</option>
              <option value="fa68e4a0-a515-44c8-a082-5b5590366658">Dambadeniya</option>
              <option value="197693d6-4247-48df-b614-6fcde9e34f7d">Giriulla</option>
            </select>

            {/* Channel Toggle */}
            <select
              value={inventoryChannel}
              onChange={(e) => setInventoryChannel(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Items</option>
              <option value="POS">POS Catalog</option>
              <option value="SPECIAL">Special Stock</option>
            </select>
          </div>
        </div>

        {/* 2 Parallel Cards: Fast Moving vs Slow Moving */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Side A: Top Fast-Moving Products (High Velocity) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Top Fast-Moving Products ({displayedFastMoving.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">Ranked by volume</span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter fast-moving..."
                  value={fastMovingSearch}
                  onChange={(e) => {
                    setFastMovingSearch(e.target.value);
                    setFastMovingLimit(25);
                  }}
                  className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 w-44"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {displayedFastMoving.length > 0 ? (
                displayedFastMoving.slice(0, fastMovingLimit).map((p) => (
                  <div key={p.id} className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          #{p.rank}
                        </span>
                        <div className="font-bold text-slate-900 truncate">{p.name}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 ml-7">
                        SKU: {p.sku} • Stock: <strong className="text-slate-700">{p.onHand} units</strong> • Velocity: {p.dailyVelocity}/day
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-slate-900">{formatCurrency(p.revenue)}</div>
                      <div className="mt-0.5">
                        {p.daysLeft < 5 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {p.daysLeft}d stock left (Reorder!)
                          </span>
                        ) : p.daysLeft <= 14 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {p.daysLeft}d stock left
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700">
                            {p.daysLeft}d supply
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No sales recorded for this branch selection
                </div>
              )}
            </div>

            {displayedFastMoving.length > fastMovingLimit && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFastMovingLimit((prev) => prev + 25)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
                >
                  Show More (+25)
                </button>
                <button
                  type="button"
                  onClick={() => setFastMovingLimit(displayedFastMoving.length)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 shadow-2xs cursor-pointer"
                >
                  Show All ({displayedFastMoving.length})
                </button>
              </div>
            )}
          </div>

          {/* Side B: Slow-Moving & Dead Stock (Low/Zero Velocity) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-purple-600" />
                  <span>Slow-Moving & Dead Stock ({displayedSlowMoving.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">Stock on-hand with 0–2 sales</span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter slow-moving..."
                  value={slowMovingSearch}
                  onChange={(e) => {
                    setSlowMovingSearch(e.target.value);
                    setSlowMovingLimit(25);
                  }}
                  className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-purple-500 w-44"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {displayedSlowMoving.length > 0 ? (
                displayedSlowMoving.slice(0, slowMovingLimit).map((p, idx) => (
                  <div key={p.id || idx} className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        SKU: {p.sku} • Stock: <strong className="text-slate-800">{p.onHand} units</strong> • Sold in period: {p.unitsSold}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Tied Capital</div>
                      <div className="font-mono font-bold text-purple-700">{formatCurrency(p.tiedCapital)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  All inventory items in this branch are actively moving
                </div>
              )}
            </div>

            {displayedSlowMoving.length > slowMovingLimit && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSlowMovingLimit((prev) => prev + 25)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
                >
                  Show More (+25)
                </button>
                <button
                  type="button"
                  onClick={() => setSlowMovingLimit(displayedSlowMoving.length)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 shadow-2xs cursor-pointer"
                >
                  Show All ({displayedSlowMoving.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          PART 2: SEPARATE DRILL-DOWN MODAL ("TOGETHER ON SURFACE, SEPARATE INSIDE")
      ===================================================================== */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7052FF] flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Combined & Separate Revenue Breakdown (POS Catalog vs. Special Stock)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Exact Buying Cost (COGS), Gross Revenue, and Net Profit split for {activeBranchName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search split items..."
                    value={splitModalSearch}
                    onChange={(e) => {
                      setSplitModalSearch(e.target.value);
                      setSplitModalLimit(25);
                    }}
                    className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-purple-500 w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsSplitModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content: 2-Column Side-by-Side Comparison */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Side A Summary: POS Catalog */}
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 uppercase">POS Catalog Performance</span>
                    <span className="text-xs font-mono font-bold text-blue-700">{posAnalytics.billsCount} Bills</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Gross Sales</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(posAnalytics.revenue)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Buying Cost</span>
                      <span className="font-mono font-bold text-slate-600">{formatCurrency(posAnalytics.cogs)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Net Profit</span>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(posAnalytics.netProfit)}</span>
                    </div>
                  </div>
                </div>

                {/* Side B Summary: Special Stock */}
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 uppercase">Special Stock Performance</span>
                    <span className="text-xs font-mono font-bold text-purple-700">{specialAnalytics.units} Units</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-purple-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Gross Sales</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(specialAnalytics.revenue)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Buying Cost</span>
                      <span className="font-mono font-bold text-slate-600">{formatCurrency(specialAnalytics.cogs)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Net Profit</span>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(specialAnalytics.netProfit)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Comparison Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Side A Items: POS Catalog */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Top POS Products (Units & Margin)
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Showing {Math.min(displayedModalPosItems.length, splitModalLimit)} of {displayedModalPosItems.length}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs max-h-80 overflow-y-auto">
                    {displayedModalPosItems.slice(0, splitModalLimit).map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.units} sold • Cost: {formatCurrency(item.cogs)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-900">{formatCurrency(item.revenue)}</div>
                          <div className="text-[10px] font-mono text-emerald-600 font-bold">
                            +{formatCurrency(item.profit)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {displayedModalPosItems.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-xs">No matching POS items</div>
                    )}
                  </div>
                  {displayedModalPosItems.length > splitModalLimit && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSplitModalLimit((prev) => prev + 25)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Show More (+25)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitModalLimit(displayedModalPosItems.length)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer"
                      >
                        Show All ({displayedModalPosItems.length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Side B Items: Special Stock */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Special Stock Remedies Sold
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Showing {Math.min(displayedModalSpecialItems.length, splitModalLimit)} of {displayedModalSpecialItems.length}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs max-h-80 overflow-y-auto">
                    {displayedModalSpecialItems.slice(0, splitModalLimit).map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.units} sold @ {formatCurrency(item.rate)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-900">{formatCurrency(item.revenue)}</div>
                          <div className="text-[10px] font-mono text-emerald-600 font-bold">
                            +{formatCurrency(item.profit)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {displayedModalSpecialItems.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-xs">No matching Special items</div>
                    )}
                  </div>
                  {displayedModalSpecialItems.length > splitModalLimit && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSplitModalLimit((prev) => prev + 25)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Show More (+25)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitModalLimit(displayedModalSpecialItems.length)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 cursor-pointer"
                      >
                        Show All ({displayedModalSpecialItems.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500 font-medium">
                Combined Margin: <strong className="text-slate-800">{combinedMargin.toFixed(1)}%</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          QUICK ACTION SHORTCUTS & AUDIT LOGS
      ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Action Shortcuts (1 Col) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Common operational shortcuts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
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
                    {branchLowStockCount} low-stock item(s)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {branchLowStockCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {branchLowStockCount} Low
                  </span>
                )}
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </div>
            </Link>
          </div>
        </div>

        {/* Live Recent Activity Feed (2 Cols) */}
        <div className="xl:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col justify-between">
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
