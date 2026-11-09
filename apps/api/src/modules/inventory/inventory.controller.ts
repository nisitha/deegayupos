import {
  Body,
  Controller,
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
import type {
  AuthTenant,
  AuthUser,
  InventoryTelemetryDto,
  PaginatedResult,
  StockAdjustmentDto,
  StockLevelDto,
  StockMovementDto,
  StockTransferDto,
} from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import {
  CreateStockAdjustmentDto,
  CreateStockTransferDto,
  StockLevelQueryDto,
  StockMovementQueryDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory & Stock Engine')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant UUID context header',
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('telemetry')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'Get inventory telemetry KPIs (total units, alerts, out-of-stock)' })
  @ApiOkResponse({ description: 'Inventory telemetry retrieved' })
  async getTelemetry(
    @CurrentTenant() tenant: AuthTenant,
  ): Promise<InventoryTelemetryDto> {
    return this.inventoryService.getTelemetry(tenant.id);
  }

  @Get('stock-levels')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'Query paginated multi-branch stock levels with filters' })
  @ApiOkResponse({ description: 'Stock levels retrieved' })
  async getStockLevels(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: StockLevelQueryDto,
  ): Promise<PaginatedResult<StockLevelDto>> {
    return this.inventoryService.getStockLevels(tenant.id, query);
  }

  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Apply physical count adjustment or damage/loss discrepancy' })
  @ApiOkResponse({ description: 'Stock adjustment applied and movement recorded' })
  async createAdjustment(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStockAdjustmentDto,
  ): Promise<StockAdjustmentDto> {
    return this.inventoryService.createAdjustment(tenant.id, user.id, dto);
  }

  @Post('transfers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Initiate inter-branch stock transfer' })
  @ApiOkResponse({ description: 'Stock transfer initiated with tracking number' })
  async createTransfer(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStockTransferDto,
  ): Promise<StockTransferDto> {
    return this.inventoryService.createTransfer(tenant.id, user.id, dto);
  }

  @Patch('transfers/:id/dispatch')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Dispatch transfer (decrements source warehouse inventory)' })
  @ApiOkResponse({ description: 'Stock transfer dispatched and source stock decremented' })
  async dispatchTransfer(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') transferId: string,
  ): Promise<StockTransferDto> {
    return this.inventoryService.dispatchTransfer(tenant.id, user.id, transferId);
  }

  @Patch('transfers/:id/receive')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Receive transfer (increments target warehouse inventory)' })
  @ApiOkResponse({ description: 'Stock transfer received and target stock incremented' })
  async receiveTransfer(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') transferId: string,
  ): Promise<StockTransferDto> {
    return this.inventoryService.receiveTransfer(tenant.id, user.id, transferId);
  }

  @Get('movements')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'Query immutable historical stock movement audit ledger' })
  @ApiOkResponse({ description: 'Stock movements retrieved' })
  async getMovements(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: StockMovementQueryDto,
  ): Promise<PaginatedResult<StockMovementDto>> {
    return this.inventoryService.getMovements(tenant.id, query);
  }
}

