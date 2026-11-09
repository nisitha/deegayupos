import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BrandDto,
  BulkImportResult,
  CategoryDto,
  CreateBrandPayload,
  CreateCategoryPayload,
  CreateProductPayload,
  CreateUnitPayload,
  PaginatedResult,
  ProductDto,
  ProductLookupResult,
  ProductVariantDto,
  UnitDto,
  UpdateBrandPayload,
  UpdateCategoryPayload,
  UpdateProductPayload,
  UpdateUnitPayload,
} from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';
import type { ProductQueryDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // FORMATTING HELPERS
  // ==========================================

  private formatCategory(c: any): CategoryDto {
    return {
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
      productCount: c._count?.products,
    };
  }

  private formatBrand(b: any): BrandDto {
    return {
      id: b.id,
      tenantId: b.tenantId,
      name: b.name,
      slug: b.slug,
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
      updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt,
    };
  }

  private formatUnit(u: any): UnitDto {
    return {
      id: u.id,
      tenantId: u.tenantId,
      name: u.name,
      shortCode: u.shortCode,
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
      updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
    };
  }

  private formatVariant(v: any): ProductVariantDto {
    return {
      id: v.id,
      productId: v.productId,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      costPrice: v.costPrice !== null && v.costPrice !== undefined ? Number(v.costPrice) : null,
      retailPrice:
        v.retailPrice !== null && v.retailPrice !== undefined ? Number(v.retailPrice) : null,
      attributes: (v.attributes as Record<string, string>) || {},
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
      updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : v.updatedAt,
    };
  }

  private formatProduct(p: any): ProductDto {
    return {
      id: p.id,
      tenantId: p.tenantId,
      categoryId: p.categoryId,
      brandId: p.brandId,
      unitId: p.unitId,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      barcode: p.barcode,
      description: p.description,
      type: p.type,
      costPrice: Number(p.costPrice || 0),
      retailPrice: Number(p.retailPrice || 0),
      wholesalePrice:
        p.wholesalePrice !== null && p.wholesalePrice !== undefined
          ? Number(p.wholesalePrice)
          : null,
      alertQuantity: p.alertQuantity,
      isTrackStock: p.isTrackStock,
      isActive: p.isActive,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
      category: p.category ? this.formatCategory(p.category) : null,
      brand: p.brand ? this.formatBrand(p.brand) : null,
      unit: p.unit ? this.formatUnit(p.unit) : null,
      variants: Array.isArray(p.variants) ? p.variants.map((v: any) => this.formatVariant(v)) : [],
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private generateSku(name: string): string {
    const cleanPrefix = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${cleanPrefix || 'PRD'}-${randomSuffix}`;
  }

  // ==========================================
  // TAXONOMY: CATEGORIES
  // ==========================================

  async getCategories(tenantId: string): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map((c) => this.formatCategory(c));
  }

  async createCategory(
    tenantId: string,
    userId: string,
    dto: CreateCategoryPayload,
  ): Promise<CategoryDto> {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    const existing = await this.prisma.category.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (existing) {
      throw new ConflictException(
        `Category with slug '${slug}' already exists in this organization.`,
      );
    }

    const category = await this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description || null,
        parentId: dto.parentId || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CATEGORY_CREATED',
        entity: 'Category',
        entityId: category.id,
        newValues: JSON.parse(JSON.stringify(category)),
      },
    });

    return this.formatCategory(category);
  }

  async updateCategory(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCategoryPayload,
  ): Promise<CategoryDto> {
    const existing = await this.prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;
    if (dto.slug !== undefined) {
      const slug = this.slugify(dto.slug);
      if (slug !== existing.slug) {
        const conflict = await this.prisma.category.findUnique({
          where: { tenantId_slug: { tenantId, slug } },
        });
        if (conflict) {
          throw new ConflictException(`Category slug '${slug}' already in use.`);
        }
        updateData.slug = slug;
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CATEGORY_UPDATED',
        entity: 'Category',
        entityId: updated.id,
        oldValues: JSON.parse(JSON.stringify(existing)),
        newValues: JSON.parse(JSON.stringify(updated)),
      },
    });

    return this.formatCategory(updated);
  }

  async deleteCategory(tenantId: string, userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CATEGORY_DELETED',
        entity: 'Category',
        entityId: id,
      },
    });

    return { success: true };
  }

  // ==========================================
  // TAXONOMY: BRANDS
  // ==========================================

  async getBrands(tenantId: string): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return brands.map((b) => this.formatBrand(b));
  }

  async createBrand(tenantId: string, userId: string, dto: CreateBrandPayload): Promise<BrandDto> {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    const existing = await this.prisma.brand.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (existing) {
      throw new ConflictException(`Brand with slug '${slug}' already exists.`);
    }

    const brand = await this.prisma.brand.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'BRAND_CREATED',
        entity: 'Brand',
        entityId: brand.id,
        newValues: JSON.parse(JSON.stringify(brand)),
      },
    });

    return this.formatBrand(brand);
  }

  async updateBrand(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateBrandPayload,
  ): Promise<BrandDto> {
    const existing = await this.prisma.brand.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Brand not found.');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) {
      const slug = this.slugify(dto.slug);
      if (slug !== existing.slug) {
        const conflict = await this.prisma.brand.findUnique({
          where: { tenantId_slug: { tenantId, slug } },
        });
        if (conflict) {
          throw new ConflictException(`Brand slug '${slug}' already in use.`);
        }
        updateData.slug = slug;
      }
    }

    const updated = await this.prisma.brand.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'BRAND_UPDATED',
        entity: 'Brand',
        entityId: updated.id,
        oldValues: JSON.parse(JSON.stringify(existing)),
        newValues: JSON.parse(JSON.stringify(updated)),
      },
    });

    return this.formatBrand(updated);
  }

  async deleteBrand(tenantId: string, userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.brand.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Brand not found.');
    }

    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'BRAND_DELETED',
        entity: 'Brand',
        entityId: id,
      },
    });

    return { success: true };
  }

  // ==========================================
  // TAXONOMY: UNITS
  // ==========================================

  async getUnits(tenantId: string): Promise<UnitDto[]> {
    const units = await this.prisma.unit.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return units.map((u) => this.formatUnit(u));
  }

  async createUnit(tenantId: string, userId: string, dto: CreateUnitPayload): Promise<UnitDto> {
    const shortCode = dto.shortCode.trim().toLowerCase();

    const existing = await this.prisma.unit.findUnique({
      where: { tenantId_shortCode: { tenantId, shortCode } },
    });
    if (existing) {
      throw new ConflictException(`Unit with code '${shortCode}' already exists.`);
    }

    const unit = await this.prisma.unit.create({
      data: {
        tenantId,
        name: dto.name,
        shortCode,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'UNIT_CREATED',
        entity: 'Unit',
        entityId: unit.id,
        newValues: JSON.parse(JSON.stringify(unit)),
      },
    });

    return this.formatUnit(unit);
  }

  async updateUnit(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateUnitPayload,
  ): Promise<UnitDto> {
    const existing = await this.prisma.unit.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Unit not found.');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.shortCode !== undefined) {
      const shortCode = dto.shortCode.trim().toLowerCase();
      if (shortCode !== existing.shortCode) {
        const conflict = await this.prisma.unit.findUnique({
          where: { tenantId_shortCode: { tenantId, shortCode } },
        });
        if (conflict) {
          throw new ConflictException(`Unit short code '${shortCode}' already in use.`);
        }
        updateData.shortCode = shortCode;
      }
    }

    const updated = await this.prisma.unit.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'UNIT_UPDATED',
        entity: 'Unit',
        entityId: updated.id,
        oldValues: JSON.parse(JSON.stringify(existing)),
        newValues: JSON.parse(JSON.stringify(updated)),
      },
    });

    return this.formatUnit(updated);
  }

  async deleteUnit(tenantId: string, userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.unit.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Unit not found.');
    }

    await this.prisma.unit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'UNIT_DELETED',
        entity: 'Unit',
        entityId: id,
      },
    });

    return { success: true };
  }

  // ==========================================
  // PRODUCTS CRUD & LOOKUP
  // ==========================================

  async getProducts(
    tenantId: string,
    query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductDto>> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          brand: true,
          unit: true,
          variants: { where: { deletedAt: null } },
        },
      }),
    ]);

    return {
      items: items.map((p) => this.formatProduct(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getProductById(tenantId: string, id: string): Promise<ProductDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        brand: true,
        unit: true,
        variants: { where: { deletedAt: null } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found.`);
    }

    return this.formatProduct(product);
  }

  /**
   * High-speed barcode / SKU scanner lookup optimized for POS checkout.
   */
  async lookup(
    tenantId: string,
    barcode?: string,
    sku?: string,
  ): Promise<ProductLookupResult> {
    if (!barcode && !sku) {
      throw new BadRequestException('Either barcode or SKU must be provided for lookup.');
    }

    const searchTerm = barcode ? barcode.trim() : sku!.trim();

    // 1. Direct search on Product
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: barcode ? [{ barcode: searchTerm }, { sku: searchTerm }] : [{ sku: searchTerm }],
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        variants: { where: { deletedAt: null } },
      },
    });

    if (product) {
      return {
        product: this.formatProduct(product),
        matchedVariant: null,
      };
    }

    // 2. Search linked ProductVariant
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: barcode ? [{ barcode: searchTerm }, { sku: searchTerm }] : [{ sku: searchTerm }],
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            unit: true,
            variants: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (variant && variant.product) {
      return {
        product: this.formatProduct(variant.product),
        matchedVariant: this.formatVariant(variant),
      };
    }

    throw new NotFoundException(
      `No product or variant found matching query '${searchTerm}'.`,
    );
  }

  /**
   * Creates a product with strict tenant uniqueness and multi-variant support.
   */
  async createProduct(
    tenantId: string,
    userId: string,
    dto: CreateProductPayload,
  ): Promise<ProductDto> {
    const sku = dto.sku ? dto.sku.trim().toUpperCase() : this.generateSku(dto.name);
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    const barcode = dto.barcode ? dto.barcode.trim() : null;

    // Strict tenant-scoped uniqueness validation
    const existingSku = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku } },
    });
    if (existingSku) {
      throw new ConflictException(
        `Product with SKU '${sku}' already exists in this organization.`,
      );
    }

    if (barcode) {
      const existingBarcode = await this.prisma.product.findUnique({
        where: { tenantId_barcode: { tenantId, barcode } },
      });
      if (existingBarcode) {
        throw new ConflictException(
          `Product with barcode '${barcode}' already exists in this organization.`,
        );
      }
    }

    // Interactive Transaction
    const createdProduct = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          name: dto.name,
          slug,
          sku,
          barcode,
          description: dto.description || null,
          type: dto.type || 'STANDARD',
          categoryId: dto.categoryId || null,
          brandId: dto.brandId || null,
          unitId: dto.unitId || null,
          costPrice: dto.costPrice !== undefined ? dto.costPrice : 0.0,
          retailPrice: dto.retailPrice,
          wholesalePrice: dto.wholesalePrice !== undefined ? dto.wholesalePrice : null,
          alertQuantity: dto.alertQuantity !== undefined ? dto.alertQuantity : 5,
          isTrackStock: dto.isTrackStock !== undefined ? dto.isTrackStock : true,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
      });

      if (dto.variants && dto.variants.length > 0) {
        for (let i = 0; i < dto.variants.length; i++) {
          const v = dto.variants[i]!;
          const varSku = v.sku
            ? v.sku.trim().toUpperCase()
            : `${sku}-${v.name.slice(0, 3).toUpperCase()}-${i + 1}`;
          const varBarcode = v.barcode ? v.barcode.trim() : null;

          await tx.productVariant.create({
            data: {
              tenantId,
              productId: product.id,
              name: v.name,
              sku: varSku,
              barcode: varBarcode,
              costPrice: v.costPrice !== undefined ? v.costPrice : null,
              retailPrice: v.retailPrice !== undefined ? v.retailPrice : null,
              attributes: v.attributes || {},
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PRODUCT_CREATED',
          entity: 'Product',
          entityId: product.id,
          newValues: JSON.parse(JSON.stringify(product)),
        },
      });

      return product;
    });

    return this.getProductById(tenantId, createdProduct.id);
  }

  async updateProduct(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateProductPayload,
  ): Promise<ProductDto> {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.brandId !== undefined) updateData.brandId = dto.brandId;
    if (dto.unitId !== undefined) updateData.unitId = dto.unitId;
    if (dto.costPrice !== undefined) updateData.costPrice = dto.costPrice;
    if (dto.retailPrice !== undefined) updateData.retailPrice = dto.retailPrice;
    if (dto.wholesalePrice !== undefined) updateData.wholesalePrice = dto.wholesalePrice;
    if (dto.alertQuantity !== undefined) updateData.alertQuantity = dto.alertQuantity;
    if (dto.isTrackStock !== undefined) updateData.isTrackStock = dto.isTrackStock;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.type !== undefined) updateData.type = dto.type;

    if (dto.sku !== undefined) {
      const sku = dto.sku.trim().toUpperCase();
      if (sku !== existing.sku) {
        const conflict = await this.prisma.product.findUnique({
          where: { tenantId_sku: { tenantId, sku } },
        });
        if (conflict) {
          throw new ConflictException(`Product SKU '${sku}' already in use.`);
        }
        updateData.sku = sku;
      }
    }

    if (dto.barcode !== undefined) {
      const barcode = dto.barcode ? dto.barcode.trim() : null;
      if (barcode !== existing.barcode && barcode !== null) {
        const conflict = await this.prisma.product.findUnique({
          where: { tenantId_barcode: { tenantId, barcode } },
        });
        if (conflict) {
          throw new ConflictException(`Product barcode '${barcode}' already in use.`);
        }
      }
      updateData.barcode = barcode;
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: updateData,
      });

      if (dto.variants && Array.isArray(dto.variants)) {
        for (const v of dto.variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: v.sku?.trim().toUpperCase(),
                barcode: v.barcode?.trim() || null,
                costPrice: v.costPrice,
                retailPrice: v.retailPrice,
                attributes: v.attributes,
              },
            });
          } else {
            const varSku = v.sku?.trim().toUpperCase() || this.generateSku(v.name);
            await tx.productVariant.create({
              data: {
                tenantId,
                productId: id,
                name: v.name,
                sku: varSku,
                barcode: v.barcode?.trim() || null,
                costPrice: v.costPrice,
                retailPrice: v.retailPrice,
                attributes: v.attributes || {},
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PRODUCT_UPDATED',
          entity: 'Product',
          entityId: updated.id,
          oldValues: JSON.parse(JSON.stringify(existing)),
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });
    });

    return this.getProductById(tenantId, id);
  }

  async deleteProduct(tenantId: string, userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'PRODUCT_DELETED',
          entity: 'Product',
          entityId: id,
        },
      });
    });

    return { success: true };
  }

  // ==========================================
  // BULK INGESTION & EXPORT
  // ==========================================

  async bulkImport(
    tenantId: string,
    userId: string,
    products: CreateProductPayload[],
  ): Promise<BulkImportResult> {
    const errors: Array<{ index: number; sku?: string; name?: string; error: string }> = [];
    let inserted = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i]!;
      try {
        await this.createProduct(tenantId, userId, p);
        inserted++;
      } catch (err: any) {
        errors.push({
          index: i + 1,
          sku: p.sku,
          name: p.name,
          error: err.message || 'Failed to insert product record',
        });
      }
    }

    return {
      total: products.length,
      inserted,
      errors,
    };
  }

  async exportProducts(tenantId: string): Promise<ProductDto[]> {
    const products = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        category: true,
        brand: true,
        unit: true,
        variants: { where: { deletedAt: null } },
      },
    });

    return products.map((p) => this.formatProduct(p));
  }
}

