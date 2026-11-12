/**
 * Unique identifier for a tenant account within the multi-tenant SaaS architecture.
 */
export type TenantId = string;

/**
 * Tenant subscription tiers supported by PixelCraft POS.
 */
export type TenantPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

/**
 * Lifecycle status of a tenant organization.
 */
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING' | 'CANCELLED';

/**
 * Contextual metadata resolved for a given request/tenant domain.
 */
export interface TenantContext {
  tenantId: TenantId;
  tenantSlug: string;
  businessName: string;
  plan: TenantPlan;
  status: TenantStatus;
  customDomain?: string;
}

/**
 * Store Profile & Receipt Branding Settings DTO
 */
export interface TenantStoreSettingsDto {
  id?: string;
  tenantId?: string;
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  vatNumber?: string | null;
  receiptHeaderNote?: string | null;
  receiptFooterNote?: string | null;
  returnPolicy?: string | null;
  receiptPaperWidth: '80mm' | '58mm';
  showLogo: boolean;
  showVat: boolean;
  showBarcode: boolean;
  showQr: boolean;
  updatedAt?: string;
}

export type UpdateTenantStoreSettingsDto = Partial<TenantStoreSettingsDto>;

