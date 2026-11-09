import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CustomerPaymentMethod } from '@pixelcraft/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const body = await request.json();

    const amount = parseFloat(String(body.amount));
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Settlement amount must be greater than zero.' },
        { status: 400 },
      );
    }

    const paymentMethod: CustomerPaymentMethod = body.paymentMethod || 'CASH';

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 },
      );
    }

    const tenantId = customer.tenantId;
    const prevBalance = Number(customer.currentBalance);
    const newBalance = Math.max(0, prevBalance - amount);

    // Atomic transaction for payment record, ledger entry, and balance decrement
    const result = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.customerPayment.count({ where: { tenantId } });
      const receiptNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`;

      const payment = await tx.customerPayment.create({
        data: {
          tenantId,
          customerId,
          amount,
          paymentMethod,
          referenceNumber: body.referenceNumber?.trim() || null,
          receiptNumber,
          notes: body.notes?.trim() || `Debt settlement via ${paymentMethod}`,
        },
      });

      const ledger = await tx.customerLedger.create({
        data: {
          tenantId,
          customerId,
          entryType: 'PAYMENT_RECEIVED',
          referenceId: receiptNumber,
          debitAmount: 0,
          creditAmount: amount,
          runningBalance: newBalance,
          notes: body.notes?.trim() || `Debt settlement via ${paymentMethod}`,
        },
      });

      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          currentBalance: newBalance,
        },
      });

      return { payment, ledger, updatedCustomer };
    });

    const creditLimit = Number(result.updatedCustomer.creditLimit);
    const currentBalance = Number(result.updatedCustomer.currentBalance);

    return NextResponse.json(
      {
        success: true,
        customer: {
          id: result.updatedCustomer.id,
          tenantId: result.updatedCustomer.tenantId,
          name: result.updatedCustomer.name,
          phone: result.updatedCustomer.phone,
          email: result.updatedCustomer.email,
          nicNumber: result.updatedCustomer.nicNumber,
          address: result.updatedCustomer.address,
          customerType: result.updatedCustomer.customerType,
          creditLimit,
          currentBalance,
          availableCredit: Math.max(0, creditLimit - currentBalance),
          loyaltyPoints: result.updatedCustomer.loyaltyPoints,
          status: result.updatedCustomer.status,
          createdAt: result.updatedCustomer.createdAt.toISOString(),
          updatedAt: result.updatedCustomer.updatedAt.toISOString(),
        },
        payment: {
          id: result.payment.id,
          tenantId: result.payment.tenantId,
          customerId: result.payment.customerId,
          customerName: customer.name,
          amount: Number(result.payment.amount),
          paymentMethod: result.payment.paymentMethod,
          referenceNumber: result.payment.referenceNumber,
          receiptNumber: result.payment.receiptNumber,
          notes: result.payment.notes,
          createdAt: result.payment.createdAt.toISOString(),
        },
        ledgerEntry: {
          id: result.ledger.id,
          tenantId: result.ledger.tenantId,
          customerId: result.ledger.customerId,
          customerName: customer.name,
          entryType: result.ledger.entryType,
          referenceId: result.ledger.referenceId,
          debitAmount: Number(result.ledger.debitAmount),
          creditAmount: Number(result.ledger.creditAmount),
          runningBalance: Number(result.ledger.runningBalance),
          notes: result.ledger.notes,
          createdAt: result.ledger.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error recording debt settlement:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
  }
}
