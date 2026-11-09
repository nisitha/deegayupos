import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  ProductType,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateBrandPayload,
  UpdateBrandPayload,
  CreateUnitPayload,
  UpdateUnitPayload,
  CreateProductVariantPayload,
  CreateProductPayload,
  UpdateProductPayload,
} from '@pixelcraft/types';

// ==========================================
// CATEGORY DTOs
// ==========================================

export class CreateCategoryDto implements CreateCategoryPayload {
  @ApiProperty({ example: 'Electronics' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'electronics' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'Consumer electronic devices and accessories' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '11111111-1111-1111-1111-111111111111' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;
}

export class UpdateCategoryDto implements UpdateCategoryPayload {
  @ApiPropertyOptional({ example: 'Consumer Electronics' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'consumer-electronics' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;
}

export class CategoryResponseDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  tenantId!: string;

  @ApiProperty({ example: 'Electronics' })
  name!: string;

  @ApiProperty({ example: 'electronics' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Electronic gadgets' })
  description?: string | null;

  @ApiPropertyOptional()
  parentId?: string | null;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: 42 })
  productCount?: number;
}

// ==========================================
// BRAND DTOs
// ==========================================

export class CreateBrandDto implements CreateBrandPayload {
  @ApiProperty({ example: 'Sony' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'sony' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;
}

export class UpdateBrandDto implements UpdateBrandPayload {
  @ApiPropertyOptional({ example: 'Sony Corporation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'sony-corp' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;
}

export class BrandResponseDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  tenantId!: string;

  @ApiProperty({ example: 'Sony' })
  name!: string;

  @ApiProperty({ example: 'sony' })
  slug!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt!: string;
}

// ==========================================
// UNIT DTOs
// ==========================================

export class CreateUnitDto implements CreateUnitPayload {
  @ApiProperty({ example: 'Pieces' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  name!: string;

  @ApiProperty({ example: 'pcs' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  shortCode!: string;
}

export class UpdateUnitDto implements UpdateUnitPayload {
  @ApiPropertyOptional({ example: 'Kilograms' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  shortCode?: string;
}

export class UnitResponseDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  tenantId!: string;

  @ApiProperty({ example: 'Pieces' })
  name!: string;

  @ApiProperty({ example: 'pcs' })
  shortCode!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt!: string;
}

// ==========================================
// PRODUCT & VARIANT DTOs
// ==========================================

export class CreateProductVariantDto implements CreateProductVariantPayload {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ example: 'Sony WH-1000XM5 - Black' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'SNY-XM5-BLK' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sku?: string;

  @ApiPropertyOptional({ example: '711719543210' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  barcode?: string | null;

  @ApiPropertyOptional({ example: 75000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number | null;

  @ApiPropertyOptional({ example: 95000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailPrice?: number | null;

  @ApiPropertyOptional({ example: { color: 'Black' } })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;
}

export class ProductVariantResponseDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  productId!: string;

  @ApiProperty({ example: 'Sony WH-1000XM5 - Black' })
  name!: string;

  @ApiProperty({ example: 'SNY-XM5-BLK' })
  sku!: string;

  @ApiPropertyOptional({ example: '711719543210' })
  barcode?: string | null;

  @ApiPropertyOptional({ example: 75000.0 })
  costPrice?: number | null;

  @ApiPropertyOptional({ example: 95000.0 })
  retailPrice?: number | null;

  @ApiProperty({ example: { color: 'Black' } })
  attributes!: Record<string, string>;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt!: string;
}

export class CreateProductDto implements CreateProductPayload {
  @ApiProperty({ example: 'Sony Wireless Headphones' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'sony-wireless-headphones' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 'SNY-WH-001' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sku?: string;

  @ApiPropertyOptional({ example: '4548736132580' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  barcode?: string | null;

  @ApiPropertyOptional({ example: 'Industry-leading noise canceling headphones' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: ['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'], default: 'STANDARD' })
  @IsOptional()
  @IsEnum(['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'])
  type?: ProductType = 'STANDARD';

  @ApiPropertyOptional({ example: '11111111-1111-1111-1111-111111111111' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @ApiPropertyOptional({ example: '22222222-2222-2222-2222-222222222222' })
  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @ApiPropertyOptional({ example: '33333333-3333-3333-3333-333333333333' })
  @IsOptional()
  @IsUUID('4')
  unitId?: string | null;

  @ApiPropertyOptional({ example: 80000.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number = 0.0;

  @ApiProperty({ example: 99000.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailPrice!: number;

  @ApiPropertyOptional({ example: 92000.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesalePrice?: number | null;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  alertQuantity?: number = 5;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isTrackStock?: boolean = true;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ type: [CreateProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}

export class UpdateProductDto implements UpdateProductPayload {
  @ApiPropertyOptional({ example: 'Sony Wireless Headphones Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: ['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'] })
  @IsOptional()
  @IsEnum(['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'])
  type?: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  unitId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesalePrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  alertQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTrackStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [CreateProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}

export class ProductResponseDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  tenantId!: string;

  @ApiProperty({ example: 'Sony Wireless Headphones' })
  name!: string;

  @ApiProperty({ example: 'sony-wireless-headphones' })
  slug!: string;

  @ApiProperty({ example: 'SNY-WH-001' })
  sku!: string;

  @ApiPropertyOptional({ example: '4548736132580' })
  barcode?: string | null;

  @ApiPropertyOptional({ example: 'Noise canceling headphones' })
  description?: string | null;

  @ApiProperty({ enum: ['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'], example: 'STANDARD' })
  type!: ProductType;

  @ApiProperty({ example: 80000.0 })
  costPrice!: number;

  @ApiProperty({ example: 99000.0 })
  retailPrice!: number;

  @ApiPropertyOptional({ example: 92000.0 })
  wholesalePrice?: number | null;

  @ApiProperty({ example: 5 })
  alertQuantity!: number;

  @ApiProperty({ example: true })
  isTrackStock!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: CategoryResponseDto })
  category?: CategoryResponseDto | null;

  @ApiPropertyOptional({ type: BrandResponseDto })
  brand?: BrandResponseDto | null;

  @ApiPropertyOptional({ type: UnitResponseDto })
  unit?: UnitResponseDto | null;

  @ApiPropertyOptional({ type: [ProductVariantResponseDto] })
  variants?: ProductVariantResponseDto[];
}

export class ProductQueryDto {
  @ApiPropertyOptional({ default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search query matching product name, SKU, or barcode' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category UUID' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by brand UUID' })
  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @ApiPropertyOptional({ enum: ['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'] })
  @IsOptional()
  @IsEnum(['STANDARD', 'VARIABLE', 'SERVICE', 'BUNDLE'])
  type?: ProductType;

  @ApiPropertyOptional({ description: 'Filter active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class ProductLookupQueryDto {
  @ApiPropertyOptional({ description: 'EAN/UPC/Code128 barcode scanned', example: '4548736132580' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'Internal SKU code', example: 'SNY-WH-001' })
  @IsOptional()
  @IsString()
  sku?: string;
}

export class ProductLookupResultDto {
  @ApiProperty({ type: ProductResponseDto })
  product!: ProductResponseDto;

  @ApiPropertyOptional({ type: ProductVariantResponseDto })
  matchedVariant?: ProductVariantResponseDto | null;
}

export class BulkImportProductDto {
  @ApiProperty({ type: [CreateProductDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  products!: CreateProductDto[];
}

export class BulkImportResultDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 98 })
  inserted!: number;

  @ApiProperty({
    example: [{ index: 14, sku: 'DUP-001', error: 'Duplicate SKU for organization' }],
  })
  errors!: Array<{ index: number; sku?: string; name?: string; error: string }>;
}

