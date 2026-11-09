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
  CustomerDto,
  CustomerLedgerDto,
  CustomerPaymentDto,
  CustomerTelemetryDto,
  PaginatedResult,
} from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  CustomerQueryDto,
  RecordDebtSettlementDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@ApiTags('Customer CRM & Credit Ledger')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant UUID context header',
  required: true,
})
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('telemetry')
  @RequireAnyPermissions('customers:view', 'customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Get Customer CRM & Receivables telemetry KPIs' })
  @ApiOkResponse({ description: 'Telemetry KPI numbers' })
  async getTelemetry(
    @CurrentTenant() tenant: AuthTenant,
  ): Promise<CustomerTelemetryDto> {
    return this.customersService.getTelemetry(tenant.id);
  }

  @Get()
  @RequireAnyPermissions('customers:view', 'customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Query paginated customers with search and filters' })
  @ApiOkResponse({ description: 'Paginated customer list' })
  async getCustomers(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: CustomerQueryDto,
  ): Promise<PaginatedResult<CustomerDto>> {
    return this.customersService.getCustomers(tenant.id, query);
  }

  @Get(':id')
  @RequireAnyPermissions('customers:view', 'customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Get single customer details and credit status' })
  @ApiOkResponse({ description: 'Customer details retrieved' })
  async getCustomerById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<CustomerDto> {
    return this.customersService.getCustomerById(tenant.id, id);
  }

  @Get(':id/ledger')
  @RequireAnyPermissions('customers:view', 'customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Get customer ledger transaction timeline (Khata statement)' })
  @ApiOkResponse({ description: 'Customer statement and ledger history' })
  async getCustomerLedger(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<{ customer: CustomerDto; ledger: CustomerLedgerDto[] }> {
    return this.customersService.getCustomerLedger(tenant.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireAnyPermissions('customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Register a new retail or wholesale customer' })
  @ApiOkResponse({ description: 'Customer registered successfully' })
  async createCustomer(
    @CurrentTenant() tenant: AuthTenant,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    return this.customersService.createCustomer(tenant.id, dto);
  }

  @Patch(':id')
  @RequireAnyPermissions('customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Update customer profile or credit limit' })
  @ApiOkResponse({ description: 'Customer updated successfully' })
  async updateCustomer(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    return this.customersService.updateCustomer(tenant.id, id, dto);
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  @RequireAnyPermissions('customers:manage', 'pos:access')
  @ApiOperation({ summary: 'Record debt settlement payment against customer Khata' })
  @ApiOkResponse({ description: 'Payment recorded and ledger updated' })
  async recordDebtSettlement(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecordDebtSettlementDto,
  ): Promise<{ customer: CustomerDto; payment: CustomerPaymentDto; ledgerEntry: CustomerLedgerDto }> {
    return this.customersService.recordDebtSettlement(
      tenant.id,
      id,
      user?.id || null,
      dto,
    );
  }
}
