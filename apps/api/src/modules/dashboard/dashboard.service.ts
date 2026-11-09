import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type {
  AuthUser,
  DashboardActivityItem,
  DashboardChartsData,
  DashboardMetrics,
} from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforces strict branch scoping and validates user branch permissions.
   * - Rejects queries for branchIds belonging to other tenants (403 Forbidden).
   * - Restricts branch-scoped users strictly to their assigned branch.
   * - Allows Owners/Admins to query all branches or filter to a specific branch.
   */
  async validateBranchAccess(
    tenantId: string,
    user: AuthUser,
    requestedBranchId?: string,
  ): Promise<string | undefined> {
    // 1. If a specific branchId is requested, verify it exists within this tenant
    if (requestedBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: requestedBranchId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!branch) {
        throw new ForbiddenException(
          'Access denied: Branch does not belong to active organization or does not exist.',
        );
      }
    }

    // 2. Inspect user's membership and branch role constraints
    const membership = await this.prisma.businessMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
      include: {
        role: true,
      },
    });

    const isGlobalAdminOrOwner =
      membership?.role.code === 'OWNER' ||
      membership?.role.code === 'ADMIN' ||
      user.isSuperAdmin;

    // 3. If user is restricted to a branch (not owner/admin and defaultBranchId is set)
    if (!isGlobalAdminOrOwner && membership?.defaultBranchId) {
      const userAssignedBranch = membership.defaultBranchId;

      if (requestedBranchId && requestedBranchId !== userAssignedBranch) {
        throw new ForbiddenException(
          'Access denied: You are restricted to your assigned branch.',
        );
      }

      // Implicitly scope to user's assigned branch if none provided
      return userAssignedBranch;
    }

    return requestedBranchId;
  }

  /**
   * Aggregates real-time KPI metrics for the tenant or branch.
   * Resilient zero-state fallback ensures no arithmetic/null errors when no sales exist.
   */
  async getMetrics(
    tenantId: string,
    user: AuthUser,
    requestedBranchId?: string,
  ): Promise<DashboardMetrics> {
    const effectiveBranchId = await this.validateBranchAccess(
      tenantId,
      user,
      requestedBranchId,
    );

    // Count active registers within the resolved branch scope
    const activeRegistersCount = await this.prisma.register.count({
      where: {
        tenantId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        isActive: true,
        deletedAt: null,
      },
    });

    // Zero-state resilient sales and inventory metrics
    // When Milestone 2 (Sales & Inventory) is introduced, these query the live transactional tables
    return {
      todaySales: 0.0,
      yesterdaySales: 0.0,
      salesGrowthPercent: 0.0,
      transactionCount: 0,
      avgTransactionValue: 0.0,
      lowStockCount: 0,
      activeRegistersCount,
    };
  }

  /**
   * Generates chart timeline and payment distribution analytics.
   */
  async getCharts(
    tenantId: string,
    user: AuthUser,
    days = 7,
    requestedBranchId?: string,
  ): Promise<DashboardChartsData> {
    await this.validateBranchAccess(tenantId, user, requestedBranchId);

    const safeDays = Math.min(Math.max(days, 1), 90);
    const timeline = [];

    const now = new Date();
    for (let i = safeDays - 1; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const dateStr = targetDate.toISOString().split('T')[0] || '';

      timeline.push({
        date: dateStr,
        revenue: 0.0,
        orders: 0,
      });
    }

    const paymentMix = [
      { method: 'CASH', total: 0.0, count: 0 },
      { method: 'CARD', total: 0.0, count: 0 },
      { method: 'QR_CODE', total: 0.0, count: 0 },
      { method: 'CREDIT', total: 0.0, count: 0 },
    ];

    return {
      timeline,
      paymentMix,
    };
  }

  /**
   * Fetches chronological business audit events and live activity feed.
   */
  async getActivity(
    tenantId: string,
    user: AuthUser,
    limit = 10,
    requestedBranchId?: string,
  ): Promise<DashboardActivityItem[]> {
    await this.validateBranchAccess(tenantId, user, requestedBranchId);

    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeLimit,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      description: log.action.replace(/_/g, ' ').toLowerCase(),
      createdAt: log.createdAt.toISOString(),
      user: log.user
        ? {
            fullName: log.user.fullName,
            email: log.user.email,
          }
        : null,
      metadata: (log.newValues as Record<string, unknown> | null) || null,
    }));
  }
}
