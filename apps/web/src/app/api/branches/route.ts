import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');

    // 1. Resolve tenant
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
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    // 2. Fetch all active branches for this tenant with their registers and default warehouse
    const branches = await prisma.branch.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
      },
      include: {
        registers: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, name: true, code: true, isActive: true },
        },
        warehouses: {
          where: { deletedAt: null, isActive: true },
          select: { id: true, name: true, isDefault: true },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: branches,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve branches';
    console.error('API /api/branches GET Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');

    // 1. Resolve tenant
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
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      name,
      code,
      phone,
      address,
      registerCode = 'REG-01',
      registerName = 'Primary Terminal',
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Branch name is required' },
        { status: 400 },
      );
    }

    const cleanCode = (code || name.slice(0, 3)).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!cleanCode) {
      return NextResponse.json(
        { success: false, error: 'Valid branch code is required' },
        { status: 400 },
      );
    }

    // 3. Check for existing branch code under this tenant
    const existing = await prisma.branch.findFirst({
      where: {
        tenantId: tenant.id,
        code: cleanCode,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Branch code '${cleanCode}' is already in use by another branch` },
        { status: 409 },
      );
    }

    // 4. Count existing branches to determine primary flag
    const branchCount = await prisma.branch.count({
      where: { tenantId: tenant.id, deletedAt: null },
    });
    const isPrimary = branchCount === 0;

    // 5. Execute creation within a transaction (Branch + Default Warehouse + Primary Register)
    const result = await prisma.$transaction(async (tx) => {
      // Create Branch
      const newBranch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: name.trim(),
          code: cleanCode,
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
          isPrimary,
          isActive: true,
        },
      });

      // Create default warehouse for this branch
      const newWarehouse = await tx.warehouse.create({
        data: {
          tenantId: tenant.id,
          branchId: newBranch.id,
          name: `${newBranch.name} Main Stock`,
          isDefault: true,
          isActive: true,
        },
      });

      // Create primary POS register for this branch
      const cleanRegCode = (registerCode || 'REG-01').trim().toUpperCase();
      const newRegister = await tx.register.create({
        data: {
          tenantId: tenant.id,
          branchId: newBranch.id,
          name: registerName || 'Primary Terminal',
          code: cleanRegCode,
          isActive: true,
        },
      });

      return {
        ...newBranch,
        warehouses: [newWarehouse],
        registers: [newRegister],
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Branch '${result.name}' (${result.code}) created successfully with primary register and warehouse`,
    }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create branch';
    console.error('API /api/branches POST Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
