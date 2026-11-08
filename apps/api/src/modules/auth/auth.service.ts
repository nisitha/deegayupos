import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@pixelcraft/database';
import type {
  AuthMeData,
  AuthResponseData,
  AuthTenant,
  AuthUser,
  LoginDto,
  RefreshTokenResponseData,
  UserTokenPayload,
} from '@pixelcraft/types';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.jwtSecret =
      configService.get<string>('JWT_SECRET') ||
      'pixelcraft-pos-dev-secret-key-32chars!!';
    this.jwtRefreshSecret =
      configService.get<string>('JWT_REFRESH_SECRET') ||
      'pixelcraft-pos-dev-refresh-secret-32chars!!';
  }

  /**
   * Authenticate user credentials, resolve tenant membership & permissions, and issue JWT tokens.
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseData> {
    const email = dto.email.trim().toLowerCase();

    // 1. Fetch user identity with active memberships, business info, and role permissions
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            business: {
              status: { in: ['ACTIVE', 'TRIAL'] },
              deletedAt: null,
            },
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
        },
      },
    });

    if (!user) {
      // Check if this is a Platform Super Admin account
      const platformUser = await this.prisma.platformUser.findUnique({
        where: { email },
      });

      if (platformUser) {
        const isPlatformPasswordValid = await bcrypt.compare(
          dto.password,
          platformUser.passwordHash,
        );

        if (!isPlatformPasswordValid) {
          throw new UnauthorizedException('Invalid email or password.');
        }

        if (!platformUser.isActive || platformUser.deletedAt) {
          throw new UnauthorizedException(
            'Platform administrator account is disabled or deactivated.',
          );
        }

        const accessPayload: UserTokenPayload = {
          sub: platformUser.id,
          email: platformUser.email,
          isPlatformUser: true,
          isSuperAdmin: platformUser.role === 'SUPER_ADMIN',
          role: platformUser.role,
        };

        const [accessToken, refreshToken] = await Promise.all([
          this.jwtService.signAsync(accessPayload, {
            secret: this.jwtSecret,
            expiresIn: '15m',
          }),
          this.jwtService.signAsync(
            { sub: platformUser.id, email: platformUser.email },
            {
              secret: this.jwtRefreshSecret,
              expiresIn: '7d',
            },
          ),
        ]);

        return {
          accessToken,
          refreshToken,
          expiresIn: 900,
          tokenType: 'Bearer',
          user: {
            id: platformUser.id,
            email: platformUser.email,
            fullName: 'PixelCraft Super Admin',
            phone: null,
            isActive: platformUser.isActive,
            isSuperAdmin: platformUser.role === 'SUPER_ADMIN',
            isPlatformUser: true,
            role: platformUser.role,
          },
          activeTenant: null,
          permissions: ['*'],
        };
      }

      // Avoid leaking user existence, but record audit if business slug exists
      if (dto.tenantSlug) {
        const business = await this.prisma.business.findUnique({
          where: { slug: dto.tenantSlug },
        });
        if (business) {
          await this.recordAuditLog({
            tenantId: business.id,
            userId: null,
            action: 'LOGIN_FAILED',
            entity: 'AUTH',
            ipAddress,
            userAgent,
            newValues: { reason: 'USER_NOT_FOUND', email },
          });
        }
      }
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 2. Verify password hash using bcrypt
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Find tenant ID for audit log
      let auditTenantId: string | null = null;
      if (dto.tenantSlug) {
        const matchingMembership = user.memberships.find(
          (m) => m.business.slug === dto.tenantSlug,
        );
        if (matchingMembership) {
          auditTenantId = matchingMembership.tenantId;
        } else {
          const business = await this.prisma.business.findUnique({
            where: { slug: dto.tenantSlug },
          });
          if (business) auditTenantId = business.id;
        }
      } else if (user.memberships.length > 0) {
        auditTenantId = user.memberships[0]?.tenantId ?? null;
      }

      if (auditTenantId) {
        await this.recordAuditLog({
          tenantId: auditTenantId,
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'AUTH',
          entityId: user.id,
          ipAddress,
          userAgent,
          newValues: { reason: 'INVALID_CREDENTIALS', email: user.email },
        });
      }

      throw new UnauthorizedException('Invalid email or password.');
    }

    // 3. Ensure user account is active
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException(
        'Account is disabled or deactivated. Please contact your organization administrator.',
      );
    }

    // 4. Resolve active tenant membership
    let selectedMembership = user.memberships[0] || null;

    if (dto.tenantSlug) {
      const matched = user.memberships.find(
        (m) => m.business.slug === dto.tenantSlug,
      );
      if (!matched) {
        throw new ForbiddenException(
          `You do not have an active membership for tenant organization '${dto.tenantSlug}'.`,
        );
      }
      selectedMembership = matched;
    }

    const activeTenant: AuthTenant | null = selectedMembership
      ? {
          id: selectedMembership.tenantId,
          name: selectedMembership.business.name,
          slug: selectedMembership.business.slug,
          role: selectedMembership.role.code,
          roleId: selectedMembership.roleId,
          status: selectedMembership.status,
          isPrimaryBranchId: selectedMembership.defaultBranchId,
        }
      : null;

    const permissions: string[] = selectedMembership
      ? selectedMembership.role.permissions.map((rp) => rp.permission.code)
      : [];

    // 5. Generate signed JWT tokens
    const accessPayload: UserTokenPayload = {
      sub: user.id,
      email: user.email,
      activeTenantId: activeTenant?.id,
      role: activeTenant?.role,
    };

    const refreshPayload = {
      sub: user.id,
      email: user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.jwtRefreshSecret,
        expiresIn: '7d',
      }),
    ]);

    // 6. Record LOGIN_SUCCESS audit log
    if (activeTenant) {
      await this.recordAuditLog({
        tenantId: activeTenant.id,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'AUTH',
        entityId: user.id,
        ipAddress,
        userAgent,
        newValues: {
          role: activeTenant.role,
          tenantSlug: activeTenant.slug,
        },
      });
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
    };

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer',
      user: authUser,
      activeTenant,
      permissions,
    };
  }

  /**
   * Refreshes an expired or expiring access token using a valid refresh token.
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseData> {
    let payload: { sub: string; email: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(
        refreshToken,
        {
          secret: this.jwtRefreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid, expired, or malformed refresh token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            business: {
              status: { in: ['ACTIVE', 'TRIAL'] },
              deletedAt: null,
            },
          },
          include: { role: true },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is invalid or deactivated.');
    }

    const primaryMembership = user.memberships[0] || null;

    const accessPayload: UserTokenPayload = {
      sub: user.id,
      email: user.email,
      activeTenantId: primaryMembership?.tenantId,
      role: primaryMembership?.role.code,
    };

    const newAccessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.jwtSecret,
      expiresIn: '15m',
    });

    const newRefreshToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '7d',
      },
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  /**
   * Introspects current authenticated user profile, tenant memberships, and active permissions.
   */
  async getMe(userId: string, currentTenantId?: string): Promise<AuthMeData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            business: {
              status: { in: ['ACTIVE', 'TRIAL'] },
              deletedAt: null,
            },
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
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is deactivated or unavailable.');
    }

    const memberships: AuthTenant[] = user.memberships.map((m) => ({
      id: m.tenantId,
      name: m.business.name,
      slug: m.business.slug,
      role: m.role.code,
      roleId: m.roleId,
      status: m.status,
      isPrimaryBranchId: m.defaultBranchId,
    }));

    let selectedMembership = user.memberships[0] || null;

    if (currentTenantId) {
      const matched = user.memberships.find((m) => m.tenantId === currentTenantId);
      if (matched) {
        selectedMembership = matched;
      }
    }

    const activeTenant: AuthTenant | null = selectedMembership
      ? {
          id: selectedMembership.tenantId,
          name: selectedMembership.business.name,
          slug: selectedMembership.business.slug,
          role: selectedMembership.role.code,
          roleId: selectedMembership.roleId,
          status: selectedMembership.status,
          isPrimaryBranchId: selectedMembership.defaultBranchId,
        }
      : null;

    const permissions: string[] = selectedMembership
      ? selectedMembership.role.permissions.map((rp) => rp.permission.code)
      : [];

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
      },
      memberships,
      activeTenant,
      permissions,
    };
  }

  /**
   * Switch the active organization tenant context for the user and issue fresh tokens.
   */
  async switchTenant(
    userId: string,
    targetTenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseData> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: {
        userId,
        tenantId: targetTenantId,
        status: 'ACTIVE',
        deletedAt: null,
        business: {
          status: { in: ['ACTIVE', 'TRIAL'] },
          deletedAt: null,
        },
      },
      include: {
        business: true,
        user: true,
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

    if (!membership) {
      throw new ForbiddenException(
        'Access denied: You do not have an active membership for the requested tenant organization.',
      );
    }

    const activeTenant: AuthTenant = {
      id: membership.tenantId,
      name: membership.business.name,
      slug: membership.business.slug,
      role: membership.role.code,
      roleId: membership.roleId,
      status: membership.status,
      isPrimaryBranchId: membership.defaultBranchId,
    };

    const permissions: string[] = membership.role.permissions.map(
      (rp) => rp.permission.code,
    );

    const accessPayload: UserTokenPayload = {
      sub: membership.userId,
      email: membership.user.email,
      activeTenantId: membership.tenantId,
      role: membership.role.code,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(
        { sub: membership.userId, email: membership.user.email },
        {
          secret: this.jwtRefreshSecret,
          expiresIn: '7d',
        },
      ),
    ]);

    await this.recordAuditLog({
      tenantId: membership.tenantId,
      userId: membership.userId,
      action: 'TENANT_SWITCH',
      entity: 'AUTH',
      entityId: membership.userId,
      ipAddress,
      userAgent,
      newValues: {
        targetTenantId: membership.tenantId,
        tenantSlug: membership.business.slug,
        role: membership.role.code,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        id: membership.user.id,
        email: membership.user.email,
        fullName: membership.user.fullName,
        phone: membership.user.phone,
        isActive: membership.user.isActive,
      },
      activeTenant,
      permissions,
    };
  }

  /**
   * Helper method to write an entry to AuditLog safely.
   */
  private async recordAuditLog(params: {
    tenantId: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    ipAddress?: string;
    userAgent?: string;
    oldValues?: Prisma.InputJsonValue;
    newValues?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          oldValues: params.oldValues ?? undefined,
          newValues: params.newValues ?? undefined,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit log [${params.action}] for tenant ${params.tenantId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
