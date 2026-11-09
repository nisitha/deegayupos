import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@pixelcraft/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const search = searchParams.get('search')?.trim();
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status')?.toUpperCase();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 100);
    const skip = (page - 1) * limit;

    // 1. Resolve tenant
    let tenant = null;
    if (tenantIdParam) {
      tenant = await prisma.business.findUnique({
        where: { id: tenantIdParam },
        select: { id: true, name: true, slug: true, currency: true },
      });
    }
    if (!tenant) {
      tenant = await prisma.business.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, name: true, slug: true, currency: true },
      });
    }

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const tenantId = tenant.id;

    // 2. Build Prisma Filter
    const where: Prisma.ProductWhereInput = {
      tenantId,
    };

    if (status === 'ARCHIVED') {
      where.deletedAt = { not: null };
    } else if (status === 'DRAFT') {
      where.deletedAt = null;
      where.isActive = false;
    } else if (status === 'ACTIVE') {
      where.deletedAt = null;
      where.isActive = true;
    } else {
      where.deletedAt = null;
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 3. Concurrently fetch products count, items, and active categories
    const [total, products, categories] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          costPrice: true,
          retailPrice: true,
          wholesalePrice: true,
          type: true,
          isActive: true,
          deletedAt: true,
          category: { select: { id: true, name: true, slug: true } },
          stockLevels: { select: { quantityOnHand: true } },
        },
      }),
      prisma.category.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const formattedProducts = products.map((p) => {
      const stockOnHand = p.stockLevels.reduce(
        (acc, sl) => acc + Number(sl.quantityOnHand || 0),
        0,
      );

      return {
        id: p.id,
        tenantId,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || null,
        costPrice: Number(p.costPrice),
        retailPrice: Number(p.retailPrice),
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
        status: p.deletedAt ? 'ARCHIVED' : p.isActive ? 'ACTIVE' : 'DRAFT',
        productType: p.type || 'STANDARD',
        type: p.type || 'STANDARD',
        isActive: p.isActive,
        category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
        categoryId: p.category?.id || null,
        stockOnHand,
        stock: stockOnHand,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json(
      {
        success: true,
        data: {
          products: formattedProducts,
          total,
          page,
          totalPages,
          limit,
          categories,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            currency: tenant.currency,
          },
        },
        products: formattedProducts,
        total,
        page,
        totalPages,
        limit,
        categories,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query products catalog';
    console.error('Products API Route error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
