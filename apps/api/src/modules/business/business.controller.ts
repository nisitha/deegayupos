import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Req,
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
  BusinessProfileData,
  BusinessSettingsData,
} from '@pixelcraft/types';
import type { Request } from 'express';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { BusinessService } from './business.service';
import {
  BusinessProfileDto,
  BusinessSettingsDto,
  UpdateBusinessSettingsDto,
} from './dto/business.dto';

@ApiTags('Business Profile & Settings')
@Controller('business')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  required: false,
  description: 'Optional organization tenant UUID to switch active session scope',
})
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Retrieve Business Organization Profile, Branches & Settings',
    description:
      'Fetches the active tenant organization metadata, all active retail branches, and operational settings.',
  })
  @ApiOkResponse({
    description: 'Business profile retrieved successfully.',
    type: BusinessProfileDto,
  })
  async getProfile(
    @CurrentTenant() tenant: AuthTenant,
  ): Promise<BusinessProfileData> {
    return this.businessService.getProfile(tenant.id);
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermissions('settings:manage')
  @ApiOperation({
    summary: 'Update Tenant Configuration & Operational Settings',
    description:
      'Updates invoice prefix, default tax rate, negative stock policy, and receipt footer. Requires settings:manage permission.',
  })
  @ApiOkResponse({
    description: 'Business settings updated successfully.',
    type: BusinessSettingsDto,
  })
  async updateSettings(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBusinessSettingsDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<BusinessSettingsData> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.businessService.updateSettings(
      tenant.id,
      user.id,
      dto,
      ip,
      userAgent,
    );
  }
}

