import { z } from 'zod';

export const checkSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, { message: 'Slug must be at least 2 characters' })
    .max(64, { message: 'Slug cannot exceed 64 characters' })
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, {
      message: 'Slug must be alphanumeric with hyphens or underscores only',
    }),
});

export const onboardingSchema = z.object({
  // User Account Details
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' })
    .max(128, { message: 'Full name cannot exceed 128 characters' }),
  email: z
    .string()
    .trim()
    .email({ message: 'Must provide a valid email address' })
    .toLowerCase(),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(128, { message: 'Password cannot exceed 128 characters' }),
  phone: z.string().trim().max(32).optional().nullable(),

  // Organization Details
  businessName: z
    .string()
    .trim()
    .min(2, { message: 'Business name must be at least 2 characters' })
    .max(255, { message: 'Business name cannot exceed 255 characters' }),
  businessSlug: z
    .string()
    .trim()
    .min(2, { message: 'Slug must be at least 2 characters' })
    .max(64, { message: 'Slug cannot exceed 64 characters' })
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, {
      message: 'Slug must contain lowercase letters, numbers, hyphens, or underscores only',
    }),
  legalName: z.string().trim().max(255).optional().nullable(),
  businessType: z.string().trim().default('RETAIL'),
  currency: z.string().trim().min(3).max(10).default('LKR'),
  timezone: z.string().trim().default('Asia/Colombo'),

  // Primary Location Setup
  branchName: z.string().trim().min(2).max(255).default('Main Branch'),
  branchAddress: z.string().trim().max(500).optional().nullable(),
  branchPhone: z.string().trim().max(32).optional().nullable(),
  warehouseName: z.string().trim().min(2).max(255).default('Central Warehouse'),
  registerName: z.string().trim().min(2).max(128).default('POS Counter 1'),

  // Subscription Plan
  planCode: z
    .string()
    .trim()
    .min(2, { message: 'Must select a valid subscription plan' })
    .toUpperCase(),
});

export type CheckSlugInput = z.infer<typeof checkSlugSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
