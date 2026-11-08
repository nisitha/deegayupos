import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Must provide a valid email address' })
    .toLowerCase(),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(128, { message: 'Password cannot exceed 128 characters' }),
  tenantSlug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, {
      message: 'Tenant slug must be alphanumeric with hyphens or underscores',
    })
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, { message: 'Refresh token is required' }),
});

export const switchTenantSchema = z.object({
  tenantId: z.string().uuid({ message: 'Must be a valid UUID tenant ID' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;
