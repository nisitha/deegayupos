import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        unit: { select: { id: true, name: true, shortCode: true } },
        stockLevels: { select: { quantityOnHand: true } },
      },
    });

    if (!product || product.deletedAt) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const stockOnHand = product.stockLevels.reduce(
      (acc, sl) => acc + Number(sl.quantityOnHand || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        costPrice: Number(product.costPrice),
        retailPrice: Number(product.retailPrice),
        wholesalePrice: product.wholesalePrice ? Number(product.wholesalePrice) : null,
        stockOnHand,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
    if (body.brandId !== undefined) updateData.brandId = body.brandId || null;
    if (body.unitId !== undefined) updateData.unitId = body.unitId || null;
    if (body.costPrice !== undefined) updateData.costPrice = Number(body.costPrice);
    if (body.retailPrice !== undefined) updateData.retailPrice = Number(body.retailPrice);
    if (body.wholesalePrice !== undefined) {
      updateData.wholesalePrice = body.wholesalePrice !== null ? Number(body.wholesalePrice) : null;
    }
    if (body.alertQuantity !== undefined) updateData.alertQuantity = Number(body.alertQuantity);
    if (body.isTrackStock !== undefined) updateData.isTrackStock = Boolean(body.isTrackStock);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.type !== undefined) updateData.type = body.type;

    if (body.sku !== undefined && body.sku.trim() !== existing.sku) {
      const sku = body.sku.trim().toUpperCase();
      const conflict = await prisma.product.findUnique({
        where: { tenantId_sku: { tenantId: existing.tenantId, sku } },
      });
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { success: false, error: `SKU '${sku}' already in use` },
          { status: 409 }
        );
      }
      updateData.sku = sku;
    }

    if (body.barcode !== undefined && body.barcode !== existing.barcode) {
      const barcode = body.barcode && body.barcode.trim() ? body.barcode.trim() : null;
      if (barcode) {
        const conflict = await prisma.product.findUnique({
          where: { tenantId_barcode: { tenantId: existing.tenantId, barcode } },
        });
        if (conflict && conflict.id !== id) {
          return NextResponse.json(
            { success: false, error: `Barcode '${barcode}' already in use` },
            { status: 409 }
          );
        }
      }
      updateData.barcode = barcode;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        costPrice: Number(updated.costPrice),
        retailPrice: Number(updated.retailPrice),
        wholesalePrice: updated.wholesalePrice ? Number(updated.wholesalePrice) : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

