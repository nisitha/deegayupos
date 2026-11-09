import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission metadata is defined on the handler or class, allow access
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyPermissions || anyPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const grantedPermissions = (request.permissions as string[]) || [];

    // Bypass check if wildcard permission is granted
    if (grantedPermissions.includes('*')) {
      return true;
    }

    // Check ALL permissions requirement
    if (requiredPermissions && requiredPermissions.length > 0) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !grantedPermissions.includes(permission),
      );

      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `Forbidden: Insufficient permissions. Missing required permission(s): ${missingPermissions.join(', ')}`,
        );
      }
    }

    // Check AT LEAST ONE permission requirement
    if (anyPermissions && anyPermissions.length > 0) {
      const hasAtLeastOne = anyPermissions.some((perm) =>
        grantedPermissions.includes(perm),
      );

      if (!hasAtLeastOne) {
        throw new ForbiddenException(
          `Forbidden: Insufficient permissions. Requires at least one of: ${anyPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}

