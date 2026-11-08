import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pixelcraft/database';
import type {
  CreatePlanDto,
  PaginatedResult,
  PlatformSettingDto,
  PlatformSettingItemDto,
  SaaSPlanDto,
  SuperAdminOverviewMetrics,
  SystemAuditLogDto,
  TenantDetail,
  TenantStatus,
  TenantSummary,
  UpdatePlanDto,
  UpdateTenantStatusDto,
} from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';
import {
  AuditLogQueryDto,
  TenantListQueryDto,
} from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate platform-wide telemetry KPIs across all tenant organizations.
   */
  async getOverviewMetrics(): Promise<SuperAdminOverviewMetrics> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const [
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        totalUsers,
        totalBranches,
        totalRegisters,
        activeSubscriptions,
      ] = await Promise.all([
        tx.business.count({ where: { deletedAt: null } }),
        tx.business.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        tx.business.count({ where: { status: 'TRIAL', deletedAt: null } }),
        tx.business.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
        tx.user.count({ where: { deletedAt: null } }),
        tx.branch.count({ where: { deletedAt: null } }),
        tx.register.count({ where: { deletedAt: null } }),
        tx.subscription.findMany({
          where: { status: 'ACTIVE' },
          include: { plan: true },
        }),
      ]);

      const estimatedMrr = activeSubscriptions.reduce((acc, sub) => {
        return acc + Number(sub.plan.monthlyPrice);
      }, 0);

      return {
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        totalUsers,
        totalBranches,
        totalRegisters,
        estimatedMrr: Math.round(estimatedMrr * 100) / 100,
      };
    });
  }

  /**
   * List paginated tenant organizations with status filtering and text search.
   */
  async getTenants(
    query: TenantListQueryDto,
  ): Promise<PaginatedResult<TenantSummary>> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      const where: Prisma.BusinessWhereInput = {
        deletedAt: null,
      };

      if (query.status) {
        where.status = query.status as Prisma.EnumBusinessStatusFilter['equals'];
      }

      if (query.search) {
        const search = query.search.trim();
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [total, businesses] = await Promise.all([
        tx.business.count({ where }),
        tx.business.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                memberships: true,
                branches: true,
                registers: true,
              },
            },
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true },
              take: 1,
            },
          },
        }),
      ]);

      const items: TenantSummary[] = businesses.map((b) => {
        const activeSub = b.subscriptions[0];
        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          legalName: b.legalName,
          businessType: b.businessType,
          status: b.status as TenantStatus,
          currency: b.currency,
          timezone: b.timezone,
          createdAt: b.createdAt.toISOString(),
          userCount: b._count.memberships,
          branchCount: b._count.branches,
          registerCount: b._count.registers,
          plan: activeSub
            ? {
                code: activeSub.plan.code,
                name: activeSub.plan.name,
                monthlyPrice: Number(activeSub.plan.monthlyPrice),
              }
            : null,
        };
      });

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    });
  }

  /**
   * Fetch full deep tenant profile with branches, registers, warehouses, and subscriptions.
   */
  async getTenantDetail(id: string): Promise<TenantDetail> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id },
        include: {
          settings: true,
          branches: {
            where: { deletedAt: null },
            include: {
              _count: { select: { registers: true } },
            },
          },
          registers: {
            where: { deletedAt: null },
          },
          warehouses: {
            where: { deletedAt: null },
          },
          memberships: {
            where: { deletedAt: null },
            include: {
              user: true,
              role: true,
            },
          },
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!business || business.deletedAt) {
        throw new NotFoundException(`Tenant organization with ID '${id}' not found.`);
      }

      const activeSub = business.subscriptions[0];

      return {
        id: business.id,
        name: business.name,
        slug: business.slug,
        legalName: business.legalName,
        businessType: business.businessType,
        status: business.status as TenantStatus,
        currency: business.currency,
        timezone: business.timezone,
        createdAt: business.createdAt.toISOString(),
        updatedAt: business.updatedAt.toISOString(),
        settings: business.settings
          ? {
              invoicePrefix: business.settings.invoicePrefix,
              taxNumber: business.settings.taxNumber,
              taxRate: Number(business.settings.taxRate),
              isTaxInclusive: business.settings.isTaxInclusive,
            }
          : null,
        branches: business.branches.map((br) => ({
          id: br.id,
          code: br.code,
          name: br.name,
          address: br.address,
          phone: br.phone,
          isPrimary: br.isPrimary,
          isActive: br.isActive,
          registerCount: br._count.registers,
        })),
        registers: business.registers.map((reg) => ({
          id: reg.id,
          branchId: reg.branchId,
          code: reg.code,
          name: reg.name,
          isActive: reg.isActive,
        })),
        warehouses: business.warehouses.map((wh) => ({
          id: wh.id,
          branchId: wh.branchId,
          name: wh.name,
          isDefault: wh.isDefault,
          isActive: wh.isActive,
        })),
        memberships: business.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          email: m.user.email,
          fullName: m.user.fullName,
          role: m.role.code,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
        })),
        subscription: activeSub
          ? {
              id: activeSub.id,
              status: activeSub.status,
              billingCycle: activeSub.billingCycle,
              startsAt: activeSub.startsAt.toISOString(),
              endsAt: activeSub.endsAt ? activeSub.endsAt.toISOString() : null,
              plan: {
                code: activeSub.plan.code,
                name: activeSub.plan.name,
                monthlyPrice: Number(activeSub.plan.monthlyPrice),
                annualPrice: Number(activeSub.plan.annualPrice),
                maxProducts: activeSub.plan.maxProducts,
                maxBranches: activeSub.plan.maxBranches,
                maxUsers: activeSub.plan.maxUsers,
                maxRegisters: activeSub.plan.maxRegisters,
              },
            }
          : null,
        recentAuditLogs: business.auditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          userId: log.userId,
          createdAt: log.createdAt.toISOString(),
          ipAddress: log.ipAddress,
        })),
      };
    });
  }

  /**
   * Update tenant organization status (e.g. SUSPENDED, ACTIVE) and record immutable audit trail.
   */
  async updateTenantStatus(
    id: string,
    dto: UpdateTenantStatusDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TenantSummary> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.business.findUnique({
        where: { id },
        include: {
          _count: {
            select: { memberships: true, branches: true, registers: true },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: true },
            take: 1,
          },
        },
      });

      if (!existing || existing.deletedAt) {
        throw new NotFoundException(`Tenant organization with ID '${id}' not found.`);
      }

      const oldStatus = existing.status;

      const updated = await tx.business.update({
        where: { id },
        data: {
          status: dto.status as Prisma.EnumBusinessStatusFilter['equals'],
        },
        include: {
          _count: {
            select: { memberships: true, branches: true, registers: true },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: true },
            take: 1,
          },
        },
      });

      // Write immutable audit log
      await tx.auditLog.create({
        data: {
          tenantId: id,
          userId: adminUserId || null,
          action: 'TENANT_STATUS_UPDATED',
          entity: 'BUSINESS',
          entityId: id,
          oldValues: { status: oldStatus },
          newValues: {
            status: dto.status,
            reason: dto.reason || 'Status altered by Platform Super Admin',
          },
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      const activeSub = updated.subscriptions[0];

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        legalName: updated.legalName,
        businessType: updated.businessType,
        status: updated.status as TenantStatus,
        currency: updated.currency,
        timezone: updated.timezone,
        createdAt: updated.createdAt.toISOString(),
        userCount: updated._count.memberships,
        branchCount: updated._count.branches,
        registerCount: updated._count.registers,
        plan: activeSub
          ? {
              code: activeSub.plan.code,
              name: activeSub.plan.name,
              monthlyPrice: Number(activeSub.plan.monthlyPrice),
            }
          : null,
      };
    });
  }

  /**
   * Retrieve all SaaS subscription plans with subscriber counts.
   */
  async getPlans(): Promise<SaaSPlanDto[]> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const plans = await tx.plan.findMany({
        orderBy: { monthlyPrice: 'asc' },
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
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
        isActive: p.isActive,
        subscriberCount: p._count.subscriptions,
      }));
    });
  }

  /**
   * Create a new SaaS subscription plan.
   */
  async createPlan(
    dto: CreatePlanDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SaaSPlanDto> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.plan.findUnique({
        where: { code: dto.code.toUpperCase() },
      });

      if (existing) {
        throw new BadRequestException(
          `SaaS Plan with code '${dto.code}' already exists.`,
        );
      }

      const created = await tx.plan.create({
        data: {
          code: dto.code.toUpperCase(),
          name: dto.name,
          description: dto.description || null,
          monthlyPrice: dto.monthlyPrice,
          annualPrice: dto.annualPrice,
          maxProducts: dto.maxProducts,
          maxBranches: dto.maxBranches,
          maxUsers: dto.maxUsers,
          maxRegisters: dto.maxRegisters,
          enabledModules: dto.enabledModules,
          isActive: dto.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: null,
          userId: adminUserId || null,
          action: 'PLAN_CREATED',
          entity: 'PLAN',
          entityId: created.id,
          newValues: { code: created.code, monthlyPrice: dto.monthlyPrice },
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return {
        id: created.id,
        code: created.code,
        name: created.name,
        description: created.description,
        monthlyPrice: Number(created.monthlyPrice),
        annualPrice: Number(created.annualPrice),
        maxProducts: created.maxProducts,
        maxBranches: created.maxBranches,
        maxUsers: created.maxUsers,
        maxRegisters: created.maxRegisters,
        enabledModules: (created.enabledModules as string[]) || [],
        isActive: created.isActive,
        subscriberCount: 0,
      };
    });
  }

  /**
   * Modify an existing SaaS subscription plan.
   */
  async updatePlan(
    id: string,
    dto: UpdatePlanDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SaaSPlanDto> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.plan.findUnique({
        where: { id },
        include: {
          _count: {
            select: { subscriptions: { where: { status: 'ACTIVE' } } },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Plan with ID '${id}' not found.`);
      }

      const updated = await tx.plan.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          description: dto.description !== undefined ? dto.description : undefined,
          monthlyPrice: dto.monthlyPrice ?? undefined,
          annualPrice: dto.annualPrice ?? undefined,
          maxProducts: dto.maxProducts ?? undefined,
          maxBranches: dto.maxBranches ?? undefined,
          maxUsers: dto.maxUsers ?? undefined,
          maxRegisters: dto.maxRegisters ?? undefined,
          enabledModules: dto.enabledModules ?? undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
        include: {
          _count: {
            select: { subscriptions: { where: { status: 'ACTIVE' } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: null,
          userId: adminUserId || null,
          action: 'PLAN_UPDATED',
          entity: 'PLAN',
          entityId: id,
          oldValues: {
            name: existing.name,
            monthlyPrice: Number(existing.monthlyPrice),
          },
          newValues: dto as Prisma.InputJsonValue,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        description: updated.description,
        monthlyPrice: Number(updated.monthlyPrice),
        annualPrice: Number(updated.annualPrice),
        maxProducts: updated.maxProducts,
        maxBranches: updated.maxBranches,
        maxUsers: updated.maxUsers,
        maxRegisters: updated.maxRegisters,
        enabledModules: (updated.enabledModules as string[]) || [],
        isActive: updated.isActive,
        subscriberCount: updated._count.subscriptions,
      };
    });
  }

  /**
   * Paginated audit logs across the entire platform.
   */
  async getAuditLogs(
    query: AuditLogQueryDto,
  ): Promise<PaginatedResult<SystemAuditLogDto>> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;

      const where: Prisma.AuditLogWhereInput = {};

      if (query.tenantId) {
        where.tenantId = query.tenantId;
      }

      if (query.action) {
        where.action = query.action;
      }

      if (query.entity) {
        where.entity = query.entity;
      }

      const [total, logs] = await Promise.all([
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            business: {
              select: { name: true, slug: true },
            },
            user: {
              select: { email: true },
            },
          },
        }),
      ]);

      const items: SystemAuditLogDto[] = logs.map((log) => ({
        id: log.id,
        tenantId: log.tenantId,
        tenantName: log.business?.name ?? null,
        tenantSlug: log.business?.slug ?? null,
        userId: log.userId,
        userEmail: log.user?.email ?? null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      }));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    });
  }

  /**
   * System-wide platform settings.
   */
  async getSettings(): Promise<PlatformSettingItemDto[]> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const settings = await tx.platformSetting.findMany({
        orderBy: { key: 'asc' },
      });

      return settings.map((s) => ({
        id: s.id,
        key: s.key,
        value: s.value,
        description: s.description,
        updatedAt: s.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Upsert a platform setting key-value pair.
   */
  async updateSetting(
    dto: PlatformSettingDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSettingItemDto> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const updated = await tx.platformSetting.upsert({
        where: { key: dto.key },
        update: {
          value: dto.value as Prisma.InputJsonValue,
          description: dto.description ?? undefined,
        },
        create: {
          key: dto.key,
          value: dto.value as Prisma.InputJsonValue,
          description: dto.description || null,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: null,
          userId: adminUserId || null,
          action: 'PLATFORM_SETTING_UPDATED',
          entity: 'PLATFORM_SETTING',
          entityId: updated.id,
          newValues: { key: dto.key, value: dto.value as Prisma.InputJsonValue },
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      return {
        id: updated.id,
        key: updated.key,
        value: updated.value,
        description: updated.description,
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }
}
