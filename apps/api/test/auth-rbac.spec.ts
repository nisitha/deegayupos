import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Request } from 'express';
import type { UserTokenPayload, AuthUser } from '@pixelcraft/types';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { TenantContextGuard } from '../src/common/guards/tenant-context.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { RequirePermissions } from '../src/common/decorators/permissions.decorator';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Phase 03: Auth, Session Management & RBAC Security Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';
  const USER_ALPHA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const USER_CASHIER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const ALL_PERMISSIONS = [
    'pos:access',
    'pos:checkout',
    'pos:discount',
    'pos:refund',
    'inventory:view',
    'inventory:manage',
    'inventory:transfer',
    'reports:view',
    'reports:export',
    'settings:view',
    'settings:manage',
    'users:manage',
  ];

  let configService: ConfigService;
  let jwtService: JwtService;
  let reflector: Reflector;
  let passwordHash: string;

  beforeAll(async () => {
    configService = new ConfigService({
      JWT_SECRET: 'test-access-token-secret-32-chars-long!!',
      JWT_REFRESH_SECRET: 'test-refresh-token-secret-32-chars-long!!',
    });

    jwtService = new JwtService({
      secret: 'test-access-token-secret-32-chars-long!!',
    });

    reflector = new Reflector();
    passwordHash = await bcrypt.hash('SuperSecret123!', 10);
  });

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

  describe('1. Authentication & Session Management (AuthService)', () => {
    it('Test 1: Successful login with owner.alpha@pixelcraftlk.com returns tokens, tenant context, and full permissions', async () => {
      let createdAuditLog: unknown = null;

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: USER_ALPHA_ID,
            email: 'owner.alpha@pixelcraftlk.com',
            fullName: 'Kasun Perera',
            phone: '+94 77 123 4567',
            passwordHash,
            isActive: true,
            deletedAt: null,
            memberships: [
              {
                id: 'mem-alpha-owner',
                tenantId: TENANT_ALPHA_ID,
                userId: USER_ALPHA_ID,
                roleId: 'role-owner-id',
                defaultBranchId: 'branch-alpha-hq',
                status: 'ACTIVE',
                deletedAt: null,
                business: {
                  id: TENANT_ALPHA_ID,
                  name: 'PixelCraft LK Flagship Store',
                  slug: 'alpha',
                  status: 'ACTIVE',
                  deletedAt: null,
                },
                role: {
                  id: 'role-owner-id',
                  code: 'OWNER',
                  name: 'Business Owner',
                  permissions: ALL_PERMISSIONS.map((code) => ({
                    permission: { code, name: code },
                  })),
                },
              },
            ],
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            createdAuditLog = data;
            return { id: 'audit-id-1', ...data };
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(mockPrisma, jwtService, configService);

      const response = await authService.login(
        {
          email: 'owner.alpha@pixelcraftlk.com',
          password: 'SuperSecret123!',
        },
        '192.168.1.100',
        'Mozilla/5.0 TestBrowser',
      );

      // Validate JWT tokens
      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(response.tokenType).toBe('Bearer');
      expect(response.expiresIn).toBe(900);

      // Verify token payload decode
      const decodedPayload = jwtService.decode(response.accessToken) as UserTokenPayload;
      expect(decodedPayload.sub).toBe(USER_ALPHA_ID);
      expect(decodedPayload.email).toBe('owner.alpha@pixelcraftlk.com');
      expect(decodedPayload.activeTenantId).toBe(TENANT_ALPHA_ID);
      expect(decodedPayload.role).toBe('OWNER');

      // Validate sanitized user
      expect(response.user).toEqual({
        id: USER_ALPHA_ID,
        email: 'owner.alpha@pixelcraftlk.com',
        fullName: 'Kasun Perera',
        phone: '+94 77 123 4567',
        isActive: true,
      });

      // Validate tenant context
      expect(response.activeTenant).toEqual({
        id: TENANT_ALPHA_ID,
        name: 'PixelCraft LK Flagship Store',
        slug: 'alpha',
        role: 'OWNER',
        roleId: 'role-owner-id',
        status: 'ACTIVE',
        isPrimaryBranchId: 'branch-alpha-hq',
      });

      // Validate full permissions granted
      expect(response.permissions).toEqual(ALL_PERMISSIONS);

      // Validate LOGIN_SUCCESS audit log was created
      expect(createdAuditLog).toMatchObject({
        tenantId: TENANT_ALPHA_ID,
        userId: USER_ALPHA_ID,
        action: 'LOGIN_SUCCESS',
        entity: 'AUTH',
        entityId: USER_ALPHA_ID,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 TestBrowser',
      });
    });

    it('Test 2: Invalid password returns 401 Unauthorized and writes an audit log', async () => {
      let createdAuditLog: unknown = null;

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: USER_ALPHA_ID,
            email: 'owner.alpha@pixelcraftlk.com',
            fullName: 'Kasun Perera',
            passwordHash,
            isActive: true,
            deletedAt: null,
            memberships: [
              {
                tenantId: TENANT_ALPHA_ID,
                business: { id: TENANT_ALPHA_ID, slug: 'alpha' },
              },
            ],
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            createdAuditLog = data;
            return { id: 'audit-id-2', ...data };
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(mockPrisma, jwtService, configService);

      await expect(
        authService.login(
          {
            email: 'owner.alpha@pixelcraftlk.com',
            password: 'WrongPassword123!',
          },
          '10.0.0.1',
          'AttackerBot/1.0',
        ),
      ).rejects.toThrow(UnauthorizedException);

      // Verify audit log captured LOGIN_FAILED
      expect(createdAuditLog).toMatchObject({
        tenantId: TENANT_ALPHA_ID,
        userId: USER_ALPHA_ID,
        action: 'LOGIN_FAILED',
        entity: 'AUTH',
        ipAddress: '10.0.0.1',
        userAgent: 'AttackerBot/1.0',
        newValues: {
          reason: 'INVALID_CREDENTIALS',
          email: 'owner.alpha@pixelcraftlk.com',
        },
      });
    });

    it('should rotate access token and refresh token via refreshToken endpoint', async () => {
      const validRefreshToken = await jwtService.signAsync(
        { sub: USER_ALPHA_ID, email: 'owner.alpha@pixelcraftlk.com' },
        {
          secret: 'test-refresh-token-secret-32-chars-long!!',
          expiresIn: '7d',
        },
      );

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: USER_ALPHA_ID,
            email: 'owner.alpha@pixelcraftlk.com',
            isActive: true,
            deletedAt: null,
            memberships: [
              {
                tenantId: TENANT_ALPHA_ID,
                role: { code: 'OWNER' },
              },
            ],
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(mockPrisma, jwtService, configService);

      const refreshed = await authService.refreshToken(validRefreshToken);
      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.expiresIn).toBe(900);
      expect(refreshed.tokenType).toBe('Bearer');
    });

    it('should introspect active profile and permissions via getMe', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: USER_ALPHA_ID,
            email: 'owner.alpha@pixelcraftlk.com',
            fullName: 'Kasun Perera',
            phone: '+94 77 123 4567',
            isActive: true,
            deletedAt: null,
            memberships: [
              {
                id: 'mem-1',
                tenantId: TENANT_ALPHA_ID,
                defaultBranchId: 'branch-1',
                status: 'ACTIVE',
                business: { id: TENANT_ALPHA_ID, name: 'PixelCraft Alpha', slug: 'alpha' },
                role: {
                  id: 'r-1',
                  code: 'OWNER',
                  permissions: [{ permission: { code: 'settings:manage' } }],
                },
              },
            ],
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(mockPrisma, jwtService, configService);
      const me = await authService.getMe(USER_ALPHA_ID, TENANT_ALPHA_ID);

      expect(me.user.email).toBe('owner.alpha@pixelcraftlk.com');
      expect(me.activeTenant?.slug).toBe('alpha');
      expect(me.permissions).toEqual(['settings:manage']);
    });
  });

  describe('2. Granular RBAC PermissionsGuard Enforcement', () => {
    class MockStoreSettingsController {
      @RequirePermissions('settings:manage')
      updateTaxPolicy() {
        return { updated: true };
      }

      @RequirePermissions('pos:checkout')
      processOrder() {
        return { checkedOut: true };
      }
    }

    const controllerInstance = new MockStoreSettingsController();

    it('Test 3: Authenticated user attempting to access a route requiring settings:manage fails with 403 Forbidden if the role lacks that permission', () => {
      const permissionsGuard = new PermissionsGuard(reflector);

      // Cashier has only pos:access and pos:checkout (lacks settings:manage)
      const cashierRequest = {
        user: { id: USER_CASHIER_ID, email: 'cashier.alpha@pixelcraftlk.com' },
        tenant: { id: TENANT_ALPHA_ID, role: 'CASHIER' },
        permissions: ['pos:access', 'pos:checkout'],
      };

      const cashierContext = createMockExecutionContext(
        cashierRequest,
        controllerInstance.updateTaxPolicy,
        MockStoreSettingsController,
      );

      expect(() => permissionsGuard.canActivate(cashierContext)).toThrow(ForbiddenException);
    });

    it('should allow user with required permission (OWNER with settings:manage) to access the endpoint', () => {
      const permissionsGuard = new PermissionsGuard(reflector);

      // Owner has settings:manage
      const ownerRequest = {
        user: { id: USER_ALPHA_ID, email: 'owner.alpha@pixelcraftlk.com' },
        tenant: { id: TENANT_ALPHA_ID, role: 'OWNER' },
        permissions: ALL_PERMISSIONS,
      };

      const ownerContext = createMockExecutionContext(
        ownerRequest,
        controllerInstance.updateTaxPolicy,
        MockStoreSettingsController,
      );

      const canActivate = permissionsGuard.canActivate(ownerContext);
      expect(canActivate).toBe(true);
    });

    it('should allow cashier to access route that requires only pos:checkout', () => {
      const permissionsGuard = new PermissionsGuard(reflector);

      const cashierRequest = {
        user: { id: USER_CASHIER_ID, email: 'cashier.alpha@pixelcraftlk.com' },
        tenant: { id: TENANT_ALPHA_ID, role: 'CASHIER' },
        permissions: ['pos:access', 'pos:checkout'],
      };

      const cashierContext = createMockExecutionContext(
        cashierRequest,
        controllerInstance.processOrder,
        MockStoreSettingsController,
      );

      const canActivate = permissionsGuard.canActivate(cashierContext);
      expect(canActivate).toBe(true);
    });
  });

  describe('3. Tenant Resolution & Tenant Spoofing Prevention (TenantContextGuard)', () => {
    it('Test 4: Tenant spoofing prevention: Tenant Alpha user attempting to access with Tenant Beta ID is rejected with 403 Forbidden', async () => {
      const mockPrisma = {
        businessMembership: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'mem-alpha',
              tenantId: TENANT_ALPHA_ID,
              userId: USER_ALPHA_ID,
              roleId: 'role-alpha',
              status: 'ACTIVE',
              defaultBranchId: 'branch-alpha-1',
              business: {
                id: TENANT_ALPHA_ID,
                name: 'Tenant Alpha Store',
                slug: 'alpha',
              },
              role: {
                id: 'role-alpha',
                code: 'OWNER',
                permissions: [{ permission: { code: 'pos:access' } }],
              },
            },
          ]),
        },
      } as unknown as PrismaService;

      const tenantGuard = new TenantContextGuard(reflector, mockPrisma);

      // User from Tenant Alpha maliciously passes Tenant Beta's ID in header
      const spoofingRequest: Record<string, unknown> = {
        headers: {
          'x-tenant-id': TENANT_BETA_ID,
        },
        user: {
          id: USER_ALPHA_ID,
          email: 'owner.alpha@pixelcraftlk.com',
        } as AuthUser,
      };

      const context = createMockExecutionContext(spoofingRequest);

      await expect(tenantGuard.canActivate(context)).rejects.toThrow(
        new ForbiddenException(
          'Access denied: You do not have an active membership for the requested tenant.',
        ),
      );
    });

    it('should verify and bind Tenant Alpha context when user passes their authorized tenant ID', async () => {
      const mockPrisma = {
        businessMembership: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'mem-alpha',
              tenantId: TENANT_ALPHA_ID,
              userId: USER_ALPHA_ID,
              roleId: 'role-alpha',
              status: 'ACTIVE',
              defaultBranchId: 'branch-alpha-1',
              business: {
                id: TENANT_ALPHA_ID,
                name: 'Tenant Alpha Store',
                slug: 'alpha',
              },
              role: {
                id: 'role-alpha',
                code: 'OWNER',
                permissions: [{ permission: { code: 'pos:checkout' } }],
              },
            },
          ]),
        },
      } as unknown as PrismaService;

      const tenantGuard = new TenantContextGuard(reflector, mockPrisma);

      const validRequest: Record<string, unknown> = {
        headers: {
          'x-tenant-id': TENANT_ALPHA_ID,
        },
        user: {
          id: USER_ALPHA_ID,
          email: 'owner.alpha@pixelcraftlk.com',
        } as AuthUser,
      };

      const context = createMockExecutionContext(validRequest);
      const allowed = await tenantGuard.canActivate(context);

      expect(allowed).toBe(true);
      expect(validRequest.tenant).toEqual({
        id: TENANT_ALPHA_ID,
        name: 'Tenant Alpha Store',
        slug: 'alpha',
        role: 'OWNER',
        roleId: 'role-alpha',
        status: 'ACTIVE',
        isPrimaryBranchId: 'branch-alpha-1',
      });
      expect(validRequest.permissions).toEqual(['pos:checkout']);
      expect(validRequest.tenantId).toBe(TENANT_ALPHA_ID);
    });

    it('should default to user primary membership when no x-tenant-id header is provided', async () => {
      const mockPrisma = {
        businessMembership: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'mem-alpha-primary',
              tenantId: TENANT_ALPHA_ID,
              userId: USER_ALPHA_ID,
              status: 'ACTIVE',
              defaultBranchId: 'branch-alpha-1',
              business: {
                id: TENANT_ALPHA_ID,
                name: 'Tenant Alpha Store',
                slug: 'alpha',
              },
              role: {
                id: 'role-alpha',
                code: 'OWNER',
                permissions: [{ permission: { code: 'pos:access' } }],
              },
            },
          ]),
        },
      } as unknown as PrismaService;

      const tenantGuard = new TenantContextGuard(reflector, mockPrisma);

      const defaultRequest: Record<string, unknown> = {
        headers: {},
        user: {
          id: USER_ALPHA_ID,
          email: 'owner.alpha@pixelcraftlk.com',
        } as AuthUser,
      };

      const context = createMockExecutionContext(defaultRequest);
      const allowed = await tenantGuard.canActivate(context);

      expect(allowed).toBe(true);
      expect(defaultRequest.tenantId).toBe(TENANT_ALPHA_ID);
    });
  });

  describe('4. Full End-to-End Auth Controller Integration', () => {
    it('should invoke AuthController.login and return structured AuthResponseData', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: USER_ALPHA_ID,
            email: 'owner.alpha@pixelcraftlk.com',
            fullName: 'Kasun Perera',
            passwordHash,
            isActive: true,
            deletedAt: null,
            memberships: [
              {
                id: 'mem-1',
                tenantId: TENANT_ALPHA_ID,
                userId: USER_ALPHA_ID,
                roleId: 'role-1',
                defaultBranchId: 'branch-1',
                status: 'ACTIVE',
                business: { id: TENANT_ALPHA_ID, name: 'PixelCraft Alpha', slug: 'alpha' },
                role: {
                  id: 'role-1',
                  code: 'OWNER',
                  permissions: [{ permission: { code: 'pos:access' } }],
                },
              },
            ],
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(mockPrisma, jwtService, configService);
      const authController = new AuthController(authService);

      const fakeReq = {
        headers: { 'user-agent': 'Vitest E2E Agent' },
      } as unknown as Request;

      const result = await authController.login(
        {
          email: 'owner.alpha@pixelcraftlk.com',
          password: 'SuperSecret123!',
        },
        '127.0.0.1',
        fakeReq,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('owner.alpha@pixelcraftlk.com');
      expect(result.activeTenant?.slug).toBe('alpha');
      expect(result.permissions).toContain('pos:access');
    });
  });
});
