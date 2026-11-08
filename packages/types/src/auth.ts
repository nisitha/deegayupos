import type { ApiResponse } from './api';

/**
 * Authentication payload embedded inside signed JWT access and refresh tokens.
 */
export interface UserTokenPayload {
  sub: string; // User ID
  email: string;
  activeTenantId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Sanitized user identity returned in auth payloads.
 * Excludes sensitive fields like passwordHash or mfaSecret.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  isActive: boolean;
}

/**
 * Tenant membership context resolved for the authenticated session.
 */
export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  roleId: string;
  status: string;
  isPrimaryBranchId?: string | null;
}

/**
 * Successful authentication response body.
 */
export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: AuthUser;
  activeTenant?: AuthTenant | null;
  permissions: string[];
}

export type AuthResponse = ApiResponse<AuthResponseData>;

/**
 * Token refresh response payload.
 */
export interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export type RefreshTokenResponse = ApiResponse<RefreshTokenResponseData>;

/**
 * Profile & session introspection returned by GET /api/v1/auth/me
 */
export interface AuthMeData {
  user: AuthUser;
  memberships: AuthTenant[];
  activeTenant?: AuthTenant | null;
  permissions: string[];
}

export type AuthMeResponse = ApiResponse<AuthMeData>;

/**
 * Credentials DTO for login request.
 */
export interface LoginDto {
  email: string;
  password: string;
  tenantSlug?: string;
}

/**
 * Refresh token request DTO.
 */
export interface RefreshTokenDto {
  refreshToken: string;
}

/**
 * Switch tenant request DTO.
 */
export interface SwitchTenantDto {
  tenantId: string;
}
