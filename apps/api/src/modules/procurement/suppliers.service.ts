import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult, SupplierDto } from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Query paginated suppliers with search and status filtering
   */
  async getSuppliers(
    tenantId: string,
    query: SupplierQueryDto,
  ): Promise<PaginatedResult<SupplierDto>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { contactPerson: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              purchaseOrders: true,
              goodsReceivedNotes: true,
            },
          },
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const items: SupplierDto[] = records.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      contactPerson: r.contactPerson,
      phone: r.phone,
      email: r.email,
      address: r.address,
      taxNumber: r.taxNumber,
      paymentTerms: r.paymentTerms,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      _count: {
        purchaseOrders: r._count?.purchaseOrders || 0,
        goodsReceivedNotes: r._count?.goodsReceivedNotes || 0,
      },
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 2. Retrieve single supplier by ID
   */
  async getSupplierById(tenantId: string, id: string): Promise<SupplierDto> {
    const r = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            goodsReceivedNotes: true,
          },
        },
      },
    });

    if (!r) {
      throw new NotFoundException(`Supplier with ID "${id}" not found.`);
    }

    return {
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      contactPerson: r.contactPerson,
      phone: r.phone,
      email: r.email,
      address: r.address,
      taxNumber: r.taxNumber,
      paymentTerms: r.paymentTerms,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      _count: {
        purchaseOrders: r._count?.purchaseOrders || 0,
        goodsReceivedNotes: r._count?.goodsReceivedNotes || 0,
      },
    };
  }

  /**
   * 3. Create a new supplier
   */
  async createSupplier(tenantId: string, dto: CreateSupplierDto): Promise<SupplierDto> {
    let code = dto.code ? dto.code.trim().toUpperCase() : '';

    if (!code) {
      const count = await this.prisma.supplier.count({ where: { tenantId } });
      code = `SUP-${String(count + 1).padStart(3, '0')}`;
    }

    const existing = await this.prisma.supplier.findFirst({
      where: {
        tenantId,
        code,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Supplier with code "${code}" already exists for this tenant.`);
    }

    const created = await this.prisma.supplier.create({
      data: {
        tenantId,
        code,
        name: dto.name.trim(),
        contactPerson: dto.contactPerson?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        taxNumber: dto.taxNumber?.trim() || null,
        paymentTerms: dto.paymentTerms?.trim() || 'NET_30',
        status: 'ACTIVE',
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      code: created.code,
      name: created.name,
      contactPerson: created.contactPerson,
      phone: created.phone,
      email: created.email,
      address: created.address,
      taxNumber: created.taxNumber,
      paymentTerms: created.paymentTerms,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * 4. Update supplier details
   */
  async updateSupplier(
    tenantId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Supplier with ID "${id}" not found.`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeClash = await this.prisma.supplier.findFirst({
        where: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (codeClash) {
        throw new ConflictException(`Supplier with code "${dto.code}" already exists.`);
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        code: dto.code !== undefined ? dto.code.trim().toUpperCase() : existing.code,
        contactPerson: dto.contactPerson !== undefined ? dto.contactPerson?.trim() || null : existing.contactPerson,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : existing.phone,
        email: dto.email !== undefined ? dto.email?.trim() || null : existing.email,
        address: dto.address !== undefined ? dto.address?.trim() || null : existing.address,
        taxNumber: dto.taxNumber !== undefined ? dto.taxNumber?.trim() || null : existing.taxNumber,
        paymentTerms: dto.paymentTerms !== undefined ? dto.paymentTerms?.trim() || null : existing.paymentTerms,
        status: dto.status !== undefined ? dto.status : existing.status,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      code: updated.code,
      name: updated.name,
      contactPerson: updated.contactPerson,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      taxNumber: updated.taxNumber,
      paymentTerms: updated.paymentTerms,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * 5. Soft-delete supplier
   */
  async deleteSupplier(tenantId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Supplier with ID "${id}" not found.`);
    }

    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    return { success: true };
  }
}
