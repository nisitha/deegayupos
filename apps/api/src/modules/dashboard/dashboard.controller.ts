import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  DashboardActivityItem,
  DashboardChartsData,
  DashboardMetrics,
} from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { DashboardService } from './dashboard.service';
import {
  DashboardActivityItemDto,
  DashboardActivityQueryDto,
  DashboardChartsDto,
  DashboardChartsQueryDto,
  DashboardMetricsDto,
  DashboardMetricsQueryDto,
} from './dto/dashboard.dto';

@ApiTags('Tenant Dashboard & Telemetry')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  required: false,
  description: 'Optional organization tenant UUID to switch active session scope',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Retrieve High-Level Dashboard Telemetry & KPI Metrics',
    description:
      'Aggregates live sales figures, ticket averages, active registers, and stock warnings. Supports optional branch scoping.',
  })
  @ApiOkResponse({
    description: 'Dashboard KPI metrics retrieved successfully.',
    type: DashboardMetricsDto,
  })
  async getMetrics(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardMetricsQueryDto,
  ): Promise<DashboardMetrics> {
    return this.dashboardService.getMetrics(tenant.id, user, query.branchId);
  }

  @Get('charts')
  @ApiOperation({
    summary: 'Retrieve Sales Timeline & Payment Breakdown Visualizations',
    description:
      'Returns time-series revenue and volume data points along with payment method distribution.',
  })
  @ApiOkResponse({
    description: 'Chart analytics data retrieved successfully.',
    type: DashboardChartsDto,
  })
  async getCharts(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardChartsQueryDto,
  ): Promise<DashboardChartsData> {
    return this.dashboardService.getCharts(
      tenant.id,
      user,
      query.days,
      query.branchId,
    );
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Retrieve Recent Chronological Tenant Activity Feed',
    description:
      'Fetches recent business events and operational audit trails for the tenant dashboard.',
  })
  @ApiOkResponse({
    description: 'Recent activity feed retrieved successfully.',
    type: [DashboardActivityItemDto],
  })
  async getActivity(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardActivityQueryDto,
  ): Promise<DashboardActivityItem[]> {
    return this.dashboardService.getActivity(
      tenant.id,
      user,
      query.limit,
      query.branchId,
    );
  }
}

