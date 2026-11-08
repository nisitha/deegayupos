import { z } from 'zod';

export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID v4 format' });

export const tenantIdSchema = z
  .string()
  .min(3, { message: 'Tenant ID must be at least 3 characters' })
  .max(64, { message: 'Tenant ID cannot exceed 64 characters' })
  .regex(/^[a-z0-9_-]+$/, {
    message:
      'Tenant ID must contain only lowercase alphanumeric characters, dashes, or underscores',
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
