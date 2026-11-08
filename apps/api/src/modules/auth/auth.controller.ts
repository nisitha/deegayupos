import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  AuthMeData,
  AuthResponseData,
  AuthTenant,
  AuthUser,
  RefreshTokenResponseData,
} from '@pixelcraft/types';
import type { Request } from 'express';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { AuthService } from './auth.service';
import {
  AuthMeDataDto,
  AuthResponseDataDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  RefreshTokenResponseDataDto,
  SwitchTenantRequestDto,
} from './dto/auth.dto';

@ApiTags('Authentication & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate User & Issue Session Tokens',
    description:
      'Validates credentials, resolves active organization tenant membership and RBAC permissions, and returns access and refresh JWTs.',
  })
  @ApiOkResponse({
    description: 'User successfully authenticated.',
    type: AuthResponseDataDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account.',
  })
  async login(
    @Body() dto: LoginRequestDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResponseData> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate Access Token via Refresh Token',
    description:
      'Accepts an unexpired refresh token and returns a fresh access token / refresh token pair.',
  })
  @ApiOkResponse({
    description: 'Tokens successfully refreshed.',
    type: RefreshTokenResponseDataDto,
  })
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<RefreshTokenResponseData> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description: 'Optional organization tenant UUID to switch active session scope',
  })
  @ApiOperation({
    summary: 'Current Authenticated User Profile & Active Tenant',
    description:
      'Returns the current user profile, all active tenant memberships, current active tenant, and granted permissions.',
  })
  @ApiOkResponse({
    description: 'Session introspection retrieved successfully.',
    type: AuthMeDataDto,
  })
  async getMe(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: AuthTenant,
  ): Promise<AuthMeData> {
    return this.authService.getMe(user.id, tenant?.id);
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Switch Active Tenant Organization Context',
    description:
      'Switches the active business tenant scope for the user, re-evaluates permissions, and issues new tokens.',
  })
  @ApiOkResponse({
    description: 'Active tenant switched successfully.',
    type: AuthResponseDataDto,
  })
  async switchTenant(
    @CurrentUser() user: AuthUser,
    @Body() dto: SwitchTenantRequestDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResponseData> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.authService.switchTenant(user.id, dto.tenantId, ip, userAgent);
  }

  @Get('test-protected')
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermissions('settings:manage')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'RBAC Verification Test Endpoint (Requires settings:manage)',
    description:
      'Protected endpoint used to verify tenant context and granular RBAC permission enforcement.',
  })
  async testProtectedEndpoint(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: AuthTenant,
  ) {
    return {
      success: true,
      message: 'Access granted to settings management resource.',
      user: user.email,
      tenant: tenant.slug,
    };
  }
}

