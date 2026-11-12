/**
 * Backwards-compatible export mapping to apps/web/src/lib/catalog-db.ts
 */

import {
  getCachedCatalogData,
  setCachedCatalogData,
  clearCachedCatalogData,
  buildProductSearchIndex,
  searchIndexedProducts,
  type CachedCatalogPayload,
  type CachedCategoryItem,
} from './catalog-db';

export {
  getCachedCatalogData,
  setCachedCatalogData,
  clearCachedCatalogData,
  buildProductSearchIndex,
  searchIndexedProducts,
  type CachedCatalogPayload,
  type CachedCategoryItem,
};

export interface CachedCatalogData<T> {
  timestamp: number;
  products: T[];
  categories: CachedCategoryItem[];
  total: number;
}

export async function getCachedCatalog<T>(
  tenantSlug: string = 'deegayu'
): Promise<CachedCatalogData<T> | null> {
  const data = await getCachedCatalogData<T>(tenantSlug);
  if (!data) return null;
  return {
    timestamp: data.cachedAt,
    products: data.products,
    categories: data.categories,
    total: data.total,
  };
}

export async function saveCachedCatalog<T>(
  tenantSlug: string = 'deegayu',
  data: {
    products: T[];
    categories: CachedCategoryItem[];
    total: number;
  }
): Promise<void> {
  await setCachedCatalogData<T>(tenantSlug, {
    products: data.products,
    categories: data.categories,
    total: data.total,
  });
}
