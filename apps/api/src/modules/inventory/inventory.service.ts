import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  InventoryTelemetryDto,
  PaginatedResult,
  StockAdjustmentDto,
  StockLevelDto,
  StockMovementDto,
  StockMovementType,
  StockTransferDto,
} from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';
import {
  CreateStockAdjustmentDto,
  CreateStockTransferDto,
  StockLevelQueryDto,
  StockMovementQueryDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Query paginated stock levels with multi-branch / warehouse filtering
   */
  async getStockLevels(
    tenantId: string,
    query: StockLevelQueryDto,
  ): Promise<PaginatedResult<StockLevelDto>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      product: { deletedAt: null },
    };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.branchId) {
      where.warehouse = {
        ...(where.warehouse || {}),
        branchId: query.branchId,
      };
    }

    if (query.categoryId) {
      where.product = {
        ...(where.product || {}),
        categoryId: query.categoryId,
      };
    }

    if (query.search) {
      const term = query.search.trim();
      where.product = {
        ...(where.product || {}),
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    const [total, records] = await Promise.all([
      this.prisma.stockLevel.count({ where }),
      this.prisma.stockLevel.findMany({
        where,
        include: {
          warehouse: {
            include: { branch: true },
          },
          product: {
            include: { category: true, unit: true },
          },
          variant: true,
        },
        orderBy: [{ product: { name: 'asc' } }, { createdAt: 'desc' } as any],
        skip,
        take: limit,
      }),
    ]);

    const items: StockLevelDto[] = records.map((r: any) => {
      const onHand = Number(r.quantityOnHand);
      const reorder = Number(r.reorderPoint);
      let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';

      if (onHand <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (onHand <= reorder) {
        status = 'LOW_STOCK';
      }

      return {
        id: r.id,
        tenantId: r.tenantId,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name,
        branchId: r.warehouse?.branchId,
        branchName: r.warehouse?.branch?.name,
        productId: r.productId,
        productName: r.product?.name || 'Unknown Product',
        sku: r.product?.sku || '',
        barcode: r.product?.barcode,
        categoryName: r.product?.category?.name,
        unit: r.product?.unit?.shortCode || 'pcs',
        variantId: r.variantId,
        variantName: r.variant?.name,
        quantityOnHand: onHand,
        quantityReserved: Number(r.quantityReserved),
        reorderPoint: reorder,
        status,
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    const filteredItems = query.lowStockOnly
      ? items.filter((i) => i.status !== 'IN_STOCK')
      : items;

    return {
      items: filteredItems,
      total: query.lowStockOnly ? filteredItems.length : total,
      page,
      limit,
      totalPages: Math.ceil((query.lowStockOnly ? filteredItems.length : total) / limit) || 1,
    };
  }

  /**
   * 2. Apply Stock Adjustment (Physical Count discrepancy, Damaged, Expired, etc.)
   */
  async createAdjustment(
    tenantId: string,
    userId: string,
    dto: CreateStockAdjustmentDto,
  ): Promise<StockAdjustmentDto> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId, isActive: true },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${dto.warehouseId}" not found for this tenant.`);
    }

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          tenantId,
          warehouseId: dto.warehouseId,
          adjustedById: userId,
          reason: dto.reason,
          status: 'APPLIED',
          notes: dto.notes || null,
        },
      });

      const itemsDto = [];

      for (const item of dto.items) {
        const stockLevel = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            warehouseId: dto.warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });

        const currentOnHand = stockLevel ? Number(stockLevel.quantityOnHand) : 0;
        const countedOnHand = Number(item.countedQuantity);
        const discrepancy = countedOnHand - currentOnHand;

        if (stockLevel) {
          await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: { quantityOnHand: countedOnHand },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantityOnHand: countedOnHand,
              quantityReserved: 0,
              reorderPoint: 5,
            },
          });
        }

        const adjustmentItem = await tx.stockAdjustmentItem.create({
          data: {
            tenantId,
            adjustmentId: adjustment.id,
            productId: item.productId,
            variantId: item.variantId || null,
            countedQuantity: countedOnHand,
            discrepancyQuantity: discrepancy,
          },
        });

        let movementType: StockMovementType = 'ADJUSTMENT_ADD';
        if (dto.reason === 'DAMAGED') {
          movementType = 'DAMAGE_LOSS';
        } else if (discrepancy < 0) {
          movementType = 'ADJUSTMENT_SUB';
        }

        await tx.stockMovement.create({
          data: {
            tenantId,
            warehouseId: dto.warehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
            movementType,
            quantity: discrepancy,
            balanceBefore: currentOnHand,
            balanceAfter: countedOnHand,
            referenceId: adjustment.id,
            notes: dto.notes || `Stock Adjustment (${dto.reason})`,
          },
        });

        itemsDto.push({
          id: adjustmentItem.id,
          adjustmentId: adjustment.id,
          productId: item.productId,
          variantId: item.variantId || null,
          countedQuantity: countedOnHand,
          discrepancyQuantity: discrepancy,
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'STOCK_ADJUSTMENT_APPLIED',
          entity: 'StockAdjustment',
          entityId: adjustment.id,
          newValues: {
            warehouseId: dto.warehouseId,
            reason: dto.reason,
            itemCount: dto.items.length,
          },
        },
      });

      return {
        id: adjustment.id,
        tenantId,
        warehouseId: dto.warehouseId,
        warehouseName: warehouse.name,
        adjustedById: userId,
        reason: dto.reason,
        status: 'APPLIED',
        notes: dto.notes,
        items: itemsDto,
        createdAt: adjustment.createdAt.toISOString(),
        updatedAt: adjustment.updatedAt.toISOString(),
      };
    });
  }

  /**
   * 3. Initiate Inter-Branch Stock Transfer
   */
  async createTransfer(
    tenantId: string,
    userId: string,
    dto: CreateStockTransferDto,
  ): Promise<StockTransferDto> {
    if (dto.sourceWarehouseId === dto.targetWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different.');
    }

    const [sourceWh, targetWh] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.sourceWarehouseId, tenantId, isActive: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.targetWarehouseId, tenantId, isActive: true },
      }),
    ]);

    if (!sourceWh || !targetWh) {
      throw new NotFoundException('Source or destination warehouse not found for this tenant.');
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const trackingNumber = `TRF-${dateStr}-${randStr}`;

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId,
          sourceWarehouseId: dto.sourceWarehouseId,
          targetWarehouseId: dto.targetWarehouseId,
          requestedById: userId,
          status: 'PENDING',
          trackingNumber,
          notes: dto.notes || null,
        },
      });

      const itemsDto = [];

      for (const item of dto.items) {
        const trItem = await tx.stockTransferItem.create({
          data: {
            tenantId,
            transferId: transfer.id,
            productId: item.productId,
            variantId: item.variantId || null,
            quantityRequested: item.quantity,
            quantityDispatched: 0,
            quantityReceived: 0,
          },
        });

        itemsDto.push({
          id: trItem.id,
          transferId: transfer.id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantityRequested: Number(item.quantity),
          quantityDispatched: 0,
          quantityReceived: 0,
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'STOCK_TRANSFER_INITIATED',
          entity: 'StockTransfer',
          entityId: transfer.id,
          newValues: {
            trackingNumber,
            sourceWarehouseId: dto.sourceWarehouseId,
            targetWarehouseId: dto.targetWarehouseId,
            itemCount: dto.items.length,
          },
        },
      });

      return {
        id: transfer.id,
        tenantId,
        sourceWarehouseId: dto.sourceWarehouseId,
        sourceWarehouseName: sourceWh.name,
        targetWarehouseId: dto.targetWarehouseId,
        targetWarehouseName: targetWh.name,
        requestedById: userId,
        status: 'PENDING',
        trackingNumber,
        notes: dto.notes,
        createdAt: transfer.createdAt.toISOString(),
        updatedAt: transfer.updatedAt.toISOString(),
        items: itemsDto,
      };
    });
  }

  /**
   * 4. Dispatch Transfer (decrements Source Warehouse stock)
   */
  async dispatchTransfer(
    tenantId: string,
    userId: string,
    transferId: string,
  ): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: {
        items: true,
        sourceWarehouse: true,
        targetWarehouse: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer with ID "${transferId}" not found.`);
    }

    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(`Cannot dispatch transfer in "${transfer.status}" status.`);
    }

    const settings = await this.prisma.businessSetting.findUnique({
      where: { tenantId },
    });

    const isNegativeStockDisallowed =
      settings?.allowNegativeStock === false ||
      settings?.negativeStockPolicy === 'DISALLOW';

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      for (const item of transfer.items) {
        const stockLevel = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            warehouseId: transfer.sourceWarehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });

        const currentOnHand = stockLevel ? Number(stockLevel.quantityOnHand) : 0;
        const reqQty = Number(item.quantityRequested);
        const newOnHand = currentOnHand - reqQty;

        if (newOnHand < 0 && isNegativeStockDisallowed) {
          throw new BadRequestException(
            `Insufficient stock in source warehouse for product ID "${item.productId}". Available: ${currentOnHand}, requested: ${reqQty}`,
          );
        }

        if (stockLevel) {
          await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: { quantityOnHand: newOnHand },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              warehouseId: transfer.sourceWarehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantityOnHand: newOnHand,
              quantityReserved: 0,
              reorderPoint: 5,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            tenantId,
            warehouseId: transfer.sourceWarehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
            movementType: 'TRANSFER_DISPATCH',
            quantity: -reqQty,
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            referenceId: transfer.id,
            notes: `Dispatched Transfer #${transfer.trackingNumber}`,
          },
        });

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantityDispatched: reqQty },
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: new Date(),
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'STOCK_TRANSFER_DISPATCHED',
          entity: 'StockTransfer',
          entityId: transfer.id,
          newValues: {
            trackingNumber: transfer.trackingNumber,
            status: 'DISPATCHED',
          },
        },
      });

      return {
        id: updated.id,
        tenantId,
        sourceWarehouseId: updated.sourceWarehouseId,
        sourceWarehouseName: transfer.sourceWarehouse?.name,
        targetWarehouseId: updated.targetWarehouseId,
        targetWarehouseName: transfer.targetWarehouse?.name,
        requestedById: updated.requestedById,
        status: updated.status,
        trackingNumber: updated.trackingNumber,
        notes: updated.notes,
        dispatchedAt: updated.dispatchedAt?.toISOString(),
        receivedAt: updated.receivedAt?.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        items: updated.items.map((i) => ({
          id: i.id,
          transferId: i.transferId,
          productId: i.productId,
          variantId: i.variantId,
          quantityRequested: Number(i.quantityRequested),
          quantityDispatched: Number(i.quantityDispatched),
          quantityReceived: Number(i.quantityReceived),
        })),
      };
    });
  }

  /**
   * 5. Receive Transfer (increments Destination Warehouse stock)
   */
  async receiveTransfer(
    tenantId: string,
    userId: string,
    transferId: string,
  ): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: {
        items: true,
        sourceWarehouse: true,
        targetWarehouse: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Stock transfer with ID "${transferId}" not found.`);
    }

    if (transfer.status !== 'DISPATCHED') {
      throw new BadRequestException(`Cannot receive transfer in "${transfer.status}" status. Transfer must be DISPATCHED.`);
    }

    return this.prisma.withTenantContext(tenantId, async (tx) => {
      for (const item of transfer.items) {
        const stockLevel = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            warehouseId: transfer.targetWarehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });

        const currentOnHand = stockLevel ? Number(stockLevel.quantityOnHand) : 0;
        const dispQty = Number(item.quantityDispatched);
        const newOnHand = currentOnHand + dispQty;

        if (stockLevel) {
          await tx.stockLevel.update({
            where: { id: stockLevel.id },
            data: { quantityOnHand: newOnHand },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              warehouseId: transfer.targetWarehouseId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantityOnHand: newOnHand,
              quantityReserved: 0,
              reorderPoint: 5,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            tenantId,
            warehouseId: transfer.targetWarehouseId,
            productId: item.productId,
            variantId: item.variantId || null,
            movementType: 'TRANSFER_RECEIPT',
            quantity: dispQty,
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            referenceId: transfer.id,
            notes: `Received Transfer #${transfer.trackingNumber}`,
          },
        });

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantityReceived: dispQty },
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'STOCK_TRANSFER_RECEIVED',
          entity: 'StockTransfer',
          entityId: transfer.id,
          newValues: {
            trackingNumber: transfer.trackingNumber,
            status: 'RECEIVED',
          },
        },
      });

      return {
        id: updated.id,
        tenantId,
        sourceWarehouseId: updated.sourceWarehouseId,
        sourceWarehouseName: transfer.sourceWarehouse?.name,
        targetWarehouseId: updated.targetWarehouseId,
        targetWarehouseName: transfer.targetWarehouse?.name,
        requestedById: updated.requestedById,
        status: updated.status,
        trackingNumber: updated.trackingNumber,
        notes: updated.notes,
        dispatchedAt: updated.dispatchedAt?.toISOString(),
        receivedAt: updated.receivedAt?.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        items: updated.items.map((i) => ({
          id: i.id,
          transferId: i.transferId,
          productId: i.productId,
          variantId: i.variantId,
          quantityRequested: Number(i.quantityRequested),
          quantityDispatched: Number(i.quantityDispatched),
          quantityReceived: Number(i.quantityReceived),
        })),
      };
    });
  }

  /**
   * 6. Query Movements (Historical Audit Ledger)
   */
  async getMovements(
    tenantId: string,
    query: StockMovementQueryDto,
  ): Promise<PaginatedResult<StockMovementDto>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.movementType) {
      where.movementType = query.movementType;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { referenceId: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { product: { sku: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: {
          warehouse: true,
          product: true,
          variant: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((r: any) => ({
        id: r.id,
        tenantId: r.tenantId,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name,
        productId: r.productId,
        productName: r.product?.name || 'Unknown Product',
        sku: r.product?.sku || '',
        variantId: r.variantId,
        variantName: r.variant?.name,
        movementType: r.movementType,
        quantity: Number(r.quantity),
        balanceBefore: Number(r.balanceBefore),
        balanceAfter: Number(r.balanceAfter),
        referenceId: r.referenceId,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 7. Telemetry KPIs
   */
  async getTelemetry(tenantId: string): Promise<InventoryTelemetryDto> {
    const levels = await this.prisma.stockLevel.findMany({
      where: {
        tenantId,
        product: { deletedAt: null },
      },
      select: {
        quantityOnHand: true,
        reorderPoint: true,
      },
    });

    const totalItemsTracked = levels.length;
    let lowStockAlertsCount = 0;
    let outOfStockCount = 0;
    let totalStockUnits = 0;

    for (const l of levels) {
      const qty = Number(l.quantityOnHand);
      const reorder = Number(l.reorderPoint);
      totalStockUnits += qty;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= reorder) {
        lowStockAlertsCount++;
      }
    }

    return {
      totalItemsTracked,
      lowStockAlertsCount,
      outOfStockCount,
      totalStockUnits,
    };
  }
}
