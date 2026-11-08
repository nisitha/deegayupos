import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to declare required RBAC permissions on controllers or individual route handlers.
 * @param permissions List of permission string codes (e.g. 'inventory:view', 'settings:manage')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

