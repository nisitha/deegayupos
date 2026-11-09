import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma, GrnStatus, PurchaseOrderStatus } from '@pixelcraft/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status')?.toUpperCase();
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const skip = (page - 1) * limit;

    let tenant = null;
    if (tenantIdParam) {
      tenant = await prisma.business.findUnique({
        where: { id: tenantIdParam },
        select: { id: true, name: true, slug: true },
      });
    }
    if (!tenant) {
      tenant = await prisma.business.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, name: true, slug: true },
      });
    }

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const tenantId = tenant.id;
    const where: Prisma.GoodsReceivedNoteWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (status && status !== 'ALL') {
      where.status = status as GrnStatus;
    }

    if (search) {
      where.OR = [
        { grnNumber: { contains: search, mode: 'insensitive' } },
        { supplierInvoiceNo: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.goodsReceivedNote.count({ where }),
      prisma.goodsReceivedNote.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
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

    const items = records.map((r) => ({
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

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    console.error('Error fetching GRNs:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantSlug = 'deegayu',
      branchId,
      warehouseId,
      supplierId,
      purchaseOrderId,
      supplierInvoiceNo,
      receivedDate,
      notes,
      items,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one line item is required' },
        { status: 400 },
      );
    }

    const tenant = await prisma.business.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 },
      );
    }

    const tenantId = tenant.id;

    // Resolve branch & warehouse defaults if needed
    let targetBranchId = branchId;
    let targetWarehouseId = warehouseId;

    if (!targetBranchId || !targetWarehouseId) {
      const defaultWh = await prisma.warehouse.findFirst({
        where: { tenantId, isActive: true },
      });
      if (defaultWh) {
        targetWarehouseId = targetWarehouseId || defaultWh.id;
        targetBranchId = targetBranchId || defaultWh.branchId;
      }
    }

    if (!targetWarehouseId || !targetBranchId) {
      return NextResponse.json(
        { success: false, error: 'Target branch and warehouse are required' },
        { status: 400 },
      );
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 },
      );
    }

    const year = new Date().getFullYear();
    const count = await prisma.goodsReceivedNote.count({ where: { tenantId } });
    const grnNumber = `GRN-${year}-${String(count + 1).padStart(4, '0')}`;

    let totalCost = 0;
    for (const item of items) {
      totalCost += Number(item.receivedQuantity) * Number(item.unitCost);
    }

    // Execute atomic transaction
    const grnResult = await prisma.$transaction(async (tx) => {
      // 1. Create GRN Header
      const grn = await tx.goodsReceivedNote.create({
        data: {
          tenantId,
          branchId: targetBranchId,
          warehouseId: targetWarehouseId,
          supplierId,
          purchaseOrderId: purchaseOrderId || null,
          grnNumber,
          supplierInvoiceNo: supplierInvoiceNo || null,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          status: 'RECEIVED',
          totalCost,
          notes: notes || null,
        },
      });

      // 2. Process each item: StockLevel + StockMovement + Cost update
      for (const item of items) {
        const lineSubtotal = Number(item.receivedQuantity) * Number(item.unitCost);

        // GRN item
        await tx.goodsReceivedNoteItem.create({
          data: {
            tenantId,
            grnId: grn.id,
            productId: item.productId,
            receivedQuantity: Number(item.receivedQuantity),
            unitCost: Number(item.unitCost),
            batchNumber: item.batchNumber || null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            subtotal: lineSubtotal,
          },
        });

        // StockLevel upsert
        const existingStock = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            warehouseId: targetWarehouseId,
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
              warehouseId: targetWarehouseId,
              productId: item.productId,
              variantId: null,
              quantityOnHand: newOnHand,
              quantityReserved: 0,
              reorderPoint: 5,
            },
          });
        }

        // Append-only StockMovement
        await tx.stockMovement.create({
          data: {
            tenantId,
            warehouseId: targetWarehouseId,
            productId: item.productId,
            variantId: null,
            movementType: 'PURCHASE_RECEIPT',
            quantity: Number(item.receivedQuantity),
            balanceBefore: currentOnHand,
            balanceAfter: newOnHand,
            referenceId: grn.id,
            notes: `GRN Received: ${grn.grnNumber} (Supplier: ${supplier.name})${item.batchNumber ? ` [Batch: ${item.batchNumber}]` : ''}`,
          },
        });

        // Update product latest costPrice
        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: Number(item.unitCost) },
        });

        // If linked PO, increment receivedQuantity
        if (purchaseOrderId) {
          const poLine = await tx.purchaseOrderItem.findFirst({
            where: { purchaseOrderId, productId: item.productId },
          });
          if (poLine) {
            await tx.purchaseOrderItem.update({
              where: { id: poLine.id },
              data: { receivedQuantity: { increment: Number(item.receivedQuantity) } },
            });
          }
        }
      }

      // 3. Update PO status if linked
      if (purchaseOrderId) {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: purchaseOrderId },
          include: { items: true },
        });
        if (po) {
          const allCompleted = po.items.every(
            (i) => Number(i.receivedQuantity) >= Number(i.orderedQuantity),
          );
          const anyReceived = po.items.some((i) => Number(i.receivedQuantity) > 0);
          const newStatus = allCompleted ? 'COMPLETED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;
          if (newStatus !== po.status) {
            await tx.purchaseOrder.update({
              where: { id: purchaseOrderId },
              data: { status: newStatus as PurchaseOrderStatus },
            });
          }
        }
      }

      return grn;
    });

    return NextResponse.json({
      success: true,
      data: grnResult,
    });
  } catch (err: unknown) {
    console.error('Error creating GRN:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
