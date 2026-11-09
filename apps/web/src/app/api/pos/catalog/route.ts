import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@pixelcraft/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId');
    const search = searchParams.get('search')?.trim();
    const categorySlug = searchParams.get('categorySlug');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1000', 10), 1), 3500);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const skip = (page - 1) * limit;

    // Resolve tenant
    let tenant = null;
    if (tenantIdParam) {
      tenant = await prisma.business.findUnique({ where: { id: tenantIdParam } });
    }
    if (!tenant) {
      tenant = await prisma.business.findUnique({ where: { slug: tenantSlug } });
    }

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const tenantId = tenant.id;

    // Fetch active categories with product counts for this tenant
    const categories = await prisma.category.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { products: { where: { deletedAt: null, isActive: true } } },
        },
      },
    });

    // Build product filter
    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: null,
      isActive: true,
    };

    if (categorySlug && categorySlug !== 'all') {
      where.category = {
        slug: categorySlug,
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Query products
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
          unit: { select: { id: true, name: true, shortCode: true } },
          stockLevels: { select: { quantityOnHand: true } },
        },
      }),
    ]);

    const formattedProducts = products.map((p) => {
      const stockOnHand = p.stockLevels.reduce(
        (sum, sl) => sum + Number(sl.quantityOnHand || 0),
        0,
      );

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        retailPrice: Number(p.retailPrice),
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : Number(p.retailPrice) * 0.9,
        costPrice: Number(p.costPrice),
        category: {
          id: p.category?.id || 'uncat',
          name: p.category?.name || 'Uncategorized',
          slug: p.category?.slug || 'uncategorized',
        },
        stockOnHand,
        unit: p.unit?.shortCode || 'pcs',
        alertQuantity: p.alertQuantity,
      };
    });

    const formattedCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.products,
    }));

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          currency: tenant.currency,
          businessType: tenant.businessType,
        },
        categories: formattedCategories,
        products: formattedProducts,
        total,
        page,
        limit,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load POS catalog';
    console.error('POS Catalog Route Handler error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
