import { z } from 'zod';

export const openShiftSchema = z.object({
  registerId: z.string().trim().default('REG-01'),
  openingFloat: z.number().min(0, 'Opening float cannot be negative'),
  notes: z.string().trim().optional(),
});

export const cashDropSchema = z.object({
  eventType: z.enum(['PAY_IN', 'PAY_OUT', 'SAFE_DROP'], {
    errorMap: () => ({ message: 'Event type must be PAY_IN, PAY_OUT, or SAFE_DROP' }),
  }),
  amount: z.number().positive('Amount must be greater than zero'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters'),
  authorizedById: z.string().uuid().optional(),
});

export const cashDenominationsSchema = z.object({
  note5000: z.number().int().min(0).optional(),
  note1000: z.number().int().min(0).optional(),
  note500: z.number().int().min(0).optional(),
  note100: z.number().int().min(0).optional(),
  note50: z.number().int().min(0).optional(),
  note20: z.number().int().min(0).optional(),
  coin10: z.number().int().min(0).optional(),
  coin5: z.number().int().min(0).optional(),
  coin2: z.number().int().min(0).optional(),
  coin1: z.number().int().min(0).optional(),
}).optional();

export const closeShiftSchema = z.object({
  closingFloatActual: z.number().min(0, 'Counted cash cannot be negative'),
  denominations: cashDenominationsSchema,
  notes: z.string().trim().optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CashDropInput = z.infer<typeof cashDropSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;

