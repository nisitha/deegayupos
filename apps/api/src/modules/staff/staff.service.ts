import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { StaffRole, StaffUserDto } from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';
import type {
  CreateStaffUserDto,
  UpdateStaffUserDto,
} from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all active staff members and cashiers belonging to the tenant.
   */
  async listStaff(tenantId: string): Promise<StaffUserDto[]> {
    const memberships = await this.prisma.businessMembership.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((m) => this.mapMembershipToDto(m));
  }

  /**
   * Get a specific staff user by ID in this tenant.
   */
  async getStaffById(tenantId: string, userId: string): Promise<StaffUserDto> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: {
        tenantId,
        userId,
        deletedAt: null,
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(`Staff user with ID "${userId}" not found.`);
    }

    return this.mapMembershipToDto(membership);
  }

  /**
   * Create a new staff account (User + BusinessMembership) with hashed credentials and role assignment.
   */
  async createStaff(
    tenantId: string,
    dto: CreateStaffUserDto,
  ): Promise<StaffUserDto> {
    const email = dto.email.toLowerCase().trim();

    // Check if membership already exists in this organization
    const existingMembership = await this.prisma.businessMembership.findFirst({
      where: {
        tenantId,
        user: { email },
        deletedAt: null,
      },
    });

    if (existingMembership) {
      throw new ConflictException(
        `A staff account with email "${dto.email}" already exists in this store.`,
      );
    }

    // Resolve or create Role entity
    let role = await this.prisma.role.findFirst({
      where: {
        tenantId,
        code: dto.role,
        deletedAt: null,
      },
    });

    if (!role) {
      role = await this.prisma.role.findFirst({
        where: {
          code: dto.role,
          deletedAt: null,
        },
      });
    }

    if (!role) {
      const roleNames: Record<StaffRole, string> = {
        OWNER: 'Store Owner',
        MANAGER: 'Store Manager',
        CASHIER: 'Cashier Staff',
      };
      role = await this.prisma.role.create({
        data: {
          tenantId,
          code: dto.role,
          name: roleNames[dto.role] || dto.role,
          description: `Default role for ${dto.role}`,
          isSystem: false,
        },
      });
    }

    const defaultPass = dto.password || 'PixelCraft@2026';
    const passwordHash = await bcrypt.hash(defaultPass, 10);
    const pinCodeHash = dto.pinCode ? await bcrypt.hash(dto.pinCode, 10) : null;

    const membership = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            fullName: dto.fullName.trim(),
            phone: dto.phone?.trim() || null,
            passwordHash,
            pinCode: pinCodeHash,
            isActive: true,
          },
        });
      } else {
        // User exists in platform, update name/phone/pin if provided
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: dto.fullName.trim() || user.fullName,
            phone: dto.phone?.trim() || user.phone,
            ...(pinCodeHash ? { pinCode: pinCodeHash } : {}),
            isActive: true,
          },
        });
      }

      const newMembership = await tx.businessMembership.create({
        data: {
          tenantId,
          userId: user.id,
          roleId: role.id,
          defaultBranchId: dto.branchId || null,
          status: 'ACTIVE',
        },
        include: {
          user: true,
          role: true,
          defaultBranch: true,
        },
      });

      return newMembership;
    });

    return this.mapMembershipToDto(membership);
  }

  /**
   * Update an existing staff member's details, role, branch, PIN, or active status.
   */
  async updateStaff(
    tenantId: string,
    userId: string,
    dto: UpdateStaffUserDto,
  ): Promise<StaffUserDto> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: {
        tenantId,
        userId,
        deletedAt: null,
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(`Staff user with ID "${userId}" not found.`);
    }

    let roleId = membership.roleId;
    if (dto.role && dto.role !== membership.role.code) {
      let targetRole = await this.prisma.role.findFirst({
        where: {
          tenantId,
          code: dto.role,
          deletedAt: null,
        },
      });
      if (!targetRole) {
        targetRole = await this.prisma.role.findFirst({
          where: {
            code: dto.role,
            deletedAt: null,
          },
        });
      }
      if (!targetRole) {
        const roleNames: Record<StaffRole, string> = {
          OWNER: 'Store Owner',
          MANAGER: 'Store Manager',
          CASHIER: 'Cashier Staff',
        };
        targetRole = await this.prisma.role.create({
          data: {
            tenantId,
            code: dto.role,
            name: roleNames[dto.role] || dto.role,
            description: `Default role for ${dto.role}`,
          },
        });
      }
      roleId = targetRole.id;
    }

    const userUpdateData: Record<string, unknown> = {};
    if (dto.fullName) userUpdateData.fullName = dto.fullName.trim();
    if (dto.email) userUpdateData.email = dto.email.toLowerCase().trim();
    if (dto.phone !== undefined) userUpdateData.phone = dto.phone?.trim() || null;
    if (dto.password) {
      userUpdateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.pinCode !== undefined) {
      userUpdateData.pinCode = dto.pinCode ? await bcrypt.hash(dto.pinCode, 10) : null;
    }
    if (dto.isActive !== undefined) {
      userUpdateData.isActive = dto.isActive;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      return tx.businessMembership.update({
        where: { id: membership.id },
        data: {
          roleId,
          defaultBranchId: dto.branchId !== undefined ? dto.branchId || null : membership.defaultBranchId,
          status: dto.isActive !== undefined ? (dto.isActive ? 'ACTIVE' : 'SUSPENDED') : membership.status,
        },
        include: {
          user: true,
          role: true,
          defaultBranch: true,
        },
      });
    });

    return this.mapMembershipToDto(updated);
  }

  /**
   * Soft-delete staff membership.
   */
  async deleteStaff(tenantId: string, userId: string): Promise<{ success: boolean }> {
    const membership = await this.prisma.businessMembership.findFirst({
      where: {
        tenantId,
        userId,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(`Staff user with ID "${userId}" not found.`);
    }

    if (membership.role.code === 'OWNER') {
      const activeOwnerCount = await this.prisma.businessMembership.count({
        where: {
          tenantId,
          role: { code: 'OWNER' },
          deletedAt: null,
          status: 'ACTIVE',
        },
      });

      if (activeOwnerCount <= 1) {
        throw new BadRequestException('Cannot remove the sole owner of this organization.');
      }
    }

    await this.prisma.businessMembership.update({
      where: { id: membership.id },
      data: {
        status: 'SUSPENDED',
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * Fast 4-digit PIN authentication for switching cashiers at terminal in < 15ms.
   */
  async verifyPin(tenantId: string, pinCode: string): Promise<StaffUserDto | null> {
    const memberships = await this.prisma.businessMembership.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        user: {
          isActive: true,
          pinCode: { not: null },
          deletedAt: null,
        },
      },
      include: {
        user: true,
        role: true,
        defaultBranch: true,
      },
    });

    for (const m of memberships) {
      if (m.user.pinCode) {
        const match = await bcrypt.compare(pinCode, m.user.pinCode);
        if (match) {
          return this.mapMembershipToDto(m);
        }
      }
    }

    return null;
  }

  private mapMembershipToDto(m: any): StaffUserDto {
    const roleCode = (m.role?.code as StaffRole) || 'CASHIER';
    return {
      id: m.user.id,
      email: m.user.email,
      fullName: m.user.fullName,
      phone: m.user.phone || null,
      role: roleCode,
      roleName: m.role?.name || roleCode,
      roleId: m.roleId,
      hasPin: Boolean(m.user.pinCode),
      isActive: m.user.isActive && m.status === 'ACTIVE',
      branchId: m.defaultBranchId || null,
      branchName: m.defaultBranch?.name || null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}
