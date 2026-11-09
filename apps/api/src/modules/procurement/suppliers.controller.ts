import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthTenant, PaginatedResult, SupplierDto } from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('Suppliers Directory')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant UUID context header',
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers:view')
  @ApiOperation({ summary: 'Query paginated suppliers with search and filters' })
  @ApiOkResponse({ description: 'Suppliers retrieved' })
  async getSuppliers(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: SupplierQueryDto,
  ): Promise<PaginatedResult<SupplierDto>> {
    return this.suppliersService.getSuppliers(tenant.id, query);
  }

  @Get(':id')
  @RequirePermissions('suppliers:view')
  @ApiOperation({ summary: 'Get single supplier details by UUID' })
  @ApiOkResponse({ description: 'Supplier retrieved' })
  async getSupplierById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<SupplierDto> {
    return this.suppliersService.getSupplierById(tenant.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('suppliers:manage')
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiOkResponse({ description: 'Supplier created' })
  async createSupplier(
    @CurrentTenant() tenant: AuthTenant,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierDto> {
    return this.suppliersService.createSupplier(tenant.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers:manage')
  @ApiOperation({ summary: 'Update an existing supplier' })
  @ApiOkResponse({ description: 'Supplier updated' })
  async updateSupplier(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    return this.suppliersService.updateSupplier(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers:manage')
  @ApiOperation({ summary: 'Soft-delete a supplier' })
  @ApiOkResponse({ description: 'Supplier deleted' })
  async deleteSupplier(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.suppliersService.deleteSupplier(tenant.id, id);
  }
}

