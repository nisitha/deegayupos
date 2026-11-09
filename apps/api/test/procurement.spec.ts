import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { SuppliersService } from '../src/modules/procurement/suppliers.service';
import { ProcurementService } from '../src/modules/procurement/procurement.service';

describe('PixelCraft POS - Phase 11: Procurement, Suppliers, PO & GRN Engine Suite', () => {
  const TENANT_ID = '0fef1423-5d89-4147-8af8-17c7e641c88a';
  const BRANCH_ID = 'bbbbbbbb-1111-1111-1111-111111111111';
  const WAREHOUSE_ID = 'wwwwwwww-1111-1111-1111-111111111111';
  const USER_ID = 'uuuuuuuu-1111-1111-1111-111111111111';

  const PRODUCT_A = {
    id: 'pppppppp-1111-1111-1111-111111111111',
    tenantId: TENANT_ID,
    name: 'Deegayu Arishta 375ml',
    sku: 'MED-ARI-375',
    costPrice: 400.0,
    retailPrice: 650.0,
  };

  const PRODUCT_B = {
    id: 'pppppppp-2222-2222-2222-222222222222',
    tenantId: TENANT_ID,
    name: 'Siddhalepa Herbal Balm 50g',
    sku: 'BALM-SID-050',
    costPrice: 220.0,
    retailPrice: 350.0,
  };

  let mockPrisma: any;
  let suppliersService: SuppliersService;
  let procurementService: ProcurementService;

  // In-memory collections
  let inMemorySuppliers: any[] = [];
  let inMemoryPurchaseOrders: any[] = [];
  let inMemoryPurchaseOrderItems: any[] = [];
  let inMemoryGrns: any[] = [];
  let inMemoryGrnItems: any[] = [];
  let inMemoryStockLevels: any[] = [];
  let inMemoryStockMovements: any[] = [];
  let inMemoryProducts: any[] = [];

  beforeEach(() => {
    inMemorySuppliers = [
      {
        id: 'ssssssss-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        code: 'SUP-001',
        name: 'Ayurna Ceylon (Pvt) Ltd',
        phone: '0776616339',
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'ssssssss-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
        code: 'SUP-002',
        name: 'Sahansa Hela Osu',
        phone: '0771328056',
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    inMemoryProducts = [{ ...PRODUCT_A }, { ...PRODUCT_B }];

    inMemoryStockLevels = [
      {
        id: 'sl-1',
        tenantId: TENANT_ID,
        warehouseId: WAREHOUSE_ID,
        productId: PRODUCT_A.id,
        variantId: null,
        quantityOnHand: 20.0,
        quantityReserved: 0,
        reorderPoint: 5,
      },
    ];

    inMemoryPurchaseOrders = [];
    inMemoryPurchaseOrderItems = [];
    inMemoryGrns = [];
    inMemoryGrnItems = [];
    inMemoryStockMovements = [];

    mockPrisma = {
      branch: {
        findFirst: vi.fn(async ({ where }) => {
          if (where.id === BRANCH_ID && where.tenantId === TENANT_ID) {
            return { id: BRANCH_ID, name: 'Main Branch', isActive: true };
          }
          return null;
        }),
      },
      warehouse: {
        findFirst: vi.fn(async ({ where }) => {
          if (where.id === WAREHOUSE_ID && where.tenantId === TENANT_ID) {
            return { id: WAREHOUSE_ID, name: 'Central Warehouse', branchId: BRANCH_ID, isActive: true };
          }
          return null;
        }),
      },
      product: {
        findFirst: vi.fn(async ({ where }) => {
          return inMemoryProducts.find((p) => p.id === where.id && p.tenantId === where.tenantId) || null;
        }),
        update: vi.fn(async ({ where, data }) => {
          const p = inMemoryProducts.find((item) => item.id === where.id);
          if (p) Object.assign(p, data);
          return p;
        }),
      },
      supplier: {
        count: vi.fn(async ({ where }) => {
          return inMemorySuppliers.filter((s) => {
            if (s.tenantId !== where.tenantId || s.deletedAt) return false;
            if (where.status && s.status !== where.status) return false;
            if (where.OR) {
              const term = where.OR[0]?.name?.contains?.toLowerCase() || '';
              return (
                s.name.toLowerCase().includes(term) ||
                s.code.toLowerCase().includes(term) ||
                (s.phone && s.phone.includes(term))
              );
            }
            return true;
          }).length;
        }),
        findMany: vi.fn(async ({ where }) => {
          return inMemorySuppliers.filter((s) => {
            if (s.tenantId !== where.tenantId || s.deletedAt) return false;
            if (where.status && s.status !== where.status) return false;
            if (where.OR) {
              const term = where.OR[0]?.name?.contains?.toLowerCase() || '';
              return (
                s.name.toLowerCase().includes(term) ||
                s.code.toLowerCase().includes(term) ||
                (s.phone && s.phone.includes(term))
              );
            }
            return true;
          });
        }),
        findFirst: vi.fn(async ({ where }) => {
          return inMemorySuppliers.find((s) => {
            if (s.tenantId !== where.tenantId || s.deletedAt) return false;
            if (where.id && s.id !== where.id) return false;
            if (where.code && s.code !== where.code) return false;
            if (where.status && s.status !== where.status) return false;
            return true;
          }) || null;
        }),
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `sup-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemorySuppliers.push(record);
          return record;
        }),
        update: vi.fn(async ({ where, data }) => {
          const s = inMemorySuppliers.find((item) => item.id === where.id);
          if (!s) throw new NotFoundException();
          Object.assign(s, data, { updatedAt: new Date() });
          return s;
        }),
      },
      purchaseOrder: {
        count: vi.fn(async ({ where }) => {
          return inMemoryPurchaseOrders.filter((po) => po.tenantId === where.tenantId && !po.deletedAt).length;
        }),
        findMany: vi.fn(async ({ where }) => {
          return inMemoryPurchaseOrders.filter((po) => po.tenantId === where.tenantId && !po.deletedAt).map((po) => ({
            ...po,
            branch: { id: BRANCH_ID, name: 'Main Branch' },
            supplier: { id: po.supplierId, name: 'Ayurna Ceylon (Pvt) Ltd' },
            items: inMemoryPurchaseOrderItems.filter((i) => i.purchaseOrderId === po.id),
          }));
        }),
        findFirst: vi.fn(async ({ where }) => {
          const po = inMemoryPurchaseOrders.find((p) => {
            if (p.id !== where.id) return false;
            if (where.tenantId && p.tenantId !== where.tenantId) return false;
            return true;
          });
          if (!po) return null;
          return {
            ...po,
            branch: { id: BRANCH_ID, name: 'Main Branch' },
            supplier: { id: po.supplierId, name: 'Ayurna Ceylon (Pvt) Ltd' },
            items: inMemoryPurchaseOrderItems.filter((i) => i.purchaseOrderId === po.id),
          };
        }),
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `po-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryPurchaseOrders.push(record);
          return record;
        }),
        update: vi.fn(async ({ where, data }) => {
          const po = inMemoryPurchaseOrders.find((p) => p.id === where.id);
          if (po) Object.assign(po, data, { updatedAt: new Date() });
          return po;
        }),
      },
      purchaseOrderItem: {
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `poi-${Date.now()}-${Math.random()}`,
            ...data,
          };
          inMemoryPurchaseOrderItems.push(record);
          return record;
        }),
        update: vi.fn(async ({ where, data }) => {
          const poi = inMemoryPurchaseOrderItems.find((p) => p.id === where.id);
          if (poi) {
            if (data.receivedQuantity?.increment) {
              poi.receivedQuantity = Number(poi.receivedQuantity) + Number(data.receivedQuantity.increment);
            } else if (data.receivedQuantity !== undefined) {
              poi.receivedQuantity = Number(data.receivedQuantity);
            }
          }
          return poi;
        }),
      },
      goodsReceivedNote: {
        count: vi.fn(async ({ where }) => {
          return inMemoryGrns.filter((g) => g.tenantId === where.tenantId && !g.deletedAt).length;
        }),
        findMany: vi.fn(async ({ where }) => {
          return inMemoryGrns.filter((g) => g.tenantId === where.tenantId && !g.deletedAt).map((g) => ({
            ...g,
            branch: { id: BRANCH_ID, name: 'Main Branch' },
            warehouse: { id: WAREHOUSE_ID, name: 'Central Warehouse' },
            supplier: { id: g.supplierId, name: 'Ayurna Ceylon (Pvt) Ltd' },
            purchaseOrder: g.purchaseOrderId ? { id: g.purchaseOrderId, poNumber: 'PO-2026-0001' } : null,
            receivedByUser: { id: USER_ID, fullName: 'Admin' },
            items: inMemoryGrnItems.filter((i) => i.grnId === g.id),
          }));
        }),
        findFirst: vi.fn(async ({ where }) => {
          const g = inMemoryGrns.find((item) => item.id === where.id && item.tenantId === where.tenantId);
          if (!g) return null;
          return {
            ...g,
            branch: { id: BRANCH_ID, name: 'Main Branch' },
            warehouse: { id: WAREHOUSE_ID, name: 'Central Warehouse' },
            supplier: { id: g.supplierId, name: 'Ayurna Ceylon (Pvt) Ltd' },
            purchaseOrder: g.purchaseOrderId ? { id: g.purchaseOrderId, poNumber: 'PO-2026-0001' } : null,
            receivedByUser: { id: USER_ID, fullName: 'Admin' },
            items: inMemoryGrnItems.filter((i) => i.grnId === g.id),
          };
        }),
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `grn-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          inMemoryGrns.push(record);
          return record;
        }),
      },
      goodsReceivedNoteItem: {
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `grni-${Date.now()}-${Math.random()}`,
            ...data,
          };
          inMemoryGrnItems.push(record);
          return record;
        }),
      },
      stockLevel: {
        findFirst: vi.fn(async ({ where }) => {
          return inMemoryStockLevels.find(
            (sl) =>
              sl.tenantId === where.tenantId &&
              sl.warehouseId === where.warehouseId &&
              sl.productId === where.productId,
          ) || null;
        }),
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `sl-${Date.now()}`,
            ...data,
          };
          inMemoryStockLevels.push(record);
          return record;
        }),
        update: vi.fn(async ({ where, data }) => {
          const sl = inMemoryStockLevels.find((s) => s.id === where.id);
          if (sl) Object.assign(sl, data);
          return sl;
        }),
      },
      stockMovement: {
        create: vi.fn(async ({ data }) => {
          const record = {
            id: `sm-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          inMemoryStockMovements.push(record);
          return record;
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }) => data),
      },
      withTenantContext: vi.fn(async (_tenantId, callback) => {
        return callback(mockPrisma);
      }),
    };

    suppliersService = new SuppliersService(mockPrisma);
    procurementService = new ProcurementService(mockPrisma);
  });

  // ==========================================
  // 1. SUPPLIERS MANAGEMENT TESTS
  // ==========================================
  describe('Suppliers Management', () => {
    it('should query paginated suppliers and filter by search term', async () => {
      const res = await suppliersService.getSuppliers(TENANT_ID, { search: 'Ayurna' });
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.name).toBe('Ayurna Ceylon (Pvt) Ltd');
      expect(res.total).toBe(1);
    });

    it('should create a new supplier with generated code SUP-003', async () => {
      const created = await suppliersService.createSupplier(TENANT_ID, {
        name: 'Link Natural Products (Pvt) Ltd',
        phone: '0112345678',
        contactPerson: 'Saman Kumara',
      });

      expect(created.code).toBe('SUP-003');
      expect(created.name).toBe('Link Natural Products (Pvt) Ltd');
      expect(created.status).toBe('ACTIVE');
    });

    it('should prevent creating a duplicate supplier with the same code', async () => {
      await expect(
        suppliersService.createSupplier(TENANT_ID, {
          name: 'Clash Supplier',
          code: 'SUP-001',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update supplier details and soft delete', async () => {
      const supplierId = inMemorySuppliers[0].id;
      const updated = await suppliersService.updateSupplier(TENANT_ID, supplierId, {
        phone: '0779998888',
      });
      expect(updated.phone).toBe('0779998888');

      const deleted = await suppliersService.deleteSupplier(TENANT_ID, supplierId);
      expect(deleted.success).toBe(true);
      expect(inMemorySuppliers[0].deletedAt).toBeTruthy();
    });
  });

  // ==========================================
  // 2. PURCHASE ORDERS (PO) TESTS
  // ==========================================
  describe('Purchase Orders Engine', () => {
    it('should create a Purchase Order with computed subtotals', async () => {
      const po = await procurementService.createPurchaseOrder(TENANT_ID, USER_ID, {
        branchId: BRANCH_ID,
        supplierId: inMemorySuppliers[0].id,
        items: [
          { productId: PRODUCT_A.id, orderedQuantity: 50, unitCost: 400.0 },
          { productId: PRODUCT_B.id, orderedQuantity: 30, unitCost: 220.0 },
        ],
      });

      expect(po.poNumber).toMatch(/^PO-\d{4}-\d{4}$/);
      expect(po.status).toBe('SUBMITTED');
      expect(po.subtotal).toBe(50 * 400 + 30 * 220); // 20,000 + 6,600 = 26,600
      expect(po.totalAmount).toBe(26600);
      expect(po.items.length).toBe(2);
    });

    it('should reject creating PO without line items', async () => {
      await expect(
        procurementService.createPurchaseOrder(TENANT_ID, USER_ID, {
          branchId: BRANCH_ID,
          supplierId: inMemorySuppliers[0].id,
          items: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // 3. GOODS RECEIVED NOTE (GRN) ATOMIC RECEIVING
  // ==========================================
  describe('Goods Received Note (GRN) Engine', () => {
    it('should atomically receive inventory, increment stock on hand, record PURCHASE_RECEIPT movement, and update product cost', async () => {
      // Prior stock on hand for PRODUCT_A is 20
      expect(inMemoryStockLevels[0].quantityOnHand).toBe(20.0);

      const grn = await procurementService.createGrn(TENANT_ID, USER_ID, {
        branchId: BRANCH_ID,
        warehouseId: WAREHOUSE_ID,
        supplierId: inMemorySuppliers[0].id,
        supplierInvoiceNo: 'INV-SUP-90812',
        items: [
          {
            productId: PRODUCT_A.id,
            receivedQuantity: 30,
            unitCost: 420.0, // updated cost from 400 to 420
            batchNumber: 'BATCH-2026-X1',
            expiryDate: '2028-12-31',
          },
        ],
      });

      // 1. GRN header verification
      expect(grn.grnNumber).toMatch(/^GRN-\d{4}-\d{4}$/);
      expect(grn.status).toBe('RECEIVED');
      expect(grn.totalCost).toBe(30 * 420.0);
      expect(grn.items.length).toBe(1);

      // 2. Atomic stock increment: 20 + 30 = 50
      expect(inMemoryStockLevels[0].quantityOnHand).toBe(50.0);

      // 3. Append-only stock movement
      expect(inMemoryStockMovements.length).toBe(1);
      const movement = inMemoryStockMovements[0];
      expect(movement.movementType).toBe('PURCHASE_RECEIPT');
      expect(movement.quantity).toBe(30);
      expect(movement.balanceBefore).toBe(20.0);
      expect(movement.balanceAfter).toBe(50.0);
      expect(movement.referenceId).toBe(grn.id);

      // 4. Product latest cost updated to 420
      expect(inMemoryProducts[0].costPrice).toBe(420.0);
    });

    it('should link GRN to PO and advance PO status to PARTIALLY_RECEIVED then COMPLETED', async () => {
      // 1. Create PO for 100 units of PRODUCT_B
      const po = await procurementService.createPurchaseOrder(TENANT_ID, USER_ID, {
        branchId: BRANCH_ID,
        supplierId: inMemorySuppliers[0].id,
        items: [{ productId: PRODUCT_B.id, orderedQuantity: 100, unitCost: 220.0 }],
      });

      expect(po.status).toBe('SUBMITTED');

      // 2. First partial GRN receiving 40 units
      await procurementService.createGrn(TENANT_ID, USER_ID, {
        branchId: BRANCH_ID,
        warehouseId: WAREHOUSE_ID,
        supplierId: inMemorySuppliers[0].id,
        purchaseOrderId: po.id,
        items: [{ productId: PRODUCT_B.id, receivedQuantity: 40, unitCost: 220.0 }],
      });

      const updatedPoPartial = inMemoryPurchaseOrders.find((p) => p.id === po.id);
      expect(updatedPoPartial.status).toBe('PARTIALLY_RECEIVED');

      // 3. Final GRN receiving remaining 60 units
      await procurementService.createGrn(TENANT_ID, USER_ID, {
        branchId: BRANCH_ID,
        warehouseId: WAREHOUSE_ID,
        supplierId: inMemorySuppliers[0].id,
        purchaseOrderId: po.id,
        items: [{ productId: PRODUCT_B.id, receivedQuantity: 60, unitCost: 220.0 }],
      });

      const updatedPoComplete = inMemoryPurchaseOrders.find((p) => p.id === po.id);
      expect(updatedPoComplete.status).toBe('COMPLETED');
    });
  });
});
