import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@pixelcraft/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status')?.toUpperCase();
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
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              purchaseOrders: true,
              goodsReceivedNotes: true,
            },
          },
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: suppliers.map((s) => ({
          id: s.id,
          tenantId: s.tenantId,
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson,
          phone: s.phone,
          email: s.email,
          address: s.address,
          taxNumber: s.taxNumber,
          paymentTerms: s.paymentTerms,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          _count: {
            purchaseOrders: s._count?.purchaseOrders || 0,
            goodsReceivedNotes: s._count?.goodsReceivedNotes || 0,
          },
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    console.error('Error fetching suppliers:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug = 'deegayu', name, code, contactPerson, phone, email, address, taxNumber, paymentTerms } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Supplier name is required' },
        { status: 400 },
      );
    }

    const tenant = await prisma.business.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 },
      );
    }

    let supplierCode = code ? code.trim().toUpperCase() : '';
    if (!supplierCode) {
      const count = await prisma.supplier.count({ where: { tenantId: tenant.id } });
      supplierCode = `SUP-${String(count + 1).padStart(3, '0')}`;
    }

    const created = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        code: supplierCode,
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        taxNumber: taxNumber?.trim() || null,
        paymentTerms: paymentTerms?.trim() || 'NET_30',
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err: unknown) {
    console.error('Error creating supplier:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

