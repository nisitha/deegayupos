import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthTenant, AuthUser } from '@pixelcraft/types';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../src/common/decorators/permissions.decorator';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { BusinessService } from '../src/modules/business/business.service';
import { BusinessController } from '../src/modules/business/business.controller';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Phase 06: Business Dashboard, Navigation & Branch Scoping Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';

  const BRANCH_ALPHA_MAIN_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
  const BRANCH_ALPHA_OUTLET_ID = 'aaaaaaaa-2222-2222-2222-222222222222';
  const BRANCH_BETA_ID = 'bbbbbbbb-1111-1111-1111-111111111111';

  const USER_ALPHA_OWNER: AuthUser = {
    id: 'uuuuuuuu-1111-1111-1111-111111111111',
    email: 'owner@alpha.com',
    fullName: 'Alpha Owner',
    isActive: true,
    role: 'OWNER',
  };

  const USER_ALPHA_CASHIER: AuthUser = {
    id: 'uuuuuuuu-2222-2222-2222-222222222222',
    email: 'cashier@alpha.com',
    fullName: 'Alpha Cashier',
    isActive: true,
    role: 'CASHIER',
  };

  const TENANT_ALPHA: AuthTenant = {
    id: TENANT_ALPHA_ID,
    name: 'Alpha Retail Store',
    slug: 'alpha-retail',
    role: 'OWNER',
    roleId: 'role-owner-id',
    status: 'ACTIVE',
    isPrimaryBranchId: BRANCH_ALPHA_MAIN_ID,
  };

  let mockPrisma: any;
  let dashboardService: DashboardService;
  let dashboardController: DashboardController;
  let businessService: BusinessService;
  let businessController: BusinessController;
  let reflector: Reflector;
  let permissionsGuard: PermissionsGuard;

  // In-memory data store for testing
  let inMemoryBranches: any[] = [];
  let inMemoryRegisters: any[] = [];
  let inMemoryMemberships: any[] = [];
  let inMemorySettings: any = null;
  let inMemoryBusiness: any = null;
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryBranches = [
      {
        id: BRANCH_ALPHA_MAIN_ID,
        tenantId: TENANT_ALPHA_ID,
        code: 'MAIN-01',
        name: 'Alpha Main Flagship',
        isPrimary: true,
        isActive: true,
        deletedAt: null,
      },
      {
        id: BRANCH_ALPHA_OUTLET_ID,
        tenantId: TENANT_ALPHA_ID,
        code: 'OUTLET-02',
        name: 'Alpha Mall Kiosk',
        isPrimary: false,
        isActive: true,
        deletedAt: null,
      },
      {
        id: BRANCH_BETA_ID,
        tenantId: TENANT_BETA_ID,
        code: 'BETA-01',
        name: 'Beta Store',
        isPrimary: true,
        isActive: true,
        deletedAt: null,
      },
    ];

    inMemoryRegisters = [
      {
        id: 'reg-01',
        tenantId: TENANT_ALPHA_ID,
        branchId: BRANCH_ALPHA_MAIN_ID,
        name: 'Main POS 1',
        code: 'REG-01',
        isActive: true,
        deletedAt: null,
      },
      {
        id: 'reg-02',
        tenantId: TENANT_ALPHA_ID,
        branchId: BRANCH_ALPHA_MAIN_ID,
        name: 'Main POS 2',
        code: 'REG-02',
        isActive: true,
        deletedAt: null,
      },
      {
        id: 'reg-03',
        tenantId: TENANT_ALPHA_ID,
        branchId: BRANCH_ALPHA_OUTLET_ID,
        name: 'Kiosk POS 1',
        code: 'REG-03',
        isActive: true,
        deletedAt: null,
      },
    ];

    inMemoryMemberships = [
      {
        tenantId: TENANT_ALPHA_ID,
        userId: USER_ALPHA_OWNER.id,
        role: { code: 'OWNER', name: 'Owner' },
        defaultBranchId: null,
      },
      {
        tenantId: TENANT_ALPHA_ID,
        userId: USER_ALPHA_CASHIER.id,
        role: { code: 'CASHIER', name: 'Cashier' },
        defaultBranchId: BRANCH_ALPHA_MAIN_ID,
      },
    ];

    inMemorySettings = {
      id: 'settings-alpha-id',
      tenantId: TENANT_ALPHA_ID,
      invoicePrefix: 'INV-',
      taxNumber: 'VAT-12345',
      taxRate: '0.00',
      isTaxInclusive: false,
      enableLoyalty: true,
      receiptFooter: 'Thank you for visiting!',
      negativeStockPolicy: 'DISALLOW',
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
    };

    inMemoryBusiness = {
      id: TENANT_ALPHA_ID,
      name: 'Alpha Retail Store',
      slug: 'alpha-retail',
      legalName: 'Alpha Retail LK Ltd',
      businessType: 'RETAIL',
      status: 'ACTIVE',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      deletedAt: null,
      settings: inMemorySettings,
      branches: inMemoryBranches.filter((b) => b.tenantId === TENANT_ALPHA_ID),
    };

    inMemoryAuditLogs = [];

    mockPrisma = {
      branch: {
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            inMemoryBranches.find(
              (b) =>
                b.id === where.id &&
                b.tenantId === where.tenantId &&
                (!where.deletedAt ? b.deletedAt === null : true),
            ) || null
          );
        }),
      },
      businessMembership: {
        findUnique: vi.fn(async ({ where }: any) => {
          return (
            inMemoryMemberships.find(
              (m) =>
                m.tenantId === where.tenantId_userId.tenantId &&
                m.userId === where.tenantId_userId.userId,
            ) || null
          );
        }),
      },
      register: {
        count: vi.fn(async ({ where }: any) => {
          return inMemoryRegisters.filter(
            (r) =>
              r.tenantId === where.tenantId &&
              (where.branchId ? r.branchId === where.branchId : true) &&
              (where.isActive !== undefined ? r.isActive === where.isActive : true) &&
              r.deletedAt === null,
          ).length;
        }),
      },
      auditLog: {
        findMany: vi.fn(async () => inMemoryAuditLogs),
        create: vi.fn(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
          inMemoryAuditLogs.push(log);
          return log;
        }),
      },
      business: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.id === TENANT_ALPHA_ID) {
            return {
              ...inMemoryBusiness,
              settings: inMemorySettings,
              branches: inMemoryBranches.filter((b) => b.tenantId === TENANT_ALPHA_ID),
            };
          }
          return null;
        }),
      },
      businessSetting: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.tenantId === TENANT_ALPHA_ID) {
            return inMemorySettings;
          }
          return null;
        }),
        upsert: vi.fn(async ({ update, create }: any) => {
          inMemorySettings = {
            ...(inMemorySettings || create),
            ...update,
            updatedAt: new Date(),
          };
          return inMemorySettings;
        }),
      },
    } as unknown as PrismaService;

    dashboardService = new DashboardService(mockPrisma);
    dashboardController = new DashboardController(dashboardService);

    businessService = new BusinessService(mockPrisma);
    businessController = new BusinessController(businessService);

    reflector = new Reflector();
    permissionsGuard = new PermissionsGuard(reflector);
  });

  describe('1. Global vs Branch-Scoped Dashboard Metrics', () => {
    it('Test 1: Authenticated Tenant Alpha owner retrieves global dashboard metrics', async () => {
      const metrics = await dashboardController.getMetrics(
        TENANT_ALPHA,
        USER_ALPHA_OWNER,
        {},
      );

      expect(metrics).toBeDefined();
      expect(metrics.todaySales).toBe(0.0);
      expect(metrics.yesterdaySales).toBe(0.0);
      expect(metrics.salesGrowthPercent).toBe(0.0);
      expect(metrics.transactionCount).toBe(0);
      expect(metrics.avgTransactionValue).toBe(0.0);
      expect(metrics.lowStockCount).toBe(0);
      // Global metrics across all branches in Tenant Alpha should count all 3 registers
      expect(metrics.activeRegistersCount).toBe(3);
    });

    it('Test 2: Filtering metrics by valid branchId returns branch-scoped figures', async () => {
      // Branch Alpha Main has 2 active registers
      const mainMetrics = await dashboardController.getMetrics(
        TENANT_ALPHA,
        USER_ALPHA_OWNER,
        { branchId: BRANCH_ALPHA_MAIN_ID },
      );
      expect(mainMetrics.activeRegistersCount).toBe(2);

      // Branch Alpha Kiosk has 1 active register
      const kioskMetrics = await dashboardController.getMetrics(
        TENANT_ALPHA,
        USER_ALPHA_OWNER,
        { branchId: BRANCH_ALPHA_OUTLET_ID },
      );
      expect(kioskMetrics.activeRegistersCount).toBe(1);
    });

    it('Test 3: Attempting to query dashboard metrics with a branchId belonging to another tenant fails with 403/404', async () => {
      // BRANCH_BETA_ID belongs to TENANT_BETA_ID, not TENANT_ALPHA_ID
      await expect(
        dashboardController.getMetrics(TENANT_ALPHA, USER_ALPHA_OWNER, {
          branchId: BRANCH_BETA_ID,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        dashboardController.getMetrics(TENANT_ALPHA, USER_ALPHA_OWNER, {
          branchId: BRANCH_BETA_ID,
        }),
      ).rejects.toThrow(
        'Access denied: Branch does not belong to active organization or does not exist.',
      );
    });
  });

  describe('2. Business Profile & Operational Settings', () => {
    it('Test 4: Business settings endpoint updates invoice prefix and reflects immediately in tenant profile', async () => {
      const req = {
        headers: { 'user-agent': 'Vitest-Test-Agent' },
      } as any;

      // Update settings
      const updatedSettings = await businessController.updateSettings(
        TENANT_ALPHA,
        USER_ALPHA_OWNER,
        {
          invoicePrefix: 'ALPHA-',
          taxRate: 12.5,
          receiptFooter: 'Visit us online at alpha.com',
          negativeStockPolicy: 'WARN',
        },
        '127.0.0.1',
        req,
      );

      expect(updatedSettings.invoicePrefix).toBe('ALPHA-');
      expect(updatedSettings.taxRate).toBe(12.5);
      expect(updatedSettings.negativeStockPolicy).toBe('WARN');

      // Verify immediate reflection in profile
      const profile = await businessController.getProfile(TENANT_ALPHA);
      expect(profile).toBeDefined();
      expect(profile.name).toBe('Alpha Retail Store');
      expect(profile.settings?.invoicePrefix).toBe('ALPHA-');
      expect(profile.settings?.taxRate).toBe(12.5);
      expect(profile.settings?.negativeStockPolicy).toBe('WARN');
      expect(profile.primaryBranch?.code).toBe('MAIN-01');
      expect(profile.branches.length).toBe(2);
    });

    it('Test 5: User lacking settings:manage permission receives 403 Forbidden when attempting to update business settings', () => {
      // Mock execution context where user only has pos:access and pos:checkout permissions
      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            permissions: ['pos:access', 'pos:checkout'],
            user: USER_ALPHA_CASHIER,
            tenant: TENANT_ALPHA,
          }),
        }),
      } as unknown as ExecutionContext;

      // Mock reflector returning required permissions for @RequirePermissions('settings:manage')
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) {
          return ['settings:manage'];
        }
        return undefined;
      });

      expect(() => permissionsGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );

      expect(() => permissionsGuard.canActivate(context)).toThrow(
        'Forbidden: Insufficient permissions. Missing required permission(s): settings:manage',
      );
    });
  });
});

