import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { TenantStoreSettingsDto } from '@pixelcraft/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');

    // 1. Resolve tenant
    let business = null;
    if (tenantIdParam) {
      business = await prisma.business.findUnique({
        where: { id: tenantIdParam },
        include: {
          settings: true,
          tenantSettings: true,
          branches: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    if (!business) {
      business = await prisma.business.findUnique({
        where: { slug: tenantSlug },
        include: {
          settings: true,
          tenantSettings: true,
          branches: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    if (!business) {
      business = await prisma.business.findFirst({
        where: { deletedAt: null },
        include: {
          settings: true,
          tenantSettings: true,
          branches: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const primaryBranch = business.branches.find((b) => b.isPrimary) || business.branches[0] || null;
    const ts = business.tenantSettings;
    const bs = business.settings;

    const data: TenantStoreSettingsDto = {
      id: ts?.id || bs?.id || business.id,
      tenantId: business.id,
      name: ts?.name || business.name || 'දීගායු වෙද මැදුර / Deegayu Weda Madura',
      legalName: ts?.legalName ?? business.legalName ?? 'Deegayu Ayurvedic Products & Health Care (Pvt) Ltd',
      logoUrl: ts?.logoUrl ?? business.logoUrl ?? 'https://pos.pixelcraftlk.com/images/deegayu-logo.png',
      phone: ts?.phone || business.phone || primaryBranch?.phone || '+94 34 222 3456',
      email: ts?.email ?? business.email ?? 'info@deegayu.pixelcraftlk.com',
      address: ts?.address || business.address || primaryBranch?.address || 'Main Street, Kalutara, Sri Lanka',
      vatNumber: ts?.vatNumber ?? bs?.vatNumber ?? bs?.taxNumber ?? 'VAT-10928392-8000',
      receiptHeaderNote:
        ts?.receiptHeaderNote ??
        bs?.receiptHeaderNote ??
        bs?.receiptHeader ??
        'Welcome to Deegayu Weda Madura • Traditional Ayurvedic Dispensary',
      receiptFooterNote:
        ts?.receiptFooterNote ??
        bs?.receiptFooterNote ??
        bs?.receiptFooter ??
        'නිරෝගී සුවය පතමු! / Wishing you healthy living! Return within 7 days.',
      returnPolicy:
        ts?.returnPolicy ??
        bs?.returnPolicy ??
        bs?.returnPolicyText ??
        'Authentic Ayurvedic preparations in unopened seal condition exchangeable within 7 days with original receipt.',
      receiptPaperWidth:
        (ts?.receiptPaperWidth as '80mm' | '58mm') ||
        (bs?.receiptPaperWidth as '80mm' | '58mm') ||
        (bs?.receiptPaperSize === 'MM_58' ? '58mm' : '80mm'),
      showLogo: ts?.showLogo ?? bs?.showLogo ?? bs?.showLogoOnReceipt ?? true,
      showVat: ts?.showVat ?? bs?.showVat ?? bs?.showTaxDetails ?? true,
      showBarcode: ts?.showBarcode ?? bs?.showBarcode ?? bs?.showBarcodeOnReceipt ?? true,
      showQr: ts?.showQr ?? bs?.showQr ?? true,
      updatedAt: ts?.updatedAt?.toISOString() || bs?.updatedAt?.toISOString() || business.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/tenant/settings:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve tenant settings',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('slug') || 'deegayu';
    const tenantIdParam = searchParams.get('tenantId') || request.headers.get('x-tenant-id');
    const body = await request.json();

    // 1. Resolve tenant
    let business = null;
    if (tenantIdParam) {
      business = await prisma.business.findUnique({
        where: { id: tenantIdParam },
        include: {
          settings: true,
          tenantSettings: true,
          branches: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    if (!business) {
      business = await prisma.business.findUnique({
        where: { slug: tenantSlug },
        include: {
          settings: true,
          tenantSettings: true,
          branches: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    if (!business) {
      business = await prisma.business.findFirst({
        where: { deletedAt: null },
        include: {
          settings: true,
          tenantSettings: true,
          branches: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          },
        },
      });
    }

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Tenant organization not found' },
        { status: 404 },
      );
    }

    const {
      name,
      legalName,
      logoUrl,
      phone,
      email,
      address,
      vatNumber,
      receiptHeaderNote,
      receiptFooterNote,
      returnPolicy,
      receiptPaperWidth,
      showLogo,
      showVat,
      showBarcode,
      showQr,
    } = body;

    // 2. Update Business record
    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...(name !== undefined && { name }),
        ...(legalName !== undefined && { legalName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
      },
    });

    // 3. Upsert BusinessSetting
    const paperSizeEnum = receiptPaperWidth === '58mm' ? 'MM_58' : 'MM_80';
    const updatedSettings = await prisma.businessSetting.upsert({
      where: { tenantId: business.id },
      create: {
        tenantId: business.id,
        invoicePrefix: 'INV-',
        taxNumber: vatNumber !== undefined ? vatNumber : null,
        vatNumber: vatNumber !== undefined ? vatNumber : null,
        receiptHeader: receiptHeaderNote !== undefined ? receiptHeaderNote : null,
        receiptHeaderNote: receiptHeaderNote !== undefined ? receiptHeaderNote : null,
        receiptFooter: receiptFooterNote !== undefined ? receiptFooterNote : null,
        receiptFooterNote: receiptFooterNote !== undefined ? receiptFooterNote : null,
        returnPolicyText: returnPolicy !== undefined ? returnPolicy : null,
        returnPolicy: returnPolicy !== undefined ? returnPolicy : null,
        receiptPaperSize: paperSizeEnum,
        receiptPaperWidth: receiptPaperWidth || '80mm',
        showLogoOnReceipt: showLogo !== undefined ? showLogo : true,
        showLogo: showLogo !== undefined ? showLogo : true,
        showTaxDetails: showVat !== undefined ? showVat : true,
        showVat: showVat !== undefined ? showVat : true,
        showBarcodeOnReceipt: showBarcode !== undefined ? showBarcode : true,
        showBarcode: showBarcode !== undefined ? showBarcode : true,
        showQr: showQr !== undefined ? showQr : true,
      },
      update: {
        ...(vatNumber !== undefined && { taxNumber: vatNumber, vatNumber }),
        ...(receiptHeaderNote !== undefined && {
          receiptHeader: receiptHeaderNote,
          receiptHeaderNote,
        }),
        ...(receiptFooterNote !== undefined && {
          receiptFooter: receiptFooterNote,
          receiptFooterNote,
        }),
        ...(returnPolicy !== undefined && {
          returnPolicyText: returnPolicy,
          returnPolicy,
        }),
        ...(receiptPaperWidth !== undefined && {
          receiptPaperSize: paperSizeEnum,
          receiptPaperWidth,
        }),
        ...(showLogo !== undefined && { showLogoOnReceipt: showLogo, showLogo }),
        ...(showVat !== undefined && { showTaxDetails: showVat, showVat }),
        ...(showBarcode !== undefined && { showBarcodeOnReceipt: showBarcode, showBarcode }),
        ...(showQr !== undefined && { showQr }),
      },
    });

    // 4. Upsert TenantSettings model
    const updatedTenantSettings = await prisma.tenantSettings.upsert({
      where: { tenantId: business.id },
      create: {
        tenantId: business.id,
        name: name || updatedBusiness.name,
        legalName: legalName !== undefined ? legalName : updatedBusiness.legalName,
        logoUrl: logoUrl !== undefined ? logoUrl : updatedBusiness.logoUrl,
        phone: phone || updatedBusiness.phone || '+94 34 222 3456',
        email: email !== undefined ? email : updatedBusiness.email,
        address: address || updatedBusiness.address || 'Main Street, Kalutara, Sri Lanka',
        vatNumber: vatNumber !== undefined ? vatNumber : updatedSettings.vatNumber,
        receiptHeaderNote: receiptHeaderNote !== undefined ? receiptHeaderNote : updatedSettings.receiptHeaderNote,
        receiptFooterNote: receiptFooterNote !== undefined ? receiptFooterNote : updatedSettings.receiptFooterNote,
        returnPolicy: returnPolicy !== undefined ? returnPolicy : updatedSettings.returnPolicy,
        receiptPaperWidth: receiptPaperWidth || '80mm',
        showLogo: showLogo !== undefined ? showLogo : true,
        showVat: showVat !== undefined ? showVat : true,
        showBarcode: showBarcode !== undefined ? showBarcode : true,
        showQr: showQr !== undefined ? showQr : true,
      },
      update: {
        ...(name !== undefined && { name }),
        ...(legalName !== undefined && { legalName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(vatNumber !== undefined && { vatNumber }),
        ...(receiptHeaderNote !== undefined && { receiptHeaderNote }),
        ...(receiptFooterNote !== undefined && { receiptFooterNote }),
        ...(returnPolicy !== undefined && { returnPolicy }),
        ...(receiptPaperWidth !== undefined && { receiptPaperWidth }),
        ...(showLogo !== undefined && { showLogo }),
        ...(showVat !== undefined && { showVat }),
        ...(showBarcode !== undefined && { showBarcode }),
        ...(showQr !== undefined && { showQr }),
      },
    });

    // 5. If primary branch exists, sync address & phone to primary branch so that receipt generator also picks it up
    const primaryBranch = business.branches.find((b) => b.isPrimary) || business.branches[0];
    if (primaryBranch && (address !== undefined || phone !== undefined || name !== undefined)) {
      await prisma.branch.update({
        where: { id: primaryBranch.id },
        data: {
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
        },
      });
    }

    const responseData: TenantStoreSettingsDto = {
      id: updatedTenantSettings.id,
      tenantId: business.id,
      name: updatedTenantSettings.name,
      legalName: updatedTenantSettings.legalName,
      logoUrl: updatedTenantSettings.logoUrl,
      phone: updatedTenantSettings.phone || '',
      email: updatedTenantSettings.email,
      address: updatedTenantSettings.address || '',
      vatNumber: updatedTenantSettings.vatNumber,
      receiptHeaderNote: updatedTenantSettings.receiptHeaderNote,
      receiptFooterNote: updatedTenantSettings.receiptFooterNote,
      returnPolicy: updatedTenantSettings.returnPolicy,
      receiptPaperWidth: updatedTenantSettings.receiptPaperWidth as '80mm' | '58mm',
      showLogo: updatedTenantSettings.showLogo,
      showVat: updatedTenantSettings.showVat,
      showBarcode: updatedTenantSettings.showBarcode,
      showQr: updatedTenantSettings.showQr,
      updatedAt: updatedTenantSettings.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'Store profile & receipt branding updated successfully',
    });
  } catch (err: unknown) {
    console.error('Error in PATCH /api/tenant/settings:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update tenant settings',
      },
      { status: 500 },
    );
  }
}

