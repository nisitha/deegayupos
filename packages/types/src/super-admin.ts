import type { ApiResponse, PaginatedResult } from './api';
import type { TenantStatus } from './tenant';

/**
 * High-level system overview telemetry metrics for Super Admin dashboard.
 */
export interface SuperAdminOverviewMetrics {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalBranches: number;
  totalRegisters: number;
  estimatedMrr: number;
}

export type SuperAdminOverviewResponse = ApiResponse<SuperAdminOverviewMetrics>;

/**
 * Summary card representation of a tenant organization in admin listings.
 */
export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  businessType: string;
  status: TenantStatus;
  currency: string;
  timezone: string;
  createdAt: string;
  userCount: number;
  branchCount: number;
  registerCount: number;
  plan?: {
    code: string;
    name: string;
    monthlyPrice: number;
  } | null;
}

export type PaginatedTenantsResponse = ApiResponse<PaginatedResult<TenantSummary>>;

/**
 * Detailed tenant profile for deep inspection in Super Admin portal.
 */
export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  businessType: string;
  status: TenantStatus;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  settings?: {
    invoicePrefix: string;
    taxNumber?: string | null;
    taxRate: number;
    isTaxInclusive: boolean;
  } | null;
  branches: Array<{
    id: string;
    code: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    isPrimary: boolean;
    isActive: boolean;
    registerCount: number;
  }>;
  registers: Array<{
    id: string;
    branchId: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  warehouses: Array<{
    id: string;
    branchId: string;
    name: string;
    isDefault: boolean;
    isActive: boolean;
  }>;
  memberships: Array<{
    id: string;
    userId: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    createdAt: string;
  }>;
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    startsAt: string;
    endsAt?: string | null;
    plan: {
      code: string;
      name: string;
      monthlyPrice: number;
      annualPrice: number;
      maxProducts: number;
      maxBranches: number;
      maxUsers: number;
      maxRegisters: number;
    };
  } | null;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    userId?: string | null;
    createdAt: string;
    ipAddress?: string | null;
  }>;
}

export type TenantDetailResponse = ApiResponse<TenantDetail>;

/**
 * Tenant status update mutation DTO.
 */
export interface UpdateTenantStatusDto {
  status: TenantStatus;
  reason?: string;
}

export interface CreatePlanDto {
  code: string;
  name: string;
  description?: string | null;
  monthlyPrice: number;
  annualPrice: number;
  maxProducts: number;
  maxBranches: number;
  maxUsers: number;
  maxRegisters: number;
  enabledModules: string[];
  isActive?: boolean;
}

export type UpdatePlanDto = Partial<CreatePlanDto>;

export interface PlatformSettingDto {
  key: string;
  value: unknown;
  description?: string | null;
}

/**
 * SaaS Subscription Plan definition.
 */
export interface SaaSPlanDto {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyPrice: number;
  annualPrice: number;
  maxProducts: number;
  maxBranches: number;
  maxUsers: number;
  maxRegisters: number;
  enabledModules: string[];
  isActive?: boolean;
  subscriberCount?: number;
}

export type SaaSPlansResponse = ApiResponse<SaaSPlanDto[]>;

/**
 * Immutable system audit log entry for super admin oversight.
 */
export interface SystemAuditLogDto {
  id: string;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantSlug?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export type PaginatedAuditLogsResponse = ApiResponse<PaginatedResult<SystemAuditLogDto>>;

/**
 * System-wide global setting key-value pair.
 */
export interface PlatformSettingItemDto {
  id: string;
  key: string;
  value: unknown;
  description?: string | null;
  updatedAt: string;
}

export type PlatformSettingsResponse = ApiResponse<PlatformSettingItemDto[]>;
