import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BusinessProfileData,
  BusinessSettingsData,
  UpdateBusinessSettingsPayload,
  UpdateReceiptSettingsPayload,
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
}

