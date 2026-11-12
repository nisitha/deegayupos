import { z } from 'zod';

export const updateBusinessSettingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(20).optional(),
  taxNumber: z.string().max(64).nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  isTaxInclusive: z.boolean().optional(),
  enableLoyalty: z.boolean().optional(),
  receiptPaperSize: z.enum(['MM_58', 'MM_80', 'A4']).optional(),
  showLogoOnReceipt: z.boolean().optional(),
  showTaxDetails: z.boolean().optional(),
  showBarcodeOnReceipt: z.boolean().optional(),
  receiptHeader: z.string().max(2000).nullable().optional(),
  receiptFooter: z.string().max(2000).nullable().optional(),
  returnPolicyText: z.string().max(2000).nullable().optional(),
  negativeStockPolicy: z.enum(['DISALLOW', 'ALLOW', 'WARN']).optional(),
});

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;

export const updateReceiptSettingsSchema = z.object({
  receiptPaperSize: z.enum(['MM_58', 'MM_80', 'A4']).optional(),
  showLogoOnReceipt: z.boolean().optional(),
  showTaxDetails: z.boolean().optional(),
  showBarcodeOnReceipt: z.boolean().optional(),
  receiptHeader: z.string().max(2000).nullable().optional(),
  receiptFooter: z.string().max(2000).nullable().optional(),
  returnPolicyText: z.string().max(2000).nullable().optional(),
});

export type UpdateReceiptSettingsInput = z.infer<typeof updateReceiptSettingsSchema>;

export const updateTenantStoreSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  legalName: z.string().max(255).nullable().optional(),
  logoUrl: z.string().max(2000).nullable().optional(),
  phone: z.string().min(1).max(64).optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().min(1).max(1000).optional(),
  vatNumber: z.string().max(64).nullable().optional(),
  receiptHeaderNote: z.string().max(2000).nullable().optional(),
  receiptFooterNote: z.string().max(2000).nullable().optional(),
  returnPolicy: z.string().max(2000).nullable().optional(),
  receiptPaperWidth: z.enum(['80mm', '58mm']).optional(),
  showLogo: z.boolean().optional(),
  showVat: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
  showQr: z.boolean().optional(),
});

export type UpdateTenantStoreSettingsInput = z.infer<typeof updateTenantStoreSettingsSchema>;



