import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser, TenantStatus } from '@pixelcraft/types';
import { SuperAdminGuard } from '../src/common/guards/super-admin.guard';
import { TenantContextGuard } from '../src/common/guards/tenant-context.guard';
import { SuperAdminService } from '../src/modules/super-admin/super-admin.service';
import { SuperAdminController } from '../src/modules/super-admin/super-admin.controller';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Phase 04: Super Admin Platform Engine Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';
  const SUPER_ADMIN_ID = '99999999-9999-9999-9999-999999999999';
  const USER_ALPHA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const USER_BETA_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const reflector = new Reflector();

  function createMockExecutionContext(
    req: Record<string, unknown>,
    handler?: unknown,
    targetClass?: unknown,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => targetClass || class {},
      getArgs: () => [],
      getArgByIndex: () => ({}),
      switchToRpc: () => ({}) as unknown,
      switchToWs: () => ({}) as unknown,
      getType: () => 'http',
    } as unknown as ExecutionContext;
  }

  describe('1. Privileged Separation of Concerns (SuperAdminGuard)', () => {
    it('Test 1: Tenant Alpha owner attempting to query /api/v1/super-admin/overview is rejected with 403 Forbidden', () => {
      const superAdminGuard = new SuperAdminGuard();

      const tenantOwnerRequest = {
        user: {
          id: USER_ALPHA_ID,
          email: 'owner.alpha@pixelcraftlk.com',
          fullName: 'Kasun Perera',
          isActive: true,
          isSuperAdmin: false,
          role: 'OWNER',
        } as AuthUser,
      };

      const context = createMockExecutionContext(tenantOwnerRequest);

      expect(() => superAdminGuard.canActivate(context)).toThrow(
        new ForbiddenException('Access denied: Requires platform Super Admin privileges.'),
      );
    });

    it('should reject unauthenticated caller with 401 Unauthorized', () => {
      const superAdminGuard = new SuperAdminGuard();
      const unauthRequest = { user: undefined };
      const context = createMockExecutionContext(unauthRequest);

      expect(() => superAdminGuard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    });

    it('Test 2: Platform Super Admin successfully passes guard and retrieves system overview metrics', async () => {
      const superAdminGuard = new SuperAdminGuard();

      const adminUser: AuthUser = {
        id: SUPER_ADMIN_ID,
        email: 'admin@pixelcraftlk.com',
        fullName: 'PixelCraft Super Admin',
        isActive: true,
        isSuperAdmin: true,
        role: 'SUPER_ADMIN',
      };

      const superAdminRequest = { user: adminUser };
      const context = createMockExecutionContext(superAdminRequest);

      // Verify guard passes
      expect(superAdminGuard.canActivate(context)).toBe(true);

      // Mock database state for overview metrics
      const mockPrisma = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb) => {
          const fakeTx = {
            business: {
              count: vi.fn().mockImplementation(async ({ where }) => {
                if (where?.status === 'ACTIVE') return 12;
                if (where?.status === 'TRIAL') return 3;
                if (where?.status === 'SUSPENDED') return 1;
                return 16; // total
              }),
            },
            user: { count: vi.fn().mockResolvedValue(48) },
            branch: { count: vi.fn().mockResolvedValue(22) },
            register: { count: vi.fn().mockResolvedValue(30) },
            subscription: {
              findMany: vi.fn().mockResolvedValue([
                { plan: { monthlyPrice: '79.00' } },
                { plan: { monthlyPrice: '199.00' } },
                { plan: { monthlyPrice: '29.00' } },
              ]),
            },
          };
          return cb(fakeTx);
        }),
      } as unknown as PrismaService;

      const superAdminService = new SuperAdminService(mockPrisma);
      const metrics = await superAdminService.getOverviewMetrics();

      expect(metrics).toEqual({
        totalTenants: 16,
        activeTenants: 12,
        trialTenants: 3,
        suspendedTenants: 1,
        totalUsers: 48,
        totalBranches: 22,
        totalRegisters: 30,
        estimatedMrr: 307.0, // 79 + 199 + 29
      });
    });
  });

  describe('2. Multi-Tenant Administration & Search (SuperAdminService)', () => {
    it('Test 3: Super Admin can list all tenants (both Alpha and Beta) and filter by status', async () => {
      const mockBusinesses = [
        {
          id: TENANT_ALPHA_ID,
          name: 'PixelCraft LK Flagship Store',
          slug: 'alpha',
          legalName: 'PixelCraft LK Retail Pvt Ltd',
          businessType: 'RETAIL',
          status: 'ACTIVE',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          _count: { memberships: 4, branches: 2, registers: 3 },
          subscriptions: [
            { plan: { code: 'PROFESSIONAL', name: 'Professional Plan', monthlyPrice: '79.00' } },
          ],
        },
        {
          id: TENANT_BETA_ID,
          name: 'Colombo Bistro & Cafe',
          slug: 'beta',
          legalName: 'Colombo Bistro Cafe Ltd',
          businessType: 'RESTAURANT',
          status: 'SUSPENDED',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          createdAt: new Date('2026-02-01T00:00:00Z'),
          _count: { memberships: 2, branches: 1, registers: 1 },
          subscriptions: [
            { plan: { code: 'STARTER', name: 'Starter Plan', monthlyPrice: '29.00' } },
          ],
        },
      ];

      const mockPrisma = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb) => {
          const fakeTx = {
            business: {
              count: vi.fn().mockResolvedValue(mockBusinesses.length),
              findMany: vi.fn().mockResolvedValue(mockBusinesses),
            },
          };
          return cb(fakeTx);
        }),
      } as unknown as PrismaService;

      const service = new SuperAdminService(mockPrisma);

      // Query all tenants
      const result = await service.getTenants({ page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.items.length).toBe(2);
      expect(result.items[0]?.slug).toBe('alpha');
      expect(result.items[0]?.plan?.code).toBe('PROFESSIONAL');
      expect(result.items[1]?.slug).toBe('beta');
      expect(result.items[1]?.status).toBe('SUSPENDED');
    });
  });

  describe('3. Tenant Suspension & Enforcement Lifecycle', () => {
    let tenantBetaStatus: TenantStatus = 'ACTIVE';
    let auditLogRecords: unknown[] = [];

    const mockPrisma = {
      withSuperAdminContext: vi.fn().mockImplementation(async (cb) => {
        const fakeTx = {
          business: {
            findUnique: vi.fn().mockImplementation(async ({ where }) => {
              if (where.id === TENANT_BETA_ID) {
                return {
                  id: TENANT_BETA_ID,
                  name: 'Colombo Bistro & Cafe',
                  slug: 'beta',
                  status: tenantBetaStatus,
                  _count: { memberships: 2, branches: 1, registers: 1 },
                  subscriptions: [],
                };
              }
              return null;
            }),
            update: vi.fn().mockImplementation(async ({ where, data }) => {
              if (where.id === TENANT_BETA_ID) {
                tenantBetaStatus = data.status;
                return {
                  id: TENANT_BETA_ID,
                  name: 'Colombo Bistro & Cafe',
                  slug: 'beta',
                  status: tenantBetaStatus,
                  currency: 'LKR',
                  timezone: 'Asia/Colombo',
                  createdAt: new Date(),
                  _count: { memberships: 2, branches: 1, registers: 1 },
                  subscriptions: [],
                };
              }
              return null;
            }),
          },
          auditLog: {
            create: vi.fn().mockImplementation(async ({ data }) => {
              auditLogRecords.push(data);
              return { id: 'audit-log-new', ...data };
            }),
          },
        };
        return cb(fakeTx);
      }),
      businessMembership: {
        findMany: vi.fn().mockImplementation(async () => [
          {
            id: 'mem-beta-owner',
            tenantId: TENANT_BETA_ID,
            userId: USER_BETA_ID,
            status: 'ACTIVE',
            roleId: 'role-beta',
            defaultBranchId: 'branch-beta-1',
            business: {
              id: TENANT_BETA_ID,
              name: 'Colombo Bistro & Cafe',
              slug: 'beta',
              status: tenantBetaStatus,
              deletedAt: null,
            },
            role: {
              id: 'role-beta',
              code: 'OWNER',
              permissions: [{ permission: { code: 'pos:access' } }],
            },
          },
        ]),
      },
    } as unknown as PrismaService;

    const superAdminService = new SuperAdminService(mockPrisma);
    const tenantGuard = new TenantContextGuard(reflector, mockPrisma);

    it('Test 4: Super Admin suspends Tenant Beta -> verifies Tenant Beta owner subsequently fails TenantContextGuard with 403 Forbidden', async () => {
      // 1. Super Admin suspends Tenant Beta
      const updated = await superAdminService.updateTenantStatus(
        TENANT_BETA_ID,
        { status: 'SUSPENDED', reason: 'Delinquent billing invoice' },
        SUPER_ADMIN_ID,
        '127.0.0.1',
        'AdminConsole/1.0',
      );

      expect(updated.status).toBe('SUSPENDED');
      expect(tenantBetaStatus).toBe('SUSPENDED');

      // Verify audit log written
      expect(auditLogRecords.length).toBeGreaterThan(0);
      expect(auditLogRecords[0]).toMatchObject({
        tenantId: TENANT_BETA_ID,
        action: 'TENANT_STATUS_UPDATED',
        newValues: {
          status: 'SUSPENDED',
          reason: 'Delinquent billing invoice',
        },
      });

      // 2. Tenant Beta owner attempts to access tenant resources
      const tenantBetaRequest: Record<string, unknown> = {
        headers: { 'x-tenant-id': TENANT_BETA_ID },
        user: {
          id: USER_BETA_ID,
          email: 'owner.beta@pixelcraftlk.com',
          isActive: true,
        } as AuthUser,
      };

      const context = createMockExecutionContext(tenantBetaRequest);

      // Must be immediately rejected with 403 Forbidden
      await expect(tenantGuard.canActivate(context)).rejects.toThrow(
        new ForbiddenException(
          'Tenant account is suspended. Please contact PixelCraft support.',
        ),
      );
    });

    it('Test 5: Super Admin reactivates Tenant Beta -> verifies Tenant Beta owner can access tenant resources again', async () => {
      // 1. Super Admin reactivates Tenant Beta back to ACTIVE
      const updated = await superAdminService.updateTenantStatus(
        TENANT_BETA_ID,
        { status: 'ACTIVE', reason: 'Billing resolved' },
        SUPER_ADMIN_ID,
      );

      expect(updated.status).toBe('ACTIVE');
      expect(tenantBetaStatus).toBe('ACTIVE');

      // 2. Tenant Beta owner attempts to access tenant resources again
      const tenantBetaRequest: Record<string, unknown> = {
        headers: { 'x-tenant-id': TENANT_BETA_ID },
        user: {
          id: USER_BETA_ID,
          email: 'owner.beta@pixelcraftlk.com',
          isActive: true,
        } as AuthUser,
      };

      const context = createMockExecutionContext(tenantBetaRequest);

      // Now guard allows access successfully
      const allowed = await tenantGuard.canActivate(context);
      expect(allowed).toBe(true);
      expect(tenantBetaRequest.tenant).toMatchObject({
        id: TENANT_BETA_ID,
        status: 'ACTIVE',
      });
    });
  });

  describe('4. SaaS Subscription Plans & Global Platform Settings', () => {
    it('should create a new subscription plan tier with immutable audit logging', async () => {
      let createdPlanData: unknown = null;
      let recordedAudit: unknown = null;

      const mockPrisma = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb) => {
          const fakeTx = {
            plan: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdPlanData = data;
                return { id: 'plan-custom-1', ...data };
              }),
            },
            auditLog: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                recordedAudit = data;
                return { id: 'audit-plan-1', ...data };
              }),
            },
          };
          return cb(fakeTx);
        }),
      } as unknown as PrismaService;

      const service = new SuperAdminService(mockPrisma);

      const plan = await service.createPlan(
        {
          code: 'HYPERMARKET',
          name: 'Hypermarket Enterprise Tier',
          monthlyPrice: 399.0,
          annualPrice: 3990.0,
          maxProducts: 100000,
          maxBranches: 50,
          maxUsers: 200,
          maxRegisters: 100,
          enabledModules: ['pos', 'inventory', 'warehouse', 'loyalty', 'api'],
        },
        SUPER_ADMIN_ID,
        '10.10.10.1',
      );

      expect(plan.code).toBe('HYPERMARKET');
      expect(plan.monthlyPrice).toBe(399.0);
      expect(createdPlanData).toBeDefined();
      expect(recordedAudit).toMatchObject({
        action: 'PLAN_CREATED',
        entity: 'PLAN',
        userId: SUPER_ADMIN_ID,
      });
    });

    it('should upsert platform-wide settings (e.g. maintenance_mode)', async () => {
      let upsertData: unknown = null;

      const mockPrisma = {
        withSuperAdminContext: vi.fn().mockImplementation(async (cb) => {
          const fakeTx = {
            platformSetting: {
              upsert: vi.fn().mockImplementation(async ({ update, create }) => {
                upsertData = { update, create };
                return {
                  id: 'setting-1',
                  key: 'maintenance_mode',
                  value: true,
                  description: 'Scheduled platform upgrade window',
                  updatedAt: new Date(),
                };
              }),
            },
            auditLog: {
              create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
            },
          };
          return cb(fakeTx);
        }),
      } as unknown as PrismaService;

      const service = new SuperAdminService(mockPrisma);

      const setting = await service.updateSetting(
        {
          key: 'maintenance_mode',
          value: true,
          description: 'Scheduled platform upgrade window',
        },
        SUPER_ADMIN_ID,
      );

      expect(setting.key).toBe('maintenance_mode');
      expect(setting.value).toBe(true);
      expect(upsertData).toBeDefined();
    });
  });

  describe('5. SuperAdminController End-to-End Orchestration', () => {
    it('should route request to SuperAdminService and return results', async () => {
      const mockService = {
        getOverviewMetrics: vi.fn().mockResolvedValue({
          totalTenants: 10,
          activeTenants: 9,
          trialTenants: 1,
          suspendedTenants: 0,
          totalUsers: 25,
          totalBranches: 12,
          totalRegisters: 15,
          estimatedMrr: 1250.0,
        }),
      } as unknown as SuperAdminService;

      const controller = new SuperAdminController(mockService);
      const metrics = await controller.getOverview();

      expect(metrics.totalTenants).toBe(10);
      expect(metrics.estimatedMrr).toBe(1250.0);
    });
  });
});
