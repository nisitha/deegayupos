import type { ApiResponse } from './api';

/**
 * High-level telemetry KPI metrics for the tenant business dashboard.
 */
export interface DashboardMetrics {
  todaySales: number;
  yesterdaySales: number;
  salesGrowthPercent: number;
  transactionCount: number;
  avgTransactionValue: number;
  lowStockCount: number;
  activeRegistersCount: number;
}

export type DashboardMetricsResponse = ApiResponse<DashboardMetrics>;

/**
 * Daily sales timeline data point for trend charts.
 */
export interface DailySalesTimelinePoint {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * Payment method volume and transaction count distribution.
 */
export interface PaymentMethodDistribution {
  method: string;
  total: number;
  count: number;
}

/**
 * Aggregate chart visualization data payload.
 */
export interface DashboardChartsData {
  timeline: DailySalesTimelinePoint[];
  paymentMix: PaymentMethodDistribution[];
}

export type DashboardChartsResponse = ApiResponse<DashboardChartsData>;

/**
 * Recent chronological business activity or audit event.
 */
export interface DashboardActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
  } | null;
  metadata?: Record<string, unknown> | null;
}

export type DashboardActivityResponse = ApiResponse<DashboardActivityItem[]>;

