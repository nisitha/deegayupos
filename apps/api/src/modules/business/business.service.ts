import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BusinessProfileData,
  BusinessSettingsData,
  UpdateBusinessSettingsPayload,
  UpdateReceiptSettingsPayload,
  TenantStoreSettingsDto,
  UpdateTenantStoreSettingsDto,
} from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches tenant business organization profile, retail branches, and operational settings.
   */
  async getProfile(tenantId: string): Promise<BusinessProfileData> {
    const business = await this.prisma.business.findFirst({
      where: {
        id: tenantId,
        deletedAt: null,
      },
      include: {
        settings: true,
        branches: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business organization tenant not found.');
    }

    const primaryBranch =
      business.branches.find((b) => b.isPrimary) || business.branches[0] || null;

    let formattedSettings: BusinessSettingsData | null = null;
    if (business.settings) {
      const s = business.settings;
      formattedSettings = {
        id: s.id,
        tenantId: s.tenantId,
        invoicePrefix: s.invoicePrefix,
        taxNumber: s.taxNumber,
        taxRate: Number(s.taxRate),
        isTaxInclusive: s.isTaxInclusive,
        enableLoyalty: s.enableLoyalty,
        receiptPaperSize: (s.receiptPaperSize as any) || 'MM_80',
        showLogoOnReceipt: s.showLogoOnReceipt !== false,
        showTaxDetails: s.showTaxDetails !== false,
        showBarcodeOnReceipt: s.showBarcodeOnReceipt !== false,
        receiptHeader: s.receiptHeader,
        receiptFooter: s.receiptFooter,
        returnPolicyText: s.returnPolicyText,
        negativeStockPolicy: s.negativeStockPolicy || 'DISALLOW',
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    }

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      legalName: business.legalName,
      businessType: business.businessType,
      status: business.status,
      currency: business.currency,
      timezone: business.timezone,
      primaryBranch: primaryBranch
        ? {
            id: primaryBranch.id,
            code: primaryBranch.code,
            name: primaryBranch.name,
            address: primaryBranch.address,
            phone: primaryBranch.phone,
            isPrimary: primaryBranch.isPrimary,
            isActive: primaryBranch.isActive,
          }
        : null,
      branches: business.branches.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        address: b.address,
        phone: b.phone,
        isPrimary: b.isPrimary,
        isActive: b.isActive,
      })),
      settings: formattedSettings,
    };
  }

  /**
   * Updates tenant business settings and writes an immutable audit record.
   */
  async updateSettings(
    tenantId: string,
    userId: string,
    dto: UpdateBusinessSettingsPayload,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BusinessSettingsData> {
    const existing = await this.prisma.businessSetting.findUnique({
      where: {
        tenantId,
      },
    });

    const updateData: Record<string, unknown> = {};
    if (dto.invoicePrefix !== undefined) updateData.invoicePrefix = dto.invoicePrefix;
    if (dto.taxNumber !== undefined) updateData.taxNumber = dto.taxNumber;
    if (dto.taxRate !== undefined) updateData.taxRate = dto.taxRate;
    if (dto.isTaxInclusive !== undefined) updateData.isTaxInclusive = dto.isTaxInclusive;
    if (dto.enableLoyalty !== undefined) updateData.enableLoyalty = dto.enableLoyalty;
    if (dto.receiptPaperSize !== undefined) updateData.receiptPaperSize = dto.receiptPaperSize;
    if (dto.showLogoOnReceipt !== undefined) updateData.showLogoOnReceipt = dto.showLogoOnReceipt;
    if (dto.showTaxDetails !== undefined) updateData.showTaxDetails = dto.showTaxDetails;
    if (dto.showBarcodeOnReceipt !== undefined) updateData.showBarcodeOnReceipt = dto.showBarcodeOnReceipt;
    if (dto.receiptHeader !== undefined) updateData.receiptHeader = dto.receiptHeader;
    if (dto.receiptFooter !== undefined) updateData.receiptFooter = dto.receiptFooter;
    if (dto.returnPolicyText !== undefined) updateData.returnPolicyText = dto.returnPolicyText;
    if (dto.negativeStockPolicy !== undefined) updateData.negativeStockPolicy = dto.negativeStockPolicy;

    const updated = await this.prisma.businessSetting.upsert({
      where: {
        tenantId,
      },
      update: updateData,
      create: {
        tenantId,
        invoicePrefix: dto.invoicePrefix || 'INV-',
        taxNumber: dto.taxNumber || null,
        taxRate: dto.taxRate !== undefined ? dto.taxRate : 0.0,
        isTaxInclusive: dto.isTaxInclusive || false,
        enableLoyalty: dto.enableLoyalty || false,
        receiptPaperSize: dto.receiptPaperSize || 'MM_80',
        showLogoOnReceipt: dto.showLogoOnReceipt !== undefined ? dto.showLogoOnReceipt : true,
        showTaxDetails: dto.showTaxDetails !== undefined ? dto.showTaxDetails : true,
        showBarcodeOnReceipt: dto.showBarcodeOnReceipt !== undefined ? dto.showBarcodeOnReceipt : true,
        receiptHeader: dto.receiptHeader || null,
        receiptFooter: dto.receiptFooter || null,
        returnPolicyText: dto.returnPolicyText || null,
        negativeStockPolicy: dto.negativeStockPolicy || 'DISALLOW',
      },
    });

    // Record immutable audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'BUSINESS_SETTINGS_UPDATED',
        entity: 'BusinessSetting',
        entityId: updated.id,
        oldValues: existing ? JSON.parse(JSON.stringify(existing)) : null,
        newValues: JSON.parse(JSON.stringify(updated)),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      invoicePrefix: updated.invoicePrefix,
      taxNumber: updated.taxNumber,
      taxRate: Number(updated.taxRate),
      isTaxInclusive: updated.isTaxInclusive,
      enableLoyalty: updated.enableLoyalty,
      receiptPaperSize: (updated.receiptPaperSize as any) || 'MM_80',
      showLogoOnReceipt: updated.showLogoOnReceipt !== false,
      showTaxDetails: updated.showTaxDetails !== false,
      showBarcodeOnReceipt: updated.showBarcodeOnReceipt !== false,
      receiptHeader: updated.receiptHeader,
      receiptFooter: updated.receiptFooter,
      returnPolicyText: updated.returnPolicyText,
      negativeStockPolicy: updated.negativeStockPolicy || 'DISALLOW',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Updates tenant receipt & document customization preferences.
   */
  async updateReceiptSettings(
    tenantId: string,
    userId: string,
    dto: UpdateReceiptSettingsPayload,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BusinessSettingsData> {
    const existing = await this.prisma.businessSetting.findUnique({
      where: { tenantId },
    });

    const updateData: Record<string, unknown> = {};
    if (dto.receiptPaperSize !== undefined) updateData.receiptPaperSize = dto.receiptPaperSize;
    if (dto.showLogoOnReceipt !== undefined) updateData.showLogoOnReceipt = dto.showLogoOnReceipt;
    if (dto.showTaxDetails !== undefined) updateData.showTaxDetails = dto.showTaxDetails;
    if (dto.showBarcodeOnReceipt !== undefined) updateData.showBarcodeOnReceipt = dto.showBarcodeOnReceipt;
    if (dto.receiptHeader !== undefined) updateData.receiptHeader = dto.receiptHeader;
    if (dto.receiptFooter !== undefined) updateData.receiptFooter = dto.receiptFooter;
    if (dto.returnPolicyText !== undefined) updateData.returnPolicyText = dto.returnPolicyText;

    const updated = await this.prisma.businessSetting.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        invoicePrefix: 'INV-',
        receiptPaperSize: dto.receiptPaperSize || 'MM_80',
        showLogoOnReceipt: dto.showLogoOnReceipt !== undefined ? dto.showLogoOnReceipt : true,
        showTaxDetails: dto.showTaxDetails !== undefined ? dto.showTaxDetails : true,
        showBarcodeOnReceipt: dto.showBarcodeOnReceipt !== undefined ? dto.showBarcodeOnReceipt : true,
        receiptHeader: dto.receiptHeader || null,
        receiptFooter: dto.receiptFooter || null,
        returnPolicyText: dto.returnPolicyText || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'RECEIPT_SETTINGS_UPDATED',
        entity: 'BusinessSetting',
        entityId: updated.id,
        oldValues: existing ? JSON.parse(JSON.stringify(existing)) : null,
        newValues: JSON.parse(JSON.stringify(updated)),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      invoicePrefix: updated.invoicePrefix,
      taxNumber: updated.taxNumber,
      taxRate: Number(updated.taxRate),
      isTaxInclusive: updated.isTaxInclusive,
      enableLoyalty: updated.enableLoyalty,
      receiptPaperSize: (updated.receiptPaperSize as any) || 'MM_80',
      showLogoOnReceipt: updated.showLogoOnReceipt !== false,
      showTaxDetails: updated.showTaxDetails !== false,
      showBarcodeOnReceipt: updated.showBarcodeOnReceipt !== false,
      receiptHeader: updated.receiptHeader,
      receiptFooter: updated.receiptFooter,
      returnPolicyText: updated.returnPolicyText,
      negativeStockPolicy: updated.negativeStockPolicy || 'DISALLOW',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves store identity, contact info, and receipt branding for active tenant.
   */
  async getTenantStoreSettings(tenantId: string): Promise<TenantStoreSettingsDto> {
    const business = await this.prisma.business.findFirst({
      where: { id: tenantId, deletedAt: null },
      include: {
        settings: true,
        tenantSettings: true,
        branches: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Tenant organization not found.');
    }

    const primaryBranch = business.branches.find((b) => b.isPrimary) || business.branches[0] || null;
    const ts = business.tenantSettings;
    const bs = business.settings;

    return {
      id: ts?.id || bs?.id || business.id,
      tenantId: business.id,
      name: ts?.name || business.name || 'Deegayu Weda Madhura',
      legalName: ts?.legalName ?? business.legalName ?? 'Deegayu Weda Madhura (Pvt) Ltd',
      logoUrl: ts?.logoUrl ?? business.logoUrl ?? 'https://pos.pixelcraftlk.com/images/deegayu-logo.png',
      phone: ts?.phone || business.phone || primaryBranch?.phone || '+94 34 222 3456',
      email: ts?.email ?? business.email ?? 'info@deegayu.pixelcraftlk.com',
      address: ts?.address || business.address || primaryBranch?.address || 'Main Street, Kalutara, Sri Lanka',
      vatNumber: ts?.vatNumber ?? bs?.vatNumber ?? bs?.taxNumber ?? 'VAT-10928392-8000',
      receiptHeaderNote:
        ts?.receiptHeaderNote ??
        bs?.receiptHeaderNote ??
        bs?.receiptHeader ??
        'Welcome to Deegayu Weda Madhura • Traditional Ayurvedic Dispensary',
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
  }

  /**
   * Persists updated store profile and receipt branding settings for tenant.
   */
  async updateTenantStoreSettings(
    tenantId: string,
    userId: string,
    dto: UpdateTenantStoreSettingsDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TenantStoreSettingsDto> {
    const business = await this.prisma.business.findFirst({
      where: { id: tenantId, deletedAt: null },
      include: {
        settings: true,
        tenantSettings: true,
        branches: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Tenant organization not found.');
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
    } = dto;

    // 1. Update Business record
    const updatedBusiness = await this.prisma.business.update({
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

    // 2. Upsert BusinessSetting
    const paperSizeEnum = receiptPaperWidth === '58mm' ? 'MM_58' : 'MM_80';
    const updatedBs = await this.prisma.businessSetting.upsert({
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

    // 3. Upsert TenantSettings model
    const updatedTs = await this.prisma.tenantSettings.upsert({
      where: { tenantId: business.id },
      create: {
        tenantId: business.id,
        name: name || updatedBusiness.name,
        legalName: legalName !== undefined ? legalName : updatedBusiness.legalName,
        logoUrl: logoUrl !== undefined ? logoUrl : updatedBusiness.logoUrl,
        phone: phone || updatedBusiness.phone || '+94 34 222 3456',
        email: email !== undefined ? email : updatedBusiness.email,
        address: address || updatedBusiness.address || 'Main Street, Kalutara, Sri Lanka',
        vatNumber: vatNumber !== undefined ? vatNumber : updatedBs.vatNumber,
        receiptHeaderNote: receiptHeaderNote !== undefined ? receiptHeaderNote : updatedBs.receiptHeaderNote,
        receiptFooterNote: receiptFooterNote !== undefined ? receiptFooterNote : updatedBs.receiptFooterNote,
        returnPolicy: returnPolicy !== undefined ? returnPolicy : updatedBs.returnPolicy,
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

    // 4. Update primary branch if contact info changed
    const primaryBranch = business.branches.find((b) => b.isPrimary) || business.branches[0];
    if (primaryBranch && (address !== undefined || phone !== undefined)) {
      await this.prisma.branch.update({
        where: { id: primaryBranch.id },
        data: {
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
        },
      });
    }

    // 5. Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TENANT_SETTINGS_UPDATED',
        entity: 'TenantSettings',
        entityId: updatedTs.id,
        newValues: JSON.parse(JSON.stringify(updatedTs)),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return {
      id: updatedTs.id,
      tenantId: business.id,
      name: updatedTs.name,
      legalName: updatedTs.legalName,
      logoUrl: updatedTs.logoUrl,
      phone: updatedTs.phone || '',
      email: updatedTs.email,
      address: updatedTs.address || '',
      vatNumber: updatedTs.vatNumber,
      receiptHeaderNote: updatedTs.receiptHeaderNote,
      receiptFooterNote: updatedTs.receiptFooterNote,
      returnPolicy: updatedTs.returnPolicy,
      receiptPaperWidth: updatedTs.receiptPaperWidth as '80mm' | '58mm',
      showLogo: updatedTs.showLogo,
      showVat: updatedTs.showVat,
      showBarcode: updatedTs.showBarcode,
      showQr: updatedTs.showQr,
      updatedAt: updatedTs.updatedAt.toISOString(),
    };
  }
}

