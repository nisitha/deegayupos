import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  CheckSlugResult,
  OnboardingResponseData,
  PublicPlanDto,
} from '@pixelcraft/types';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  CheckSlugRequestDto,
  OnboardingRegisterRequestDto,
} from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Tenant Onboarding & Self-Service Registration')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Public()
  @Get('plans')
  @ApiOperation({
    summary: 'List Public SaaS Subscription Plans',
    description:
      'Returns all active subscription tiers with 14-day free trial limits, pricing, and features for onboarding selection.',
  })
  @ApiOkResponse({ description: 'Public plans retrieved successfully.' })
  async getPlans(): Promise<PublicPlanDto[]> {
    return this.onboardingService.getActivePlans();
  }

  @Public()
  @Post('check-slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check Subdomain / Tenant Slug Availability',
    description:
      'Validates whether a proposed tenant slug is available or already claimed by another business or reserved by platform.',
  })
  @ApiOkResponse({ description: 'Slug availability check completed.' })
  async checkSlug(@Body() dto: CheckSlugRequestDto): Promise<CheckSlugResult> {
    return this.onboardingService.checkSlug(dto.slug);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Self-Service Business Registration & Instant Provisioning',
    description:
      'Executes atomic multi-table tenant provisioning (user, business, branch, warehouse, register, role, 14-day trial) and returns instant authenticated session tokens.',
  })
  @ApiCreatedResponse({
    description: 'Tenant organization provisioned successfully with 14-day trial.',
  })
  @ApiConflictResponse({
    description: 'Slug or email already in use.',
  })
  async register(
    @Body() dto: OnboardingRegisterRequestDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<OnboardingResponseData> {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.onboardingService.register(dto, ip, userAgent);
  }
}
