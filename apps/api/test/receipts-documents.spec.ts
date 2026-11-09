import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { AuthTenant, AuthUser } from '@pixelcraft/types';
import { PosService } from '../src/modules/pos/pos.service';
import { PosController } from '../src/modules/pos/pos.controller';
import { BusinessService } from '../src/modules/business/business.service';
import { BusinessController } from '../src/modules/business/business.controller';

describe('PixelCraft POS - Phase 09: Receipts, Invoices & Document Management Engine Suite', () => {
  const TENANT_ALPHA_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_BETA_ID = '22222222-2222-2222-2222-222222222222';
  const BRANCH_ALPHA_ID = 'bbbbbbbb-1111-1111-1111-111111111111';
  const BRANCH_BETA_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
  const SALE_ALPHA_ID = 'sale-alpha-1111-1111-1111-111111111111';
  const SALE_BETA_ID = 'sale-beta-2222-2222-2222-222222222222';

  const USER_ALPHA: AuthUser = {
    id: 'uuuuuuuu-1111-1111-1111-111111111111',
    email: 'admin@alpha.com',
    fullName: 'Alpha Admin',
    isActive: true,
    role: 'ADMIN',
  };

  const TENANT_ALPHA: AuthTenant = {
    id: TENANT_ALPHA_ID,
    name: 'Alpha Supermarket',
    slug: 'alpha-supermarket',
    role: 'ADMIN',
    roleId: 'role-admin-id',
    status: 'ACTIVE',
  };

  let mockPrisma: any;
  let posService: PosService;
  let posController: PosController;
  let businessService: BusinessService;
  let businessController: BusinessController;

  // In-memory data
  let inMemoryBusinesses: any[] = [];
  let inMemoryBranches: any[] = [];
  let inMemoryBusinessSettings: any[] = [];
  let inMemorySales: any[] = [];
  let inMemorySaleItems: any[] = [];
  let inMemorySalePayments: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryBusinesses = [
      {
        id: TENANT_ALPHA_ID,
        name: 'Alpha Supermarket',
        slug: 'alpha-supermarket',
        legalName: 'Alpha Retail Holdings PLC',
        businessType: 'RETAIL',
        status: 'ACTIVE',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: TENANT_BETA_ID,
        name: 'Beta Cafe',
        slug: 'beta-cafe',
        legalName: 'Beta Food & Beverage Ltd',
        businessType: 'CAFE',
        status: 'ACTIVE',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    inMemoryBranches = [
      {
        id: BRANCH_ALPHA_ID,
        tenantId: TENANT_ALPHA_ID,
        code: 'COL-01',
        name: 'Alpha Flagship Store',
        address: '123 Galle Road, Colombo 03',
        phone: '+94 11 234 5678',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: BRANCH_BETA_ID,
        tenantId: TENANT_BETA_ID,
        code: 'KND-01',
        name: 'Beta Kandy Outlet',
        address: '45 Peradeniya Road, Kandy',
        phone: '+94 81 234 5678',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    inMemoryBusinessSettings = [
      {
        id: 'settings-alpha-id',
        tenantId: TENANT_ALPHA_ID,
        invoicePrefix: 'INV-2026-',
        taxNumber: 'VAT-987654321',
        taxRate: 8.0,
        isTaxInclusive: false,
        enableLoyalty: true,
        receiptPaperSize: 'MM_80',
        showLogoOnReceipt: true,
        showTaxDetails: true,
        showBarcodeOnReceipt: true,
        receiptHeader: 'Welcome to Alpha Supermarket - Always Fresh!',
        receiptFooter: 'Thank you for shopping with us! Exchange within 7 days with original receipt.',
        returnPolicyText: 'Perishable goods are non-returnable. Unopened non-perishables exchangeable within 7 days.',
        negativeStockPolicy: 'DISALLOW',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        id: 'settings-beta-id',
        tenantId: TENANT_BETA_ID,
        invoicePrefix: 'BETA-',
        taxNumber: 'VAT-112233445',
        taxRate: 5.0,
        isTaxInclusive: true,
        enableLoyalty: false,
        receiptPaperSize: 'MM_58',
        showLogoOnReceipt: true,
        showTaxDetails: false,
        showBarcodeOnReceipt: true,
        receiptHeader: 'Beta Coffee & Bakery',
        receiptFooter: 'Have a great day!',
        returnPolicyText: 'Food items once served cannot be returned.',
        negativeStockPolicy: 'ALLOW',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ];

    inMemorySales = [
      {
        id: SALE_ALPHA_ID,
        tenantId: TENANT_ALPHA_ID,
        branchId: BRANCH_ALPHA_ID,
        cashierId: USER_ALPHA.id,
        invoiceNumber: 'INV-2026-00001',
        orderType: 'RETAIL_WALKIN',
        customerName: 'Saman Perera',
        status: 'COMPLETED',
        subtotal: 1200.0,
        discountAmount: 100.0,
        taxAmount: 88.0,
        totalAmount: 1188.0,
        paidAmount: 1500.0,
        changeDue: 312.0,
        idempotencyKey: 'idemp-alpha-001',
        notes: null,
        createdAt: new Date('2026-11-09T10:30:00Z'),
        updatedAt: new Date('2026-11-09T10:30:00Z'),
        deletedAt: null,
      },
      {
        id: SALE_BETA_ID,
        tenantId: TENANT_BETA_ID,
        branchId: BRANCH_BETA_ID,
        cashierId: 'user-beta-cashier',
        invoiceNumber: 'BETA-00042',
        orderType: 'DINE_IN',
        tableNumber: 'T-04',
        status: 'COMPLETED',
        subtotal: 2500.0,
        discountAmount: 0.0,
        taxAmount: 125.0,
        totalAmount: 2625.0,
        paidAmount: 2625.0,
        changeDue: 0.0,
        idempotencyKey: 'idemp-beta-042',
        notes: null,
        createdAt: new Date('2026-11-09T11:45:00Z'),
        updatedAt: new Date('2026-11-09T11:45:00Z'),
        deletedAt: null,
      },
    ];

    inMemorySaleItems = [
      {
        id: 'item-1',
        saleId: SALE_ALPHA_ID,
        productName: 'Ceylon Organic Tea 200g',
        sku: 'TEA-001',
        unitPrice: 600.0,
        quantity: 2,
        discountAmount: 0,
        taxAmount: 44.0,
        subtotal: 1200.0,
        notes: 'Gift wrap requested',
      },
      {
        id: 'item-2',
        saleId: SALE_BETA_ID,
        productName: 'Cappuccino (Large)',
        sku: 'BEV-001',
        unitPrice: 850.0,
        quantity: 2,
        discountAmount: 0,
        taxAmount: 85.0,
        subtotal: 1700.0,
        notes: 'Extra foam',
      },
    ];

    inMemorySalePayments = [
      {
        id: 'pay-1',
        saleId: SALE_ALPHA_ID,
        paymentMethod: 'CASH',
        amount: 1500.0,
        reference: null,
        status: 'SUCCESS',
        createdAt: new Date('2026-11-09T10:30:00Z'),
      },
      {
        id: 'pay-2',
        saleId: SALE_BETA_ID,
        paymentMethod: 'CARD',
        amount: 2625.0,
        reference: 'AUTH-998877',
        status: 'SUCCESS',
        createdAt: new Date('2026-11-09T11:45:00Z'),
      },
    ];

    inMemoryAuditLogs = [];

    mockPrisma = {
      withTenantContext: vi.fn(async (_tenantId: string, callback: any) => {
        return callback(mockPrisma);
      }),
      business: {
        findFirst: vi.fn(async ({ where }: any) => {
          const b = inMemoryBusinesses.find((x) => x.id === where.id);
          if (!b) return null;
          return {
            ...b,
            settings: inMemoryBusinessSettings.find((s) => s.tenantId === b.id) || null,
            branches: inMemoryBranches.filter((br) => br.tenantId === b.id),
          };
        }),
      },
      businessSetting: {
        findUnique: vi.fn(async ({ where }: any) => {
          return inMemoryBusinessSettings.find((s) => s.tenantId === where.tenantId) || null;
        }),
        upsert: vi.fn(async ({ where, update, create }: any) => {
          let setting = inMemoryBusinessSettings.find((s) => s.tenantId === where.tenantId);
          if (setting) {
            Object.assign(setting, update, { updatedAt: new Date() });
          } else {
            setting = {
              id: `settings-${Date.now()}`,
              tenantId: where.tenantId,
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            inMemoryBusinessSettings.push(setting);
          }
          return setting;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const setting = inMemoryBusinessSettings.find((s) => s.tenantId === where.tenantId);
          if (setting) {
            Object.assign(setting, data, { updatedAt: new Date() });
          }
          return setting;
        }),
      },
      sale: {
        findFirst: vi.fn(async ({ where, include }: any) => {
          const found = inMemorySales.find((s) => {
            if (where.id && s.id !== where.id) return false;
            if (where.tenantId && s.tenantId !== where.tenantId) return false;
            return true;
          });
          if (!found) return null;

          const business = inMemoryBusinesses.find((b) => b.id === found.tenantId);
          const settings = inMemoryBusinessSettings.find((s) => s.tenantId === found.tenantId);
          const branch = inMemoryBranches.find((br) => br.id === found.branchId);

          return {
            ...found,
            items: include?.items
              ? inMemorySaleItems.filter((i) => i.saleId === found.id)
              : undefined,
            payments: include?.payments
              ? inMemorySalePayments.filter((p) => p.saleId === found.id)
              : undefined,
            cashier: include?.cashier
              ? { id: found.cashierId, fullName: 'Alpha Cashier', email: 'cashier@alpha.com' }
              : undefined,
            branch: include?.branch ? branch : undefined,
            business: include?.business
              ? {
                  ...business,
                  settings: include.business.include?.settings ? settings : undefined,
                }
              : undefined,
          };
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          inMemoryAuditLogs.push({ id: `audit-${Date.now()}`, ...data, createdAt: new Date() });
        }),
      },
    };

    posService = new PosService(mockPrisma);
    posController = new PosController(posService);
    businessService = new BusinessService(mockPrisma);
    businessController = new BusinessController(businessService);
  });

  // =========================================================================
  // Test 1: Querying receipt payload returns branding, invoice #, and amounts
  // =========================================================================
  it('Test 1: should return complete receipt payload with branding, invoice number, and exact decimal amounts', async () => {
    const receipt = await posController.getReceiptDocument(TENANT_ALPHA, SALE_ALPHA_ID);

    expect(receipt).toBeDefined();
    // 1. Business Branding & Profile
    expect(receipt.business.name).toBe('Alpha Supermarket');
    expect(receipt.business.legalName).toBe('Alpha Retail Holdings PLC');
    expect(receipt.business.currency).toBe('LKR');

    // 2. Branch Details
    expect(receipt.branch.name).toBe('Alpha Flagship Store');
    expect(receipt.branch.address).toBe('123 Galle Road, Colombo 03');
    expect(receipt.branch.phone).toBe('+94 11 234 5678');

    // 3. Sequential Invoice Number and Sale Financials
    expect(receipt.sale.invoiceNumber).toBe('INV-2026-00001');
    expect(receipt.sale.subtotal).toBe(1200.0);
    expect(receipt.sale.discountAmount).toBe(100.0);
    expect(receipt.sale.taxAmount).toBe(88.0);
    expect(receipt.sale.totalAmount).toBe(1188.0);
    expect(receipt.sale.paidAmount).toBe(1500.0);
    expect(receipt.sale.changeDue).toBe(312.0);

    // 4. Traceable Barcode Identifiers
    expect(receipt.barcodeData.format).toBe('CODE128');
    expect(receipt.barcodeData.code).toBe('INV-2026-00001');
    expect(receipt.barcodeData.verificationUrl).toContain('INV-2026-00001');

    // 5. Itemized Breakdown & Notes
    expect(receipt.sale.items).toHaveLength(1);
    expect(receipt.sale.items[0]?.productName).toBe('Ceylon Organic Tea 200g');
    expect(receipt.sale.items[0]?.notes).toBe('Gift wrap requested');

    // 6. Tax Breakdown
    expect(receipt.taxBreakdown).toHaveLength(1);
    expect(receipt.taxBreakdown[0]?.rate).toBe(8.0);
    expect(receipt.taxBreakdown[0]?.taxAmount).toBe(88.0);

    // 7. Configured Notes & Policies
    expect(receipt.settings.receiptHeader).toBe('Welcome to Alpha Supermarket - Always Fresh!');
    expect(receipt.settings.receiptFooter).toContain('Exchange within 7 days with original receipt');
    expect(receipt.settings.returnPolicyText).toContain('Perishable goods are non-returnable');
  });

  // =========================================================================
  // Test 2: Multi-tenant boundary: Tenant Alpha cannot view receipts for Tenant Beta
  // =========================================================================
  it('Test 2: should enforce multi-tenant boundary and reject cross-tenant receipt and PDF inspection with 404', async () => {
    // Attempting to view Beta's receipt as Tenant Alpha
    await expect(
      posController.getReceiptDocument(TENANT_ALPHA, SALE_BETA_ID),
    ).rejects.toThrow(NotFoundException);

    // Attempting to generate PDF for Beta's sale as Tenant Alpha
    const mockRes: any = {
      set: vi.fn(),
      end: vi.fn(),
    };

    await expect(
      posController.getSalePdf(TENANT_ALPHA, SALE_BETA_ID, mockRes),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // Test 3: Updating receipt header/footer reflects immediately in receipts
  // =========================================================================
  it('Test 3: should immediately reflect updated receipt header and footer settings in subsequent receipt payloads', async () => {
    const mockReq: any = {
      headers: { 'user-agent': 'Vitest-Agent/1.0' },
    };

    // Update settings via BusinessController
    const updatedSettings = await businessController.updateReceiptSettings(
      TENANT_ALPHA,
      USER_ALPHA,
      {
        receiptHeader: '★ Special New Year Festive Promotion ★',
        receiptFooter: 'Thank you for choosing Alpha! Happy New Year 2026!',
        returnPolicyText: 'Extended 14-day holiday exchange policy in effect.',
        receiptPaperSize: 'A4',
      },
      '192.168.1.100',
      mockReq,
    );

    expect(updatedSettings.receiptHeader).toBe('★ Special New Year Festive Promotion ★');
    expect(updatedSettings.receiptFooter).toBe('Thank you for choosing Alpha! Happy New Year 2026!');
    expect(updatedSettings.receiptPaperSize).toBe('A4');

    // Query receipt payload and verify immediate propagation
    const receipt = await posController.getReceiptDocument(TENANT_ALPHA, SALE_ALPHA_ID);
    expect(receipt.settings.receiptHeader).toBe('★ Special New Year Festive Promotion ★');
    expect(receipt.settings.receiptFooter).toBe('Thank you for choosing Alpha! Happy New Year 2026!');
    expect(receipt.settings.returnPolicyText).toBe('Extended 14-day holiday exchange policy in effect.');
    expect(receipt.settings.paperSize).toBe('A4');
  });

  // =========================================================================
  // Test 4: PDF generation returns valid application/pdf binary buffer
  // =========================================================================
  it('Test 4: should generate and stream a valid application/pdf binary buffer without throwing errors', async () => {
    let capturedBuffer: Buffer | null = null;
    let capturedHeaders: Record<string, unknown> = {};

    const mockRes: any = {
      set: vi.fn((headers: Record<string, unknown>) => {
        capturedHeaders = headers;
      }),
      end: vi.fn((buf: Buffer) => {
        capturedBuffer = buf;
      }),
    };

    await posController.getSalePdf(TENANT_ALPHA, SALE_ALPHA_ID, mockRes);

    expect(mockRes.set).toHaveBeenCalled();
    expect(mockRes.end).toHaveBeenCalled();
    expect(capturedHeaders['Content-Type']).toBe('application/pdf');
    expect(capturedHeaders['Content-Disposition']).toBe('attachment; filename="invoice-inv-2026-00001.pdf"');

    expect(capturedBuffer).toBeDefined();
    expect(Buffer.isBuffer(capturedBuffer)).toBe(true);
    expect((capturedBuffer as unknown as Buffer).length).toBeGreaterThan(500);

    // Verify PDF Magic Bytes "%PDF-"
    const pdfHeader = (capturedBuffer as unknown as Buffer).subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  });
});
