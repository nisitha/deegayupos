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
