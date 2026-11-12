import { z } from 'zod';

export const staffRoleEnum = z.enum(['OWNER', 'MANAGER', 'CASHIER']);

export const createStaffUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  pinCode: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').optional().nullable(),
  role: staffRoleEnum.default('CASHIER'),
  branchId: z.string().uuid().optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
});

export const updateStaffUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  pinCode: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits').optional().nullable(),
  role: staffRoleEnum.optional(),
  branchId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  phone: z.string().max(32).optional().nullable(),
});

export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
export type UpdateStaffUserInput = z.infer<typeof updateStaffUserSchema>;
