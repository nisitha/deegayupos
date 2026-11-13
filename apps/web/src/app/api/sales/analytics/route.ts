import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const period = searchParams.get('period') || 'daily';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
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

    // 2. Resolve Date Range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'daily' || period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === 'weekly' || period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'monthly' || period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (startDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      if (endDateParam) {
        endDate = new Date(endDateParam);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // Default: Last 30 days
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    }

    // 3. Query all completed sales in range
    const sales = await prisma.sale.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['COMPLETED', 'VOIDED', 'REFUNDED'] },
        deletedAt: null,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(branchId && branchId !== 'ALL' && { branchId }),
      },
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
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Compute High-Precision Metrics
    let grossSales = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalCost = 0;
    let completedBillCount = 0;
    let voidedBillCount = 0;

    const paymentBreakdown = {
      CASH: 0,
      CARD: 0,
      CREDIT: 0,
      QR: 0,
      OTHER: 0,
    };

    // Daily buckets for chart
    const dailyMap: Map<string, { date: string; label: string; sales: number; profit: number; count: number }> =
      new Map();

    // Initialize daily map with dates across range
    const loopDate = new Date(startDate);
    while (loopDate <= endDate) {
      const dateKey = loopDate.toISOString().split('T')[0]!;
      const label = loopDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(dateKey, { date: dateKey, label, sales: 0, profit: 0, count: 0 });
      loopDate.setDate(loopDate.getDate() + 1);
    }

    // Top products aggregation map
    const productStatsMap: Map<
      string,
      { productId: string; name: string; sku: string; quantity: number; revenue: number; cost: number }
    > = new Map();

    for (const sale of sales) {
      const saleDateKey = sale.createdAt.toISOString().split('T')[0]!;
      const dayBucket = dailyMap.get(saleDateKey);

      if (sale.status === 'COMPLETED') {
        completedBillCount++;
        const saleTotal = Number(sale.totalAmount);
        const saleDiscount = Number(sale.discountAmount);
        const saleTax = Number(sale.taxAmount);

        grossSales += saleTotal;
        totalDiscount += saleDiscount;
        totalTax += saleTax;

        let saleCost = 0;
        for (const item of sale.items) {
          const qty = Number(item.quantity);
          const revenue = Number(item.subtotal);
          const unitCost = item.product?.costPrice ? Number(item.product.costPrice) : 0;
          const itemCost = unitCost * qty;
          saleCost += itemCost;
          totalCost += itemCost;

          // Aggregate top products
          const prodKey = item.productId || item.sku || item.productName;
          const existing = productStatsMap.get(prodKey) || {
            productId: item.productId || '',
            name: item.productName,
            sku: item.sku,
            quantity: 0,
            revenue: 0,
            cost: 0,
          };
          existing.quantity += qty;
          existing.revenue += revenue;
          existing.cost += itemCost;
          productStatsMap.set(prodKey, existing);
        }

        const saleProfit = saleTotal - saleCost;

        if (dayBucket) {
          dayBucket.sales += saleTotal;
          dayBucket.profit += saleProfit;
          dayBucket.count += 1;
        }

        // Payments Breakdown
        for (const p of sale.payments) {
          const amt = Number(p.amount);
          const method = p.paymentMethod;
          if (method === 'CASH') paymentBreakdown.CASH += amt;
          else if (method === 'CARD') paymentBreakdown.CARD += amt;
          else if (method === 'CUSTOMER_CREDIT' || method === 'STORE_CREDIT') paymentBreakdown.CREDIT += amt;
          else if (method === 'QR_PAYMENT') paymentBreakdown.QR += amt;
          else paymentBreakdown.OTHER += amt;
        }
      } else {
        voidedBillCount++;
      }
    }

    const netSales = grossSales;
    const netProfit = Math.max(0, netSales - totalCost);
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    const averageOrderValue = completedBillCount > 0 ? netSales / completedBillCount : 0;

    // Convert daily map to array
    const dailyTrend = Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      label: d.label,
      sales: Math.round(d.sales * 100) / 100,
      profit: Math.round(d.profit * 100) / 100,
      count: d.count,
    }));

    // Top 10 products sorted by revenue
    const topProducts = Array.from(productStatsMap.values())
      .map((p) => ({
        ...p,
        revenue: Math.round(p.revenue * 100) / 100,
        profit: Math.round((p.revenue - p.cost) * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        grossSales: Math.round(grossSales * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        billCount: completedBillCount,
        voidedBillCount,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        paymentBreakdown: {
          cash: Math.round(paymentBreakdown.CASH * 100) / 100,
          card: Math.round(paymentBreakdown.CARD * 100) / 100,
          credit: Math.round(paymentBreakdown.CREDIT * 100) / 100,
          qr: Math.round(paymentBreakdown.QR * 100) / 100,
          other: Math.round(paymentBreakdown.OTHER * 100) / 100,
        },
        dailyTrend,
        topProducts,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to compute sales analytics';
    console.error('[GET /api/sales/analytics Error]', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
