import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        business: { slug: tenantSlug },
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            sales: true,
            ledgerEntries: true,
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 },
      );
    }

    const creditLimit = Number(customer.creditLimit || 0);
    const currentBalance = Number(customer.currentBalance || 0);

    return NextResponse.json({
      success: true,
      data: {
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
        _count: customer._count,
      },
    });
  } catch (error) {
    console.error('Error fetching customer by id:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 },
      );
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        phone: body.phone !== undefined ? body.phone?.trim() || null : undefined,
        email: body.email !== undefined ? body.email?.trim() || null : undefined,
        nicNumber: body.nicNumber !== undefined ? body.nicNumber?.trim() || null : undefined,
        address: body.address !== undefined ? body.address?.trim() || null : undefined,
        customerType: body.customerType !== undefined ? body.customerType : undefined,
        creditLimit:
          body.creditLimit !== undefined ? parseFloat(String(body.creditLimit)) : undefined,
        status: body.status !== undefined ? body.status : undefined,
      },
    });

    const creditLimit = Number(updated.creditLimit);
    const currentBalance = Number(updated.currentBalance);

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        tenantId: updated.tenantId,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        nicNumber: updated.nicNumber,
        address: updated.address,
        customerType: updated.customerType,
        creditLimit,
        currentBalance,
        availableCredit: Math.max(0, creditLimit - currentBalance),
        loyaltyPoints: updated.loyaltyPoints,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
  }
}
