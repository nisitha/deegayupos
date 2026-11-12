import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import type { StaffRole, StaffUserDto } from '@pixelcraft/types';
import { createStaffUserSchema } from '@pixelcraft/validation';

export const dynamic = 'force-dynamic';

async function resolveTenant(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get('slug') || 'deegayu';
  const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');

  let tenant = null;
  if (tenantIdParam) {
    tenant = await prisma.business.findUnique({
      where: { id: tenantIdParam },
      select: { id: true, name: true, slug: true },
    });
  }
  if (!tenant) {
    tenant = await prisma.business.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
  }
  if (!tenant) {
    tenant = await prisma.business.findFirst({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
  }
  return tenant;
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const memberships = await prisma.businessMembership.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const staff: StaffUserDto[] = memberships.map((m) => {
      const roleCode = (m.role?.code as StaffRole) || 'CASHIER';
      return {
        id: m.user.id,
        email: m.user.email,
        fullName: m.user.fullName,
        phone: m.user.phone || null,
        role: roleCode,
        roleName: m.role?.name || roleCode,
        roleId: m.roleId,
        hasPin: Boolean(m.user.pinCode),
        isActive: m.user.isActive && m.status === 'ACTIVE',
        branchId: m.defaultBranchId || null,
        branchName: m.defaultBranch?.name || null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: staff,
    });
  } catch (error: unknown) {
    console.error('Error fetching staff list:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validation = createStaffUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const input = validation.data;
    const email = input.email.toLowerCase().trim();

    // Check if membership already exists for this tenant
    const existingMembership = await prisma.businessMembership.findFirst({
      where: {
        tenantId: tenant.id,
        user: { email },
        deletedAt: null,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        {
          success: false,
          error: `A staff member with email "${input.email}" already exists in this store.`,
        },
        { status: 409 },
      );
    }

    // Resolve or create Role entity
    let role = await prisma.role.findFirst({
      where: {
        tenantId: tenant.id,
        code: input.role,
        deletedAt: null,
      },
    });

    if (!role) {
      role = await prisma.role.findFirst({
        where: {
          code: input.role,
          deletedAt: null,
        },
      });
    }

    if (!role) {
      const roleNames: Record<StaffRole, string> = {
        OWNER: 'Store Owner',
        MANAGER: 'Store Manager',
        CASHIER: 'Cashier Staff',
      };
      role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          code: input.role,
          name: roleNames[input.role] || input.role,
          description: `Role for ${input.role}`,
          isSystem: false,
        },
      });
    }

    const defaultPass = input.password || 'PixelCraft@2026';
    const passwordHash = await bcrypt.hash(defaultPass, 10);
    const pinCodeHash = input.pinCode ? await bcrypt.hash(input.pinCode, 10) : null;

    const membership = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            fullName: input.fullName.trim(),
            phone: input.phone?.trim() || null,
            passwordHash,
            pinCode: pinCodeHash,
            isActive: true,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: input.fullName.trim() || user.fullName,
            phone: input.phone?.trim() || user.phone,
            ...(pinCodeHash ? { pinCode: pinCodeHash } : {}),
            isActive: true,
          },
        });
      }

      return tx.businessMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id,
          defaultBranchId: input.branchId || null,
          status: 'ACTIVE',
        },
        include: {
          user: true,
          role: true,
          defaultBranch: true,
        },
      });
    });

    const roleCode = (membership.role?.code as StaffRole) || 'CASHIER';
    const staffDto: StaffUserDto = {
      id: membership.user.id,
      email: membership.user.email,
      fullName: membership.user.fullName,
      phone: membership.user.phone || null,
      role: roleCode,
      roleName: membership.role?.name || roleCode,
      roleId: membership.roleId,
      hasPin: Boolean(membership.user.pinCode),
      isActive: membership.user.isActive && membership.status === 'ACTIVE',
      branchId: membership.defaultBranchId || null,
      branchName: membership.defaultBranch?.name || null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: staffDto,
    });
  } catch (error: unknown) {
    console.error('Error creating staff account:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
