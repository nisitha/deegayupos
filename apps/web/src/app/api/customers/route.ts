import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma, CustomerType, CustomerStatus } from '@pixelcraft/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const search = searchParams.get('search')?.trim();
    const customerType = searchParams.get('customerType')?.toUpperCase();
    const status = searchParams.get('status')?.toUpperCase();
    const hasDebtOnly = searchParams.get('hasDebtOnly') === 'true';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const skip = (page - 1) * limit;

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

    const tenantId = tenant.id;
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (customerType && customerType !== 'ALL') {
      where.customerType = customerType as CustomerType;
    }

    if (status && status !== 'ALL') {
      where.status = status as CustomerStatus;
    }

    if (hasDebtOnly) {
      where.currentBalance = { gt: 0 };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nicNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Telemetry and customers fetched in parallel
    const [total, customers, telemetryTotalCust, telemetryActiveCredit, telemetryAgg] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ currentBalance: 'desc' }, { updatedAt: 'desc' }],
        include: {
          _count: {
            select: {
              sales: true,
              ledgerEntries: true,
              payments: true,
            },
          },
        },
      }),
      prisma.customer.count({
        where: { tenantId, deletedAt: null },
      }),
      prisma.customer.count({
        where: { tenantId, deletedAt: null, currentBalance: { gt: 0 } },
      }),
      prisma.customer.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: {
          currentBalance: true,
          creditLimit: true,
        },
      }),
    ]);

    const formattedCustomers = customers.map((c) => {
      const creditLimit = Number(c.creditLimit || 0);
      const currentBalance = Number(c.currentBalance || 0);
      const availableCredit = Math.max(0, creditLimit - currentBalance);

      return {
        id: c.id,
        tenantId: c.tenantId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        nicNumber: c.nicNumber,
        address: c.address,
        customerType: c.customerType,
        creditLimit,
        currentBalance,
        availableCredit,
        loyaltyPoints: c.loyaltyPoints || 0,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        _count: c._count,
      };
    });

    const telemetry = {
      totalCustomers: telemetryTotalCust,
      totalReceivables: Number(telemetryAgg._sum.currentBalance || 0),
      activeCreditAccounts: telemetryActiveCredit,
      totalCreditLimit: Number(telemetryAgg._sum.creditLimit || 0),
    };

    return NextResponse.json({
      success: true,
      items: formattedCustomers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      telemetry,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || body.tenantSlug || 'deegayu';
    const tenantIdParam = body.tenantId || searchParams.get('tenantId') || request.headers.get('x-tenant-id');

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

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 },
      );
    }

    const created = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        nicNumber: body.nicNumber?.trim() || null,
        address: body.address?.trim() || null,
        customerType: body.customerType || 'WALK_IN',
        creditLimit: body.creditLimit ? parseFloat(String(body.creditLimit)) : 0,
        currentBalance: 0,
        loyaltyPoints: body.loyaltyPoints ? parseInt(String(body.loyaltyPoints), 10) : 0,
        status: 'ACTIVE',
      },
    });

    const creditLimit = Number(created.creditLimit);
    const currentBalance = Number(created.currentBalance);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          tenantId: created.tenantId,
          name: created.name,
          phone: created.phone,
          email: created.email,
          nicNumber: created.nicNumber,
          address: created.address,
          customerType: created.customerType,
          creditLimit,
          currentBalance,
          availableCredit: Math.max(0, creditLimit - currentBalance),
          loyaltyPoints: created.loyaltyPoints,
          status: created.status,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
  }
}
