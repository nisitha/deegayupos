import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CustomerDto,
  CustomerLedgerDto,
  CustomerPaymentDto,
  CustomerTelemetryDto,
  PaginatedResult,
} from '@pixelcraft/types';
import { Prisma } from '@pixelcraft/database';
import { PrismaService } from '../../common/database/prisma.service';
import {
  CreateCustomerDto,
  CustomerQueryDto,
  RecordDebtSettlementDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format Prisma customer model into CustomerDto with calculated availableCredit
   */
  private formatCustomer(customer: any): CustomerDto {
    const creditLimit = Number(customer.creditLimit || 0);
    const currentBalance = Number(customer.currentBalance || 0);
    const availableCredit = Math.max(0, creditLimit - currentBalance);

    return {
      id: customer.id,
      tenantId: customer.tenantId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      nicNumber: customer.nicNumber,
      address: customer.address,
      customerType: customer.customerType,
      creditLimit,
      currentBalance,
      availableCredit,
      loyaltyPoints: customer.loyaltyPoints || 0,
      status: customer.status,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      _count: customer._count,
    };
  }

  /**
   * 1. Query paginated customers with search, type, and debt filters
   */
  async getCustomers(
    tenantId: string,
    query: CustomerQueryDto,
  ): Promise<PaginatedResult<CustomerDto>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.customerType) {
      where.customerType = query.customerType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.hasDebtOnly) {
      where.currentBalance = { gt: 0 };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { nicNumber: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ currentBalance: 'desc' }, { updatedAt: 'desc' }],
        include: {
          _count: {
            select: {
              sales: true,
              ledgerEntries: true,
              payments: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((c) => this.formatCustomer(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 2. Retrieve customer telemetry KPI aggregates
   */
  async getTelemetry(tenantId: string): Promise<CustomerTelemetryDto> {
    const [totalCustomers, activeCreditAccounts, aggregate] = await Promise.all([
      this.prisma.customer.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.customer.count({
        where: { tenantId, deletedAt: null, currentBalance: { gt: 0 } },
      }),
      this.prisma.customer.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: {
          currentBalance: true,
          creditLimit: true,
        },
      }),
    ]);

    return {
      totalCustomers,
      totalReceivables: Number(aggregate._sum.currentBalance || 0),
      activeCreditAccounts,
      totalCreditLimit: Number(aggregate._sum.creditLimit || 0),
    };
  }

  /**
   * 3. Get single customer by ID
   */
  async getCustomerById(tenantId: string, id: string): Promise<CustomerDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: {
            sales: true,
            ledgerEntries: true,
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    return this.formatCustomer(customer);
  }

  /**
   * 4. Retrieve complete Customer Ledger (Khata statement / timeline)
   */
  async getCustomerLedger(
    tenantId: string,
    customerId: string,
  ): Promise<{ customer: CustomerDto; ledger: CustomerLedgerDto[] }> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${customerId}" not found.`);
    }

    const entries = await this.prisma.customerLedger.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const ledgerDtos: CustomerLedgerDto[] = entries.map((entry) => ({
      id: entry.id,
      tenantId: entry.tenantId,
      customerId: entry.customerId,
      customerName: customer.name,
      entryType: entry.entryType,
      referenceId: entry.referenceId,
      debitAmount: Number(entry.debitAmount),
      creditAmount: Number(entry.creditAmount),
      runningBalance: Number(entry.runningBalance),
      notes: entry.notes,
      createdById: entry.createdById,
      createdAt: entry.createdAt.toISOString(),
    }));

    return {
      customer: this.formatCustomer(customer),
      ledger: ledgerDtos,
    };
  }

  /**
   * 5. Create a new Customer
   */
  async createCustomer(
    tenantId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        nicNumber: dto.nicNumber?.trim() || null,
        address: dto.address?.trim() || null,
        customerType: dto.customerType || 'WALK_IN',
        creditLimit: dto.creditLimit ?? 0,
        currentBalance: 0,
        loyaltyPoints: dto.loyaltyPoints ?? 0,
        status: 'ACTIVE',
      },
    });

    return this.formatCustomer(customer);
  }

  /**
   * 6. Update existing Customer
   */
  async updateCustomer(
    tenantId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
        nicNumber: dto.nicNumber !== undefined ? dto.nicNumber?.trim() || null : undefined,
        address: dto.address !== undefined ? dto.address?.trim() || null : undefined,
        customerType: dto.customerType ?? undefined,
        creditLimit: dto.creditLimit !== undefined ? dto.creditLimit : undefined,
        status: dto.status ?? undefined,
      },
    });

    return this.formatCustomer(updated);
  }

  /**
   * 7. Record Debt Settlement Payment (Cash, Card, Bank Transfer)
   * Decrements outstanding currentBalance atomically within withTenantContext,
   * generates receipt PAY-YYYY-XXXX and appends CustomerLedger entry.
   */
  async recordDebtSettlement(
    tenantId: string,
    customerId: string,
    receivedById: string | null,
    dto: RecordDebtSettlementDto,
  ): Promise<{ customer: CustomerDto; payment: CustomerPaymentDto; ledgerEntry: CustomerLedgerDto }> {
    if (dto.amount <= 0) {
      throw new BadRequestException('Settlement amount must be greater than zero.');
    }

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, tenantId, deletedAt: null },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID "${customerId}" not found.`);
      }

      const prevBalance = Number(customer.currentBalance);
      const paymentAmount = Number(dto.amount);
      const newBalance = Math.max(0, prevBalance - paymentAmount);

      // Generate sequential receipt number
      const year = new Date().getFullYear();
      const count = await tx.customerPayment.count({ where: { tenantId } });
      const receiptNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`;

      // 1. Create Payment Record
      const payment = await tx.customerPayment.create({
        data: {
          tenantId,
          customerId,
          amount: paymentAmount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber?.trim() || null,
          receiptNumber,
          notes: dto.notes?.trim() || `Debt settlement via ${dto.paymentMethod}`,
          receivedById,
        },
      });

      // 2. Append Customer Ledger Entry
      const ledger = await tx.customerLedger.create({
        data: {
          tenantId,
          customerId,
          entryType: 'PAYMENT_RECEIVED',
          referenceId: receiptNumber,
          debitAmount: 0,
          creditAmount: paymentAmount,
          runningBalance: newBalance,
          notes: dto.notes?.trim() || `Debt settlement via ${dto.paymentMethod}`,
          createdById: receivedById,
        },
      });

      // 3. Atomically Update Customer Balance
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          currentBalance: newBalance,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: receivedById || customerId,
          action: 'CUSTOMER_DEBT_SETTLEMENT',
          entity: 'CustomerPayment',
          entityId: payment.id,
          newValues: {
            customerId,
            customerName: customer.name,
            amount: paymentAmount,
            paymentMethod: dto.paymentMethod,
            receiptNumber,
            prevBalance,
            newBalance,
          },
        },
      });

      return {
        customer: this.formatCustomer(updatedCustomer),
        payment: {
          id: payment.id,
          tenantId: payment.tenantId,
          customerId: payment.customerId,
          customerName: customer.name,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod,
          referenceNumber: payment.referenceNumber,
          receiptNumber: payment.receiptNumber,
          notes: payment.notes,
          receivedById: payment.receivedById,
          createdAt: payment.createdAt.toISOString(),
        },
        ledgerEntry: {
          id: ledger.id,
          tenantId: ledger.tenantId,
          customerId: ledger.customerId,
          customerName: customer.name,
          entryType: ledger.entryType,
          referenceId: ledger.referenceId,
          debitAmount: Number(ledger.debitAmount),
          creditAmount: Number(ledger.creditAmount),
          runningBalance: Number(ledger.runningBalance),
          notes: ledger.notes,
          createdById: ledger.createdById,
          createdAt: ledger.createdAt.toISOString(),
        },
      };
    });
  }
}
