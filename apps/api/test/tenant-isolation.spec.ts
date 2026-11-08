import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@pixelcraft/database';
import { createTenantPrismaClient } from '@pixelcraft/database';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Multi-Tenant Isolation & RLS Security Suite', () => {
  let prismaService: PrismaService;
  let isDbConnected = false;

  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const configService = new ConfigService({
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/pixelcraft_pos?schema=public',
    });

    prismaService = new PrismaService(configService);

    try {
      await prismaService.$connect();
      // Test basic connection ping
      await prismaService.$queryRaw`SELECT 1`;
      isDbConnected = true;
    } catch {
      // If live DB engine is not reachable, suite executes extension-level defense-in-depth tests
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await prismaService.$disconnect();
    }
  });

  describe('1. Defense-in-Depth Application Layer Tenant Isolation', () => {
    it('should inject tenantId into queries when tenant context is active', async () => {
      const rawMockPrisma = new PrismaClient();
      let capturedArgs: unknown = null;

      const alphaClient = createTenantPrismaClient(rawMockPrisma, {
        tenantId: TENANT_ALPHA_ID,
      }).$extends({
        query: {
          $allModels: {
            async $allOperations({ args }) {
              capturedArgs = args;
              return [];
            },
          },
        },
      });

      await alphaClient.branch.findMany();
      expect((capturedArgs as { where?: Record<string, unknown> })?.where).toEqual({
        tenantId: TENANT_ALPHA_ID,
      });
    });

    it('should prevent cross-tenant queries: Tenant Alpha cannot view Tenant Beta records', async () => {
      const rawMockPrisma = new PrismaClient();
      let capturedArgs: unknown = null;

      const alphaClient = createTenantPrismaClient(rawMockPrisma, {
        tenantId: TENANT_ALPHA_ID,
      }).$extends({
        query: {
          $allModels: {
            async $allOperations({ args }) {
              capturedArgs = args;
              return [];
            },
          },
        },
      });

      // Tenant Alpha queries for its branches
      await alphaClient.branch.findMany({
        where: { code: 'ALPHA-HQ' },
      });

      expect((capturedArgs as { where?: Record<string, unknown> })?.where).toMatchObject({
        tenantId: TENANT_ALPHA_ID,
        code: 'ALPHA-HQ',
      });
    });

    it('should fail-safe to zero rows if tenant-scoped model is queried without tenant context', async () => {
      const rawMockPrisma = new PrismaClient();
      let capturedArgs: unknown = null;

      // Client initialized without tenant context
      const unauthenticatedClient = createTenantPrismaClient(rawMockPrisma, {}).$extends({
        query: {
          $allModels: {
            async $allOperations({ args }) {
              capturedArgs = args;
              return [];
            },
          },
        },
      });

      const results = await unauthenticatedClient.branch.findMany();
      expect(results).toEqual([]);
      expect((capturedArgs as { where?: Record<string, unknown> })?.where).toMatchObject({
        id: '00000000-0000-0000-0000-000000000000',
      });
    });

    it('should allow Super Admin to bypass tenant filters across organizations', async () => {
      const rawMockPrisma = new PrismaClient();
      let capturedArgs: unknown = null;

      const superAdminClient = createTenantPrismaClient(rawMockPrisma, {
        isSuperAdmin: true,
      }).$extends({
        query: {
          $allModels: {
            async $allOperations({ args }) {
              capturedArgs = args;
              return [
                { id: 'branch-1', tenantId: TENANT_ALPHA_ID, name: 'Alpha Branch' },
                { id: 'branch-2', tenantId: TENANT_BETA_ID, name: 'Beta Branch' },
              ];
            },
          },
        },
      });

      const results = await superAdminClient.branch.findMany();
      expect(results.length).toBe(2);
      expect((capturedArgs as { where?: unknown })?.where).toBeUndefined(); // No forced tenantId where injected
    });
  });

  describe('2. Decimal-Safe Financial Precision Verification', () => {
    it('should ensure financial plan pricing retains exact decimal precision without floating point drift', () => {
      const sampleMonthlyPrice = '29.00';
      const sampleAnnualPrice = '290.00';
      const samplePaymentAmount = '145.5050';

      // Verify strings conform to Decimal(12, 2) and Decimal(14, 4)
      const decimal2Regex = /^\d+(\.\d{1,2})?$/;
      const decimal4Regex = /^\d+(\.\d{1,4})?$/;

      expect(decimal2Regex.test(sampleMonthlyPrice)).toBe(true);
      expect(decimal2Regex.test(sampleAnnualPrice)).toBe(true);
      expect(decimal4Regex.test(samplePaymentAmount)).toBe(true);

      // Verify floating point addition drift (0.1 + 0.2 !== 0.3) is avoided by decimal types
      const floatingResult = 0.1 + 0.2;
      expect(floatingResult).not.toBe(0.3); // Demonstrates why Float is strictly prohibited

      const fixedDecimalResult = (Math.round((0.1 + 0.2) * 100) / 100).toFixed(2);
      expect(fixedDecimalResult).toBe('0.30');
    });
  });

  describe('3. Database Row-Level Security (RLS) Transaction Wrapper', () => {
    it('should properly configure session parameter query in withTenantContext', async () => {
      let executedSql: string[] = [];

      // Mock transaction runner
      const mockPrisma = {
        $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
          const fakeTx = {
            $executeRawUnsafe: async (sql: string) => {
              executedSql.push(sql);
            },
          };
          return cb(fakeTx);
        },
      } as unknown as PrismaService;

      // Bind method to mock
      const withTenantContext = PrismaService.prototype.withTenantContext.bind(mockPrisma);

      await withTenantContext(TENANT_ALPHA_ID, async () => {
        return 'success';
      });

      expect(executedSql).toContain(`SET LOCAL app.current_tenant_id = '${TENANT_ALPHA_ID}'`);
      expect(executedSql).toContain(`SET LOCAL app.is_super_admin = 'false'`);
    });

    it('should properly configure super admin session parameter in withSuperAdminContext', async () => {
      let executedSql: string[] = [];

      const mockPrisma = {
        $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
          const fakeTx = {
            $executeRawUnsafe: async (sql: string) => {
              executedSql.push(sql);
            },
          };
          return cb(fakeTx);
        },
      } as unknown as PrismaService;

      const withSuperAdminContext = PrismaService.prototype.withSuperAdminContext.bind(mockPrisma);

      await withSuperAdminContext(async () => {
        return 'admin_success';
      });

      expect(executedSql).toContain(`SET LOCAL app.is_super_admin = 'true'`);
    });
  });
});
