import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthTenant, AuthUser } from '@pixelcraft/types';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../src/common/decorators/permissions.decorator';
import { ProductsService } from '../src/modules/products/products.service';
import { ProductsController } from '../src/modules/products/products.controller';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Phase 07: Product & Catalogue Management Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';

  const USER_ALPHA_MANAGER: AuthUser = {
    id: 'uuuuuuuu-1111-1111-1111-111111111111',
    email: 'manager@alpha.com',
    fullName: 'Alpha Manager',
    isActive: true,
    role: 'MANAGER',
  };

  const USER_ALPHA_CASHIER: AuthUser = {
    id: 'uuuuuuuu-2222-2222-2222-222222222222',
    email: 'cashier@alpha.com',
    fullName: 'Alpha Cashier',
    isActive: true,
    role: 'CASHIER',
  };

  const USER_BETA_OWNER: AuthUser = {
    id: 'uuuuuuuu-3333-3333-3333-333333333333',
    email: 'owner@beta.com',
    fullName: 'Beta Owner',
    isActive: true,
    role: 'OWNER',
  };

  const TENANT_ALPHA: AuthTenant = {
    id: TENANT_ALPHA_ID,
    name: 'Alpha Retail Store',
    slug: 'alpha-retail',
    role: 'OWNER',
    roleId: 'role-owner-id',
    status: 'ACTIVE',
  };

  const TENANT_BETA: AuthTenant = {
    id: TENANT_BETA_ID,
    name: 'Beta Store',
    slug: 'beta-store',
    role: 'OWNER',
    roleId: 'role-owner-beta-id',
    status: 'ACTIVE',
  };

  let mockPrisma: any;
  let productsService: ProductsService;
  let productsController: ProductsController;
  let reflector: Reflector;
  let permissionsGuard: PermissionsGuard;

  // In-memory data store for isolated testing
  let inMemoryCategories: any[] = [];
  let inMemoryBrands: any[] = [];
  let inMemoryUnits: any[] = [];
  let inMemoryProducts: any[] = [];
  let inMemoryVariants: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryCategories = [];
    inMemoryBrands = [];
    inMemoryUnits = [];
    inMemoryProducts = [];
    inMemoryVariants = [];
    inMemoryAuditLogs = [];

    mockPrisma = {
      $transaction: vi.fn(async (callback: any) => {
        return callback(mockPrisma);
      }),
      category: {
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryCategories.filter(
            (c) => c.tenantId === where.tenantId && (!where.deletedAt ? c.deletedAt === null : true),
          );
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            inMemoryCategories.find(
              (c) =>
                c.id === where.id &&
                c.tenantId === where.tenantId &&
                (!where.deletedAt ? c.deletedAt === null : true),
            ) || null
          );
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.tenantId_slug) {
            return (
              inMemoryCategories.find(
                (c) =>
                  c.tenantId === where.tenantId_slug.tenantId &&
                  c.slug === where.tenantId_slug.slug &&
                  c.deletedAt === null,
              ) || null
            );
          }
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const cat = {
            id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryCategories.push(cat);
          return cat;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const index = inMemoryCategories.findIndex((c) => c.id === where.id);
          if (index !== -1) {
            inMemoryCategories[index] = {
              ...inMemoryCategories[index],
              ...data,
              updatedAt: new Date(),
            };
            return inMemoryCategories[index];
          }
          return null;
        }),
      },
      brand: {
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryBrands.filter(
            (b) => b.tenantId === where.tenantId && (!where.deletedAt ? b.deletedAt === null : true),
          );
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            inMemoryBrands.find(
              (b) =>
                b.id === where.id &&
                b.tenantId === where.tenantId &&
                (!where.deletedAt ? b.deletedAt === null : true),
            ) || null
          );
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.tenantId_slug) {
            return (
              inMemoryBrands.find(
                (b) =>
                  b.tenantId === where.tenantId_slug.tenantId &&
                  b.slug === where.tenantId_slug.slug &&
                  b.deletedAt === null,
              ) || null
            );
          }
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const brand = {
            id: `brand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryBrands.push(brand);
          return brand;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const index = inMemoryBrands.findIndex((b) => b.id === where.id);
          if (index !== -1) {
            inMemoryBrands[index] = {
              ...inMemoryBrands[index],
              ...data,
              updatedAt: new Date(),
            };
            return inMemoryBrands[index];
          }
          return null;
        }),
      },
      unit: {
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryUnits.filter(
            (u) => u.tenantId === where.tenantId && (!where.deletedAt ? u.deletedAt === null : true),
          );
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            inMemoryUnits.find(
              (u) =>
                u.id === where.id &&
                u.tenantId === where.tenantId &&
                (!where.deletedAt ? u.deletedAt === null : true),
            ) || null
          );
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.tenantId_shortCode) {
            return (
              inMemoryUnits.find(
                (u) =>
                  u.tenantId === where.tenantId_shortCode.tenantId &&
                  u.shortCode === where.tenantId_shortCode.shortCode &&
                  u.deletedAt === null,
              ) || null
            );
          }
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const unit = {
            id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryUnits.push(unit);
          return unit;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const index = inMemoryUnits.findIndex((u) => u.id === where.id);
          if (index !== -1) {
            inMemoryUnits[index] = {
              ...inMemoryUnits[index],
              ...data,
              updatedAt: new Date(),
            };
            return inMemoryUnits[index];
          }
          return null;
        }),
      },
      product: {
        count: vi.fn(async ({ where }: any) => {
          return inMemoryProducts.filter((p) => {
            if (p.tenantId !== where.tenantId) return false;
            if (where.deletedAt === null && p.deletedAt !== null) return false;
            if (where.categoryId && p.categoryId !== where.categoryId) return false;
            if (where.brandId && p.brandId !== where.brandId) return false;
            if (where.type && p.type !== where.type) return false;
            return true;
          }).length;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryProducts
            .filter((p) => {
              if (p.tenantId !== where.tenantId) return false;
              if (where.deletedAt === null && p.deletedAt !== null) return false;
              if (where.categoryId && p.categoryId !== where.categoryId) return false;
              if (where.brandId && p.brandId !== where.brandId) return false;
              if (where.type && p.type !== where.type) return false;
              return true;
            })
            .map((p) => ({
              ...p,
              category: inMemoryCategories.find((c) => c.id === p.categoryId) || null,
              brand: inMemoryBrands.find((b) => b.id === p.brandId) || null,
              unit: inMemoryUnits.find((u) => u.id === p.unitId) || null,
              variants: inMemoryVariants.filter((v) => v.productId === p.id && v.deletedAt === null),
            }));
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          const found = inMemoryProducts.find((p) => {
            if (p.tenantId !== where.tenantId) return false;
            if (where.deletedAt === null && p.deletedAt !== null) return false;
            if (where.id && p.id !== where.id) return false;
            if (where.OR) {
              const matched = where.OR.some((cond: any) => {
                if (cond.barcode && p.barcode === cond.barcode) return true;
                if (cond.sku && p.sku === cond.sku) return true;
                return false;
              });
              if (!matched) return false;
            }
            return true;
          });
          if (!found) return null;
          return {
            ...found,
            category: inMemoryCategories.find((c) => c.id === found.categoryId) || null,
            brand: inMemoryBrands.find((b) => b.id === found.brandId) || null,
            unit: inMemoryUnits.find((u) => u.id === found.unitId) || null,
            variants: inMemoryVariants.filter((v) => v.productId === found.id && v.deletedAt === null),
          };
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.tenantId_sku) {
            return (
              inMemoryProducts.find(
                (p) =>
                  p.tenantId === where.tenantId_sku.tenantId &&
                  p.sku === where.tenantId_sku.sku &&
                  p.deletedAt === null,
              ) || null
            );
          }
          if (where.tenantId_barcode) {
            return (
              inMemoryProducts.find(
                (p) =>
                  p.tenantId === where.tenantId_barcode.tenantId &&
                  p.barcode === where.tenantId_barcode.barcode &&
                  p.deletedAt === null,
              ) || null
            );
          }
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const p = {
            id: `prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryProducts.push(p);
          return p;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const index = inMemoryProducts.findIndex((p) => p.id === where.id);
          if (index !== -1) {
            inMemoryProducts[index] = {
              ...inMemoryProducts[index],
              ...data,
              updatedAt: new Date(),
            };
            return inMemoryProducts[index];
          }
          return null;
        }),
      },
      productVariant: {
        findFirst: vi.fn(async ({ where }: any) => {
          const found = inMemoryVariants.find((v) => {
            if (v.tenantId !== where.tenantId) return false;
            if (where.deletedAt === null && v.deletedAt !== null) return false;
            if (where.OR) {
              return where.OR.some((cond: any) => {
                if (cond.barcode && v.barcode === cond.barcode) return true;
                if (cond.sku && v.sku === cond.sku) return true;
                return false;
              });
            }
            return true;
          });
          if (!found) return null;
          const parentProduct = inMemoryProducts.find((p) => p.id === found.productId);
          return {
            ...found,
            product: parentProduct
              ? {
                  ...parentProduct,
                  category: inMemoryCategories.find((c) => c.id === parentProduct.categoryId) || null,
                  brand: inMemoryBrands.find((b) => b.id === parentProduct.brandId) || null,
                  unit: inMemoryUnits.find((u) => u.id === parentProduct.unitId) || null,
                  variants: inMemoryVariants.filter(
                    (v) => v.productId === parentProduct.id && v.deletedAt === null,
                  ),
                }
              : null,
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const variant = {
            id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryVariants.push(variant);
          return variant;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const index = inMemoryVariants.findIndex((v) => v.id === where.id);
          if (index !== -1) {
            inMemoryVariants[index] = {
              ...inMemoryVariants[index],
              ...data,
              updatedAt: new Date(),
            };
            return inMemoryVariants[index];
          }
          return null;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          inMemoryVariants.forEach((v, idx) => {
            if (v.productId === where.productId) {
              inMemoryVariants[idx] = { ...v, ...data };
            }
          });
          return { count: inMemoryVariants.length };
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
          inMemoryAuditLogs.push(log);
          return log;
        }),
      },
    } as unknown as PrismaService;

    productsService = new ProductsService(mockPrisma);
    productsController = new ProductsController(productsService);

    reflector = new Reflector();
    permissionsGuard = new PermissionsGuard(reflector);
  });

  describe('1. Product & Taxonomy Provisioning', () => {
    it('Test 1: Authenticated user creates Category, Brand, Unit, and a standard Product with Decimal prices', async () => {
      // 1. Create Category
      const category = await productsController.createCategory(
        TENANT_ALPHA,
        USER_ALPHA_MANAGER,
        {
          name: 'Beverages',
          slug: 'beverages',
          description: 'Carbonated and soft beverages',
        },
      );
      expect(category.id).toBeDefined();
      expect(category.name).toBe('Beverages');

      // 2. Create Brand
      const brand = await productsController.createBrand(
        TENANT_ALPHA,
        USER_ALPHA_MANAGER,
        {
          name: 'Coca-Cola',
          slug: 'coca-cola',
        },
      );
      expect(brand.id).toBeDefined();
      expect(brand.name).toBe('Coca-Cola');

      // 3. Create Unit
      const unit = await productsController.createUnit(
        TENANT_ALPHA,
        USER_ALPHA_MANAGER,
        {
          name: 'Can',
          shortCode: 'can',
        },
      );
      expect(unit.id).toBeDefined();
      expect(unit.shortCode).toBe('can');

      // 4. Create Standard Product
      const product = await productsController.createProduct(
        TENANT_ALPHA,
        USER_ALPHA_MANAGER,
        {
          name: 'Coca-Cola Zero 330ml',
          sku: 'CC-ZERO-330',
          barcode: '5449000000996',
          categoryId: category.id,
          brandId: brand.id,
          unitId: unit.id,
          costPrice: 120.5,
          retailPrice: 180.0,
          wholesalePrice: 150.0,
          alertQuantity: 10,
        },
      );

      expect(product.id).toBeDefined();
      expect(product.name).toBe('Coca-Cola Zero 330ml');
      expect(product.sku).toBe('CC-ZERO-330');
      expect(product.costPrice).toBe(120.5);
      expect(product.retailPrice).toBe(180.0);
      expect(product.wholesalePrice).toBe(150.0);
      expect(product.category?.name).toBe('Beverages');
      expect(product.brand?.name).toBe('Coca-Cola');
      expect(product.unit?.shortCode).toBe('can');
    });

    it('Test 2: Rapid lookup by barcode resolves the exact product model', async () => {
      // Create product
      await productsController.createProduct(TENANT_ALPHA, USER_ALPHA_MANAGER, {
        name: 'Mineral Water 500ml',
        sku: 'H2O-500',
        barcode: '4792022001122',
        retailPrice: 90.0,
      });

      // Rapid lookup
      const lookupResult = await productsController.lookup(TENANT_ALPHA, {
        barcode: '4792022001122',
      });

      expect(lookupResult).toBeDefined();
      expect(lookupResult.product.name).toBe('Mineral Water 500ml');
      expect(lookupResult.product.sku).toBe('H2O-500');
      expect(lookupResult.product.retailPrice).toBe(90.0);
      expect(lookupResult.matchedVariant).toBeNull();
    });
  });

  describe('2. Multi-Tenant Isolation & Uniqueness Constraints', () => {
    it('Test 3: Multi-tenant isolation: Tenant Alpha cannot see or edit Tenant Beta products', async () => {
      // Create product in Tenant Beta
      const betaProduct = await productsController.createProduct(
        TENANT_BETA,
        USER_BETA_OWNER,
        {
          name: 'Beta Exclusive Gadget',
          sku: 'BETA-GADGET-01',
          retailPrice: 5000.0,
        },
      );

      // Tenant Alpha attempting to get Beta product receives 404
      await expect(
        productsController.getProductById(TENANT_ALPHA, betaProduct.id),
      ).rejects.toThrow(NotFoundException);

      // Tenant Alpha attempting to delete Beta product receives 404
      await expect(
        productsController.deleteProduct(
          TENANT_ALPHA,
          USER_ALPHA_MANAGER,
          betaProduct.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Test 4: Tenant-scoped SKU uniqueness: Tenant Alpha and Beta can both possess SKU ITEM-001, but duplicate within Alpha triggers 409 Conflict', async () => {
      // 1. Tenant Alpha creates product with SKU ITEM-001
      const alphaProduct = await productsController.createProduct(
        TENANT_ALPHA,
        USER_ALPHA_MANAGER,
        {
          name: 'Alpha Item One',
          sku: 'ITEM-001',
          retailPrice: 100.0,
        },
      );
      expect(alphaProduct.sku).toBe('ITEM-001');

      // 2. Tenant Beta also creates product with SAME SKU ITEM-001 (Allowed across different tenants!)
      const betaProduct = await productsController.createProduct(
        TENANT_BETA,
        USER_BETA_OWNER,
        {
          name: 'Beta Item One',
          sku: 'ITEM-001',
          retailPrice: 150.0,
        },
      );
      expect(betaProduct.sku).toBe('ITEM-001');

      // 3. Tenant Alpha creates DUPLICATE SKU ITEM-001 within Tenant Alpha (Rejected with 409 Conflict!)
      await expect(
        productsController.createProduct(TENANT_ALPHA, USER_ALPHA_MANAGER, {
          name: 'Alpha Item Duplicate',
          sku: 'ITEM-001',
          retailPrice: 200.0,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        productsController.createProduct(TENANT_ALPHA, USER_ALPHA_MANAGER, {
          name: 'Alpha Item Duplicate',
          sku: 'ITEM-001',
          retailPrice: 200.0,
        }),
      ).rejects.toThrow(
        "Product with SKU 'ITEM-001' already exists in this organization.",
      );
    });
  });

  describe('3. Variable Products & RBAC Security Enforcement', () => {
    it('Test 5: Variable product creation correctly provisions linked ProductVariant records', async () => {
      const variableProduct = await productsController.createProduct(
        TENANT_ALPHA,
        USER_ALPHA_MANAGER,
        {
          name: 'Polo Cotton T-Shirt',
          sku: 'POLO-TSHIRT',
          type: 'VARIABLE',
          costPrice: 1500.0,
          retailPrice: 2900.0,
          variants: [
            {
              name: 'Medium / Navy',
              sku: 'POLO-M-NVY',
              barcode: '890123450001',
              retailPrice: 2900.0,
              attributes: { size: 'M', color: 'Navy' },
            },
            {
              name: 'Large / Navy',
              sku: 'POLO-L-NVY',
              barcode: '890123450002',
              retailPrice: 3200.0,
              attributes: { size: 'L', color: 'Navy' },
            },
          ],
        },
      );

      expect(variableProduct.variants).toBeDefined();
      expect(variableProduct.variants?.length).toBe(2);
      expect(variableProduct.variants![0]!.sku).toBe('POLO-M-NVY');
      expect(variableProduct.variants![1]!.retailPrice).toBe(3200.0);

      // Verify barcode lookup on variant directly resolves the parent product with matchedVariant
      const variantLookup = await productsController.lookup(TENANT_ALPHA, {
        barcode: '890123450002',
      });
      expect(variantLookup.product.name).toBe('Polo Cotton T-Shirt');
      expect(variantLookup.matchedVariant?.name).toBe('Large / Navy');
      expect(variantLookup.matchedVariant?.sku).toBe('POLO-L-NVY');
    });

    it('Test 6: Cashier without inventory:manage permission receives 403 Forbidden on product mutation', () => {
      // Mock execution context where user only has pos:access and pos:checkout permissions
      const context = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            permissions: ['pos:access', 'pos:checkout'],
            user: USER_ALPHA_CASHIER,
            tenant: TENANT_ALPHA,
          }),
        }),
      } as unknown as ExecutionContext;

      // Mock reflector returning required permissions for @RequirePermissions('inventory:manage')
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) {
          return ['inventory:manage'];
        }
        return undefined;
      });

      expect(() => permissionsGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );

      expect(() => permissionsGuard.canActivate(context)).toThrow(
        'Forbidden: Insufficient permissions. Missing required permission(s): inventory:manage',
      );
    });
  });
});
