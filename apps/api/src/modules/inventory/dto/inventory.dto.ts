import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  CreateStockAdjustmentDto as ICreateStockAdjustmentDto,
  CreateStockAdjustmentItemDto as ICreateStockAdjustmentItemDto,
  CreateStockTransferDto as ICreateStockTransferDto,
  CreateStockTransferItemDto as ICreateStockTransferItemDto,
  StockAdjustmentReason,
  StockMovementType,
} from '@pixelcraft/types';

export class StockLevelQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Branch UUID' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by Warehouse UUID' })
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by Category UUID' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Search term for product name, SKU, or barcode' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Show only low or out of stock items' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  lowStockOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class CreateStockAdjustmentItemDto implements ICreateStockAdjustmentItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiPropertyOptional({ description: 'Product Variant UUID' })
  @IsOptional()
  @IsUUID('4')
  variantId?: string | null;

  @ApiProperty({ description: 'Actual counted quantity on hand' })
  @IsNumber()
  @Min(0)
  countedQuantity!: number;
}

export class CreateStockAdjustmentDto implements ICreateStockAdjustmentDto {
  @ApiProperty({ description: 'Warehouse UUID' })
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({
    description: 'Reason for adjustment',
    enum: ['PHYSICAL_COUNT', 'DAMAGED', 'EXPIRED', 'LOST_STOLEN', 'CORRECTION'],
  })
  @IsEnum(['PHYSICAL_COUNT', 'DAMAGED', 'EXPIRED', 'LOST_STOLEN', 'CORRECTION'])
  reason!: StockAdjustmentReason;

  @ApiPropertyOptional({ description: 'Audit notes for this adjustment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    type: [CreateStockAdjustmentItemDto],
    description: 'List of items being adjusted',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockAdjustmentItemDto)
  items!: CreateStockAdjustmentItemDto[];
}

export class CreateStockTransferItemDto implements ICreateStockTransferItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiPropertyOptional({ description: 'Product Variant UUID' })
  @IsOptional()
  @IsUUID('4')
  variantId?: string | null;

  @ApiProperty({ description: 'Quantity to transfer' })
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateStockTransferDto implements ICreateStockTransferDto {
  @ApiProperty({ description: 'Source Warehouse UUID' })
  @IsUUID('4')
  sourceWarehouseId!: string;

  @ApiProperty({ description: 'Destination Warehouse UUID' })
  @IsUUID('4')
  targetWarehouseId!: string;

  @ApiPropertyOptional({ description: 'Transfer notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    type: [CreateStockTransferItemDto],
    description: 'Transfer line items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferItemDto)
  items!: CreateStockTransferItemDto[];
}

export class StockMovementQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Warehouse UUID' })
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by Product UUID' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter by Movement Type',
    enum: [
      'SALE',
      'PURCHASE_RECEIPT',
      'TRANSFER_DISPATCH',
      'TRANSFER_RECEIPT',
      'ADJUSTMENT_ADD',
      'ADJUSTMENT_SUB',
      'RETURN_RESTOCK',
      'DAMAGE_LOSS',
    ],
  })
  @IsOptional()
  @IsEnum([
    'SALE',
    'PURCHASE_RECEIPT',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIPT',
    'ADJUSTMENT_ADD',
    'ADJUSTMENT_SUB',
    'RETURN_RESTOCK',
    'DAMAGE_LOSS',
  ])
  movementType?: StockMovementType;

  @ApiPropertyOptional({ description: 'Search term for notes or reference ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

