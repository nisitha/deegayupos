import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@pixelcraft/types';
import { PosService } from '../src/modules/pos/pos.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';

describe('PixelCraft POS - Phase 10: Multi-Branch Inventory & Stock Movement Engine Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';

  const BRANCH_ALPHA_MAIN = 'bbbbbbbb-1111-1111-1111-111111111111';
  const BRANCH_ALPHA_SUB = 'bbbbbbbb-1111-1111-1111-222222222222';
  const BRANCH_BETA_MAIN = 'bbbbbbbb-2222-2222-2222-111111111111';

  const WAREHOUSE_ALPHA_MAIN = 'wwwwwwww-1111-1111-1111-111111111111';
  const WAREHOUSE_ALPHA_SUB = 'wwwwwwww-1111-1111-1111-222222222222';
  const WAREHOUSE_BETA_MAIN = 'wwwwwwww-2222-2222-2222-111111111111';

  const PRODUCT_A_ID = 'pppppppp-1111-1111-1111-111111111111';
  const PRODUCT_B_ID = 'pppppppp-2222-2222-2222-222222222222';

  const USER_ALPHA_MANAGER: AuthUser = {
    id: 'uuuuuuuu-1111-1111-1111-111111111111',
    email: 'manager@alpha.com',
    fullName: 'Alpha Manager',
    isActive: true,
    role: 'MANAGER',
  };

  let mockPrisma: any;
  let posService: PosService;
  let inventoryService: InventoryService;

  // In-memory data store
  let inMemoryBranches: any[] = [];
  let inMemoryWarehouses: any[] = [];
  let inMemoryBusinessSettings: any[] = [];
  let inMemoryProducts: any[] = [];
  let inMemoryStockLevels: any[] = [];
  let inMemoryStockMovements: any[] = [];
  let inMemoryStockAdjustments: any[] = [];
  let inMemoryStockAdjustmentItems: any[] = [];
  let inMemoryStockTransfers: any[] = [];
  let inMemoryStockTransferItems: any[] = [];
  let inMemorySales: any[] = [];
  let inMemorySaleItems: any[] = [];
  let inMemorySalePayments: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryBranches = [
      {
        id: BRANCH_ALPHA_MAIN,
        tenantId: TENANT_ALPHA_ID,
        name: 'Alpha Flagship Branch',
        code: 'COL-01',
        isPrimary: true,
        isActive: true,
      },
      {
        id: BRANCH_ALPHA_SUB,
        tenantId: TENANT_ALPHA_ID,
        name: 'Alpha Express Branch',
        code: 'COL-02',
        isPrimary: false,
        isActive: true,
      },
      {
        id: BRANCH_BETA_MAIN,
        tenantId: TENANT_BETA_ID,
        name: 'Beta Main Branch',
        code: 'KAN-01',
        isPrimary: true,
        isActive: true,
      },
    ];

    inMemoryWarehouses = [
      {
        id: WAREHOUSE_ALPHA_MAIN,
        tenantId: TENANT_ALPHA_ID,
        branchId: BRANCH_ALPHA_MAIN,
        name: 'Alpha Main Warehouse',
        isDefault: true,
        isActive: true,
      },
      {
        id: WAREHOUSE_ALPHA_SUB,
        tenantId: TENANT_ALPHA_ID,
        branchId: BRANCH_ALPHA_SUB,
        name: 'Alpha Express Storage',
        isDefault: true,
        isActive: true,
      },
      {
        id: WAREHOUSE_BETA_MAIN,
        tenantId: TENANT_BETA_ID,
        branchId: BRANCH_BETA_MAIN,
        name: 'Beta Main Warehouse',
        isDefault: true,
        isActive: true,
      },
    ];

    inMemoryBusinessSettings = [
      {
        tenantId: TENANT_ALPHA_ID,
        invoicePrefix: 'INV-',
        taxRate: 8.0,
        negativeStockPolicy: 'DISALLOW',
        allowNegativeStock: false,
      },
      {
        tenantId: TENANT_BETA_ID,
        invoicePrefix: 'INV-',
        taxRate: 5.0,
        negativeStockPolicy: 'DISALLOW',
        allowNegativeStock: false,
      },
    ];

    inMemoryProducts = [
      {
        id: PRODUCT_A_ID,
        tenantId: TENANT_ALPHA_ID,
        name: 'Organic Basmati Rice 5kg',
        sku: 'RICE-001',
        barcode: '8901234567890',
        retailPrice: 2450.0,
        isTrackStock: true,
        deletedAt: null,
      },
      {
        id: PRODUCT_B_ID,
        tenantId: TENANT_BETA_ID,
        name: 'Ceylon Black Tea 500g',
        sku: 'TEA-001',
        barcode: '8901234567891',
        retailPrice: 1200.0,
        isTrackStock: true,
        deletedAt: null,
      },
    ];

    inMemoryStockLevels = [];
    inMemoryStockMovements = [];
    inMemoryStockAdjustments = [];
    inMemoryStockAdjustmentItems = [];
    inMemoryStockTransfers = [];
    inMemoryStockTransferItems = [];
    inMemorySales = [];
    inMemorySaleItems = [];
    inMemorySalePayments = [];
    inMemoryAuditLogs = [];

    mockPrisma = {
      $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
      withTenantContext: vi.fn(async (_tenantId: string, cb: any) => cb(mockPrisma)),
      branch: {
        findFirst: vi.fn(async ({ where }: any) => {
          return inMemoryBranches.find(
            (b) =>
              b.id === where.id &&
              b.tenantId === where.tenantId &&
              (where.isActive === undefined || b.isActive === where.isActive),
          ) || null;
        }),
      },
      warehouse: {
        findFirst: vi.fn(async ({ where }: any) => {
          return inMemoryWarehouses.find(
            (w) =>
              (where.id ? w.id === where.id : true) &&
              (where.branchId ? w.branchId === where.branchId : true) &&
              w.tenantId === where.tenantId &&
              (where.isActive === undefined || w.isActive === where.isActive),
          ) || null;
        }),
      },
      businessSetting: {
        findUnique: vi.fn(async ({ where }: any) => {
          return inMemoryBusinessSettings.find((s) => s.tenantId === where.tenantId) || null;
        }),
      },
      product: {
        findUnique: vi.fn(async ({ where }: any) => {
          return inMemoryProducts.find((p) => p.id === where.id) || null;
        }),
      },
      stockLevel: {
        findFirst: vi.fn(async ({ where }: any) => {
          return inMemoryStockLevels.find(
            (s) =>
              s.tenantId === where.tenantId &&
              s.warehouseId === where.warehouseId &&
              s.productId === where.productId &&
              (where.variantId ? s.variantId === where.variantId : true),
          ) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `sl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            updatedAt: new Date(),
          };
          inMemoryStockLevels.push(created);
          return created;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const idx = inMemoryStockLevels.findIndex((s) => s.id === where.id);
          if (idx !== -1) {
            inMemoryStockLevels[idx] = {
              ...inMemoryStockLevels[idx],
              ...data,
              updatedAt: new Date(),
            };
            return inMemoryStockLevels[idx];
          }
          throw new NotFoundException('StockLevel not found');
        }),
        count: vi.fn(async ({ where }: any) => {
          return inMemoryStockLevels.filter((s) => s.tenantId === where.tenantId).length;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryStockLevels
            .filter((s) => s.tenantId === where.tenantId)
            .map((s) => ({
              ...s,
              warehouse: inMemoryWarehouses.find((w) => w.id === s.warehouseId),
              product: inMemoryProducts.find((p) => p.id === s.productId),
            }));
        }),
      },
      stockMovement: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            createdAt: new Date(),
          };
          inMemoryStockMovements.push(created);
          return created;
        }),
        count: vi.fn(async ({ where }: any) => {
          return inMemoryStockMovements.filter((m) => m.tenantId === where.tenantId).length;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryStockMovements
            .filter((m) => m.tenantId === where.tenantId)
            .map((m) => ({
              ...m,
              warehouse: inMemoryWarehouses.find((w) => w.id === m.warehouseId),
              product: inMemoryProducts.find((p) => p.id === m.productId),
            }));
        }),
      },
      stockAdjustment: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryStockAdjustments.push(created);
          return created;
        }),
      },
      stockAdjustmentItem: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `adji-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
          };
          inMemoryStockAdjustmentItems.push(created);
          return created;
        }),
      },
      stockTransfer: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `trf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryStockTransfers.push(created);
          return created;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          const trf = inMemoryStockTransfers.find(
            (t) => t.id === where.id && t.tenantId === where.tenantId,
          );
          if (!trf) return null;
          return {
            ...trf,
            items: inMemoryStockTransferItems.filter((i) => i.transferId === trf.id),
            sourceWarehouse: inMemoryWarehouses.find((w) => w.id === trf.sourceWarehouseId),
            targetWarehouse: inMemoryWarehouses.find((w) => w.id === trf.targetWarehouseId),
          };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const idx = inMemoryStockTransfers.findIndex((t) => t.id === where.id);
          if (idx !== -1) {
            inMemoryStockTransfers[idx] = {
              ...inMemoryStockTransfers[idx],
              ...data,
              updatedAt: new Date(),
            };
            return {
              ...inMemoryStockTransfers[idx],
              items: inMemoryStockTransferItems.filter((i) => i.transferId === where.id),
            };
          }
          throw new NotFoundException('StockTransfer not found');
        }),
      },
      stockTransferItem: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `trfi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
          };
          inMemoryStockTransferItems.push(created);
          return created;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const idx = inMemoryStockTransferItems.findIndex((i) => i.id === where.id);
          if (idx !== -1) {
            inMemoryStockTransferItems[idx] = {
              ...inMemoryStockTransferItems[idx],
              ...data,
            };
            return inMemoryStockTransferItems[idx];
          }
          throw new NotFoundException('StockTransferItem not found');
        }),
      },
      sale: {
        count: vi.fn(async () => inMemorySales.length),
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `sale-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySales.push(created);
          return created;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const sale = inMemorySales.find((s) => s.id === where.id);
          if (!sale) return null;
          return {
            ...sale,
            items: inMemorySaleItems.filter((i) => i.saleId === sale.id),
            payments: inMemorySalePayments.filter((p) => p.saleId === sale.id),
            cashier: {
              id: sale.cashierId,
              fullName: 'Cashier User',
              email: 'cashier@alpha.com',
            },
          };
        }),
      },
      saleItem: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `item-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySaleItems.push(created);
          return created;
        }),
      },
      salePayment: {
        create: vi.fn(async ({ data }: any) => {
          const created = {
            id: `pay-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySalePayments.push(created);
          return created;
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          const created = { id: `log-${Date.now()}`, ...data };
          inMemoryAuditLogs.push(created);
          return created;
        }),
      },
    };

    posService = new PosService(mockPrisma);
    inventoryService = new InventoryService(mockPrisma);
  });

  // Test 1: Completing a POS sale immediately decrements StockLevel.quantityOnHand and writes an immutable StockMovement entry
  it('Test 1: Completing a POS sale immediately decrements StockLevel.quantityOnHand and writes an immutable StockMovement entry', async () => {
    // Seed initial stock of 15 units
    inMemoryStockLevels.push({
      id: 'sl-prod-a-alpha',
      tenantId: TENANT_ALPHA_ID,
      warehouseId: WAREHOUSE_ALPHA_MAIN,
      productId: PRODUCT_A_ID,
      variantId: null,
      quantityOnHand: 15.0,
      quantityReserved: 0.0,
      reorderPoint: 5.0,
      updatedAt: new Date(),
    });

    const result = await posService.checkout(
      TENANT_ALPHA_ID,
      USER_ALPHA_MANAGER.id,
      {
        branchId: BRANCH_ALPHA_MAIN,
        items: [
          {
            productId: PRODUCT_A_ID,
            productName: 'Organic Basmati Rice 5kg',
            sku: 'RICE-001',
            unitPrice: 2450.0,
            quantity: 4.0,
            subtotal: 9800.0,
          },
        ],
        payments: [
          {
            paymentMethod: 'CASH',
            amount: 10000.0,
          },
        ],
        subtotal: 9800.0,
        totalAmount: 9800.0,
        paidAmount: 10000.0,
        changeDue: 200.0,
      },
    );

    expect(result).toBeDefined();
    expect(result.invoiceNumber).toBeDefined();

    // Verify StockLevel decremented from 15 to 11
    const updatedStock = inMemoryStockLevels.find(
      (s) => s.warehouseId === WAREHOUSE_ALPHA_MAIN && s.productId === PRODUCT_A_ID,
    );
    expect(updatedStock).toBeDefined();
    expect(updatedStock.quantityOnHand).toBe(11.0);

    // Verify StockMovement entry
    const movement = inMemoryStockMovements.find(
      (m) => m.referenceId === result.id && m.movementType === 'SALE',
    );
    expect(movement).toBeDefined();
    expect(movement.movementType).toBe('SALE');
    expect(movement.quantity).toBe(-4.0);
    expect(movement.balanceBefore).toBe(15.0);
    expect(movement.balanceAfter).toBe(11.0);
  });

  // Test 2: If allowNegativeStock: false, checkout with insufficient stock rejects with 400 Bad Request
  it('Test 2: If allowNegativeStock: false, checkout with insufficient stock rejects with 400 Bad Request', async () => {
    // Initial stock is 2 units
    inMemoryStockLevels.push({
      id: 'sl-prod-a-alpha-low',
      tenantId: TENANT_ALPHA_ID,
      warehouseId: WAREHOUSE_ALPHA_MAIN,
      productId: PRODUCT_A_ID,
      variantId: null,
      quantityOnHand: 2.0,
      quantityReserved: 0.0,
      reorderPoint: 5.0,
      updatedAt: new Date(),
    });

    // Attempt to checkout 6 units
    await expect(
      posService.checkout(
        TENANT_ALPHA_ID,
        USER_ALPHA_MANAGER.id,
        {
          branchId: BRANCH_ALPHA_MAIN,
          items: [
            {
              productId: PRODUCT_A_ID,
              productName: 'Organic Basmati Rice 5kg',
              sku: 'RICE-001',
              unitPrice: 2450.0,
              quantity: 6.0,
              subtotal: 14700.0,
            },
          ],
          payments: [{ paymentMethod: 'CASH', amount: 14700.0 }],
          subtotal: 14700.0,
          totalAmount: 14700.0,
          paidAmount: 14700.0,
        },
      ),
    ).rejects.toThrow(BadRequestException);

    // Verify stock was NOT decremented
    const stock = inMemoryStockLevels.find((s) => s.id === 'sl-prod-a-alpha-low');
    expect(stock.quantityOnHand).toBe(2.0);

    // Verify no movement was recorded
    expect(inMemoryStockMovements.length).toBe(0);
  });

  // Test 3: Inter-branch transfer: Dispatching transfer decrements Source Warehouse stock; receiving transfer increments Destination Warehouse stock
  it('Test 3: Inter-branch transfer: Dispatching transfer decrements Source Warehouse stock; receiving transfer increments Destination Warehouse stock', async () => {
    // Seed initial stock: Main warehouse has 50 units, Sub warehouse has 10 units
    inMemoryStockLevels.push(
      {
        id: 'sl-source',
        tenantId: TENANT_ALPHA_ID,
        warehouseId: WAREHOUSE_ALPHA_MAIN,
        productId: PRODUCT_A_ID,
        variantId: null,
        quantityOnHand: 50.0,
        quantityReserved: 0.0,
        reorderPoint: 5.0,
        updatedAt: new Date(),
      },
      {
        id: 'sl-target',
        tenantId: TENANT_ALPHA_ID,
        warehouseId: WAREHOUSE_ALPHA_SUB,
        productId: PRODUCT_A_ID,
        variantId: null,
        quantityOnHand: 10.0,
        quantityReserved: 0.0,
        reorderPoint: 5.0,
        updatedAt: new Date(),
      },
    );

    // 1. Initiate transfer for 20 units
    const transfer = await inventoryService.createTransfer(
      TENANT_ALPHA_ID,
      USER_ALPHA_MANAGER.id,
      {
        sourceWarehouseId: WAREHOUSE_ALPHA_MAIN,
        targetWarehouseId: WAREHOUSE_ALPHA_SUB,
        notes: 'Replenishing Express branch stock',
        items: [{ productId: PRODUCT_A_ID, quantity: 20.0 }],
      },
    );

    expect(transfer.status).toBe('PENDING');
    expect(transfer.trackingNumber).toMatch(/^TRF-\d{8}-[A-Z0-9]+$/);

    // 2. Dispatch transfer -> Source warehouse stock decrements from 50 to 30
    const dispatched = await inventoryService.dispatchTransfer(
      TENANT_ALPHA_ID,
      USER_ALPHA_MANAGER.id,
      transfer.id,
    );
    expect(dispatched.status).toBe('DISPATCHED');

    const sourceStock = inMemoryStockLevels.find((s) => s.id === 'sl-source');
    expect(sourceStock.quantityOnHand).toBe(30.0);

    const dispatchMovement = inMemoryStockMovements.find(
      (m) => m.referenceId === transfer.id && m.movementType === 'TRANSFER_DISPATCH',
    );
    expect(dispatchMovement).toBeDefined();
    expect(dispatchMovement.quantity).toBe(-20.0);
    expect(dispatchMovement.balanceBefore).toBe(50.0);
    expect(dispatchMovement.balanceAfter).toBe(30.0);

    // 3. Receive transfer -> Destination warehouse stock increments from 10 to 30
    const received = await inventoryService.receiveTransfer(
      TENANT_ALPHA_ID,
      USER_ALPHA_MANAGER.id,
      transfer.id,
    );
    expect(received.status).toBe('RECEIVED');

    const targetStock = inMemoryStockLevels.find((s) => s.id === 'sl-target');
    expect(targetStock.quantityOnHand).toBe(30.0);

    const receiveMovement = inMemoryStockMovements.find(
      (m) => m.referenceId === transfer.id && m.movementType === 'TRANSFER_RECEIPT',
    );
    expect(receiveMovement).toBeDefined();
    expect(receiveMovement.quantity).toBe(20.0);
    expect(receiveMovement.balanceBefore).toBe(10.0);
    expect(receiveMovement.balanceAfter).toBe(30.0);
  });

  // Test 4: Stock adjustment for damaged items updates balance and writes DAMAGE_LOSS movement
  it('Test 4: Stock adjustment for damaged items updates balance and writes DAMAGE_LOSS movement', async () => {
    // Initial stock is 25 units
    inMemoryStockLevels.push({
      id: 'sl-dmg-test',
      tenantId: TENANT_ALPHA_ID,
      warehouseId: WAREHOUSE_ALPHA_MAIN,
      productId: PRODUCT_A_ID,
      variantId: null,
      quantityOnHand: 25.0,
      quantityReserved: 0.0,
      reorderPoint: 5.0,
      updatedAt: new Date(),
    });

    // 5 units water damaged, counted remaining is 20
    const adjustment = await inventoryService.createAdjustment(
      TENANT_ALPHA_ID,
      USER_ALPHA_MANAGER.id,
      {
        warehouseId: WAREHOUSE_ALPHA_MAIN,
        reason: 'DAMAGED',
        notes: 'Water leak damaged 5 packaging units',
        items: [{ productId: PRODUCT_A_ID, countedQuantity: 20.0 }],
      },
    );

    expect(adjustment.status).toBe('APPLIED');
    expect(adjustment.reason).toBe('DAMAGED');

    // Verify stock is now 20
    const stock = inMemoryStockLevels.find((s) => s.id === 'sl-dmg-test');
    expect(stock.quantityOnHand).toBe(20.0);

    // Verify DAMAGE_LOSS movement
    const movement = inMemoryStockMovements.find(
      (m) => m.referenceId === adjustment.id && m.movementType === 'DAMAGE_LOSS',
    );
    expect(movement).toBeDefined();
    expect(movement.movementType).toBe('DAMAGE_LOSS');
    expect(movement.quantity).toBe(-5.0);
    expect(movement.balanceBefore).toBe(25.0);
    expect(movement.balanceAfter).toBe(20.0);
  });

  // Test 5: Tenant isolation: Tenant Alpha cannot view, adjust, or transfer Tenant Beta's inventory
  it("Test 5: Tenant isolation: Tenant Alpha cannot view, adjust, or transfer Tenant Beta's inventory", async () => {
    // Beta Warehouse stock
    inMemoryStockLevels.push({
      id: 'sl-beta-only',
      tenantId: TENANT_BETA_ID,
      warehouseId: WAREHOUSE_BETA_MAIN,
      productId: PRODUCT_B_ID,
      variantId: null,
      quantityOnHand: 100.0,
      quantityReserved: 0.0,
      reorderPoint: 10.0,
      updatedAt: new Date(),
    });

    // 1. Tenant Alpha attempts to adjust Beta's warehouse -> rejects with NotFoundException
    await expect(
      inventoryService.createAdjustment(
        TENANT_ALPHA_ID,
        USER_ALPHA_MANAGER.id,
        {
          warehouseId: WAREHOUSE_BETA_MAIN,
          reason: 'PHYSICAL_COUNT',
          notes: 'Illegal cross-tenant adjustment',
          items: [{ productId: PRODUCT_B_ID, countedQuantity: 90.0 }],
        },
      ),
    ).rejects.toThrow(NotFoundException);

    // 2. Tenant Alpha attempts to transfer from Beta's warehouse -> rejects with NotFoundException
    await expect(
      inventoryService.createTransfer(
        TENANT_ALPHA_ID,
        USER_ALPHA_MANAGER.id,
        {
          sourceWarehouseId: WAREHOUSE_BETA_MAIN,
          targetWarehouseId: WAREHOUSE_ALPHA_MAIN,
          items: [{ productId: PRODUCT_B_ID, quantity: 10.0 }],
        },
      ),
    ).rejects.toThrow(NotFoundException);

    // 3. Tenant Alpha queries stock levels -> does NOT see Beta's stock
    const alphaLevels = await inventoryService.getStockLevels(TENANT_ALPHA_ID, {});
    expect(alphaLevels.items.some((item) => item.tenantId === TENANT_BETA_ID)).toBe(false);
  });
});
