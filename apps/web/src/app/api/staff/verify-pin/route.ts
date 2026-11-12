import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import type { StaffRole, StaffUserDto } from '@pixelcraft/types';

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

export async function POST(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const { pinCode } = await request.json();
    if (!pinCode || typeof pinCode !== 'string' || !/^\d{4}$/.test(pinCode)) {
      return NextResponse.json(
        { success: false, error: 'Valid 4-digit PIN is required' },
        { status: 400 },
      );
    }

    const memberships = await prisma.businessMembership.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'ACTIVE',
        user: {
          isActive: true,
          pinCode: { not: null },
          deletedAt: null,
        },
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
    });

    for (const m of memberships) {
      if (m.user.pinCode) {
        const match = await bcrypt.compare(pinCode, m.user.pinCode);
        if (match) {
          const roleCode = (m.role?.code as StaffRole) || 'CASHIER';
          const staffDto: StaffUserDto = {
            id: m.user.id,
            email: m.user.email,
            fullName: m.user.fullName,
            phone: m.user.phone || null,
            role: roleCode,
            roleName: m.role?.name || roleCode,
            roleId: m.roleId,
            hasPin: true,
            isActive: true,
            branchId: m.defaultBranchId || null,
            branchName: m.defaultBranch?.name || null,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
          };

          return NextResponse.json({ success: true, data: staffDto });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: 'Invalid PIN code.',
    });
  } catch (error: unknown) {
    console.error('Error verifying cashier PIN:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
