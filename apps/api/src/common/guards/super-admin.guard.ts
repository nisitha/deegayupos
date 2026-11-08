import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '@pixelcraft/types';

/**
 * Dedicated security guard ensuring that incoming requests originate from an authenticated
 * Platform Super Admin account. Blocks standard tenant users with an immediate 403 Forbidden.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException(
        'Authentication required to access Super Admin platform resources.',
      );
    }

    if (user.isSuperAdmin !== true && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Access denied: Requires platform Super Admin privileges.',
      );
    }

    return true;
  }
}

