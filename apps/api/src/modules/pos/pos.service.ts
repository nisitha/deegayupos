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
  ReceiptDocumentDto,
  ReceiptTaxBreakdownItem,
  SaleDto,
  SaleItemDto,
  SalePaymentDto,
} from '@pixelcraft/types';
import type { Prisma } from '@pixelcraft/database';
import PDFDocument from 'pdfkit';
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
   * Fetch complete receipt payload including tenant branding, branch address,
   * cashier details, tax breakdown, barcode data, and customized receipt header/footer notes.
   */
  async getReceiptDocument(
    tenantId: string,
    saleId: string,
  ): Promise<ReceiptDocumentDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: true,
        payments: true,
        cashier: {
          select: { id: true, fullName: true, email: true },
        },
        branch: true,
        business: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID "${saleId}" not found for this tenant.`);
    }

    const s = sale.business.settings;
    const paperSize = s?.receiptPaperSize || 'MM_80';
    const showLogo = s?.showLogoOnReceipt ?? true;
    const showTaxDetails = s?.showTaxDetails ?? true;
    const showBarcode = s?.showBarcodeOnReceipt ?? true;

    const saleDto = this.mapSaleToDto(sale);

    // Compute tax breakdown
    const taxBreakdown: ReceiptTaxBreakdownItem[] = [];
    if (saleDto.taxAmount > 0) {
      const rate = s ? Number(s.taxRate) : 0;
      const taxableAmount = Math.max(0, saleDto.subtotal - saleDto.discountAmount);
      taxBreakdown.push({
        rate,
        taxableAmount,
        taxAmount: saleDto.taxAmount,
      });
    }

    return {
      sale: saleDto,
      business: {
        id: sale.business.id,
        name: sale.business.name,
        legalName: sale.business.legalName,
        businessType: sale.business.businessType,
        currency: sale.business.currency,
        logoUrl: null,
      },
      branch: {
        id: sale.branch.id,
        name: sale.branch.name,
        code: sale.branch.code,
        address: sale.branch.address,
        phone: sale.branch.phone,
      },
      cashier: sale.cashier || {
        id: sale.cashierId,
        fullName: 'Cashier Station',
        email: 'cashier@pixelcraftlk.com',
      },
      settings: {
        paperSize: paperSize as 'MM_58' | 'MM_80' | 'A4',
        showLogo,
        showTaxDetails,
        showBarcode,
        taxNumber: s?.taxNumber || null,
        receiptHeader: s?.receiptHeader || null,
        receiptFooter: s?.receiptFooter || null,
        returnPolicyText: s?.returnPolicyText || null,
      },
      barcodeData: {
        format: 'CODE128',
        code: sale.invoiceNumber,
        verificationUrl: `https://pos.pixelcraftlk.com/verify/${sale.invoiceNumber}`,
      },
      taxBreakdown,
    };
  }

  /**
   * Generates a vector-sharp A4 PDF tax invoice buffer for customer or accounting records.
   */
  async generateSalePdf(
    tenantId: string,
    saleId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const receipt = await this.getReceiptDocument(tenantId, saleId);
    const { sale, business, branch, cashier, settings } = receipt;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Invoice ${sale.invoiceNumber}`,
        Author: 'PixelCraft POS',
        Subject: 'Commercial Tax Invoice',
        Creator: 'PixelCraft POS Engine',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });

    // Primary brand bar
    doc.rect(40, 40, 515, 6).fill('#2F65F6');

    // Business Name & Title
    doc.fontSize(20).fillColor('#0F172A').text(business.legalName || business.name, 40, 56);
    doc.fontSize(10).fillColor('#64748B').text(branch.name, 40, 82);
    if (branch.address) doc.text(branch.address, 40, 96);
    if (branch.phone) doc.text(`Tel: ${branch.phone}`, 40, 110);
    if (settings.taxNumber) doc.text(`Tax / VAT Reg: ${settings.taxNumber}`, 40, 124);

    // Invoice Meta (right column)
    doc.fontSize(16).fillColor('#2F65F6').text('TAX INVOICE', 350, 56, { align: 'right' });
    doc.fontSize(10).fillColor('#0F172A').text(`Invoice #: ${sale.invoiceNumber}`, 350, 82, { align: 'right' });
    doc.fillColor('#64748B').text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`, 350, 96, { align: 'right' });
    doc.text(`Time: ${new Date(sale.createdAt).toLocaleTimeString()}`, 350, 110, { align: 'right' });
    doc.text(`Cashier: ${cashier.fullName}`, 350, 124, { align: 'right' });
    if (sale.customerName) {
      doc.text(`Customer: ${sale.customerName}`, 350, 138, { align: 'right' });
    }

    // Header Note
    let currentY = 165;
    if (settings.receiptHeader) {
      doc.fontSize(9).fillColor('#475569').text(settings.receiptHeader, 40, currentY, { width: 515 });
      currentY += 22;
    }

    // Items Table Header
    doc.rect(40, currentY, 515, 20).fill('#F1F5F9');
    doc.fillColor('#1E293B').fontSize(9).font('Helvetica-Bold');
    doc.text('#', 50, currentY + 5);
    doc.text('Item Description', 80, currentY + 5);
    doc.text('SKU', 260, currentY + 5);
    doc.text('Unit Price', 330, currentY + 5, { width: 60, align: 'right' });
    doc.text('Qty', 400, currentY + 5, { width: 40, align: 'right' });
    doc.text('Total', 450, currentY + 5, { width: 95, align: 'right' });

    currentY += 24;
    doc.font('Helvetica').fontSize(9);

    sale.items.forEach((item, index) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 40;
      }

      doc.fillColor('#334155');
      doc.text((index + 1).toString(), 50, currentY);
      doc.text(item.productName, 80, currentY, { width: 175 });
      doc.fillColor('#64748B').text(item.sku, 260, currentY);
      doc.fillColor('#334155');
      doc.text(item.unitPrice.toFixed(2), 330, currentY, { width: 60, align: 'right' });
      doc.text(item.quantity.toString(), 400, currentY, { width: 40, align: 'right' });
      doc.text(item.subtotal.toFixed(2), 450, currentY, { width: 95, align: 'right' });

      currentY += 18;
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(40, currentY).lineTo(555, currentY).stroke();
      currentY += 6;
    });

    // Totals Section
    currentY += 10;
    const totalsX = 350;
    const totalsWidth = 195;

    doc.fontSize(9).fillColor('#64748B').text('Subtotal:', totalsX, currentY);
    doc.fillColor('#0F172A').text(`${business.currency} ${sale.subtotal.toFixed(2)}`, totalsX, currentY, { width: totalsWidth, align: 'right' });
    currentY += 16;

    if (sale.discountAmount > 0) {
      doc.fillColor('#059669').text('Discount:', totalsX, currentY);
      doc.text(`-${business.currency} ${sale.discountAmount.toFixed(2)}`, totalsX, currentY, { width: totalsWidth, align: 'right' });
      currentY += 16;
    }

    if (sale.taxAmount > 0) {
      doc.fillColor('#64748B').text('Tax:', totalsX, currentY);
      doc.fillColor('#0F172A').text(`${business.currency} ${sale.taxAmount.toFixed(2)}`, totalsX, currentY, { width: totalsWidth, align: 'right' });
      currentY += 16;
    }

    // Grand Total Box
    doc.rect(totalsX - 10, currentY, totalsWidth + 20, 24).fill('#EFF6FF');
    doc.fillColor('#1D4ED8').font('Helvetica-Bold').fontSize(11).text('Total Due:', totalsX, currentY + 6);
    doc.text(`${business.currency} ${sale.totalAmount.toFixed(2)}`, totalsX, currentY + 6, { width: totalsWidth, align: 'right' });
    currentY += 34;

    // Payments Breakdown
    doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Payment Method(s):', 40, currentY);
    currentY += 14;
    sale.payments.forEach((p) => {
      doc.fillColor('#334155').text(`• ${p.paymentMethod}: ${business.currency} ${p.amount.toFixed(2)} ${p.reference ? `(Ref: ${p.reference})` : ''}`, 40, currentY);
      currentY += 14;
    });
    if (sale.changeDue > 0) {
      doc.fillColor('#059669').text(`Change Given: ${business.currency} ${sale.changeDue.toFixed(2)}`, 40, currentY);
      currentY += 14;
    }

    // Footer & Policies
    currentY = Math.max(currentY + 20, 720);
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(40, currentY).lineTo(555, currentY).stroke();
    currentY += 10;

    if (settings.receiptFooter) {
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(settings.receiptFooter, 40, currentY, { align: 'center', width: 515 });
      currentY += 14;
    }
    if (settings.returnPolicyText) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94A3B8').text(settings.returnPolicyText, 40, currentY, { align: 'center', width: 515 });
      currentY += 12;
    }

    doc.font('Helvetica').fontSize(8).fillColor('#CBD5E1').text(`Verification URL: https://pos.pixelcraftlk.com/verify/${sale.invoiceNumber}`, 40, currentY, { align: 'center', width: 515 });

    doc.end();

    const buffer = await pdfPromise;
    const filename = `invoice-${sale.invoiceNumber.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.pdf`;

    return { buffer, filename };
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
