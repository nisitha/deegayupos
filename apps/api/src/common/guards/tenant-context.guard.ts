import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthTenant, AuthUser } from '@pixelcraft/types';
import { PrismaService } from '../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException(
        'User context not established. Ensure JwtAuthGuard is executed before TenantContextGuard.',
      );
    }

    // Extract requested tenant from incoming header
    const requestedTenantId = (
      request.headers['x-tenant-id'] ||
      request.headers['x-tenant']
    )?.toString().trim();

    // Query user's active business memberships
    const memberships = await this.prisma.businessMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        business: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const firstMembership = memberships[0];
    if (!firstMembership) {
      throw new ForbiddenException(
        'Access denied: User does not belong to any active organization tenant.',
      );
    }

    let activeMembership = firstMembership;

    if (requestedTenantId) {
      const matched = memberships.find((m) => m.tenantId === requestedTenantId);
      if (!matched) {
        throw new ForbiddenException(
          'Access denied: You do not have an active membership for the requested tenant.',
        );
      }
      activeMembership = matched;
    }

    // Enforce business status isolation & suspension check
    if (activeMembership.business.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Tenant account is suspended. Please contact PixelCraft support.',
      );
    }

    if (activeMembership.business.status === 'EXPIRED') {
      throw new ForbiddenException(
        'Tenant organization subscription has expired. Please renew your subscription.',
      );
    }

    if (activeMembership.business.deletedAt) {
      throw new ForbiddenException(
        'Tenant organization has been deactivated or removed.',
      );
    }

    const authTenant: AuthTenant = {
      id: activeMembership.tenantId,
      name: activeMembership.business.name,
      slug: activeMembership.business.slug,
      role: activeMembership.role.code,
      roleId: activeMembership.roleId,
      status: activeMembership.status,
      isPrimaryBranchId: activeMembership.defaultBranchId,
    };

    const permissions: string[] = activeMembership.role.permissions.map(
      (rp) => rp.permission.code,
    );

    // Attach validated tenant context and granted permissions to request object
    request.tenant = authTenant;
    request.tenantId = authTenant.id;
    request.permissions = permissions;

    return true;
  }
}
