import type { ApiResponse } from './api';
import type { AuthResponseData } from './auth';

/**
 * Slug availability request contract.
 */
export interface CheckSlugDto {
  slug: string;
}

/**
 * Result of checking tenant slug uniqueness.
 */
export interface CheckSlugResult {
  slug: string;
  available: boolean;
  reason?: string;
}

export type CheckSlugResponse = ApiResponse<CheckSlugResult>;

/**
 * Complete self-service registration onboarding payload.
 */
export interface OnboardingPayload {
  // User Credentials
  fullName: string;
  email: string;
  password: string;
  phone?: string | null;

  // Business Information
  businessName: string;
  businessSlug: string;
  legalName?: string | null;
  businessType?: string;
  currency?: string;
  timezone?: string;

  // Primary Location Setup
  branchName?: string;
  branchAddress?: string | null;
  branchPhone?: string | null;
  warehouseName?: string;
  registerName?: string;

  // SaaS Subscription Plan Selection
  planCode: string;
}

/**
 * Successful onboarding response returning instant authenticated session.
 */
export interface OnboardingResponseData extends AuthResponseData {
  trialEndsAt: string;
}

export type OnboardingResponse = ApiResponse<OnboardingResponseData>;

/**
 * Public SaaS subscription plan details exposed for prospective tenants.
 */
export interface PublicPlanDto {
  id: string;
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
  trialDays: number;
}

export type PublicPlansResponse = ApiResponse<PublicPlanDto[]>;
