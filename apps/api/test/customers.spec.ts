import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthTenant, AuthUser } from '@pixelcraft/types';
import { CustomersService } from '../src/modules/customers/customers.service';
import { CustomersController } from '../src/modules/customers/customers.controller';
import { PosService } from '../src/modules/pos/pos.service';

describe('PixelCraft POS - Phase 12: Customer CRM, Khata Ledger & Debt Settlement Suite', () => {
  const TENANT_ID = '0fef1423-5d89-4147-8af8-17c7e641c88a';
  const BRANCH_ID = 'bbbbbbbb-1111-1111-1111-111111111111';
  const CASHIER_ID = 'uuuuuuuu-1111-1111-1111-111111111111';

  const AUTH_TENANT: AuthTenant = {
    id: TENANT_ID,
    name: 'Deegayu Weda Madura',
    slug: 'deegayu',
    role: 'MANAGER',
    roleId: 'role-mgr-001',
    status: 'ACTIVE',
  };

  const AUTH_USER: AuthUser = {
    id: CASHIER_ID,
    email: 'cashier@deegayu.lk',
    fullName: 'Main Cashier',
    isActive: true,
    role: 'CASHIER',
  };

  let mockPrisma: any;
  let customersService: CustomersService;
  let customersController: CustomersController;
  let posService: PosService;

  // In-memory data store
  let inMemoryCustomers: any[] = [];
  let inMemoryLedgers: any[] = [];
  let inMemoryPayments: any[] = [];
  let inMemorySales: any[] = [];
  let inMemorySaleItems: any[] = [];
  let inMemorySalePayments: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryCustomers = [
      {
        id: 'cust-001',
        tenantId: TENANT_ID,
        name: 'Dr. C. Senanayake',
        phone: '0771234567',
        email: 'senanayake@ayur.lk',
        nicNumber: '197512345678',
        address: 'Colombo 07',
        customerType: 'WHOLESALE',
        creditLimit: 150000.0,
        currentBalance: 45000.0,
        loyaltyPoints: 120,
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        id: 'cust-002',
        tenantId: TENANT_ID,
        name: 'Mrs. Malini Perera',
        phone: '0719876543',
        email: 'malini.p@gmail.com',
        nicNumber: '198287654321',
        address: 'Nugegoda',
        customerType: 'RETAIL_CREDIT',
        creditLimit: 30000.0,
        currentBalance: 12500.0,
        loyaltyPoints: 45,
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date('2026-01-02T10:00:00Z'),
        updatedAt: new Date('2026-01-02T10:00:00Z'),
      },
      {
        id: 'cust-003',
        tenantId: TENANT_ID,
        name: 'Mr. Sunil Jayasinghe',
        phone: '0723456789',
        email: 'sunil@yahoo.com',
        nicNumber: '196834567890',
        address: 'Kandy',
        customerType: 'RETAIL_CREDIT',
        creditLimit: 25000.0,
        currentBalance: 24500.0, // Almost maxed out
        loyaltyPoints: 80,
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: new Date('2026-01-03T10:00:00Z'),
        updatedAt: new Date('2026-01-03T10:00:00Z'),
      },
      {
        id: 'cust-suspended',
        tenantId: TENANT_ID,
        name: 'Suspended Debtor',
        phone: '0700000000',
        email: 'defaulter@baddebt.lk',
        nicNumber: '199000000000',
        address: 'Unknown',
        customerType: 'RETAIL_CREDIT',
        creditLimit: 10000.0,
        currentBalance: 10000.0,
        loyaltyPoints: 0,
        status: 'SUSPENDED',
        deletedAt: null,
        createdAt: new Date('2026-01-04T10:00:00Z'),
        updatedAt: new Date('2026-01-04T10:00:00Z'),
      },
    ];

    inMemoryLedgers = [
      {
        id: 'led-001',
        tenantId: TENANT_ID,
        customerId: 'cust-001',
        entryType: 'CREDIT_SALE',
        referenceId: 'INV-2026-00001',
        debitAmount: 45000.0,
        creditAmount: 0.0,
        runningBalance: 45000.0,
        notes: 'Initial wholesale order',
        createdById: CASHIER_ID,
        createdAt: new Date('2026-01-01T11:00:00Z'),
      },
    ];

    inMemoryPayments = [];
    inMemorySales = [];
    inMemorySaleItems = [];
    inMemorySalePayments = [];
    inMemoryAuditLogs = [];

    mockPrisma = {
      customer: {
        findFirst: vi.fn(async ({ where }: any) => {
          return inMemoryCustomers.find((c) => {
            if (where.tenantId && c.tenantId !== where.tenantId) return false;
            if (where.id && c.id !== where.id) return false;
            if (where.deletedAt === null && c.deletedAt !== null) return false;
            return true;
          }) || null;
        }),
        findMany: vi.fn(async ({ where, skip = 0, take = 50 }: any) => {
          let list = inMemoryCustomers.filter((c) => {
            if (where.tenantId && c.tenantId !== where.tenantId) return false;
            if (where.deletedAt === null && c.deletedAt !== null) return false;
            if (where.customerType && c.customerType !== where.customerType) return false;
            if (where.status && c.status !== where.status) return false;
            if (where.currentBalance?.gt !== undefined && !(c.currentBalance > where.currentBalance.gt)) return false;
            if (where.OR) {
              const matches = where.OR.some((term: any) => {
                if (term.name?.contains) {
                  return c.name.toLowerCase().includes(term.name.contains.toLowerCase());
                }
                if (term.phone?.contains) {
                  return c.phone && c.phone.includes(term.phone.contains);
                }
                if (term.email?.contains) {
                  return c.email && c.email.toLowerCase().includes(term.email.contains.toLowerCase());
                }
                if (term.nicNumber?.contains) {
                  return c.nicNumber && c.nicNumber.toLowerCase().includes(term.nicNumber.contains.toLowerCase());
                }
                return false;
              });
              if (!matches) return false;
            }
            return true;
          });
          return list.slice(skip, skip + take);
        }),
        count: vi.fn(async ({ where }: any) => {
          return inMemoryCustomers.filter((c) => {
            if (where.tenantId && c.tenantId !== where.tenantId) return false;
            if (where.deletedAt === null && c.deletedAt !== null) return false;
            if (where.currentBalance?.gt !== undefined && !(c.currentBalance > where.currentBalance.gt)) return false;
            if (where.OR) {
              const matches = where.OR.some((term: any) => {
                if (term.name?.contains) {
                  return c.name.toLowerCase().includes(term.name.contains.toLowerCase());
                }
                if (term.phone?.contains) {
                  return c.phone && c.phone.includes(term.phone.contains);
                }
                return false;
              });
              if (!matches) return false;
            }
            return true;
          }).length;
        }),
        aggregate: vi.fn(async ({ where }: any) => {
          const list = inMemoryCustomers.filter((c) => {
            if (where.tenantId && c.tenantId !== where.tenantId) return false;
            if (where.deletedAt === null && c.deletedAt !== null) return false;
            return true;
          });
          const currentBalance = list.reduce((sum, c) => sum + Number(c.currentBalance), 0);
          const creditLimit = list.reduce((sum, c) => sum + Number(c.creditLimit), 0);
          return {
            _sum: {
              currentBalance,
              creditLimit,
            },
          };
        }),
        create: vi.fn(async ({ data }: any) => {
          const newCust = {
            id: `cust-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryCustomers.push(newCust);
          return newCust;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const idx = inMemoryCustomers.findIndex((c) => c.id === where.id);
          if (idx === -1) throw new Error('Customer not found for update');
          inMemoryCustomers[idx] = {
            ...inMemoryCustomers[idx],
            ...data,
            updatedAt: new Date(),
          };
          return inMemoryCustomers[idx];
        }),
      },
      customerLedger: {
        findMany: vi.fn(async ({ where }: any) => {
          return inMemoryLedgers
            .filter((l) => l.tenantId === where.tenantId && l.customerId === where.customerId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }),
        create: vi.fn(async ({ data }: any) => {
          const entry = {
            id: `led-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          inMemoryLedgers.push(entry);
          return entry;
        }),
      },
      customerPayment: {
        count: vi.fn(async ({ where }: any) => {
          return inMemoryPayments.filter((p) => p.tenantId === where.tenantId).length;
        }),
        create: vi.fn(async ({ data }: any) => {
          const payment = {
            id: `pay-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          inMemoryPayments.push(payment);
          return payment;
        }),
      },
      branch: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.id === BRANCH_ID) {
            return { id: BRANCH_ID, tenantId: where.tenantId, name: 'Main Clinic Branch', isActive: true };
          }
          return null;
        }),
      },
      businessSetting: {
        findUnique: vi.fn(async () => ({ invoicePrefix: 'INV-' })),
      },
      sale: {
        count: vi.fn(async () => inMemorySales.length),
        create: vi.fn(async ({ data }: any) => {
          const sale = {
            id: `sale-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemorySales.push(sale);
          return sale;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const s = inMemorySales.find((sale) => sale.id === where.id);
          if (!s) return null;
          return {
            ...s,
            items: inMemorySaleItems.filter((i) => i.saleId === s.id),
            payments: inMemorySalePayments.filter((p) => p.saleId === s.id),
            cashier: { id: CASHIER_ID, fullName: 'Main Cashier', email: 'cashier@deegayu.lk' },
          };
        }),
      },
      saleItem: {
        create: vi.fn(async ({ data }: any) => {
          const item = { id: `si-${Date.now()}`, createdAt: new Date(), ...data };
          inMemorySaleItems.push(item);
          return item;
        }),
      },
      salePayment: {
        create: vi.fn(async ({ data }: any) => {
          const p = { id: `sp-${Date.now()}`, createdAt: new Date(), ...data };
          inMemorySalePayments.push(p);
          return p;
        }),
      },
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          const log = { id: `al-${Date.now()}`, ...data };
          inMemoryAuditLogs.push(log);
          return log;
        }),
      },
      warehouse: {
        findFirst: vi.fn(async () => null),
      },
      withTenantContext: vi.fn(async (_tenantId: string, callback: any) => {
        return callback(mockPrisma);
      }),
    };

    customersService = new CustomersService(mockPrisma as any);
    customersController = new CustomersController(customersService);
    posService = new PosService(mockPrisma as any);
  });

  // =========================================================================
  // 1. CUSTOMER CRM & QUERY TESTS
  // =========================================================================
  describe('Customer CRM Queries & Telemetry', () => {
    it('should query paginated customers and calculate availableCredit accurately', async () => {
      const res = await customersService.getCustomers(TENANT_ID, { page: 1, limit: 10 });
      expect(res.items.length).toBe(4);
      expect(res.total).toBe(4);

      // Verify Dr. Senanayake credit calculation: Limit 150k - Balance 45k = Available 105k
      const doc = res.items.find((c) => c.name === 'Dr. C. Senanayake');
      expect(doc).toBeDefined();
      expect(doc?.creditLimit).toBe(150000.0);
      expect(doc?.currentBalance).toBe(45000.0);
      expect(doc?.availableCredit).toBe(105000.0);
    });

    it('should filter customers by search query (name, phone, nic)', async () => {
      const res = await customersService.getCustomers(TENANT_ID, { search: 'Malini' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].name).toBe('Mrs. Malini Perera');
    });

    it('should filter customers with hasDebtOnly=true', async () => {
      const res = await customersService.getCustomers(TENANT_ID, { hasDebtOnly: true });
      expect(res.items.every((c) => c.currentBalance > 0)).toBe(true);
    });

    it('should calculate customer telemetry KPI aggregates', async () => {
      const telemetry = await customersService.getTelemetry(TENANT_ID);
      expect(telemetry.totalCustomers).toBe(4);
      // 45,000 + 12,500 + 24,500 + 10,000 = 92,000
      expect(telemetry.totalReceivables).toBe(92000.0);
      expect(telemetry.activeCreditAccounts).toBe(4);
      expect(telemetry.totalCreditLimit).toBe(215000.0);
    });

    it('should create a new customer with initial zero balance', async () => {
      const created = await customersService.createCustomer(TENANT_ID, {
        name: 'Mr. Anura Kumara',
        phone: '0779998888',
        email: 'anura@parliament.lk',
        customerType: 'RETAIL_CREDIT',
        creditLimit: 50000.0,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Mr. Anura Kumara');
      expect(created.creditLimit).toBe(50000.0);
      expect(created.currentBalance).toBe(0.0);
      expect(created.availableCredit).toBe(50000.0);
      expect(created.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // 2. KHATA STATEMENT & DEBT SETTLEMENT TESTS
  // =========================================================================
  describe('Khata Statement & Debt Settlement Engine', () => {
    it('should fetch complete customer Khata ledger history', async () => {
      const { customer, ledger } = await customersService.getCustomerLedger(TENANT_ID, 'cust-001');
      expect(customer.name).toBe('Dr. C. Senanayake');
      expect(ledger.length).toBe(1);
      expect(ledger[0].entryType).toBe('CREDIT_SALE');
      expect(ledger[0].debitAmount).toBe(45000.0);
    });

    it('should record debt settlement payment, update balance atomically and append ledger', async () => {
      const prevBalance = inMemoryCustomers[0].currentBalance; // 45,000
      const settlementAmount = 20000.0;

      const result = await customersService.recordDebtSettlement(
        TENANT_ID,
        'cust-001',
        CASHIER_ID,
        {
          amount: settlementAmount,
          paymentMethod: 'CASH',
          notes: 'Partial settlement for invoice 001',
        },
      );

      // 1. Balance decreased
      expect(result.customer.currentBalance).toBe(prevBalance - settlementAmount); // 25,000
      expect(result.customer.availableCredit).toBe(150000.0 - 25000.0); // 125,000

      // 2. Payment receipt voucher generated
      expect(result.payment.receiptNumber).toMatch(/^PAY-2026-\d{4}$/);
      expect(result.payment.amount).toBe(settlementAmount);
      expect(result.payment.paymentMethod).toBe('CASH');

      // 3. Ledger entry appended
      expect(result.ledgerEntry.entryType).toBe('PAYMENT_RECEIVED');
      expect(result.ledgerEntry.creditAmount).toBe(settlementAmount);
      expect(result.ledgerEntry.runningBalance).toBe(25000.0);

      // 4. Audit Log logged
      expect(inMemoryAuditLogs.length).toBe(1);
      expect(inMemoryAuditLogs[0].action).toBe('CUSTOMER_DEBT_SETTLEMENT');
    });

    it('should reject debt settlement with zero or negative payment amount', async () => {
      await expect(
        customersService.recordDebtSettlement(TENANT_ID, 'cust-001', CASHIER_ID, {
          amount: 0,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject debt settlement for non-existent customer', async () => {
      await expect(
        customersService.recordDebtSettlement(TENANT_ID, 'cust-unknown', CASHIER_ID, {
          amount: 5000,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 3. POS CREDIT SALES & CREDIT LIMIT ENFORCEMENT
  // =========================================================================
  describe('POS Checkout - Credit Sales Enforcement', () => {
    it('should reject credit checkout when customerId is missing', async () => {
      await expect(
        posService.checkout(TENANT_ID, CASHIER_ID, {
          branchId: BRANCH_ID,
          items: [
            {
              productName: 'Herbal Elixir',
              unitPrice: 5000,
              quantity: 1,
              subtotal: 5000,
            },
          ],
          payments: [
            {
              paymentMethod: 'CUSTOMER_CREDIT',
              amount: 5000,
            },
          ],
          subtotal: 5000,
          totalAmount: 5000,
          paidAmount: 5000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject credit checkout for a SUSPENDED customer', async () => {
      await expect(
        posService.checkout(TENANT_ID, CASHIER_ID, {
          branchId: BRANCH_ID,
          customerId: 'cust-suspended',
          items: [
            {
              productName: 'Herbal Elixir',
              unitPrice: 2000,
              quantity: 1,
              subtotal: 2000,
            },
          ],
          payments: [
            {
              paymentMethod: 'CUSTOMER_CREDIT',
              amount: 2000,
            },
          ],
          subtotal: 2000,
          totalAmount: 2000,
          paidAmount: 2000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject credit sale when requested amount breaches customer credit limit', async () => {
      // Sunil Jayasinghe has creditLimit 25,000 and currentBalance 24,500. Only 500 available.
      await expect(
        posService.checkout(TENANT_ID, CASHIER_ID, {
          branchId: BRANCH_ID,
          customerId: 'cust-003',
          items: [
            {
              productName: 'Ayurvedic Treatment Box',
              unitPrice: 1500,
              quantity: 1,
              subtotal: 1500,
            },
          ],
          payments: [
            {
              paymentMethod: 'CUSTOMER_CREDIT',
              amount: 1500, // 24,500 + 1,500 = 26,000 > 25,000
            },
          ],
          subtotal: 1500,
          totalAmount: 1500,
          paidAmount: 1500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully execute credit sale within limit, increment debt and append Khata ledger', async () => {
      // Dr. Senanayake has creditLimit 150,000 and currentBalance 45,000.
      const initialBalance = inMemoryCustomers[0].currentBalance; // 45,000
      const saleAmount = 15000.0;

      const sale = await posService.checkout(TENANT_ID, CASHIER_ID, {
        branchId: BRANCH_ID,
        customerId: 'cust-001',
        customerName: 'Dr. C. Senanayake',
        items: [
          {
            productName: 'Herbal Formula bulk pack',
            unitPrice: 15000.0,
            quantity: 1,
            subtotal: 15000.0,
          },
        ],
        payments: [
          {
            paymentMethod: 'CUSTOMER_CREDIT',
            amount: saleAmount,
          },
        ],
        subtotal: saleAmount,
        totalAmount: saleAmount,
        paidAmount: saleAmount,
      });

      expect(sale.id).toBeDefined();
      expect(sale.status).toBe('COMPLETED');

      // Verify customer debt incremented
      const updatedCust = inMemoryCustomers.find((c) => c.id === 'cust-001');
      expect(updatedCust.currentBalance).toBe(initialBalance + saleAmount); // 60,000

      // Verify CustomerLedger record created
      const newLedgerEntry = inMemoryLedgers.find(
        (l) => l.customerId === 'cust-001' && l.entryType === 'CREDIT_SALE' && l.debitAmount === saleAmount,
      );
      expect(newLedgerEntry).toBeDefined();
      expect(newLedgerEntry.runningBalance).toBe(60000.0);
    });
  });
});
