import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import type { StaffRole, StaffUserDto } from '@pixelcraft/types';
import { updateStaffUserSchema } from '@pixelcraft/validation';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const membership = await prisma.businessMembership.findFirst({
      where: {
        tenantId: tenant.id,
        userId: id,
        deletedAt: null,
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found' },
        { status: 404 },
      );
    }

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

    return NextResponse.json({ success: true, data: staffDto });
  } catch (error: unknown) {
    console.error('Error fetching staff member:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validation = updateStaffUserSchema.safeParse(body);
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
    const membership = await prisma.businessMembership.findFirst({
      where: {
        tenantId: tenant.id,
        userId: id,
        deletedAt: null,
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found' },
        { status: 404 },
      );
    }

    let roleId = membership.roleId;
    if (input.role && input.role !== membership.role.code) {
      let targetRole = await prisma.role.findFirst({
        where: {
          tenantId: tenant.id,
          code: input.role,
          deletedAt: null,
        },
      });
      if (!targetRole) {
        targetRole = await prisma.role.findFirst({
          where: {
            code: input.role,
            deletedAt: null,
          },
        });
      }
      if (!targetRole) {
        const roleNames: Record<StaffRole, string> = {
          OWNER: 'Store Owner',
          MANAGER: 'Store Manager',
          CASHIER: 'Cashier Staff',
        };
        targetRole = await prisma.role.create({
          data: {
            tenantId: tenant.id,
            code: input.role,
            name: roleNames[input.role] || input.role,
            description: `Role for ${input.role}`,
          },
        });
      }
      roleId = targetRole.id;
    }

    const userUpdateData: Record<string, unknown> = {};
    if (input.fullName) userUpdateData.fullName = input.fullName.trim();
    if (input.email) userUpdateData.email = input.email.toLowerCase().trim();
    if (input.phone !== undefined) userUpdateData.phone = input.phone?.trim() || null;
    if (input.password) {
      userUpdateData.passwordHash = await bcrypt.hash(input.password, 10);
    }
    if (input.pinCode !== undefined) {
      userUpdateData.pinCode = input.pinCode ? await bcrypt.hash(input.pinCode, 10) : null;
    }
    if (input.isActive !== undefined) {
      userUpdateData.isActive = input.isActive;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userUpdateData,
        });
      }

      return tx.businessMembership.update({
        where: { id: membership.id },
        data: {
          roleId,
          defaultBranchId: input.branchId !== undefined ? input.branchId || null : membership.defaultBranchId,
          status: input.isActive !== undefined ? (input.isActive ? 'ACTIVE' : 'SUSPENDED') : membership.status,
        },
        include: {
          user: true,
          role: true,
          defaultBranch: true,
        },
      });
    });

    const roleCode = (updated.role?.code as StaffRole) || 'CASHIER';
    const staffDto: StaffUserDto = {
      id: updated.user.id,
      email: updated.user.email,
      fullName: updated.user.fullName,
      phone: updated.user.phone || null,
      role: roleCode,
      roleName: updated.role?.name || roleCode,
      roleId: updated.roleId,
      hasPin: Boolean(updated.user.pinCode),
      isActive: updated.user.isActive && updated.status === 'ACTIVE',
      branchId: updated.defaultBranchId || null,
      branchName: updated.defaultBranch?.name || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: staffDto });
  } catch (error: unknown) {
    console.error('Error updating staff member:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const membership = await prisma.businessMembership.findFirst({
      where: {
        tenantId: tenant.id,
        userId: id,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Staff member not found' },
        { status: 404 },
      );
    }

    if (membership.role.code === 'OWNER') {
      const activeOwnerCount = await prisma.businessMembership.count({
        where: {
          tenantId: tenant.id,
          role: { code: 'OWNER' },
          deletedAt: null,
          status: 'ACTIVE',
        },
      });

      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove the sole owner of this organization.' },
          { status: 400 },
        );
      }
    }

    await prisma.businessMembership.update({
      where: { id: membership.id },
      data: {
        status: 'SUSPENDED',
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error: unknown) {
    console.error('Error deleting staff member:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
