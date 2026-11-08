import { z } from 'zod';

export const updateTenantStatusSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'], {
    message: 'Status must be one of: TRIAL, ACTIVE, SUSPENDED, EXPIRED',
  }),
  reason: z.string().trim().max(500).optional(),
});

export const createPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(64)
    .toUpperCase(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(128),
  description: z.string().trim().max(1000).optional(),
  monthlyPrice: z.number().min(0, 'Monthly price cannot be negative'),
  annualPrice: z.number().min(0, 'Annual price cannot be negative'),
  maxProducts: z.number().int().min(1).default(500),
  maxBranches: z.number().int().min(1).default(1),
  maxUsers: z.number().int().min(1).default(2),
  maxRegisters: z.number().int().min(1).default(1),
  enabledModules: z.array(z.string()).default(['pos', 'inventory']),
  isActive: z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();

export const updatePlatformSettingSchema = z.object({
  key: z.string().trim().min(1, 'Setting key is required').max(128),
  value: z.any(),
  description: z.string().trim().max(500).optional(),
});

export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type UpdatePlatformSettingInput = z.infer<typeof updatePlatformSettingSchema>;
