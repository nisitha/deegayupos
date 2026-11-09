import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma, PurchaseOrderStatus } from '@pixelcraft/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status')?.toUpperCase();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
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
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (status && status !== 'ALL') {
      where.status = status as PurchaseOrderStatus;
    }

    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = records.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: r.branch.name,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      poNumber: r.poNumber,
      status: r.status,
      orderDate: r.orderDate.toISOString(),
      expectedDate: r.expectedDate ? r.expectedDate.toISOString() : null,
      subtotal: Number(r.subtotal),
      taxAmount: Number(r.taxAmount),
      totalAmount: Number(r.totalAmount),
      notes: r.notes,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        productSku: i.product?.sku,
        orderedQuantity: Number(i.orderedQuantity),
        receivedQuantity: Number(i.receivedQuantity),
        unitCost: Number(i.unitCost),
        subtotal: Number(i.subtotal),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    console.error('Error fetching purchase orders:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug = 'deegayu', branchId, supplierId, orderDate, expectedDate, notes, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one line item is required' },
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

    // Resolve branch
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { tenantId: tenant.id, isActive: true },
      });
      targetBranchId = defaultBranch?.id;
    }

    if (!targetBranchId) {
      return NextResponse.json(
        { success: false, error: 'Target branch is required' },
        { status: 400 },
      );
    }

    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count({ where: { tenantId: tenant.id } });
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

    let subtotal = 0;
    for (const item of items) {
      subtotal += Number(item.orderedQuantity) * Number(item.unitCost);
    }

    const created = await prisma.purchaseOrder.create({
      data: {
        tenantId: tenant.id,
        branchId: targetBranchId,
        supplierId,
        poNumber,
        status: 'SUBMITTED',
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        notes: notes || null,
        items: {
          create: items.map((i: { productId: string; orderedQuantity: number; unitCost: number }) => ({
            tenantId: tenant.id,
            productId: i.productId,
            orderedQuantity: Number(i.orderedQuantity),
            receivedQuantity: 0,
            unitCost: Number(i.unitCost),
            subtotal: Number(i.orderedQuantity) * Number(i.unitCost),
          })),
        },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err: unknown) {
    console.error('Error creating purchase order:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
