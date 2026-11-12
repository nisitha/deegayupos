import type { ApiResponse } from './api';

export interface BusinessProfileBranch {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export type ReceiptPaperSize = 'MM_58' | 'MM_80' | 'A4';

export interface BusinessSettingsData {
  id: string;
  tenantId: string;
  invoicePrefix: string;
  taxNumber?: string | null;
  taxRate: number;
  isTaxInclusive: boolean;
  enableLoyalty: boolean;
  receiptPaperSize: ReceiptPaperSize;
  showLogoOnReceipt: boolean;
  showTaxDetails: boolean;
  showBarcodeOnReceipt: boolean;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  returnPolicyText?: string | null;
  negativeStockPolicy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfileData {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  logoUrl?: string | null;
  businessType: string;
  status: string;
  currency: string;
  timezone: string;
  primaryBranch?: BusinessProfileBranch | null;
  branches: BusinessProfileBranch[];
  settings?: BusinessSettingsData | null;
}

export type BusinessProfileResponse = ApiResponse<BusinessProfileData>;

export interface UpdateBusinessSettingsPayload {
  invoicePrefix?: string;
  taxNumber?: string | null;
  taxRate?: number;
  isTaxInclusive?: boolean;
  enableLoyalty?: boolean;
  receiptPaperSize?: ReceiptPaperSize;
  showLogoOnReceipt?: boolean;
  showTaxDetails?: boolean;
  showBarcodeOnReceipt?: boolean;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  returnPolicyText?: string | null;
  negativeStockPolicy?: string;
}

export interface UpdateReceiptSettingsPayload {
  receiptPaperSize?: ReceiptPaperSize;
  showLogoOnReceipt?: boolean;
  showTaxDetails?: boolean;
  showBarcodeOnReceipt?: boolean;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  returnPolicyText?: string | null;
}

export type BusinessSettingsResponse = ApiResponse<BusinessSettingsData>;
