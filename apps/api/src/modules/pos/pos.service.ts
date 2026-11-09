import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CheckoutPayload,
  HeldCartDto,
  HoldCartPayload,
  PaginatedResult,
  SaleDto,
  SaleItemDto,
  SalePaymentDto,
} from '@pixelcraft/types';
import type { Prisma } from '@pixelcraft/database';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process a POS Checkout sale transaction atomically.
   * Supports idempotency via idempotencyKey to prevent duplicate orders.
   */
  async checkout(
    tenantId: string,
    cashierId: string,
    payload: CheckoutPayload,
  ): Promise<SaleDto> {
    // 1. Idempotency Check
    if (payload.idempotencyKey) {
      const existingSale = await this.prisma.sale.findFirst({
        where: {
          tenantId,
          idempotencyKey: payload.idempotencyKey,
        },
        include: {
          items: true,
          payments: true,
          cashier: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      if (existingSale) {
        this.logger.log(
          `Idempotent hit for key "${payload.idempotencyKey}" - returning existing sale #${existingSale.invoiceNumber}`,
        );
        return this.mapSaleToDto(existingSale);
      }
    }

    // 2. Mathematical Integrity Validation
    const computedTotal =
      Number(payload.subtotal) -
      Number(payload.discountAmount || 0) +
      Number(payload.taxAmount || 0);

    // Allow a fractional penny variance for floating-point calculation rounding
    if (Math.abs(computedTotal - Number(payload.totalAmount)) > 0.05) {
      throw new BadRequestException(
        `Mathematical discrepancy in sale total: subtotal (${payload.subtotal}) - discount (${payload.discountAmount || 0}) + tax (${payload.taxAmount || 0}) = ${computedTotal.toFixed(2)}, but totalAmount is ${payload.totalAmount.toFixed(2)}.`,
      );
    }

    if (Number(payload.paidAmount) + 0.001 < Number(payload.totalAmount)) {
      throw new BadRequestException(
        `Paid amount (${payload.paidAmount}) is less than total amount due (${payload.totalAmount}).`,
      );
    }

    const calculatedChangeDue = Math.max(
      0,
      Number(payload.paidAmount) - Number(payload.totalAmount),
    );

    // 3. Verify Branch Context
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: payload.branchId,
        tenantId,
        isActive: true,
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${payload.branchId}" not found or inactive.`);
    }

    // 4. Atomic Transaction Execution
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      // Generate sequential invoice number
      const settings = await tx.businessSetting.findUnique({
        where: { tenantId },
      });

      const prefix = settings?.invoicePrefix || 'INV-';
      const year = new Date().getFullYear();
      const currentCount = await tx.sale.count({
        where: { tenantId },
      });

      const invoiceNumber = `${prefix}${year}-${String(currentCount + 1).padStart(5, '0')}`;

      // Create Sale Record
      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId: payload.branchId,
          registerId: payload.registerId || null,
          cashierId,
          customerId: payload.customerId || null,
          customerName: payload.customerName || null,
          invoiceNumber,
          orderType: payload.orderType || 'RETAIL_WALKIN',
          tableNumber: payload.tableNumber || null,
          status: 'COMPLETED',
          subtotal: payload.subtotal,
          discountAmount: payload.discountAmount || 0,
          taxAmount: payload.taxAmount || 0,
          totalAmount: payload.totalAmount,
          paidAmount: payload.paidAmount,
          changeDue: payload.changeDue !== undefined ? payload.changeDue : calculatedChangeDue,
          idempotencyKey: payload.idempotencyKey || null,
          notes: payload.notes || null,
        },
      });

      // Insert Line Items
      for (const item of payload.items) {
        await tx.saleItem.create({
          data: {
            tenantId,
            saleId: sale.id,
            productId: item.productId || null,
            variantId: item.variantId || null,
            productName: item.productName,
            sku: item.sku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discountAmount: item.discountAmount || 0,
            taxAmount: item.taxAmount || 0,
            subtotal: item.subtotal,
            notes: item.notes || null,
          },
        });
      }

      // Insert Payments
      for (const p of payload.payments) {
        await tx.salePayment.create({
          data: {
            tenantId,
            saleId: sale.id,
            paymentMethod: p.paymentMethod,
            amount: p.amount,
            reference: p.reference || null,
            status: 'SUCCESS',
          },
        });
      }

      // Emit Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: cashierId,
          action: 'SALE_COMPLETED',
          entity: 'Sale',
          entityId: sale.id,
          newValues: {
            invoiceNumber: sale.invoiceNumber,
            totalAmount: Number(sale.totalAmount),
            paidAmount: Number(sale.paidAmount),
            orderType: sale.orderType,
            itemCount: payload.items.length,
          },
        },
      });

      // Return complete sale with items and payments
      const completedSale = await tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          payments: true,
          cashier: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      return this.mapSaleToDto(completedSale!);
    });
  }

  /**
   * Suspend an active cart for later retrieval (e.g. Table order or held queue).
   */
  async holdCart(
    tenantId: string,
    cashierId: string,
    payload: HoldCartPayload,
  ): Promise<HeldCartDto> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: payload.branchId, tenantId },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${payload.branchId}" not found.`);
    }

    const heldCart = await this.prisma.heldCart.create({
      data: {
        tenantId,
        branchId: payload.branchId,
        registerId: payload.registerId || null,
        cashierId,
        cartReference: payload.cartReference,
        cartData: payload.cartData as unknown as Prisma.InputJsonValue,
      },
    });

    return this.mapHeldCartToDto(heldCart);
  }

  /**
   * Retrieve all suspended/held carts for the tenant/branch.
   */
  async getHeldCarts(tenantId: string, branchId?: string): Promise<HeldCartDto[]> {
    const heldCarts = await this.prisma.heldCart.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return heldCarts.map((h) => this.mapHeldCartToDto(h));
  }

  /**
   * Resume and remove a suspended cart so it can be completed on the checkout screen.
   */
  async resumeCart(tenantId: string, heldCartId: string): Promise<HeldCartDto> {
    const heldCart = await this.prisma.heldCart.findFirst({
      where: { id: heldCartId, tenantId },
    });

    if (!heldCart) {
      throw new NotFoundException(`Held cart with ID "${heldCartId}" not found.`);
    }

    await this.prisma.heldCart.delete({
      where: { id: heldCartId },
    });

    return this.mapHeldCartToDto(heldCart);
  }

  /**
   * Void an existing sale with audit tracking.
   */
  async voidSale(
    tenantId: string,
    userId: string,
    saleId: string,
    reason: string,
  ): Promise<SaleDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: true,
        payments: true,
        cashier: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID "${saleId}" not found.`);
    }

    if (sale.status === 'VOIDED') {
      throw new BadRequestException(`Sale #${sale.invoiceNumber} is already voided.`);
    }

    const updatedSale = await this.prisma.withTenantContext(tenantId, async (tx) => {
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'VOIDED',
          notes: sale.notes
            ? `${sale.notes}\n[VOID REASON: ${reason}]`
            : `[VOID REASON: ${reason}]`,
        },
        include: {
          items: true,
          payments: true,
          cashier: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SALE_VOIDED',
          entity: 'Sale',
          entityId: sale.id,
          newValues: {
            invoiceNumber: sale.invoiceNumber,
            reason,
          },
        },
      });

      return updated;
    });

    return this.mapSaleToDto(updatedSale);
  }

  /**
   * Fetch a single sale record by ID.
   */
  async getSaleById(tenantId: string, saleId: string): Promise<SaleDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: true,
        payments: true,
        cashier: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID "${saleId}" not found.`);
    }

    return this.mapSaleToDto(sale);
  }

  /**
   * List recent sales for the tenant/branch with pagination.
   */
  async getSales(
    tenantId: string,
    query: { branchId?: string; page?: number; limit?: number },
  ): Promise<PaginatedResult<SaleDto>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: true,
          cashier: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((s) => this.mapSaleToDto(s)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // --- DTO Mapping Helpers ---

  private mapSaleToDto(sale: {
    id: string;
    tenantId: string;
    branchId: string;
    registerId: string | null;
    cashierId: string;
    customerId: string | null;
    customerName: string | null;
    invoiceNumber: string;
    orderType: string;
    tableNumber: string | null;
    status: string;
    subtotal: unknown;
    discountAmount: unknown;
    taxAmount: unknown;
    totalAmount: unknown;
    paidAmount: unknown;
    changeDue: unknown;
    idempotencyKey: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{
      id: string;
      saleId: string;
      productId: string | null;
      variantId: string | null;
      productName: string;
      sku: string;
      unitPrice: unknown;
      quantity: unknown;
      discountAmount: unknown;
      taxAmount: unknown;
      subtotal: unknown;
      notes: string | null;
    }>;
    payments?: Array<{
      id: string;
      saleId: string;
      paymentMethod: string;
      amount: unknown;
      reference: string | null;
      status: string;
      createdAt: Date;
    }>;
    cashier?: { id: string; fullName: string; email: string } | null;
  }): SaleDto {
    return {
      id: sale.id,
      tenantId: sale.tenantId,
      branchId: sale.branchId,
      registerId: sale.registerId || undefined,
      cashierId: sale.cashierId,
      customerId: sale.customerId || undefined,
      customerName: sale.customerName || undefined,
      invoiceNumber: sale.invoiceNumber,
      orderType: sale.orderType as SaleDto['orderType'],
      tableNumber: sale.tableNumber || undefined,
      status: sale.status as SaleDto['status'],
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      taxAmount: Number(sale.taxAmount),
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      changeDue: Number(sale.changeDue),
      idempotencyKey: sale.idempotencyKey || undefined,
      notes: sale.notes || undefined,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      items: (sale.items || []).map((i) => this.mapSaleItemToDto(i)),
      payments: (sale.payments || []).map((p) => this.mapSalePaymentToDto(p)),
      cashier: sale.cashier || undefined,
    };
  }

  private mapSaleItemToDto(item: {
    id: string;
    saleId: string;
    productId: string | null;
    variantId: string | null;
    productName: string;
    sku: string;
    unitPrice: unknown;
    quantity: unknown;
    discountAmount: unknown;
    taxAmount: unknown;
    subtotal: unknown;
    notes: string | null;
  }): SaleItemDto {
    return {
      id: item.id,
      saleId: item.saleId,
      productId: item.productId || undefined,
      variantId: item.variantId || undefined,
      productName: item.productName,
      sku: item.sku,
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      discountAmount: Number(item.discountAmount),
      taxAmount: Number(item.taxAmount),
      subtotal: Number(item.subtotal),
      notes: item.notes || undefined,
    };
  }

  private mapSalePaymentToDto(p: {
    id: string;
    saleId: string;
    paymentMethod: string;
    amount: unknown;
    reference: string | null;
    status: string;
    createdAt: Date;
  }): SalePaymentDto {
    return {
      id: p.id,
      saleId: p.saleId,
      paymentMethod: p.paymentMethod as SalePaymentDto['paymentMethod'],
      amount: Number(p.amount),
      reference: p.reference || undefined,
      status: p.status as SalePaymentDto['status'],
      createdAt: p.createdAt.toISOString(),
    };
  }

  private mapHeldCartToDto(heldCart: {
    id: string;
    tenantId: string;
    branchId: string;
    registerId: string | null;
    cashierId: string;
    cartReference: string;
    cartData: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): HeldCartDto {
    return {
      id: heldCart.id,
      tenantId: heldCart.tenantId,
      branchId: heldCart.branchId,
      registerId: heldCart.registerId || undefined,
      cashierId: heldCart.cashierId,
      cartReference: heldCart.cartReference,
      cartData: heldCart.cartData as HeldCartDto['cartData'],
      createdAt: heldCart.createdAt.toISOString(),
      updatedAt: heldCart.updatedAt.toISOString(),
    };
  }
}
