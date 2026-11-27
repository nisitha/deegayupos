import type { ApiResponse, PaginatedResult } from './api';

export type ProductType = 'STANDARD' | 'VARIABLE' | 'SERVICE' | 'BUNDLE';

export interface CategoryDto {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export interface CreateCategoryPayload {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
}

export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
}

export interface BrandDto {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandPayload {
  name: string;
  slug?: string;
}

export interface UpdateBrandPayload {
  name?: string;
  slug?: string;
}

export interface UnitDto {
  id: string;
  tenantId: string;
  name: string;
  shortCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitPayload {
  name: string;
  shortCode: string;
}

export interface UpdateUnitPayload {
  name?: string;
  shortCode?: string;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  costPrice?: number | null;
  retailPrice?: number | null;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductVariantPayload {
  id?: string;
  name: string;
  sku?: string;
  barcode?: string | null;
  costPrice?: number | null;
  retailPrice?: number | null;
  attributes?: Record<string, string>;
}

export interface ProductDto {
  id: string;
  tenantId?: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  name: string;
  slug?: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  type?: ProductType;
  costPrice?: number;
  retailPrice: number;
  purchasePrice?: number;
  stock?: number;
  wholesalePrice?: number | null;
  alertQuantity?: number;
  isTrackStock?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockSourceProductId?: string | null;
  stockConversionFactor?: number | null;
  category?: CategoryDto | null;
  brand?: BrandDto | null;
  unit?: UnitDto | null;
  variants?: ProductVariantDto[];
}

export interface CreateProductPayload {
  name: string;
  slug?: string;
  sku?: string;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  type?: ProductType;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  costPrice?: number;
  retailPrice: number;
  wholesalePrice?: number | null;
  alertQuantity?: number;
  isTrackStock?: boolean;
  isActive?: boolean;
  stockSourceProductId?: string | null;
  stockConversionFactor?: number | null;
  variants?: CreateProductVariantPayload[];
}

export interface UpdateProductPayload {
  name?: string;
  slug?: string;
  sku?: string;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  type?: ProductType;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  costPrice?: number;
  retailPrice?: number;
  wholesalePrice?: number | null;
  alertQuantity?: number;
  isTrackStock?: boolean;
  isActive?: boolean;
  stockSourceProductId?: string | null;
  stockConversionFactor?: number | null;
  variants?: CreateProductVariantPayload[];
}

export interface ProductLookupResult {
  product?: ProductDto | null;
  matchedVariant?: ProductVariantDto | null;
  found?: boolean;
}

export interface BulkImportRowError {
  index: number;
  sku?: string;
  name?: string;
  error: string;
}

export interface BulkImportResult {
  total: number;
  inserted: number;
  errors: BulkImportRowError[];
  importedCount?: number;
  skippedCount?: number;
}

export type ProductResponse = ApiResponse<ProductDto>;
export type ProductListResponse = ApiResponse<PaginatedResult<ProductDto>>;
export type ProductLookupResponse = ApiResponse<ProductLookupResult>;
export type CategoryListResponse = ApiResponse<CategoryDto[]>;
export type BrandListResponse = ApiResponse<BrandDto[]>;
export type UnitListResponse = ApiResponse<UnitDto[]>;
export type BulkImportResponse = ApiResponse<BulkImportResult>;

