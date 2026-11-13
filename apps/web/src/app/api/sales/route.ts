import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@pixelcraft/database';
import type { OrderType, SalePaymentMethod, SaleStatus } from '@pixelcraft/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const period = searchParams.get('period') || 'all';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const paymentMethod = searchParams.get('paymentMethod');
    const statusParam = searchParams.get('status');
    const branchId = searchParams.get('branchId');

    // 1. Resolve tenant
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
      tenant = await prisma.business.findFirst({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      });
    }

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    // 2. Build Date Filter
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;
    const now = new Date();

    if (period === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      dateFilter = { gte: startOfToday, lte: endOfToday };
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      weekAgo.setHours(0, 0, 0, 0);
      dateFilter = { gte: weekAgo, lte: now };
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      monthAgo.setHours(0, 0, 0, 0);
      dateFilter = { gte: monthAgo, lte: now };
    } else if (startDateParam || endDateParam) {
      dateFilter = {};
      if (startDateParam) dateFilter.gte = new Date(startDateParam);
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // 3. Build Where Clause
    const where: Prisma.SaleWhereInput = {
      tenantId: tenant.id,
      deletedAt: null,
      ...(dateFilter && { createdAt: dateFilter }),
      ...(branchId && branchId !== 'ALL' && { branchId }),
      ...(statusParam && statusParam !== 'ALL' && { status: statusParam as SaleStatus }),
      ...(paymentMethod && paymentMethod !== 'ALL' && {
        payments: {
          some: {
            paymentMethod: paymentMethod as SalePaymentMethod,
          },
        },
      }),
    };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { cashierName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 4. Query total count & paginated records
    const [total, rawSales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  costPrice: true,
                  retailPrice: true,
                  imageUrl: true,
                },
              },
            },
          },
          payments: true,
          cashier: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              phone: true,
              address: true,
            },
          },
        },
      }),
    ]);

    // Format Decimal fields to standard numbers
    const sales = rawSales.map((sale) => ({
      id: sale.id,
      tenantId: sale.tenantId,
      branchId: sale.branchId,
      registerId: sale.registerId,
      shiftId: sale.shiftId,
      cashierId: sale.cashierId,
      cashierName: sale.cashierName || sale.cashier?.fullName || 'Cashier',
      customerId: sale.customerId,
      customerName: sale.customerName || sale.customer?.name || null,
      invoiceNumber: sale.invoiceNumber,
      orderType: sale.orderType,
      tableNumber: sale.tableNumber,
      status: sale.status,
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      taxAmount: Number(sale.taxAmount),
      totalAmount: Number(sale.totalAmount),
      paidAmount: Number(sale.paidAmount),
      changeDue: Number(sale.changeDue),
      idempotencyKey: sale.idempotencyKey,
      notes: sale.notes,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      branch: sale.branch,
      cashier: sale.cashier,
      customer: sale.customer,
      items: sale.items.map((item) => ({
        id: item.id,
        saleId: item.saleId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        sku: item.sku,
        unitPrice: Number(item.unitPrice),
        quantity: Number(item.quantity),
        discountAmount: Number(item.discountAmount),
        taxAmount: Number(item.taxAmount),
        subtotal: Number(item.subtotal),
        costPrice: item.product?.costPrice ? Number(item.product.costPrice) : 0,
        imageUrl: item.product?.imageUrl || null,
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        saleId: p.saleId,
        paymentMethod: p.paymentMethod,
        amount: Number(p.amount),
        reference: p.reference,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: sales,
        sales,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch sales history';
    console.error('[GET /api/sales Error]', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const body = await request.json();

    // 1. Resolve tenant
    const tenant = await prisma.business.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: body.tenantId || undefined }],
        deletedAt: null,
      },
      include: {
        branches: { where: { deletedAt: null } },
      },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const branchId = body.branchId || tenant.branches[0]?.id;
    if (!branchId) {
      return NextResponse.json({ success: false, error: 'No active branch found' }, { status: 400 });
    }

    // 2. Resolve Cashier
    let cashierId = body.cashierId;
    let cashierName = body.cashierName;

    if (!cashierId) {
      const defaultUser = await prisma.user.findFirst({
        where: { deletedAt: null, memberships: { some: { tenantId: tenant.id } } },
      });
      cashierId = defaultUser?.id;
      cashierName = defaultUser?.fullName || 'Cashier';
    }

    if (!cashierId) {
      return NextResponse.json({ success: false, error: 'No cashier found' }, { status: 400 });
    }

    // 3. Generate Sequential Invoice Number
    const count = await prisma.sale.count({ where: { tenantId: tenant.id } });
    const invoiceNumber =
      body.invoiceNumber || `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const subtotal = Number(body.subtotal || 0);
    const discountAmount = Number(body.discountAmount || 0);
    const taxAmount = Number(body.taxAmount || 0);
    const totalAmount = Number(body.totalAmount || 0);
    const paidAmount = Number(body.paidAmount || totalAmount);
    const changeDue = Math.max(0, paidAmount - totalAmount);

    // 4. Resolve default warehouse for inventory deduction
    const warehouse = await prisma.warehouse.findFirst({
      where: { tenantId: tenant.id, branchId, deletedAt: null },
      orderBy: { isDefault: 'desc' },
    });

    // 5. Execute creation within Prisma transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create Sale
      const createdSale = await tx.sale.create({
        data: {
          tenantId: tenant.id,
          branchId,
          cashierId,
          cashierName,
          customerId: body.customerId || null,
          customerName: body.customerName || null,
          invoiceNumber,
          orderType: (body.orderType as OrderType) || 'RETAIL_WALKIN',
          status: 'COMPLETED',
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount,
          changeDue,
          notes: body.notes || null,
          idempotencyKey: body.idempotencyKey || null,
        },
      });

      // Create SaleItems and update stock
      if (Array.isArray(body.items)) {
        for (const item of body.items) {
          const qty = Number(item.quantity || 1);
          const unitPrice = Number(item.unitPrice || item.price || 0);
          const itemSubtotal = Number(item.subtotal || unitPrice * qty);
          const itemDiscount = Number(item.discountAmount || 0);
          const itemTax = Number(item.taxAmount || 0);

          await tx.saleItem.create({
            data: {
              tenantId: tenant.id,
              saleId: createdSale.id,
              productId: item.productId || null,
              variantId: item.variantId || null,
              productName: item.productName || item.name || 'Ayurvedic Product',
              sku: item.sku || 'SKU-GEN',
              unitPrice,
              quantity: qty,
              discountAmount: itemDiscount,
              taxAmount: itemTax,
              subtotal: itemSubtotal,
            },
          });

          // Stock level decrement & Stock movement
          if (warehouse && item.productId) {
            const stockLevel = await tx.stockLevel.findUnique({
              where: {
                tenantId_warehouseId_productId_variantId: {
                  tenantId: tenant.id,
                  warehouseId: warehouse.id,
                  productId: item.productId,
                  variantId: item.variantId || null,
                },
              },
            });

            const currentQty = stockLevel ? Number(stockLevel.quantityOnHand) : 0;
            const newQty = currentQty - qty;

            await tx.stockLevel.upsert({
              where: {
                tenantId_warehouseId_productId_variantId: {
                  tenantId: tenant.id,
                  warehouseId: warehouse.id,
                  productId: item.productId,
                  variantId: item.variantId || null,
                },
              },
              create: {
                tenantId: tenant.id,
                warehouseId: warehouse.id,
                productId: item.productId,
                variantId: item.variantId || null,
                quantityOnHand: newQty,
              },
              update: {
                quantityOnHand: newQty,
              },
            });

            await tx.stockMovement.create({
              data: {
                tenantId: tenant.id,
                warehouseId: warehouse.id,
                productId: item.productId,
                variantId: item.variantId || null,
                movementType: 'SALE',
                quantity: qty,
                balanceBefore: currentQty,
                balanceAfter: newQty,
                referenceId: invoiceNumber,
                notes: `POS Bill #${invoiceNumber}`,
              },
            });
          }
        }
      }

      // Create SalePayments
      const payments = Array.isArray(body.payments) && body.payments.length > 0
        ? body.payments
        : [{ paymentMethod: 'CASH', amount: totalAmount }];

      for (const p of payments) {
        await tx.salePayment.create({
          data: {
            tenantId: tenant.id,
            saleId: createdSale.id,
            paymentMethod: (p.paymentMethod as SalePaymentMethod) || 'CASH',
            amount: Number(p.amount || totalAmount),
            reference: p.reference || null,
            status: 'SUCCESS',
          },
        });

        // Credit sale handling: update customer ledger
        if (
          (p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT') &&
          body.customerId
        ) {
          const customer = await tx.customer.findUnique({ where: { id: body.customerId } });
          if (customer) {
            const currentDebt = Number(customer.currentBalance || 0);
            const newDebt = currentDebt + Number(p.amount);

            await tx.customer.update({
              where: { id: customer.id },
              data: { currentBalance: newDebt },
            });

            await tx.customerLedger.create({
              data: {
                tenantId: tenant.id,
                customerId: customer.id,
                entryType: 'CREDIT_SALE',
                debitAmount: Number(p.amount),
                creditAmount: 0,
                runningBalance: newDebt,
                referenceId: createdSale.id,
                notes: `Credit purchase - Bill #${invoiceNumber}`,
                createdById: cashierId,
              },
            });
          }
        }
      }

      return createdSale;
    });

    return NextResponse.json({
      success: true,
      data: sale,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to process checkout';
    console.error('[POST /api/sales Error]', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
