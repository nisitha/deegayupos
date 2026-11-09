import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any_permissions';

/**
 * Decorator to declare required RBAC permissions on controllers or individual route handlers.
 * All specified permissions must be present.
 * @param permissions List of permission string codes (e.g. 'inventory:view', 'settings:manage')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to declare that at least ONE of the specified permissions must be granted.
 * @param permissions List of permission string codes (e.g. 'pos:access', 'inventory:view')
 */
export const RequireAnyPermissions = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);

