import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@pixelcraft/database';

interface CachedCatalogItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  stockOnHand: number;
  unit: string;
  alertQuantity: number | null;
  imageUrl?: string | null;
}

interface CachedCategoryItem {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface CatalogResponsePayload {
  tenant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    businessType: string;
  };
  categories: CachedCategoryItem[];
  products: CachedCatalogItem[];
  total: number;
  page: number;
  limit: number;
}

interface CachedCatalog {
  timestamp: number;
  data: CatalogResponsePayload;
}

// Server In-Memory Cache (Global singleton across Next.js API requests)
const memoryCache: Record<string, CachedCatalog> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const STALE_TTL_MS = 10 * 60 * 1000; // 10 minutes Stale-While-Revalidate window

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
};

async function fetchFreshCatalog(params: {
  tenantSlug: string;
  tenantIdParam: string | null;
  search?: string;
  categorySlug?: string | null;
  limit: number;
  page: number;
}): Promise<CatalogResponsePayload | null> {
  const { tenantSlug, tenantIdParam, search, categorySlug, limit, page } = params;
  const skip = (page - 1) * limit;

  // 1. Resolve tenant
  let tenant = null;
  if (tenantIdParam) {
    tenant = await prisma.business.findUnique({
      where: { id: tenantIdParam },
      select: { id: true, name: true, slug: true, currency: true, businessType: true },
    });
  }
  if (!tenant) {
    tenant = await prisma.business.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true, currency: true, businessType: true },
    });
  }

  if (!tenant) {
    return null;
  }

  const tenantId = tenant.id;

  // 2. Fetch active categories with product counts for this tenant
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

  // 3. Build product filter
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

  // 4. Query products with selective field projection
  const [total, products] = await Promise.all([
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
        imageUrl: true,
        retailPrice: true,
        wholesalePrice: true,
        costPrice: true,
        alertQuantity: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true } },
        unit: { select: { shortCode: true } },
        stockLevels: { select: { quantityOnHand: true } },
      },
    }),
  ]);

  const formattedProducts: CachedCatalogItem[] = products.map((p) => {
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
      imageUrl: p.imageUrl || null,
    };
  });

  const formattedCategories: CachedCategoryItem[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    count: c._count.products,
  }));

  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId');
    const search = searchParams.get('search')?.trim();
    const categorySlug = searchParams.get('categorySlug');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1000', 10), 1), 3500);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = `${tenantSlug}:${tenantIdParam || ''}:${categorySlug || 'all'}:${search || ''}:${limit}:${page}`;
    const cached = memoryCache[cacheKey];
    const now = Date.now();

    const ifNoneMatch = request.headers.get('if-none-match');
    const ifModifiedSince = request.headers.get('if-modified-since');

    // 1. Check in-memory cache
    if (!forceRefresh && cached) {
      const age = now - cached.timestamp;
      const etag = `W/"cat-${cached.timestamp}"`;

      // 1a. Conditional 304 Not Modified validation
      if (
        ifNoneMatch === etag ||
        (ifModifiedSince && new Date(ifModifiedSince).getTime() >= cached.timestamp)
      ) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ...CACHE_HEADERS,
            ETag: etag,
            'Last-Modified': new Date(cached.timestamp).toUTCString(),
            'X-Cache-Status': 'NOT_MODIFIED',
          },
        });
      }

      // Fresh cache hit (< 5 mins) -> Return in 0-2ms
      if (age < CACHE_TTL_MS) {
        return NextResponse.json(
          { success: true, data: cached.data },
          {
            headers: {
              ...CACHE_HEADERS,
              ETag: etag,
              'Last-Modified': new Date(cached.timestamp).toUTCString(),
              'X-Cache-Status': 'HIT',
              'X-Cache-Age-Ms': String(age),
            },
          },
        );
      }

      // Stale cache hit (5-10 mins) -> Return immediately and revalidate in background
      if (age < STALE_TTL_MS) {
        // Trigger background revalidation
        fetchFreshCatalog({ tenantSlug, tenantIdParam, search, categorySlug, limit, page })
          .then((freshData) => {
            if (freshData) {
              memoryCache[cacheKey] = { timestamp: Date.now(), data: freshData };
            }
          })
          .catch((err) => {
            console.warn('Background catalog revalidation error:', err);
          });

        return NextResponse.json(
          { success: true, data: cached.data },
          {
            headers: {
              ...CACHE_HEADERS,
              ETag: etag,
              'Last-Modified': new Date(cached.timestamp).toUTCString(),
              'X-Cache-Status': 'STALE-REVALIDATING',
              'X-Cache-Age-Ms': String(age),
            },
          },
        );
      }
    }

    // 2. Cache Miss or Force Refresh: Fetch directly from Supabase
    const data = await fetchFreshCatalog({
      tenantSlug,
      tenantIdParam,
      search,
      categorySlug,
      limit,
      page,
    });

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    // Store in memory cache
    memoryCache[cacheKey] = {
      timestamp: Date.now(),
      data,
    };

    const freshEtag = `W/"cat-${data ? Date.now() : 'empty'}"`;

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          ...CACHE_HEADERS,
          ETag: freshEtag,
          'Last-Modified': new Date().toUTCString(),
          'X-Cache-Status': 'MISS',
        },
      },
    );
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
