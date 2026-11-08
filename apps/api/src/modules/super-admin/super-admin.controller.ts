import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthUser,
  PaginatedResult,
  PlatformSettingItemDto,
  SaaSPlanDto,
  SuperAdminOverviewMetrics,
  SystemAuditLogDto,
  TenantDetail,
  TenantSummary,
} from '@pixelcraft/types';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import {
  AuditLogQueryDto,
  CreatePlanRequestDto,
  TenantListQueryDto,
  UpdatePlanRequestDto,
  UpdatePlatformSettingRequestDto,
  UpdateTenantStatusRequestDto,
} from './dto/super-admin.dto';
import { SuperAdminService } from './super-admin.service';

@ApiTags('Super Admin Platform Engine')
@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Platform-wide Telemetry KPI Metrics',
    description:
      'Aggregates business count, active tenants, suspended tenants, total users, branches, registers, and estimated MRR across all tenants.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Metrics retrieved successfully.' })
  async getOverview(): Promise<SuperAdminOverviewMetrics> {
    return this.superAdminService.getOverviewMetrics();
  }

  @Get('tenants')
  @ApiOperation({
    summary: 'List Paginated Tenant Organizations',
    description:
      'Returns paginated list of tenant businesses with search by name/slug and filter by status.',
  })
  async getTenants(
    @Query() query: TenantListQueryDto,
  ): Promise<PaginatedResult<TenantSummary>> {
    return this.superAdminService.getTenants(query);
  }

  @Get('tenants/:id')
  @ApiOperation({
    summary: 'Get Detailed Tenant Organization Profile',
    description:
      'Returns deep tenant profile including branches, registers, warehouses, staff memberships, and active SaaS subscriptions.',
  })
  @ApiParam({ name: 'id', description: 'Tenant Business UUID' })
  async getTenantDetail(@Param('id') id: string): Promise<TenantDetail> {
    return this.superAdminService.getTenantDetail(id);
  }

  @Patch('tenants/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Tenant Status (Activate / Suspend)',
    description:
      'Modifies business status (ACTIVE, SUSPENDED, TRIAL, EXPIRED) and writes an immutable audit log entry.',
  })
  @ApiParam({ name: 'id', description: 'Tenant Business UUID' })
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusRequestDto,
    @CurrentUser() adminUser: AuthUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<TenantSummary> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.superAdminService.updateTenantStatus(
      id,
      dto,
      adminUser?.id,
      ip,
      userAgent,
    );
  }

  @Get('plans')
  @ApiOperation({
    summary: 'List All SaaS Subscription Plans',
    description:
      'Retrieves all subscription tier plans with limits, pricing, and active subscriber counts.',
  })
  async getPlans(): Promise<SaaSPlanDto[]> {
    return this.superAdminService.getPlans();
  }

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create New SaaS Subscription Plan',
    description:
      'Creates a new subscription plan tier with limits and financial pricing.',
  })
  async createPlan(
    @Body() dto: CreatePlanRequestDto,
    @CurrentUser() adminUser: AuthUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<SaaSPlanDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.superAdminService.createPlan(dto, adminUser?.id, ip, userAgent);
  }

  @Patch('plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Modify SaaS Subscription Plan',
    description: 'Updates plan pricing, limits, or feature modules.',
  })
  @ApiParam({ name: 'id', description: 'Plan UUID' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanRequestDto,
    @CurrentUser() adminUser: AuthUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<SaaSPlanDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.superAdminService.updatePlan(
      id,
      dto,
      adminUser?.id,
      ip,
      userAgent,
    );
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'List Paginated Platform Audit Logs',
    description:
      'Global immutable audit trail spanning all tenants and platform-level actions.',
  })
  async getAuditLogs(
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedResult<SystemAuditLogDto>> {
    return this.superAdminService.getAuditLogs(query);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Retrieve System-wide Platform Settings',
    description: 'Lists all global platform settings and system toggles.',
  })
  async getSettings(): Promise<PlatformSettingItemDto[]> {
    return this.superAdminService.getSettings();
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert System-wide Platform Setting',
    description: 'Updates or creates a global platform setting parameter.',
  })
  async updateSetting(
    @Body() dto: UpdatePlatformSettingRequestDto,
    @CurrentUser() adminUser: AuthUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<PlatformSettingItemDto> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.superAdminService.updateSetting(
      dto,
      adminUser?.id,
      ip,
      userAgent,
    );
  }
}
