import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  AuthMeData,
  AuthResponseData,
  AuthTenant,
  AuthUser,
  LoginDto,
  RefreshTokenDto,
  RefreshTokenResponseData,
  SwitchTenantDto,
} from '@pixelcraft/types';

export class LoginRequestDto implements LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'owner.alpha@pixelcraftlk.com',
  })
  @IsEmail({}, { message: 'Must provide a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Account password',
    example: 'SuperSecret123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  password!: string;

  @ApiPropertyOptional({
    description: 'Target tenant organization slug (optional)',
    example: 'alpha',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class RefreshTokenRequestDto implements RefreshTokenDto {
  @ApiProperty({
    description: 'Cryptographically signed JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;
}

export class SwitchTenantRequestDto implements SwitchTenantDto {
  @ApiProperty({
    description: 'Target tenant organization UUID',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsUUID('4', { message: 'Must provide a valid UUID tenant ID' })
  tenantId!: string;
}

export class AuthUserDto implements AuthUser {
  @ApiProperty({ example: '99999999-9999-9999-9999-999999999999' })
  id!: string;

  @ApiProperty({ example: 'owner.alpha@pixelcraftlk.com' })
  email!: string;

  @ApiProperty({ example: 'Kasun Perera' })
  fullName!: string;

  @ApiPropertyOptional({ example: '+94 77 123 4567', nullable: true })
  phone?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AuthTenantDto implements AuthTenant {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'PixelCraft LK Flagship Store' })
  name!: string;

  @ApiProperty({ example: 'alpha' })
  slug!: string;

  @ApiProperty({ example: 'OWNER' })
  role!: string;

  @ApiProperty({ example: '33333333-3333-3333-3333-333333333333' })
  roleId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ example: '44444444-4444-4444-4444-444444444444', nullable: true })
  isPrimaryBranchId?: string | null;
}

export class AuthResponseDataDto implements AuthResponseData {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiPropertyOptional({ type: AuthTenantDto, nullable: true })
  activeTenant?: AuthTenantDto | null;

  @ApiProperty({
    type: [String],
    example: ['pos:access', 'pos:checkout', 'inventory:view', 'settings:manage'],
  })
  permissions!: string[];
}

export class RefreshTokenResponseDataDto implements RefreshTokenResponseData {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}

export class AuthMeDataDto implements AuthMeData {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: [AuthTenantDto] })
  memberships!: AuthTenantDto[];

  @ApiPropertyOptional({ type: AuthTenantDto, nullable: true })
  activeTenant?: AuthTenantDto | null;

  @ApiProperty({
    type: [String],
    example: ['pos:access', 'pos:checkout', 'settings:manage'],
  })
  permissions!: string[];
}

