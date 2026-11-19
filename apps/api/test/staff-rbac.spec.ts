import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { AuthTenant, AuthUser, StaffRole } from '@pixelcraft/types';
import { StaffService } from '../src/modules/staff/staff.service';
import { StaffController } from '../src/modules/staff/staff.controller';

describe('PixelCraft POS - Step 5: Staff Accounts, RBAC & Cashier Attribution Suite', () => {
  const TENANT_ID = '0fef1423-5d89-4147-8af8-17c7e641c88a';
  const BRANCH_ID = '85d48a94-b6a3-4b9f-a746-0ac2ff61355c';

  const OWNER_USER_ID = '96b2747b-9d22-4266-94ce-b035fadef498';
  const CASHIER_ROLE_ID = '7822cd7f-42b0-4d76-82b5-c524c5d0f8f0';
  const OWNER_ROLE_ID = '1088a904-904d-4ba4-a10f-a39b1dab1410';

  const AUTH_TENANT: AuthTenant = {
    id: TENANT_ID,
    name: 'Deegayu Weda Madhura',
    slug: 'deegayu',
    role: 'OWNER',
    roleId: OWNER_ROLE_ID,
    status: 'ACTIVE',
  };

  let mockPrisma: any;
  let staffService: StaffService;
  let staffController: StaffController;

  let inMemoryUsers: any[] = [];
  let inMemoryMemberships: any[] = [];
  let inMemoryRoles: any[] = [];
  let inMemoryBranches: any[] = [];

  beforeEach(() => {
    inMemoryUsers = [
      {
        id: OWNER_USER_ID,
        email: 'owner@deegayu.pixelcraftlk.com',
        fullName: 'Dr. Deegayu (Owner)',
        phone: '+94 34 222 1111',
        passwordHash: '$2a$10$hashedownerpassword',
        pinCode: null,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ];

    inMemoryRoles = [
      {
        id: OWNER_ROLE_ID,
        tenantId: TENANT_ID,
        code: 'OWNER',
        name: 'Store Owner',
        deletedAt: null,
      },
      {
        id: CASHIER_ROLE_ID,
        tenantId: TENANT_ID,
        code: 'CASHIER',
        name: 'Dispensary Cashier',
        deletedAt: null,
      },
    ];

    inMemoryBranches = [
      {
        id: BRANCH_ID,
        tenantId: TENANT_ID,
        name: 'Main Branch',
        isPrimary: true,
        deletedAt: null,
      },
    ];

    inMemoryMemberships = [
      {
        id: 'mem-owner-1',
        tenantId: TENANT_ID,
        userId: OWNER_USER_ID,
        roleId: OWNER_ROLE_ID,
        defaultBranchId: BRANCH_ID,
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
        user: inMemoryUsers[0],
        role: inMemoryRoles[0],
        defaultBranch: inMemoryBranches[0],
      },
    ];

    mockPrisma = {
      businessMembership: {
        findMany: vi.fn(async (args) => {
          return inMemoryMemberships.filter((m) => {
            if (args?.where?.tenantId && m.tenantId !== args.where.tenantId) return false;
            if (args?.where?.deletedAt === null && m.deletedAt !== null) return false;
            if (args?.where?.status && m.status !== args.where.status) return false;
            if (args?.where?.user?.pinCode?.not === null && !m.user?.pinCode) return false;
            return true;
          });
        }),
        findFirst: vi.fn(async (args) => {
          return inMemoryMemberships.find((m) => {
            if (args?.where?.tenantId && m.tenantId !== args.where.tenantId) return false;
            if (args?.where?.userId && m.userId !== args.where.userId) return false;
            if (args?.where?.user?.email && m.user?.email !== args.where.user.email) return false;
            if (args?.where?.deletedAt === null && m.deletedAt !== null) return false;
            return true;
          }) || null;
        }),
        count: vi.fn(async (args) => {
          return inMemoryMemberships.filter((m) => {
            if (args?.where?.tenantId && m.tenantId !== args.where.tenantId) return false;
            if (args?.where?.role?.code && m.role?.code !== args.where.role.code) return false;
            if (args?.where?.status && m.status !== args.where.status) return false;
            if (args?.where?.deletedAt === null && m.deletedAt !== null) return false;
            return true;
          }).length;
        }),
        create: vi.fn(async (args) => {
          const user = inMemoryUsers.find((u) => u.id === args.data.userId);
          const role = inMemoryRoles.find((r) => r.id === args.data.roleId);
          const branch = inMemoryBranches.find((b) => b.id === args.data.defaultBranchId) || null;
          const newMem = {
            id: `mem-${Date.now()}`,
            tenantId: args.data.tenantId,
            userId: args.data.userId,
            roleId: args.data.roleId,
            defaultBranchId: args.data.defaultBranchId || null,
            status: args.data.status || 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            user,
            role,
            defaultBranch: branch,
          };
          inMemoryMemberships.push(newMem);
          return newMem;
        }),
        update: vi.fn(async (args) => {
          const mem = inMemoryMemberships.find((m) => m.id === args.where.id);
          if (!mem) throw new Error('Membership not found');
          if (args.data.roleId) {
            mem.roleId = args.data.roleId;
            mem.role = inMemoryRoles.find((r) => r.id === args.data.roleId) || mem.role;
          }
          if (args.data.defaultBranchId !== undefined) {
            mem.defaultBranchId = args.data.defaultBranchId;
            mem.defaultBranch = inMemoryBranches.find((b) => b.id === args.data.defaultBranchId) || null;
          }
          if (args.data.status) mem.status = args.data.status;
          if (args.data.deletedAt !== undefined) mem.deletedAt = args.data.deletedAt;
          mem.updatedAt = new Date();
          return mem;
        }),
      },
      user: {
        findUnique: vi.fn(async (args) => {
          if (args?.where?.id) {
            return inMemoryUsers.find((u) => u.id === args.where.id) || null;
          }
          if (args?.where?.email) {
            return inMemoryUsers.find((u) => u.email === args.where.email) || null;
          }
          return null;
        }),
        create: vi.fn(async (args) => {
          const newUser = {
            id: `usr-${Date.now()}`,
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryUsers.push(newUser);
          return newUser;
        }),
        update: vi.fn(async (args) => {
          const user = inMemoryUsers.find((u) => u.id === args.where.id);
          if (!user) throw new Error('User not found');
          Object.assign(user, args.data);
          user.updatedAt = new Date();
          return user;
        }),
      },
      role: {
        findFirst: vi.fn(async (args) => {
          return inMemoryRoles.find((r) => {
            if (args?.where?.code && r.code !== args.where.code) return false;
            if (args?.where?.tenantId && r.tenantId !== args.where.tenantId) return false;
            if (args?.where?.deletedAt === null && r.deletedAt !== null) return false;
            return true;
          }) || null;
        }),
        create: vi.fn(async (args) => {
          const newRole = {
            id: `role-${Date.now()}`,
            ...args.data,
            deletedAt: null,
          };
          inMemoryRoles.push(newRole);
          return newRole;
        }),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    staffService = new StaffService(mockPrisma as any);
    staffController = new StaffController(staffService);
  });

  it('1. should list all staff members for the tenant', async () => {
    const list = await staffController.listStaff(AUTH_TENANT);
    expect(list).toHaveLength(1);
    expect(list[0].fullName).toBe('Dr. Deegayu (Owner)');
    expect(list[0].role).toBe('OWNER');
    expect(list[0].isActive).toBe(true);
  });

  it('2. should create a new cashier account with hashed credentials and 4-digit PIN', async () => {
    const created = await staffController.createStaff(AUTH_TENANT, {
      fullName: 'Kamal Perera',
      email: 'kamal@deegayu.pixelcraftlk.com',
      role: 'CASHIER',
      pinCode: '1234',
      phone: '+94 77 123 4567',
      branchId: BRANCH_ID,
    });

    expect(created.fullName).toBe('Kamal Perera');
    expect(created.email).toBe('kamal@deegayu.pixelcraftlk.com');
    expect(created.role).toBe('CASHIER');
    expect(created.hasPin).toBe(true);
    expect(created.branchId).toBe(BRANCH_ID);

    // Verify stored user password and PIN are securely hashed
    const storedUser = inMemoryUsers.find((u) => u.email === 'kamal@deegayu.pixelcraftlk.com');
    expect(storedUser).toBeDefined();
    expect(storedUser.pinCode).not.toBe('1234');
    expect(await bcrypt.compare('1234', storedUser.pinCode)).toBe(true);
  });

  it('3. should reject creating duplicate staff email in the same tenant', async () => {
    await staffController.createStaff(AUTH_TENANT, {
      fullName: 'Kamal Perera',
      email: 'kamal@deegayu.pixelcraftlk.com',
      role: 'CASHIER',
    });

    await expect(
      staffController.createStaff(AUTH_TENANT, {
        fullName: 'Another Kamal',
        email: 'kamal@deegayu.pixelcraftlk.com',
        role: 'CASHIER',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('4. should verify 4-digit terminal PIN in fast lookup for cashier switching', async () => {
    const pinHash = await bcrypt.hash('4321', 10);
    const cashierUser = {
      id: 'cashier-user-2',
      email: 'nimal@deegayu.pixelcraftlk.com',
      fullName: 'Nimal Bandara',
      pinCode: pinHash,
      isActive: true,
      deletedAt: null,
    };
    inMemoryUsers.push(cashierUser);

    inMemoryMemberships.push({
      id: 'mem-cashier-2',
      tenantId: TENANT_ID,
      userId: cashierUser.id,
      roleId: CASHIER_ROLE_ID,
      defaultBranchId: BRANCH_ID,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      user: cashierUser,
      role: inMemoryRoles[1],
      defaultBranch: inMemoryBranches[0],
    });

    const verified = await staffController.verifyPin(AUTH_TENANT, { pinCode: '4321' });
    expect(verified).not.toBeNull();
    expect(verified?.fullName).toBe('Nimal Bandara');
    expect(verified?.role).toBe('CASHIER');

    const invalid = await staffController.verifyPin(AUTH_TENANT, { pinCode: '0000' });
    expect(invalid).toBeNull();
  });

  it('5. should prevent deleting the sole owner of the tenant', async () => {
    await expect(
      staffController.deleteStaff(AUTH_TENANT, OWNER_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should update staff member details, role, and branch', async () => {
    const created = await staffController.createStaff(AUTH_TENANT, {
      fullName: 'Sunil Silva',
      email: 'sunil@deegayu.pixelcraftlk.com',
      role: 'CASHIER',
    });

    const updated = await staffController.updateStaff(AUTH_TENANT, created.id, {
      fullName: 'Sunil Silva (Senior Cashier)',
      phone: '+94 71 999 8888',
      role: 'MANAGER',
    });

    expect(updated.fullName).toBe('Sunil Silva (Senior Cashier)');
    expect(updated.phone).toBe('+94 71 999 8888');
    expect(updated.role).toBe('MANAGER');
  });
});

