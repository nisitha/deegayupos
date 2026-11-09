import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        business: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 },
      );
    }

    const ledgerEntries = await prisma.customerLedger.findMany({
      where: {
        customerId: id,
        tenantId: customer.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const creditLimit = Number(customer.creditLimit || 0);
    const currentBalance = Number(customer.currentBalance || 0);

    const formattedLedger = ledgerEntries.map((entry) => ({
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
      createdByName: entry.createdBy?.fullName || 'System',
      createdAt: entry.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      customer: {
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
        availableCredit: Math.max(0, creditLimit - currentBalance),
        loyaltyPoints: customer.loyaltyPoints || 0,
        status: customer.status,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
      ledger: formattedLedger,
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
  }
}
