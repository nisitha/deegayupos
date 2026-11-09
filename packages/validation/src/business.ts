import { z } from 'zod';

export const updateBusinessSettingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(20).optional(),
  taxNumber: z.string().max(64).nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  isTaxInclusive: z.boolean().optional(),
  enableLoyalty: z.boolean().optional(),
  receiptFooter: z.string().max(2000).nullable().optional(),
  negativeStockPolicy: z.enum(['DISALLOW', 'ALLOW', 'WARN']).optional(),
});

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;

