import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GoodsReceivedNoteDto,
  GoodsReceivedNoteItemDto,
  PaginatedResult,
  PurchaseOrderDto,
  PurchaseOrderItemDto,
} from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';
import {
  CreateGrnDto,
  CreatePurchaseOrderDto,
  GrnQueryDto,
  PurchaseOrderQueryDto,
} from './dto/procurement.dto';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Create a Purchase Order (PO)
   */
  async createPurchaseOrder(
    tenantId: string,
    _userId: string,
    dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Purchase Order must contain at least one line item.');
    }

    const [branch, supplier] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId, isActive: true },
      }),
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, status: 'ACTIVE', deletedAt: null },
      }),
    ]);

    if (!branch) {
      throw new NotFoundException(`Branch "${dto.branchId}" not found for this tenant.`);
    }
    if (!supplier) {
      throw new NotFoundException(`Supplier "${dto.supplierId}" not found or inactive.`);
    }

    // Generate unique sequential/timestamped PO number
    const year = new Date().getFullYear();
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

    let subtotal = 0;
    for (const item of dto.items) {
      subtotal += item.orderedQuantity * item.unitCost;
    }
    const taxAmount = 0;
    const totalAmount = subtotal + taxAmount;

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          poNumber,
          status: 'SUBMITTED',
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          subtotal,
          taxAmount,
          totalAmount,
          notes: dto.notes || null,
        },
      });

      const itemsDto: PurchaseOrderItemDto[] = [];

      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
          select: { id: true, name: true, sku: true },
        });

        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }

        const lineSubtotal = item.orderedQuantity * item.unitCost;
        const poItem = await tx.purchaseOrderItem.create({
          data: {
            tenantId,
            purchaseOrderId: po.id,
            productId: item.productId,
            orderedQuantity: item.orderedQuantity,
            receivedQuantity: 0,
            unitCost: item.unitCost,
            subtotal: lineSubtotal,
          },
        });

        itemsDto.push({
          id: poItem.id,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          orderedQuantity: Number(poItem.orderedQuantity),
          receivedQuantity: Number(poItem.receivedQuantity),
          unitCost: Number(poItem.unitCost),
          subtotal: Number(poItem.subtotal),
        });
      }

      return {
        id: po.id,
        tenantId,
        branchId: branch.id,
        branchName: branch.name,
        supplierId: supplier.id,
        supplierName: supplier.name,
        poNumber: po.poNumber,
        status: po.status,
        orderDate: po.orderDate.toISOString(),
        expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
        subtotal: Number(po.subtotal),
        taxAmount: Number(po.taxAmount),
        totalAmount: Number(po.totalAmount),
        notes: po.notes,
        items: itemsDto,
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString(),
      };
    });
  }

  /**
   * 2. Query paginated Purchase Orders
   */
  async getPurchaseOrders(
    tenantId: string,
    query: PurchaseOrderQueryDto,
  ): Promise<PaginatedResult<PurchaseOrderDto>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { poNumber: { contains: term, mode: 'insensitive' } },
        { supplier: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: PurchaseOrderDto[] = records.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: r.branch.name,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      poNumber: r.poNumber,
      status: r.status,
      orderDate: r.orderDate.toISOString(),
      expectedDate: r.expectedDate ? r.expectedDate.toISOString() : null,
      subtotal: Number(r.subtotal),
      taxAmount: Number(r.taxAmount),
      totalAmount: Number(r.totalAmount),
      notes: r.notes,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        productSku: i.product?.sku,
        orderedQuantity: Number(i.orderedQuantity),
        receivedQuantity: Number(i.receivedQuantity),
        unitCost: Number(i.unitCost),
        subtotal: Number(i.subtotal),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Get single Purchase Order by ID
   */
  async getPurchaseOrderById(tenantId: string, id: string): Promise<PurchaseOrderDto> {
    const r = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!r) {
      throw new NotFoundException(`Purchase Order "${id}" not found.`);
    }

    return {
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: r.branch.name,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      poNumber: r.poNumber,
      status: r.status,
      orderDate: r.orderDate.toISOString(),
      expectedDate: r.expectedDate ? r.expectedDate.toISOString() : null,
      subtotal: Number(r.subtotal),
      taxAmount: Number(r.taxAmount),
      totalAmount: Number(r.totalAmount),
      notes: r.notes,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        productSku: i.product?.sku,
        orderedQuantity: Number(i.orderedQuantity),
        receivedQuantity: Number(i.receivedQuantity),
        unitCost: Number(i.unitCost),
        subtotal: Number(i.subtotal),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  /**
   * 4. Goods Received Note (GRN) Processing Engine:
   * - Increments StockLevel.quantityOnHand
   * - Creates atomic StockMovement (PURCHASE_RECEIPT)
   * - Updates Product.costPrice
   * - Progresses PO line receivedQuantity & status (PARTIALLY_RECEIVED / COMPLETED)
   */
  async createGrn(
    tenantId: string,
    userId: string,
    dto: CreateGrnDto,
  ): Promise<GoodsReceivedNoteDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Goods Received Note must have at least one line item.');
    }

    const [branch, warehouse, supplier] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId, isActive: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId, isActive: true },
      }),
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, tenantId, status: 'ACTIVE', deletedAt: null },
      }),
    ]);

    if (!branch) {
      throw new NotFoundException(`Branch "${dto.branchId}" not found.`);
    }
    if (!warehouse) {
      throw new NotFoundException(`Warehouse "${dto.warehouseId}" not found.`);
    }
    if (!supplier) {
      throw new NotFoundException(`Supplier "${dto.supplierId}" not found.`);
    }

    // Verify PO if linked
    let linkedPo: any = null;
    if (dto.purchaseOrderId) {
      linkedPo = await this.prisma.purchaseOrder.findFirst({
        where: { id: dto.purchaseOrderId, tenantId, deletedAt: null },
        include: { items: true },
      });
      if (!linkedPo) {
        throw new NotFoundException(`Linked Purchase Order "${dto.purchaseOrderId}" not found.`);
      }
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.goodsReceivedNote.count({ where: { tenantId } });
    const grnNumber = `GRN-${year}-${String(count + 1).padStart(4, '0')}`;

    let totalCost = 0;
    for (const item of dto.items) {
      totalCost += item.receivedQuantity * item.unitCost;
    }

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      // 1. Create GRN Header
      const grn = await tx.goodsReceivedNote.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          purchaseOrderId: dto.purchaseOrderId || null,
          grnNumber,
          supplierInvoiceNo: dto.supplierInvoiceNo || null,
          receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
          status: 'RECEIVED',
          totalCost,
          receivedByUserId: userId,
          notes: dto.notes || null,
        },
      });

      const itemsDto: GoodsReceivedNoteItemDto[] = [];

      // 2. Process each item: StockLevel + StockMovement + Cost update + PO progress
      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
        });

        if (!product) {
          throw new NotFoundException(`Product "${item.productId}" not found.`);
        }

        const lineSubtotal = item.receivedQuantity * item.unitCost;

        // Create GRN item
        const grnItem = await tx.goodsReceivedNoteItem.create({
          data: {
            tenantId,
            grnId: grn.id,
            productId: item.productId,
            receivedQuantity: item.receivedQuantity,
            unitCost: item.unitCost,
            batchNumber: item.batchNumber || null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            subtotal: lineSubtotal,
          },
        });

        // 3. Atomically update StockLevel
        const existingStock = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            warehouseId: dto.warehouseId,
            productId: item.productId,
            variantId: null,
          },
        });

        const currentOnHand = existingStock ? Number(existingStock.quantityOnHand) : 0;
        const newOnHand = currentOnHand + Number(item.receivedQuantity);

        if (existingStock) {
          await tx.stockLevel.update({
            where: { id: existingStock.id },
            data: { quantityOnHand: newOnHand },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              productId: item.productId,
              variantId: null,
              quantityOnHand: newOnHand,
              quantityReserved: 0,
              reorderPoint: 5,
            },
          });
        }

        // 4. Record Append-Only StockMovement (PURCHASE_RECEIPT)
        await tx.stockMovement.create({
          data: {
            tenantId,
            warehouseId: dto.warehouseId,
            productId: item.productId,
            variantId: null,
            movementType: 'PURCHASE_RECEIPT',
            quantity: item.receivedQuantity,
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            referenceId: grn.id,
            notes: `GRN Received: ${grn.grnNumber} (Supplier: ${supplier.name})${item.batchNumber ? ` [Batch: ${item.batchNumber}]` : ''}`,
          },
        });

        // 5. Update Product latest costPrice
        await tx.product.update({
          where: { id: product.id },
          data: { costPrice: item.unitCost },
        });

        // 6. Update PO line item if linked
        if (linkedPo) {
          const poLine = linkedPo.items.find((poi: any) => poi.productId === item.productId);
          if (poLine) {
            await tx.purchaseOrderItem.update({
              where: { id: poLine.id },
              data: {
                receivedQuantity: { increment: item.receivedQuantity },
              },
            });
          }
        }

        itemsDto.push({
          id: grnItem.id,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          receivedQuantity: Number(grnItem.receivedQuantity),
          unitCost: Number(grnItem.unitCost),
          batchNumber: grnItem.batchNumber,
          expiryDate: grnItem.expiryDate ? grnItem.expiryDate.toISOString() : null,
          subtotal: Number(grnItem.subtotal),
        });
      }

      // 7. Re-evaluate PO status if linked
      if (linkedPo) {
        const freshPo = await tx.purchaseOrder.findFirst({
          where: { id: linkedPo.id, tenantId },
          include: { items: true },
        });

        if (freshPo) {
          const allCompleted = freshPo.items.every(
            (i: any) => Number(i.receivedQuantity) >= Number(i.orderedQuantity),
          );
          const anyReceived = freshPo.items.some(
            (i: any) => Number(i.receivedQuantity) > 0,
          );

          const newStatus = allCompleted
            ? 'COMPLETED'
            : anyReceived
            ? 'PARTIALLY_RECEIVED'
            : freshPo.status;

          if (newStatus !== freshPo.status) {
            await tx.purchaseOrder.update({
              where: { id: freshPo.id },
              data: { status: newStatus },
            });
          }
        }
      }

      // 8. Record audit log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'GRN_RECEIVED',
          entity: 'GoodsReceivedNote',
          entityId: grn.id,
          newValues: {
            grnNumber: grn.grnNumber,
            supplierId: grn.supplierId,
            warehouseId: grn.warehouseId,
            totalCost: Number(grn.totalCost),
            itemCount: dto.items.length,
          },
        },
      });

      return {
        id: grn.id,
        tenantId,
        branchId: branch.id,
        branchName: branch.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        supplierId: supplier.id,
        supplierName: supplier.name,
        purchaseOrderId: grn.purchaseOrderId,
        poNumber: linkedPo ? linkedPo.poNumber : null,
        grnNumber: grn.grnNumber,
        supplierInvoiceNo: grn.supplierInvoiceNo,
        receivedDate: grn.receivedDate.toISOString(),
        status: grn.status,
        totalCost: Number(grn.totalCost),
        receivedByUserId: userId,
        notes: grn.notes,
        items: itemsDto,
        createdAt: grn.createdAt.toISOString(),
        updatedAt: grn.updatedAt.toISOString(),
      };
    });
  }

  /**
   * 5. Query paginated Goods Received Notes
   */
  async getGoodsReceivedNotes(
    tenantId: string,
    query: GrnQueryDto,
  ): Promise<PaginatedResult<GoodsReceivedNoteDto>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;
    if (query.status) where.status = query.status;

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { grnNumber: { contains: term, mode: 'insensitive' } },
        { supplierInvoiceNo: { contains: term, mode: 'insensitive' } },
        { supplier: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.goodsReceivedNote.count({ where }),
      this.prisma.goodsReceivedNote.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
          receivedByUser: { select: { id: true, fullName: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: GoodsReceivedNoteDto[] = records.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: r.branch.name,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse.name,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.purchaseOrder ? r.purchaseOrder.poNumber : null,
      grnNumber: r.grnNumber,
      supplierInvoiceNo: r.supplierInvoiceNo,
      receivedDate: r.receivedDate.toISOString(),
      status: r.status,
      totalCost: Number(r.totalCost),
      receivedByUserId: r.receivedByUserId,
      receivedByName: r.receivedByUser ? r.receivedByUser.fullName : null,
      notes: r.notes,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        productSku: i.product?.sku,
        receivedQuantity: Number(i.receivedQuantity),
        unitCost: Number(i.unitCost),
        batchNumber: i.batchNumber,
        expiryDate: i.expiryDate ? i.expiryDate.toISOString() : null,
        subtotal: Number(i.subtotal),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 6. Get single GRN by ID
   */
  async getGrnById(tenantId: string, id: string): Promise<GoodsReceivedNoteDto> {
    const r = await this.prisma.goodsReceivedNote.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        receivedByUser: { select: { id: true, fullName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!r) {
      throw new NotFoundException(`Goods Received Note "${id}" not found.`);
    }

    return {
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: r.branch.name,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse.name,
      supplierId: r.supplierId,
      supplierName: r.supplier.name,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.purchaseOrder ? r.purchaseOrder.poNumber : null,
      grnNumber: r.grnNumber,
      supplierInvoiceNo: r.supplierInvoiceNo,
      receivedDate: r.receivedDate.toISOString(),
      status: r.status,
      totalCost: Number(r.totalCost),
      receivedByUserId: r.receivedByUserId,
      receivedByName: r.receivedByUser ? r.receivedByUser.fullName : null,
      notes: r.notes,
      items: r.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        productSku: i.product?.sku,
        receivedQuantity: Number(i.receivedQuantity),
        unitCost: Number(i.unitCost),
        batchNumber: i.batchNumber,
        expiryDate: i.expiryDate ? i.expiryDate.toISOString() : null,
        subtotal: Number(i.subtotal),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
