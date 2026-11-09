import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BusinessProfileData,
  BusinessSettingsData,
  UpdateBusinessSettingsPayload,
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
        receiptFooter: s.receiptFooter,
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
    if (dto.receiptFooter !== undefined) updateData.receiptFooter = dto.receiptFooter;
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
        receiptFooter: dto.receiptFooter || null,
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
      receiptFooter: updated.receiptFooter,
      negativeStockPolicy: updated.negativeStockPolicy || 'DISALLOW',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

