import { z } from 'zod';

export const stockMovementTypeSchema = z.enum([
  'SALE',
  'PURCHASE_RECEIPT',
  'TRANSFER_DISPATCH',
  'TRANSFER_RECEIPT',
  'ADJUSTMENT_ADD',
  'ADJUSTMENT_SUB',
  'RETURN_RESTOCK',
  'DAMAGE_LOSS',
]);

export const stockAdjustmentReasonSchema = z.enum([
  'PHYSICAL_COUNT',
  'DAMAGED',
  'EXPIRED',
  'LOST_STOLEN',
  'CORRECTION',
]);

export const stockAdjustmentStatusSchema = z.enum(['APPLIED', 'REVERSED']);

export const stockTransferStatusSchema = z.enum([
  'PENDING',
  'DISPATCHED',
  'RECEIVED',
  'CANCELLED',
]);

export const stockLevelQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  lowStockOnly: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createStockAdjustmentItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  countedQuantity: z.number().min(0, 'Counted quantity must be non-negative'),
});

export const createStockAdjustmentSchema = z.object({
  warehouseId: z.string().uuid('Valid warehouse ID required'),
  reason: stockAdjustmentReasonSchema,
  notes: z.string().max(500).optional(),
  items: z
    .array(createStockAdjustmentItemSchema)
    .min(1, 'At least one item is required for stock adjustment'),
});

export const createStockTransferItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().positive('Transfer quantity must be greater than 0'),
});

export const createStockTransferSchema = z.object({
  sourceWarehouseId: z.string().uuid('Source warehouse ID required'),
  targetWarehouseId: z.string().uuid('Target warehouse ID required'),
  notes: z.string().max(500).optional(),
  items: z
    .array(createStockTransferItemSchema)
    .min(1, 'At least one item is required for stock transfer'),
}).refine((data) => data.sourceWarehouseId !== data.targetWarehouseId, {
  message: 'Source and target warehouses must be different',
  path: ['targetWarehouseId'],
});

export const stockMovementQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  movementType: stockMovementTypeSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

