import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type {
  CreatePlanDto,
  PlatformSettingDto,
  TenantStatus,
  UpdatePlanDto,
  UpdateTenantStatusDto,
} from '@pixelcraft/types';

export class UpdateTenantStatusRequestDto implements UpdateTenantStatusDto {
  @ApiProperty({
    description: 'Updated operational status for the tenant organization',
    enum: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'],
    example: 'SUSPENDED',
  })
  @IsEnum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'], {
    message: 'Status must be one of: TRIAL, ACTIVE, SUSPENDED, EXPIRED',
  })
  status!: TenantStatus;

  @ApiPropertyOptional({
    description: 'Administrative reason for status change (stored in audit logs)',
    example: 'Non-payment of monthly SaaS subscription invoice',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TenantListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search string matching business name or slug',
    example: 'alpha',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant status',
    enum: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'],
  })
  @IsOptional()
  @IsIn(['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'])
  status?: TenantStatus;
}

export class CreatePlanRequestDto implements CreatePlanDto {
  @ApiProperty({ example: 'STARTER', description: 'Unique uppercase plan code' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Starter Retail Plan' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'Suitable for single store boutiques' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 29.0 })
  @IsNumber()
  @Min(0)
  monthlyPrice!: number;

  @ApiProperty({ example: 290.0 })
  @IsNumber()
  @Min(0)
  annualPrice!: number;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  maxProducts!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  maxBranches!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  maxUsers!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  maxRegisters!: number;

  @ApiProperty({ example: ['pos', 'inventory'] })
  @IsArray()
  @IsString({ each: true })
  enabledModules!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdatePlanRequestDto implements UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRegisters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AuditLogQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by specific tenant UUID' })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filter by action code (e.g. LOGIN_SUCCESS, TENANT_STATUS_UPDATED)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity (e.g. AUTH, BUSINESS, PLAN)' })
  @IsOptional()
  @IsString()
  entity?: string;
}

export class UpdatePlatformSettingRequestDto implements PlatformSettingDto {
  @ApiProperty({ example: 'maintenance_mode' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: false })
  value!: unknown;

  @ApiPropertyOptional({ example: 'Controls system-wide maintenance blackout mode' })
  @IsOptional()
  @IsString()
  description?: string;
}

