import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  CustomerPaymentMethod,
  CustomerStatus,
  CustomerType,
} from '@pixelcraft/types';

export class CustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name, phone, email, or NIC' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Customer Type (WALK_IN, RETAIL_CREDIT, WHOLESALE)' })
  @IsOptional()
  @IsString()
  customerType?: CustomerType;

  @ApiPropertyOptional({ description: 'Filter by Status (ACTIVE, SUSPENDED)' })
  @IsOptional()
  @IsString()
  status?: CustomerStatus;

  @ApiPropertyOptional({ description: 'Filter only customers with outstanding debt' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasDebtOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer full name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Primary phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'National Identity Card (NIC) number' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nicNumber?: string;

  @ApiPropertyOptional({ description: 'Postal address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Customer category', default: 'WALK_IN' })
  @IsOptional()
  @IsString()
  customerType?: CustomerType = 'WALK_IN';

  @ApiPropertyOptional({ description: 'Approved credit limit (LKR)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number = 0;

  @ApiPropertyOptional({ description: 'Initial loyalty points', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loyaltyPoints?: number = 0;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer full name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Primary phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'NIC number' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nicNumber?: string;

  @ApiPropertyOptional({ description: 'Postal address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Customer category' })
  @IsOptional()
  @IsString()
  customerType?: CustomerType;

  @ApiPropertyOptional({ description: 'Credit limit (LKR)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Status (ACTIVE, SUSPENDED)' })
  @IsOptional()
  @IsString()
  status?: CustomerStatus;
}

export class RecordDebtSettlementDto {
  @ApiProperty({ description: 'Settlement payment amount (LKR)', example: 5000.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Payment method', enum: ['CASH', 'CARD', 'BANK_TRANSFER'], example: 'CASH' })
  @IsString()
  paymentMethod!: CustomerPaymentMethod;

  @ApiPropertyOptional({ description: 'Bank transfer or card transaction reference' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Payment remarks or receipt note' })
  @IsOptional()
  @IsString()
  notes?: string;
}
