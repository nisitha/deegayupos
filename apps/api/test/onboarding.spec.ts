import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserTokenPayload } from '@pixelcraft/types';
import { OnboardingService } from '../src/modules/onboarding/onboarding.service';
import { OnboardingController } from '../src/modules/onboarding/onboarding.controller';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Phase 05: SaaS Plans & Business Onboarding Suite', () => {
  const configService = new ConfigService({
    JWT_SECRET: 'test-onboarding-access-secret-32-chars!!',
    JWT_REFRESH_SECRET: 'test-onboarding-refresh-secret-32-chars!',
  });

  const jwtService = new JwtService({
    secret: 'test-onboarding-access-secret-32-chars!!',
  });

  const SEEDED_PLANS = [
    {
      id: 'plan-starter-id',
      code: 'STARTER',
      name: 'Starter Plan',
      description: 'Single outlet retail boutiques',
      monthlyPrice: '29.00',
      annualPrice: '290.00',
      maxProducts: 500,
      maxBranches: 1,
      maxUsers: 2,
      maxRegisters: 1,
      enabledModules: ['pos', 'inventory'],
      isActive: true,
    },
    {
      id: 'plan-pro-id',
      code: 'PROFESSIONAL',
      name: 'Professional Plan',
      description: 'Growing multi-outlet retailers',
      monthlyPrice: '79.00',
      annualPrice: '790.00',
      maxProducts: 5000,
      maxBranches: 3,
      maxUsers: 10,
      maxRegisters: 5,
      enabledModules: ['pos', 'inventory', 'reports'],
      isActive: true,
    },
    {
      id: 'plan-enterprise-id',
      code: 'ENTERPRISE',
      name: 'Enterprise Plan',
      description: 'Unlimited multi-store chain operations',
      monthlyPrice: '199.00',
      annualPrice: '1990.00',
      maxProducts: 50000,
      maxBranches: 20,
      maxUsers: 50,
      maxRegisters: 25,
      enabledModules: ['pos', 'inventory', 'reports', 'multi-branch', 'api'],
      isActive: true,
    },
  ];

  describe('1. Public Plans Catalog Endpoint', () => {
    it('Test 1: Public endpoint /api/v1/onboarding/plans returns seeded plans with 14-day trial entitlements', async () => {
      const mockPrisma = {
        plan: {
          findMany: vi.fn().mockResolvedValue(SEEDED_PLANS),
        },
      } as unknown as PrismaService;

      const onboardingService = new OnboardingService(mockPrisma, jwtService, configService);
      const plans = await onboardingService.getActivePlans();

      expect(plans.length).toBe(3);
      expect(plans[0]?.code).toBe('STARTER');
      expect(plans[0]?.monthlyPrice).toBe(29.0);
      expect(plans[0]?.trialDays).toBe(14);

      expect(plans[1]?.code).toBe('PROFESSIONAL');
      expect(plans[1]?.maxBranches).toBe(3);

      expect(plans[2]?.code).toBe('ENTERPRISE');
      expect(plans[2]?.enabledModules).toContain('api');
    });
  });

  describe('2. Subdomain / Organization Slug Availability', () => {
    it('Test 2: Slug collision check correctly identifies taken slugs (alpha, beta) vs available ones', async () => {
      const existingBusinesses = new Map([
        ['alpha', { id: 'alpha-id', slug: 'alpha' }],
        ['beta', { id: 'beta-id', slug: 'beta' }],
      ]);

      const mockPrisma = {
        business: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            return existingBusinesses.get(where.slug) || null;
          }),
        },
      } as unknown as PrismaService;

      const onboardingService = new OnboardingService(mockPrisma, jwtService, configService);

      // Taken slug: alpha
      const checkAlpha = await onboardingService.checkSlug('alpha');
      expect(checkAlpha.available).toBe(false);
      expect(checkAlpha.reason).toContain('already registered');

      // Taken slug: beta
      const checkBeta = await onboardingService.checkSlug('beta');
      expect(checkBeta.available).toBe(false);

      // Available slug: gamestore
      const checkAvailable = await onboardingService.checkSlug('gamestore');
      expect(checkAvailable.available).toBe(true);
      expect(checkAvailable.slug).toBe('gamestore');

      // Reserved platform slug: admin
      const checkReserved = await onboardingService.checkSlug('admin');
      expect(checkReserved.available).toBe(false);
      expect(checkReserved.reason).toContain('reserved for system platform use');
    });
  });

  describe('3. Transactional Onboarding & Atomic Provisioning', () => {
    it('Test 3: Successful onboarding atomically creates Business, Settings, Branch, Warehouse, Register, Owner Role, Membership, and 14-day Trial Subscription', async () => {
      const createdEntities: Record<string, unknown> = {};

      const mockPrisma = {
        business: {
          findUnique: vi.fn().mockResolvedValue(null), // slug is available
        },
        plan: {
          findUnique: vi.fn().mockResolvedValue(SEEDED_PLANS[1]), // PROFESSIONAL
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            user: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.user = data;
                return { id: 'user-new-id', ...data };
              }),
            },
            business: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.business = data;
                return { id: 'biz-new-id', ...data };
              }),
            },
            businessSetting: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.settings = data;
                return { id: 'settings-new-id', ...data };
              }),
            },
            branch: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.branch = data;
                return { id: 'branch-new-id', ...data };
              }),
            },
            warehouse: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.warehouse = data;
                return { id: 'wh-new-id', ...data };
              }),
            },
            register: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.register = data;
                return { id: 'reg-new-id', ...data };
              }),
            },
            role: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.role = data;
                return { id: 'role-owner-id', ...data };
              }),
            },
            permission: {
              findMany: vi.fn().mockResolvedValue([
                { id: 'p-1', code: 'pos:access' },
                { id: 'p-2', code: 'pos:checkout' },
                { id: 'p-3', code: 'settings:manage' },
              ]),
            },
            rolePermission: {
              createMany: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.rolePermissions = data;
                return { count: data.length };
              }),
            },
            businessMembership: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.membership = data;
                return { id: 'mem-new-id', ...data };
              }),
            },
            subscription: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.subscription = data;
                return { id: 'sub-new-id', ...data };
              }),
            },
            auditLog: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdEntities.auditLog = data;
                return { id: 'audit-new-id', ...data };
              }),
            },
          };

          return callback(fakeTx);
        }),
      } as unknown as PrismaService;

      const onboardingService = new OnboardingService(mockPrisma, jwtService, configService);

      const result = await onboardingService.register(
        {
          fullName: 'Sahan Jayawardena',
          email: 'sahan@myretail.lk',
          password: 'SuperSecurePassword123!',
          businessName: 'MyRetail Colombo',
          businessSlug: 'myretail',
          businessType: 'RETAIL',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          branchName: 'Main Colombo Store',
          warehouseName: 'Main Storage Room',
          registerName: 'Counter 01 POS',
          planCode: 'PROFESSIONAL',
        },
        '192.168.1.50',
        'Mozilla/5.0 OnboardingClient',
      );

      // Verify all atomic entities were provisioned
      expect(createdEntities.user).toMatchObject({
        email: 'sahan@myretail.lk',
        fullName: 'Sahan Jayawardena',
      });
      expect(createdEntities.business).toMatchObject({
        name: 'MyRetail Colombo',
        slug: 'myretail',
        status: 'TRIAL',
        currency: 'LKR',
      });
      expect(createdEntities.branch).toMatchObject({
        code: 'MAIN-01',
        name: 'Main Colombo Store',
        isPrimary: true,
      });
      expect(createdEntities.warehouse).toMatchObject({
        name: 'Main Storage Room',
        isDefault: true,
      });
      expect(createdEntities.register).toMatchObject({
        code: 'REG-01',
        name: 'Counter 01 POS',
      });
      expect(createdEntities.role).toMatchObject({
        code: 'OWNER',
        name: 'Business Owner',
      });
      expect(createdEntities.membership).toMatchObject({
        status: 'ACTIVE',
      });
      expect(createdEntities.subscription).toMatchObject({
        status: 'TRIAL',
        billingCycle: 'MONTHLY',
      });
      expect(createdEntities.auditLog).toMatchObject({
        action: 'BUSINESS_ONBOARDED',
        entity: 'BUSINESS',
      });

      // Verify 14-day trial calculation
      const trialEndsAtDate = new Date(result.trialEndsAt);
      const expectedDiffDays = Math.round(
        (trialEndsAtDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(expectedDiffDays).toBe(14);
    });

    it('Test 4: Verifies that returned JWT tokens allow immediate authenticated access with active tenant context', async () => {
      const mockPrisma = {
        business: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        plan: {
          findUnique: vi.fn().mockResolvedValue(SEEDED_PLANS[0]),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const fakeTx = {
            user: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({
                id: 'usr-fresh-1',
                email: 'test@instantauth.com',
                fullName: 'Instant Auth User',
                isActive: true,
              }),
            },
            business: {
              create: vi.fn().mockResolvedValue({
                id: 'biz-fresh-1',
                name: 'Instant Store',
                slug: 'instantstore',
                status: 'TRIAL',
              }),
            },
            businessSetting: { create: vi.fn().mockResolvedValue({}) },
            branch: {
              create: vi.fn().mockResolvedValue({ id: 'br-fresh-1' }),
            },
            warehouse: { create: vi.fn().mockResolvedValue({}) },
            register: { create: vi.fn().mockResolvedValue({}) },
            role: {
              create: vi.fn().mockResolvedValue({ id: 'r-owner', code: 'OWNER' }),
            },
            permission: {
              findMany: vi.fn().mockResolvedValue([
                { id: 'p1', code: 'pos:access' },
                { id: 'p2', code: 'pos:checkout' },
              ]),
            },
            rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
            businessMembership: { create: vi.fn().mockResolvedValue({}) },
            subscription: { create: vi.fn().mockResolvedValue({}) },
            auditLog: { create: vi.fn().mockResolvedValue({}) },
          };
          return callback(fakeTx);
        }),
      } as unknown as PrismaService;

      const onboardingService = new OnboardingService(mockPrisma, jwtService, configService);

      const result = await onboardingService.register({
        fullName: 'Instant Auth User',
        email: 'test@instantauth.com',
        password: 'Password123!',
        businessName: 'Instant Store',
        businessSlug: 'instantstore',
        planCode: 'STARTER',
      });

      // Verify immediate token generation
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');

      // Decode token payload
      const decoded = jwtService.verify<UserTokenPayload>(result.accessToken, {
        secret: 'test-onboarding-access-secret-32-chars!!',
      });

      expect(decoded.sub).toBe('usr-fresh-1');
      expect(decoded.email).toBe('test@instantauth.com');
      expect(decoded.activeTenantId).toBe('biz-fresh-1');
      expect(decoded.role).toBe('OWNER');

      // Verify active tenant payload
      expect(result.activeTenant).toMatchObject({
        id: 'biz-fresh-1',
        name: 'Instant Store',
        slug: 'instantstore',
        role: 'OWNER',
        status: 'TRIAL',
      });
      expect(result.permissions).toContain('pos:access');
      expect(result.permissions).toContain('pos:checkout');
    });

    it('Test 5: Transaction rollback verification: If duplicate business slug or invalid plan is supplied, no records are partially created', async () => {
      const mockPrisma = {
        business: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'existing-id',
            slug: 'taken-slug',
          }), // Slug collision
        },
        plan: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn(),
      } as unknown as PrismaService;

      const onboardingService = new OnboardingService(mockPrisma, jwtService, configService);

      // Attempt onboarding with taken slug
      await expect(
        onboardingService.register({
          fullName: 'Jane Doe',
          email: 'jane@taken.com',
          password: 'Password123!',
          businessName: 'Collision Store',
          businessSlug: 'taken-slug',
          planCode: 'STARTER',
        }),
      ).rejects.toThrow(ConflictException);

      // Verify transaction was NEVER even started, preventing any orphaned writes
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject registration if plan code is invalid or inactive', async () => {
      const mockPrisma = {
        business: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        plan: {
          findUnique: vi.fn().mockResolvedValue(null), // Non-existent plan
        },
        $transaction: vi.fn(),
      } as unknown as PrismaService;

      const onboardingService = new OnboardingService(mockPrisma, jwtService, configService);

      await expect(
        onboardingService.register({
          fullName: 'Jane Doe',
          email: 'jane@invalidplan.com',
          password: 'Password123!',
          businessName: 'No Plan Store',
          businessSlug: 'noplan',
          planCode: 'NONEXISTENT_PLAN',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('4. OnboardingController End-to-End Orchestration', () => {
    it('should route check-slug and register through OnboardingController', async () => {
      const mockService = {
        getActivePlans: vi.fn().mockResolvedValue(SEEDED_PLANS),
        checkSlug: vi.fn().mockResolvedValue({ slug: 'myboutique', available: true }),
        register: vi.fn().mockResolvedValue({
          accessToken: 'fake-jwt',
          user: { email: 'test@boutique.lk' },
          activeTenant: { slug: 'myboutique' },
        }),
      } as unknown as OnboardingService;

      const controller = new OnboardingController(mockService);

      const plans = await controller.getPlans();
      expect(plans.length).toBe(3);

      const slugCheck = await controller.checkSlug({ slug: 'myboutique' });
      expect(slugCheck.available).toBe(true);

      const fakeReq = {
        headers: { 'user-agent': 'BrowserClient/1.0' },
      } as unknown as Request;

      const regResult = await controller.register(
        {
          fullName: 'Boutique Owner',
          email: 'test@boutique.lk',
          password: 'Password123!',
          businessName: 'My Boutique',
          businessSlug: 'myboutique',
          planCode: 'STARTER',
        },
        '127.0.0.1',
        fakeReq,
      );

      expect(regResult.accessToken).toBe('fake-jwt');
      expect(regResult.activeTenant?.slug).toBe('myboutique');
    });
  });
});

