import { z } from 'zod';

export const dashboardMetricsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

export type DashboardMetricsQueryInput = z.infer<typeof dashboardMetricsQuerySchema>;

export const dashboardChartsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7).optional(),
  branchId: z.string().uuid().optional(),
});

export type DashboardChartsQueryInput = z.infer<typeof dashboardChartsQuerySchema>;

export const dashboardActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  branchId: z.string().uuid().optional(),
});

export type DashboardActivityQueryInput = z.infer<typeof dashboardActivityQuerySchema>;

