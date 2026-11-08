import { z } from 'zod';

export const healthCheckDataSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  service: z.string().min(1),
  version: z.string().min(1),
  environment: z.string().min(1),
  uptime: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  nodeVersion: z.string(),
  database: z
    .object({
      status: z.enum(['connected', 'disconnected']),
      latencyMs: z.number().optional(),
    })
    .optional(),
  memoryUsage: z
    .object({
      rssMb: z.number(),
      heapTotalMb: z.number(),
      heapUsedMb: z.number(),
    })
    .optional(),
});

export const healthCheckResponseSchema = z.object({
  success: z.boolean(),
  data: healthCheckDataSchema,
  timestamp: z.string().datetime(),
  path: z.string().optional(),
});

export type HealthCheckDataSchema = z.infer<typeof healthCheckDataSchema>;
export type HealthCheckResponseSchema = z.infer<typeof healthCheckResponseSchema>;
