import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ReceiptDocumentDto } from '@pixelcraft/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: saleId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';

    // 1. Resolve tenant
    const tenant = await prisma.business.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: searchParams.get('tenantId') || undefined }],
        deletedAt: null,
      },
      include: {
        settings: true,
        tenantSettings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    // 2. Resolve Sale
    const sale = await prisma.sale.findFirst({
      where: {
        OR: [{ id: saleId }, { invoiceNumber: saleId }],
        tenantId: tenant.id,
        deletedAt: null,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        cashier: { select: { id: true, fullName: true, email: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        branch: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    const ts = tenant.tenantSettings;
    const bs = tenant.settings;

    const receiptDoc: ReceiptDocumentDto = {
      sale: {
        id: sale.id,
        tenantId: sale.tenantId,
        branchId: sale.branchId,
        registerId: sale.registerId || undefined,
        shiftId: sale.shiftId || undefined,
        cashierId: sale.cashierId,
        cashierName: sale.cashierName || sale.cashier?.fullName || 'Cashier',
        customerId: sale.customerId || undefined,
        customerName: sale.customerName || sale.customer?.name || undefined,
        invoiceNumber: sale.invoiceNumber,
        orderType: sale.orderType,
        tableNumber: sale.tableNumber || undefined,
        status: sale.status,
        subtotal: Number(sale.subtotal),
        discountAmount: Number(sale.discountAmount),
        taxAmount: Number(sale.taxAmount),
        totalAmount: Number(sale.totalAmount),
        paidAmount: Number(sale.paidAmount),
        changeDue: Number(sale.changeDue),
        notes: sale.notes || undefined,
        createdAt: sale.createdAt.toISOString(),
        updatedAt: sale.updatedAt.toISOString(),
        cashier: sale.cashier
          ? {
              id: sale.cashier.id,
              fullName: sale.cashier.fullName,
              email: sale.cashier.email,
            }
          : undefined,
        items: sale.items.map((i) => ({
          id: i.id,
          saleId: i.saleId,
          productId: i.productId || undefined,
          variantId: i.variantId || undefined,
          productName: i.productName,
          sku: i.sku,
          unitPrice: Number(i.unitPrice),
          quantity: Number(i.quantity),
          discountAmount: Number(i.discountAmount),
          taxAmount: Number(i.taxAmount),
          subtotal: Number(i.subtotal),
        })),
        payments: sale.payments.map((p) => ({
          id: p.id,
          saleId: p.saleId,
          paymentMethod: p.paymentMethod,
          amount: Number(p.amount),
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      },
      business: {
        id: tenant.id,
        name: ts?.name || tenant.name,
        legalName: ts?.legalName || tenant.legalName || 'Deegayu Ayurvedic Products & Health Care (Pvt) Ltd',
        businessType: tenant.businessType,
        currency: tenant.currency || 'LKR',
        logoUrl: ts?.logoUrl || tenant.logoUrl || null,
      },
      branch: {
        id: sale.branch.id,
        name: sale.branch.name,
        code: sale.branch.code,
        address: sale.branch.address || ts?.address || 'Main Street, Kalutara, Sri Lanka',
        phone: sale.branch.phone || ts?.phone || '+94 34 222 3456',
      },
      cashier: {
        id: sale.cashier?.id || sale.cashierId,
        fullName: sale.cashier?.fullName || sale.cashierName || 'Kasun Rathnayake',
        email: sale.cashier?.email || 'cashier@pixelcraftlk.com',
      },
      settings: {
        paperSize: ts?.receiptPaperWidth === '58mm' ? 'MM_58' : 'MM_80',
        showLogo: ts?.showLogo ?? bs?.showLogoOnReceipt ?? true,
        showTaxDetails: ts?.showVat ?? bs?.showTaxDetails ?? true,
        showBarcode: ts?.showBarcode ?? bs?.showBarcodeOnReceipt ?? true,
        taxNumber: ts?.vatNumber || bs?.taxNumber || 'VAT-10928392-8000',
        receiptHeader: ts?.receiptHeaderNote || bs?.receiptHeader || 'Welcome to Deegayu Weda Madura',
        receiptFooter: ts?.receiptFooterNote || bs?.receiptFooter || 'නිරෝගී සුවය පතමු! / Wishing you healthy living!',
        returnPolicyText: ts?.returnPolicy || bs?.returnPolicyText || 'Exchangeable within 7 days with original receipt.',
      },
      barcodeData: {
        format: 'CODE128',
        code: sale.invoiceNumber,
        verificationUrl: `https://pos.pixelcraftlk.com/receipt/${sale.invoiceNumber}`,
      },
      taxBreakdown: [
        {
          rate: 8,
          taxableAmount: Number(sale.subtotal),
          taxAmount: Number(sale.taxAmount),
        },
      ],
    };

    return NextResponse.json({
      success: true,
      data: receiptDoc,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate receipt document';
    console.error('[GET /api/pos/sales/[id]/receipt Error]', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
