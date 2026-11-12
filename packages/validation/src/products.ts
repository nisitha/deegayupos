import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  parentId: z.string().uuid('Invalid parent category UUID').optional().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(255),
  slug: z.string().min(1).max(255).optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').max(128),
  shortCode: z.string().min(1, 'Unit code is required').max(32),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = createUnitSchema.partial();
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const createProductVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required').max(255),
  sku: z.string().min(1).max(128).optional(),
  barcode: z.string().max(128).optional().nullable(),
  costPrice: z.coerce.number().min(0).optional().nullable(),
  retailPrice: z.coerce.number().min(0).optional().nullable(),
  attributes: z.record(z.string(), z.string()).default({}),
});

export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  slug: z.string().min(1).max(255).optional(),
  sku: z.string().min(1).max(128).optional(),
  barcode: z.string().max(128).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  type: z.enum(['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE']).default('STANDARD'),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  costPrice: z.coerce.number().min(0).default(0),
  retailPrice: z.coerce.number().min(0, 'Retail price must be >= 0'),
  wholesalePrice: z.coerce.number().min(0).optional().nullable(),
  alertQuantity: z.coerce.number().int().min(0).default(5),
  isTrackStock: z.boolean().default(true),
  isActive: z.boolean().default(true),
  variants: z.array(createProductVariantSchema).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().max(255).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  type: z.enum(['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE']).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export const productLookupQuerySchema = z.object({
  barcode: z.string().optional(),
  sku: z.string().optional(),
});

export type ProductLookupQueryInput = z.infer<typeof productLookupQuerySchema>;

export const bulkImportProductSchema = z.object({
  products: z.array(createProductSchema).min(1, 'At least 1 product must be provided').max(1000),
});

export type BulkImportProductInput = z.infer<typeof bulkImportProductSchema>;

