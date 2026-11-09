import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import type {
  AuthTenant,
  AuthUser,
  GoodsReceivedNoteDto,
  PaginatedResult,
  PurchaseOrderDto,
} from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import {
  CreateGrnDto,
  CreatePurchaseOrderDto,
  GrnQueryDto,
  PurchaseOrderQueryDto,
} from './dto/procurement.dto';
import { ProcurementService } from './procurement.service';

@ApiTags('Procurement Engine (PO & GRN)')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant UUID context header',
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ==========================================
  // PURCHASE ORDERS (PO)
  // ==========================================

  @Get('purchase-orders')
  @RequirePermissions('procurement:view')
  @ApiOperation({ summary: 'Query paginated Purchase Orders with filters' })
  @ApiOkResponse({ description: 'Purchase Orders retrieved' })
  async getPurchaseOrders(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: PurchaseOrderQueryDto,
  ): Promise<PaginatedResult<PurchaseOrderDto>> {
    return this.procurementService.getPurchaseOrders(tenant.id, query);
  }

  @Get('purchase-orders/:id')
  @RequirePermissions('procurement:view')
  @ApiOperation({ summary: 'Get single Purchase Order details with line items' })
  @ApiOkResponse({ description: 'Purchase Order retrieved' })
  async getPurchaseOrderById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<PurchaseOrderDto> {
    return this.procurementService.getPurchaseOrderById(tenant.id, id);
  }

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('procurement:manage')
  @ApiOperation({ summary: 'Create and submit a new Purchase Order' })
  @ApiOkResponse({ description: 'Purchase Order created' })
  async createPurchaseOrder(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderDto> {
    return this.procurementService.createPurchaseOrder(tenant.id, user.id, dto);
  }

  // ==========================================
  // GOODS RECEIVED NOTES (GRN)
  // ==========================================

  @Get('grn')
  @RequirePermissions('procurement:view')
  @ApiOperation({ summary: 'Query paginated Goods Received Notes (GRN)' })
  @ApiOkResponse({ description: 'Goods Received Notes retrieved' })
  async getGoodsReceivedNotes(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: GrnQueryDto,
  ): Promise<PaginatedResult<GoodsReceivedNoteDto>> {
    return this.procurementService.getGoodsReceivedNotes(tenant.id, query);
  }

  @Get('grn/:id')
  @RequirePermissions('procurement:view')
  @ApiOperation({ summary: 'Get single GRN details with received line items' })
  @ApiOkResponse({ description: 'GRN retrieved' })
  async getGrnById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<GoodsReceivedNoteDto> {
    return this.procurementService.getGrnById(tenant.id, id);
  }

  @Post('grn')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('procurement:manage')
  @ApiOperation({
    summary: 'Receive inventory via GRN (atomic stock increment, movements & cost update)',
  })
  @ApiOkResponse({ description: 'GRN received and inventory updated' })
  async createGrn(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGrnDto,
  ): Promise<GoodsReceivedNoteDto> {
    return this.procurementService.createGrn(tenant.id, user.id, dto);
  }
}
