import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StaffRole } from '@pixelcraft/types';

export class CreateStaffUserDto {
  @ApiProperty({ description: 'Full name of the staff member', example: 'Kamal Perera' })
  @IsString()
  fullName!: string;

  @ApiProperty({ description: 'Email address of the staff member', example: 'kamal@deegayu.pixelcraftlk.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Initial login password', example: 'Password123!' })
  @IsOptional()
  @IsString()
  @Length(6, 100)
  password?: string;

  @ApiPropertyOptional({ description: '4-digit quick terminal PIN', example: '1234' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pinCode?: string;

  @ApiProperty({ enum: ['OWNER', 'MANAGER', 'CASHIER'], default: 'CASHIER' })
  @IsEnum(['OWNER', 'MANAGER', 'CASHIER'])
  role!: StaffRole;

  @ApiPropertyOptional({ description: 'Branch ID assignment' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Contact phone number', example: '+94 77 123 4567' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateStaffUserDto {
  @ApiPropertyOptional({ description: 'Full name of the staff member' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Email address of the staff member' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Updated password' })
  @IsOptional()
  @IsString()
  @Length(6, 100)
  password?: string;

  @ApiPropertyOptional({ description: 'Updated 4-digit PIN' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pinCode?: string;

  @ApiPropertyOptional({ enum: ['OWNER', 'MANAGER', 'CASHIER'] })
  @IsOptional()
  @IsEnum(['OWNER', 'MANAGER', 'CASHIER'])
  role?: StaffRole;

  @ApiPropertyOptional({ description: 'Branch ID assignment' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Active account status' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class VerifyPinDto {
  @ApiProperty({ description: '4-digit quick terminal PIN', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pinCode!: string;
}
