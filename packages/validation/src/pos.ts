import { z } from 'zod';

export const checkoutItemSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  productName: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  subtotal: z.number().min(0, 'Subtotal cannot be negative'),
  notes: z.string().optional(),
});

export const checkoutPaymentSchema = z.object({
  paymentMethod: z.enum([
    'CASH',
    'CARD',
    'QR_PAYMENT',
    'BANK_TRANSFER',
    'STORE_CREDIT',
  ]),
  amount: z.number().positive('Payment amount must be greater than zero'),
  reference: z.string().max(128).optional(),
});

export const checkoutSchema = z.object({
  branchId: z.string().uuid('Valid branch ID is required'),
  registerId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().max(255).optional(),
  orderType: z
    .enum(['RETAIL_WALKIN', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'])
    .default('RETAIL_WALKIN'),
  tableNumber: z.string().max(32).optional(),
  items: z.array(checkoutItemSchema).min(1, 'Cart cannot be empty'),
  payments: z.array(checkoutPaymentSchema).min(1, 'At least one payment is required'),
  subtotal: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0),
  paidAmount: z.number().min(0),
  changeDue: z.number().min(0).default(0),
  idempotencyKey: z.string().max(128).optional(),
  notes: z.string().optional(),
});

export const holdCartSchema = z.object({
  branchId: z.string().uuid('Valid branch ID is required'),
  registerId: z.string().uuid().optional(),
  cartReference: z.string().min(1, 'Cart reference is required').max(128),
  cartData: z.record(z.unknown()),
});

export const voidSaleSchema = z.object({
  reason: z.string().min(3, 'Void reason must be at least 3 characters').max(255),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;
export type CheckoutItemSchema = z.infer<typeof checkoutItemSchema>;
export type CheckoutPaymentSchema = z.infer<typeof checkoutPaymentSchema>;
export type HoldCartSchema = z.infer<typeof holdCartSchema>;
export type VoidSaleSchema = z.infer<typeof voidSaleSchema>;

