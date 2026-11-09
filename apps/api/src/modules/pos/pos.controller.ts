import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  HeldCartDto,
  PaginatedResult,
  SaleDto,
} from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import {
  CheckoutRequestDto,
  HoldCartRequestDto,
  VoidSaleRequestDto,
} from './dto/pos.dto';
import { PosService } from './pos.service';

@ApiTags('POS & Sales Engine')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Optional tenant header override (verified against user memberships)',
  required: false,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('pos:checkout', 'pos:access')
  @ApiOperation({
    summary: 'Process checkout transaction',
    description: 'Executes sale creation, items creation, and payment capture in a single atomic transaction.',
  })
  @ApiOkResponse({ description: 'Sale processed successfully' })
  async checkout(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() body: CheckoutRequestDto,
  ): Promise<SaleDto> {
    return this.posService.checkout(tenant.id, user.id, body);
  }

  @Post('cart/hold')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('pos:checkout', 'pos:access')
  @ApiOperation({
    summary: 'Hold active cart',
    description: 'Suspends an active order ticket for later resumption (e.g. Table order or held queue).',
  })
  @ApiOkResponse({ description: 'Cart suspended successfully' })
  async holdCart(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() body: HoldCartRequestDto,
  ): Promise<HeldCartDto> {
    return this.posService.holdCart(tenant.id, user.id, body);
  }

  @Get('cart/held')
  @RequireAnyPermissions('pos:checkout', 'pos:access')
  @ApiOperation({
    summary: 'List held carts',
    description: 'Retrieves all suspended carts for the current tenant and branch.',
  })
  @ApiOkResponse({ description: 'Held carts list' })
  async getHeldCarts(
    @CurrentTenant() tenant: AuthTenant,
    @Query('branchId') branchId?: string,
  ): Promise<HeldCartDto[]> {
    return this.posService.getHeldCarts(tenant.id, branchId);
  }

  @Post('cart/resume/:id')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('pos:checkout', 'pos:access')
  @ApiOperation({
    summary: 'Resume held cart',
    description: 'Removes the suspended cart from queue and returns its data to resume in checkout.',
  })
  @ApiOkResponse({ description: 'Cart resumed successfully' })
  async resumeCart(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HeldCartDto> {
    return this.posService.resumeCart(tenant.id, id);
  }

  @Post('void/:id')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions('pos:checkout', 'pos:access', 'pos:refund', 'pos:void')
  @ApiOperation({
    summary: 'Void a completed sale',
    description: 'Sets sale status to VOIDED and logs audit event with reason.',
  })
  @ApiOkResponse({ description: 'Sale voided successfully' })
  async voidSale(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VoidSaleRequestDto,
  ): Promise<SaleDto> {
    return this.posService.voidSale(
      tenant.id,
      user.id,
      id,
      body.reason,
    );
  }

  @Get('sales/:id')
  @RequireAnyPermissions('pos:checkout', 'pos:access')
  @ApiOperation({
    summary: 'Get sale by ID',
    description: 'Fetches detailed sale record including items and payments for receipt reprint.',
  })
  @ApiOkResponse({ description: 'Sale details' })
  async getSaleById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SaleDto> {
    return this.posService.getSaleById(tenant.id, id);
  }

  @Get('sales')
  @RequireAnyPermissions('pos:checkout', 'pos:access')
  @ApiOperation({
    summary: 'List recent sales',
    description: 'Retrieves sales list with optional branch filtering and pagination.',
  })
  @ApiOkResponse({ description: 'Sales list' })
  async getSales(
    @CurrentTenant() tenant: AuthTenant,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<SaleDto>> {
    return this.posService.getSales(tenant.id, {
      branchId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
