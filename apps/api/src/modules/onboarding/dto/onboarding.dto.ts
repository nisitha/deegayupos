import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { CheckSlugDto, OnboardingPayload } from '@pixelcraft/types';

export class CheckSlugRequestDto implements CheckSlugDto {
  @ApiProperty({
    description: 'Proposed tenant business subdomain/slug identifier',
    example: 'myretail',
  })
  @IsString()
  @MinLength(2, { message: 'Slug must be at least 2 characters' })
  @MaxLength(64, { message: 'Slug cannot exceed 64 characters' })
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Slug must contain lowercase alphanumeric characters, hyphens, or underscores only',
  })
  slug!: string;
}

export class OnboardingRegisterRequestDto implements OnboardingPayload {
  // 1. User Credentials
  @ApiProperty({ example: 'Sahan Jayawardena', description: 'Account owner full name' })
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  fullName!: string;

  @ApiProperty({ example: 'sahan@myretail.lk', description: 'Primary administrator email' })
  @IsEmail({}, { message: 'Must provide a valid email address' })
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8, description: 'Secure account password' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '+94 77 123 4567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  // 2. Business Details
  @ApiProperty({ example: 'MyRetail Boutique', description: 'Official business organization name' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  businessName!: string;

  @ApiProperty({ example: 'myretail', description: 'Unique multi-tenant organization slug' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Slug must be alphanumeric with hyphens or underscores only',
  })
  businessSlug!: string;

  @ApiPropertyOptional({ example: 'MyRetail PVT LTD' })
  @IsOptional()
  @IsString()
  legalName?: string | null;

  @ApiPropertyOptional({ example: 'RETAIL', default: 'RETAIL' })
  @IsOptional()
  @IsString()
  businessType?: string = 'RETAIL';

  @ApiPropertyOptional({ example: 'LKR', default: 'LKR' })
  @IsOptional()
  @IsString()
  currency?: string = 'LKR';

  @ApiPropertyOptional({ example: 'Asia/Colombo', default: 'Asia/Colombo' })
  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Colombo';

  // 3. Primary Location Setup
  @ApiPropertyOptional({ example: 'Colombo Flagship', default: 'Main Branch' })
  @IsOptional()
  @IsString()
  branchName?: string = 'Main Branch';

  @ApiPropertyOptional({ example: '120 Galle Road, Colombo 03' })
  @IsOptional()
  @IsString()
  branchAddress?: string | null;

  @ApiPropertyOptional({ example: '+94 11 234 5678' })
  @IsOptional()
  @IsString()
  branchPhone?: string | null;

  @ApiPropertyOptional({ example: 'Central Warehouse', default: 'Central Warehouse' })
  @IsOptional()
  @IsString()
  warehouseName?: string = 'Central Warehouse';

  @ApiPropertyOptional({ example: 'Counter 01', default: 'POS Counter 1' })
  @IsOptional()
  @IsString()
  registerName?: string = 'POS Counter 1';

  // 4. Plan Selection
  @ApiProperty({ example: 'PROFESSIONAL', description: 'Selected SaaS plan code' })
  @IsString()
  @IsNotEmpty({ message: 'Must select a SaaS subscription plan' })
  planCode!: string;
}

