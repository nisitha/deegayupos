import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: saleId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';

    let body: { reason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // optional body
    }
    const reason = body.reason?.trim() || 'Customer returned items / Transaction voided';

    // 1. Resolve tenant
    const tenant = await prisma.business.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: searchParams.get('tenantId') || undefined }],
        deletedAt: null,
      },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    // 2. Find target sale
    const existingSale = await prisma.sale.findFirst({
      where: {
        OR: [{ id: saleId }, { invoiceNumber: saleId }],
        tenantId: tenant.id,
        deletedAt: null,
      },
      include: {
        items: true,
        payments: true,
        customer: true,
      },
    });

    if (!existingSale) {
      return NextResponse.json(
        { success: false, error: `Bill/Sale #${saleId} not found` },
        { status: 404 },
      );
    }

    if (existingSale.status === 'VOIDED' || existingSale.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: `Bill #${existingSale.invoiceNumber} is already ${existingSale.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    // 3. Resolve warehouse for inventory restock
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        tenantId: tenant.id,
        branchId: existingSale.branchId,
        deletedAt: null,
      },
      orderBy: { isDefault: 'desc' },
    });

    // 4. Interactive transaction: Mark VOIDED, restore inventory & log stock movements
    const voidedSale = await prisma.$transaction(async (tx) => {
      // A. Update Sale Status
      const updated = await tx.sale.update({
        where: { id: existingSale.id },
        data: {
          status: 'VOIDED',
          notes: existingSale.notes
            ? `${existingSale.notes}\n[VOIDED: ${new Date().toISOString()}] Reason: ${reason}`
            : `[VOIDED: ${new Date().toISOString()}] Reason: ${reason}`,
        },
        include: {
          items: true,
          payments: true,
          cashier: { select: { id: true, fullName: true, email: true } },
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      // B. Increment Stock Levels back and log StockMovements
      for (const item of existingSale.items) {
        if (item.productId && warehouse) {
          const qty = Number(item.quantity);

          const stockLevel = await tx.stockLevel.findFirst({
            where: {
              tenantId: tenant.id,
              warehouseId: warehouse.id,
              productId: item.productId,
              ...(item.variantId ? { variantId: item.variantId } : { variantId: null }),
            },
          });

          const currentQty = stockLevel ? Number(stockLevel.quantityOnHand) : 0;
          const restoredQty = currentQty + qty;

          if (stockLevel) {
            await tx.stockLevel.update({
              where: { id: stockLevel.id },
              data: { quantityOnHand: restoredQty },
            });
          } else {
            await tx.stockLevel.create({
              data: {
                tenantId: tenant.id,
                warehouseId: warehouse.id,
                productId: item.productId,
                variantId: item.variantId || null,
                quantityOnHand: restoredQty,
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              tenantId: tenant.id,
              warehouseId: warehouse.id,
              productId: item.productId,
              variantId: item.variantId || null,
              movementType: 'RETURN_RESTOCK',
              quantity: qty,
              balanceBefore: currentQty,
              balanceAfter: restoredQty,
              referenceId: existingSale.invoiceNumber,
              notes: `Bill #${existingSale.invoiceNumber} voided: ${reason}`,
            },
          });
        }
      }

      // C. Reverse Customer Credit if bill was charged to customer ledger
      const creditPayments = existingSale.payments.filter(
        (p) => p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT',
      );

      for (const cp of creditPayments) {
        if (existingSale.customerId) {
          const customer = await tx.customer.findUnique({
            where: { id: existingSale.customerId },
          });

          if (customer) {
            const currentDebt = Number(customer.currentBalance || 0);
            const reverseAmount = Number(cp.amount);
            const newDebt = Math.max(0, currentDebt - reverseAmount);

            await tx.customer.update({
              where: { id: customer.id },
              data: { currentBalance: newDebt },
            });

            await tx.customerLedger.create({
              data: {
                tenantId: tenant.id,
                customerId: customer.id,
                entryType: 'REFUND_CREDIT',
                debitAmount: 0,
                creditAmount: reverseAmount,
                runningBalance: newDebt,
                referenceId: existingSale.id,
                notes: `Voided Credit Bill #${existingSale.invoiceNumber}`,
              },
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: `Bill #${existingSale.invoiceNumber} successfully voided and inventory restored.`,
      data: voidedSale,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to void bill';
    console.error('[POST /api/sales/[id]/void Error]', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
