import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthTenant,
  CheckSlugResult,
  OnboardingPayload,
  OnboardingResponseData,
  PublicPlanDto,
  UserTokenPayload,
} from '@pixelcraft/types';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/database/prisma.service';

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'super-admin',
  'app',
  'system',
  'auth',
  'pixelcraft',
  'pos',
  'billing',
  'dashboard',
  'help',
  'support',
  'status',
]);

@Injectable()
export class OnboardingService {
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
   * List publicly available subscription plans for onboarding preview.
   */
  async getActivePlans(): Promise<PublicPlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });

    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      monthlyPrice: Number(p.monthlyPrice),
      annualPrice: Number(p.annualPrice),
      maxProducts: p.maxProducts,
      maxBranches: p.maxBranches,
      maxUsers: p.maxUsers,
      maxRegisters: p.maxRegisters,
      enabledModules: (p.enabledModules as string[]) || [],
      trialDays: 14,
    }));
  }

  /**
   * Inspect tenant organization slug availability.
   */
  async checkSlug(slug: string): Promise<CheckSlugResult> {
    const cleanSlug = slug.trim().toLowerCase();

    if (RESERVED_SLUGS.has(cleanSlug)) {
      return {
        slug: cleanSlug,
        available: false,
        reason: 'This slug is reserved for system platform use.',
      };
    }

    const existing = await this.prisma.business.findUnique({
      where: { slug: cleanSlug },
      select: { id: true },
    });

    if (existing) {
      return {
        slug: cleanSlug,
        available: false,
        reason: 'This organization slug is already registered.',
      };
    }

    return {
      slug: cleanSlug,
      available: true,
    };
  }

  /**
   * Executes atomic multi-tenant organization provisioning and returns authenticated session.
   */
  async register(
    dto: OnboardingPayload,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OnboardingResponseData> {
    const email = dto.email.trim().toLowerCase();
    const slug = dto.businessSlug.trim().toLowerCase();

    // 1. Validation checks
    if (RESERVED_SLUGS.has(slug)) {
      throw new BadRequestException(
        `The slug '${slug}' is reserved for platform infrastructure.`,
      );
    }

    const slugCheck = await this.checkSlug(slug);
    if (!slugCheck.available) {
      throw new ConflictException(
        slugCheck.reason || 'Organization slug is already in use.',
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode.toUpperCase() },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException(
        `Subscription plan '${dto.planCode}' was not found or is currently inactive.`,
      );
    }

    // 2. Hash password securely
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 Days

    // 3. Execute strict atomic database transaction
    const provisioningResult = await this.prisma.$transaction(async (tx) => {
      // a. Find or create user account
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: dto.fullName,
            phone: dto.phone || null,
            isActive: true,
          },
        });
      }

      // b. Create Tenant Business Organization
      const business = await tx.business.create({
        data: {
          name: dto.businessName,
          slug,
          legalName: dto.legalName || null,
          businessType: dto.businessType || 'RETAIL',
          status: 'TRIAL',
          currency: dto.currency || 'LKR',
          timezone: dto.timezone || 'Asia/Colombo',
        },
      });

      // c. Create Business Settings
      const prefix = `${slug.toUpperCase().slice(0, 5).replace(/[^A-Z0-9]/g, '')}-`;
      await tx.businessSetting.create({
        data: {
          tenantId: business.id,
          invoicePrefix: prefix || 'INV-',
          taxRate: 0.0,
          isTaxInclusive: false,
        },
      });

      // d. Create Primary Retail Branch
      const branch = await tx.branch.create({
        data: {
          tenantId: business.id,
          code: 'MAIN-01',
          name: dto.branchName || 'Main Branch',
          address: dto.branchAddress || null,
          phone: dto.branchPhone || null,
          isPrimary: true,
          isActive: true,
        },
      });

      // e. Create Default Warehouse
      await tx.warehouse.create({
        data: {
          tenantId: business.id,
          branchId: branch.id,
          name: dto.warehouseName || 'Central Warehouse',
          isDefault: true,
          isActive: true,
        },
      });

      // f. Create Default Cash Register (POS Counter)
      await tx.register.create({
        data: {
          tenantId: business.id,
          branchId: branch.id,
          code: 'REG-01',
          name: dto.registerName || 'POS Counter 1',
          isActive: true,
        },
      });

      // g. Create Tenant-scoped OWNER Role
      const roleOwner = await tx.role.create({
        data: {
          tenantId: business.id,
          code: 'OWNER',
          name: 'Business Owner',
          isSystem: true,
        },
      });

      // h. Assign All System Permissions to Owner Role
      const allPermissions = await tx.permission.findMany();
      if (allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((perm) => ({
            roleId: roleOwner.id,
            permissionId: perm.id,
          })),
        });
      }

      // i. Create Business Membership linking User to Business with OWNER Role
      await tx.businessMembership.create({
        data: {
          tenantId: business.id,
          userId: user.id,
          roleId: roleOwner.id,
          defaultBranchId: branch.id,
          status: 'ACTIVE',
        },
      });

      // j. Create 14-Day Free Trial Subscription
      await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          startsAt: now,
          trialEndsAt,
        },
      });

      // k. Immutable Audit Log Entry
      await tx.auditLog.create({
        data: {
          tenantId: business.id,
          userId: user.id,
          action: 'BUSINESS_ONBOARDED',
          entity: 'BUSINESS',
          entityId: business.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          newValues: {
            businessName: business.name,
            slug: business.slug,
            planCode: plan.code,
            trialEndsAt: trialEndsAt.toISOString(),
          },
        },
      });

      return {
        user,
        business,
        branch,
        roleOwner,
        allPermissions,
      };
    });

    // 4. Generate signed JWT session tokens
    const accessPayload: UserTokenPayload = {
      sub: provisioningResult.user.id,
      email: provisioningResult.user.email,
      activeTenantId: provisioningResult.business.id,
      role: provisioningResult.roleOwner.code,
    };

    const refreshPayload = {
      sub: provisioningResult.user.id,
      email: provisioningResult.user.email,
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

    const activeTenant: AuthTenant = {
      id: provisioningResult.business.id,
      name: provisioningResult.business.name,
      slug: provisioningResult.business.slug,
      role: provisioningResult.roleOwner.code,
      roleId: provisioningResult.roleOwner.id,
      status: provisioningResult.business.status,
      isPrimaryBranchId: provisioningResult.branch.id,
    };

    const permissions = provisioningResult.allPermissions.map((p) => p.code);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        id: provisioningResult.user.id,
        email: provisioningResult.user.email,
        fullName: provisioningResult.user.fullName,
        phone: provisioningResult.user.phone,
        isActive: provisioningResult.user.isActive,
      },
      activeTenant,
      permissions,
      trialEndsAt: trialEndsAt.toISOString(),
    };
  }
}

