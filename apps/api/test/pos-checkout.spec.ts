import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthTenant, AuthUser, CheckoutPayload, HoldCartPayload } from '@pixelcraft/types';
import { PosService } from '../src/modules/pos/pos.service';
import { PosController } from '../src/modules/pos/pos.controller';
import { PrismaService } from '../src/common/database/prisma.service';

describe('PixelCraft POS - Phase 08: POS Checkout & Sales Engine Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';
  const BRANCH_ALPHA_ID = 'bbbbbbbb-1111-1111-1111-111111111111';
  const BRANCH_BETA_ID = 'bbbbbbbb-2222-2222-2222-222222222222';

  const USER_ALPHA_CASHIER: AuthUser = {
    id: 'uuuuuuuu-1111-1111-1111-111111111111',
    email: 'cashier@alpha.com',
    fullName: 'Alpha Cashier',
    isActive: true,
    role: 'CASHIER',
  };

  const USER_BETA_CASHIER: AuthUser = {
    id: 'uuuuuuuu-2222-2222-2222-222222222222',
    email: 'cashier@beta.com',
    fullName: 'Beta Cashier',
    isActive: true,
    role: 'CASHIER',
  };

  const TENANT_ALPHA: AuthTenant = {
    id: TENANT_ALPHA_ID,
    name: 'Alpha Supermarket',
    slug: 'alpha-supermarket',
    role: 'CASHIER',
    roleId: 'role-cashier-id',
    status: 'ACTIVE',
  };

  const TENANT_BETA: AuthTenant = {
    id: TENANT_BETA_ID,
    name: 'Beta Cafe',
    slug: 'beta-cafe',
    role: 'CASHIER',
    roleId: 'role-beta-id',
    status: 'ACTIVE',
  };

  let mockPrisma: any;
  let posService: PosService;
  let posController: PosController;

  // In-memory data store for isolated testing
  let inMemoryBranches: any[] = [];
  let inMemorySales: any[] = [];
  let inMemorySaleItems: any[] = [];
  let inMemorySalePayments: any[] = [];
  let inMemoryHeldCarts: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryBranches = [
      {
        id: BRANCH_ALPHA_ID,
        tenantId: TENANT_ALPHA_ID,
        name: 'Main Flagship Branch',
        isActive: true,
      },
      {
        id: BRANCH_BETA_ID,
        tenantId: TENANT_BETA_ID,
        name: 'Beta Branch',
        isActive: true,
      },
    ];
    inMemorySales = [];
    inMemorySaleItems = [];
    inMemorySalePayments = [];
    inMemoryHeldCarts = [];
    inMemoryAuditLogs = [];

    mockPrisma = {
      $transaction: vi.fn(async (callback: any) => {
        return callback(mockPrisma);
      }),
      withTenantContext: vi.fn(async (_tenantId: string, callback: any) => {
        return callback(mockPrisma);
      }),
      branch: {
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            inMemoryBranches.find(
              (b) =>
                b.id === where.id &&
                b.tenantId === where.tenantId &&
                (where.isActive === undefined || b.isActive === where.isActive),
            ) || null
          );
        }),
      },
      businessSetting: {
        findUnique: vi.fn(async ({ where }: any) => {
          return {
            tenantId: where.tenantId,
            invoicePrefix: 'INV-',
            taxRate: 8.0,
          };
        }),
      },
      sale: {
        count: vi.fn(async ({ where }: any) => {
          return inMemorySales.filter((s) => s.tenantId === where.tenantId).length;
        }),
        create: vi.fn(async ({ data }: any) => {
          const newSale = {
            id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySales.push(newSale);
          return newSale;
        }),
        findFirst: vi.fn(async ({ where, include }: any) => {
          const found = inMemorySales.find((s) => {
            if (where.id && s.id !== where.id) return false;
            if (where.tenantId && s.tenantId !== where.tenantId) return false;
            if (where.idempotencyKey && s.idempotencyKey !== where.idempotencyKey) return false;
            return true;
          });
          if (!found) return null;
          return {
            ...found,
            items: include?.items
              ? inMemorySaleItems.filter((i) => i.saleId === found.id)
              : undefined,
            payments: include?.payments
              ? inMemorySalePayments.filter((p) => p.saleId === found.id)
              : undefined,
            cashier: include?.cashier
              ? { id: found.cashierId, fullName: 'Test Cashier', email: 'cashier@test.com' }
              : undefined,
          };
        }),
        findUnique: vi.fn(async ({ where, include }: any) => {
          const found = inMemorySales.find((s) => s.id === where.id);
          if (!found) return null;
          return {
            ...found,
            items: include?.items
              ? inMemorySaleItems.filter((i) => i.saleId === found.id)
              : undefined,
            payments: include?.payments
              ? inMemorySalePayments.filter((p) => p.saleId === found.id)
              : undefined,
            cashier: include?.cashier
              ? { id: found.cashierId, fullName: 'Test Cashier', email: 'cashier@test.com' }
              : undefined,
          };
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return inMemorySales
            .filter((s) => {
              if (where.tenantId && s.tenantId !== where.tenantId) return false;
              if (where.branchId && s.branchId !== where.branchId) return false;
              return true;
            })
            .map((found) => ({
              ...found,
              items: inMemorySaleItems.filter((i) => i.saleId === found.id),
              payments: inMemorySalePayments.filter((p) => p.saleId === found.id),
            }));
        }),
        update: vi.fn(async ({ where, data, include }: any) => {
          const index = inMemorySales.findIndex((s) => s.id === where.id);
          if (index === -1) throw new Error('Sale not found');
          inMemorySales[index] = { ...inMemorySales[index], ...data, updatedAt: new Date() };
          const found = inMemorySales[index];
          return {
            ...found,
            items: include?.items
              ? inMemorySaleItems.filter((i) => i.saleId === found.id)
              : undefined,
            payments: include?.payments
              ? inMemorySalePayments.filter((p) => p.saleId === found.id)
              : undefined,
            cashier: include?.cashier
              ? { id: found.cashierId, fullName: 'Test Cashier', email: 'cashier@test.com' }
              : undefined,
          };
        }),
      },
      saleItem: {
        create: vi.fn(async ({ data }: any) => {
          const newItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySaleItems.push(newItem);
          return newItem;
        }),
      },
      salePayment: {
        create: vi.fn(async ({ data }: any) => {
          const newPayment = {
            id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySalePayments.push(newPayment);
          return newPayment;
        }),
      },
      heldCart: {
        create: vi.fn(async ({ data }: any) => {
          const newCart = {
            id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryHeldCarts.push(newCart);
          return newCart;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            inMemoryHeldCarts.find(
              (c) =>
                (!where.id || c.id === where.id) &&
                (!where.tenantId || c.tenantId === where.tenantId),
            ) || null
          );
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryHeldCarts.filter(
            (c) =>
              (!where.tenantId || c.tenantId === where.tenantId) &&
              (!where.branchId || c.branchId === where.branchId),
          );
        }),
        delete: vi.fn(async ({ where }: any) => {
          const index = inMemoryHeldCarts.findIndex((c) => c.id === where.id);
          if (index !== -1) {
            const deleted = inMemoryHeldCarts[index];
            inMemoryHeldCarts.splice(index, 1);
            return deleted;
          }
          return null;
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
          inMemoryAuditLogs.push(log);
          return log;
        }),
      },
    };

    posService = new PosService(mockPrisma as unknown as PrismaService);
    posController = new PosController(posService);
  });

  it('Test 1: Complete checkout with standard products calculates exact decimal subtotal, tax, and total', async () => {
    const payload: CheckoutPayload = {
      branchId: BRANCH_ALPHA_ID,
      orderType: 'RETAIL_WALKIN',
      subtotal: 1500.0,
      discountAmount: 100.0,
      taxAmount: 112.0, // 8% on net 1400 = 112
      totalAmount: 1512.0,
      paidAmount: 2000.0,
      changeDue: 488.0,
      items: [
        {
          productName: 'Ceylon Black Tea 200g',
          sku: 'TEA-BLK-200',
          unitPrice: 500.0,
          quantity: 3,
          discountAmount: 0,
          taxAmount: 0,
          subtotal: 1500.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 2000.0,
        },
      ],
    };

    const sale = await posController.checkout(TENANT_ALPHA, USER_ALPHA_CASHIER, payload);

    expect(sale).toBeDefined();
    expect(sale.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(sale.status).toBe('COMPLETED');
    expect(sale.subtotal).toBe(1500.0);
    expect(sale.discountAmount).toBe(100.0);
    expect(sale.taxAmount).toBe(112.0);
    expect(sale.totalAmount).toBe(1512.0);
    expect(sale.paidAmount).toBe(2000.0);
    expect(sale.changeDue).toBe(488.0);
    expect(sale.items).toHaveLength(1);
    expect(sale.payments).toHaveLength(1);
    expect(sale.payments[0]?.paymentMethod).toBe('CASH');

    // Verify audit log entry
    expect(inMemoryAuditLogs).toHaveLength(1);
    expect(inMemoryAuditLogs[0]?.action).toBe('SALE_COMPLETED');
  });

  it('Test 2: Multi-payment checkout (Rs. 5,000 cash + Rs. 3,000 card) successfully settles total', async () => {
    const payload: CheckoutPayload = {
      branchId: BRANCH_ALPHA_ID,
      orderType: 'DINE_IN',
      tableNumber: 'T-04',
      subtotal: 7500.0,
      discountAmount: 0.0,
      taxAmount: 500.0,
      totalAmount: 8000.0,
      paidAmount: 8000.0,
      changeDue: 0.0,
      items: [
        {
          productName: 'Seafood Platter Deluxe',
          sku: 'DINE-SEA-01',
          unitPrice: 7500.0,
          quantity: 1,
          subtotal: 7500.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 5000.0,
        },
        {
          paymentMethod: 'CARD',
          amount: 3000.0,
          reference: 'VISA-4421',
        },
      ],
    };

    const sale = await posController.checkout(TENANT_ALPHA, USER_ALPHA_CASHIER, payload);

    expect(sale.totalAmount).toBe(8000.0);
    expect(sale.paidAmount).toBe(8000.0);
    expect(sale.changeDue).toBe(0.0);
    expect(sale.payments).toHaveLength(2);
    expect(sale.payments.map((p) => p.paymentMethod)).toEqual(['CASH', 'CARD']);
    expect(sale.tableNumber).toBe('T-04');
    expect(sale.orderType).toBe('DINE_IN');
  });

  it('Test 3: Idempotent submission: Sending the same idempotencyKey returns the original sale without creating duplicate rows', async () => {
    const idempotencyKey = 'unique-idemp-checkout-key-999';

    const payload: CheckoutPayload = {
      branchId: BRANCH_ALPHA_ID,
      orderType: 'RETAIL_WALKIN',
      idempotencyKey,
      subtotal: 250.0,
      discountAmount: 0,
      taxAmount: 20.0,
      totalAmount: 270.0,
      paidAmount: 300.0,
      changeDue: 30.0,
      items: [
        {
          productName: 'Bottled Spring Water 500ml',
          sku: 'BEV-WTR-500',
          unitPrice: 250.0,
          quantity: 1,
          subtotal: 250.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 300.0,
        },
      ],
    };

    // First submission
    const firstSale = await posController.checkout(TENANT_ALPHA, USER_ALPHA_CASHIER, payload);
    expect(firstSale.idempotencyKey).toBe(idempotencyKey);
    const initialSalesCount = inMemorySales.length;

    // Duplicate submission with identical idempotencyKey
    const duplicateSale = await posController.checkout(TENANT_ALPHA, USER_ALPHA_CASHIER, payload);

    // Must return the exact same invoice without creating a new sale record in database
    expect(duplicateSale.invoiceNumber).toBe(firstSale.invoiceNumber);
    expect(duplicateSale.id).toBe(firstSale.id);
    expect(inMemorySales.length).toBe(initialSalesCount);
  });

  it('Test 4: Tenant isolation: Tenant Alpha cannot view or resume Tenant Beta held carts or sales', async () => {
    // 1. Create a held cart for Tenant Beta
    const betaHoldPayload: HoldCartPayload = {
      branchId: BRANCH_BETA_ID,
      cartReference: 'Beta Table VIP-1',
      cartData: {
        orderType: 'DINE_IN',
        tableNumber: 'VIP-1',
        items: [],
      },
    };

    const betaCart = await posController.holdCart(TENANT_BETA, USER_BETA_CASHIER, betaHoldPayload);
    expect(betaCart.tenantId).toBe(TENANT_BETA_ID);

    // 2. Tenant Alpha queries held carts - should NOT see Beta's cart
    const alphaCarts = await posController.getHeldCarts(TENANT_ALPHA);
    expect(alphaCarts.find((c) => c.id === betaCart.id)).toBeUndefined();

    // 3. Tenant Alpha attempts to resume Beta's held cart - must be rejected with 404
    await expect(posController.resumeCart(TENANT_ALPHA, betaCart.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Test 5: Hold and Resume cart workflow preserves item details, notes, and quantities', async () => {
    const holdPayload: HoldCartPayload = {
      branchId: BRANCH_ALPHA_ID,
      cartReference: 'Held Order - Customer Anura',
      cartData: {
        orderType: 'RETAIL_WALKIN',
        customerName: 'Anura Kumara',
        notes: 'Hold for 10 minutes while customer grabs cash',
        items: [
          {
            productName: 'Organic Cinnamon 100g',
            sku: 'SPICE-CIN-100',
            unitPrice: 650.0,
            quantity: 2,
            subtotal: 1300.0,
            notes: 'Glass jar packaging',
          },
        ],
        discountAmount: 50.0,
      },
    };

    // 1. Hold cart
    const held = await posController.holdCart(TENANT_ALPHA, USER_ALPHA_CASHIER, holdPayload);
    expect(held.cartReference).toBe('Held Order - Customer Anura');
    const heldData = held.cartData as any;
    expect(heldData.customerName).toBe('Anura Kumara');
    expect(heldData.items).toHaveLength(1);

    // 2. Resume cart
    const resumed = await posController.resumeCart(TENANT_ALPHA, held.id);
    expect(resumed.id).toBe(held.id);
    const resumedData = resumed.cartData as any;
    expect(resumedData.customerName).toBe('Anura Kumara');
    expect(resumedData.items[0]?.sku).toBe('SPICE-CIN-100');
    expect(resumedData.items[0]?.notes).toBe('Glass jar packaging');

    // 3. Cart should no longer exist in held list
    const remainingHeld = await posController.getHeldCarts(TENANT_ALPHA);
    expect(remainingHeld.find((c) => c.id === held.id)).toBeUndefined();
  });

  it('Test 6: Void sale workflow updates sale status to VOIDED and logs audit event', async () => {
    // First, complete a sale
    const payload: CheckoutPayload = {
      branchId: BRANCH_ALPHA_ID,
      orderType: 'RETAIL_WALKIN',
      subtotal: 1000.0,
      totalAmount: 1000.0,
      paidAmount: 1000.0,
      items: [
        {
          productName: 'Sample Goods',
          sku: 'SMPL-01',
          unitPrice: 1000.0,
          quantity: 1,
          subtotal: 1000.0,
        },
      ],
      payments: [{ paymentMethod: 'CASH', amount: 1000.0 }],
    };

    const sale = await posController.checkout(TENANT_ALPHA, USER_ALPHA_CASHIER, payload);
    expect(sale.status).toBe('COMPLETED');

    // Void the sale
    const voided = await posController.voidSale(TENANT_ALPHA, USER_ALPHA_CASHIER, sale.id, {
      reason: 'Customer requested instant cancellation',
    });

    expect(voided.status).toBe('VOIDED');
    expect(voided.notes).toContain('Customer requested instant cancellation');

    // Attempting to void again should fail with BadRequestException
    await expect(
      posController.voidSale(TENANT_ALPHA, USER_ALPHA_CASHIER, sale.id, {
        reason: 'Duplicate void attempt',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Test 7: Mathematical validation rejects underpayment with BadRequestException', async () => {
    const underpaidPayload: CheckoutPayload = {
      branchId: BRANCH_ALPHA_ID,
      orderType: 'RETAIL_WALKIN',
      subtotal: 1000.0,
      totalAmount: 1000.0,
      paidAmount: 500.0, // Insufficient: Rs. 500 paid for Rs. 1000 order
      items: [
        {
          productName: 'Item',
          sku: 'ITM-1',
          unitPrice: 1000.0,
          quantity: 1,
          subtotal: 1000.0,
        },
      ],
      payments: [{ paymentMethod: 'CASH', amount: 500.0 }],
    };

    await expect(
      posController.checkout(TENANT_ALPHA, USER_ALPHA_CASHIER, underpaidPayload),
    ).rejects.toThrow(BadRequestException);
  });
});
