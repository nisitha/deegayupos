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

export interface BusinessSettingsData {
  id: string;
  tenantId: string;
  invoicePrefix: string;
  taxNumber?: string | null;
  taxRate: number;
  isTaxInclusive: boolean;
  enableLoyalty: boolean;
  receiptFooter?: string | null;
  negativeStockPolicy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfileData {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
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
  receiptFooter?: string | null;
  negativeStockPolicy?: string;
}

export type BusinessSettingsResponse = ApiResponse<BusinessSettingsData>;
