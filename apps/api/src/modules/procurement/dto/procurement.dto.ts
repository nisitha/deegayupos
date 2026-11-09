import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { PurchaseOrderStatus, GrnStatus } from '@pixelcraft/types';

export class PurchaseOrderQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Branch UUID' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by Supplier UUID' })
  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by Status (DRAFT, SUBMITTED, PARTIALLY_RECEIVED, COMPLETED, CANCELLED)' })
  @IsOptional()
  @IsString()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Search term for PO number or supplier name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Ordered quantity', example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  orderedQuantity!: number;

  @ApiProperty({ description: 'Agreed unit cost (LKR)', example: 450.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Target Branch UUID' })
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID('4')
  supplierId!: string;

  @ApiPropertyOptional({ description: 'Order date ISO string' })
  @IsOptional()
  @IsString()
  orderDate?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date ISO string' })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Procurement order notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Purchase Order line items', type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}

export class CreateGrnItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ description: 'Received physical quantity', example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  receivedQuantity!: number;

  @ApiProperty({ description: 'Actual invoice unit cost (LKR)', example: 450.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({ description: 'Batch number / Lot code' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Expiry date ISO string' })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class CreateGrnDto {
  @ApiProperty({ description: 'Receiving Branch UUID' })
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ description: 'Receiving Warehouse UUID' })
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({ description: 'Supplier UUID' })
  @IsUUID('4')
  supplierId!: string;

  @ApiPropertyOptional({ description: 'Linked Purchase Order UUID' })
  @IsOptional()
  @IsUUID('4')
  purchaseOrderId?: string;

  @ApiPropertyOptional({ description: 'Supplier Invoice / Delivery Order number' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierInvoiceNo?: string;

  @ApiPropertyOptional({ description: 'Physical receiving date ISO string' })
  @IsOptional()
  @IsString()
  receivedDate?: string;

  @ApiPropertyOptional({ description: 'Receiving inspection notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'GRN received line items', type: [CreateGrnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrnItemDto)
  items!: CreateGrnItemDto[];
}

export class GrnQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Branch UUID' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by Warehouse UUID' })
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by Supplier UUID' })
  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by Purchase Order UUID' })
  @IsOptional()
  @IsUUID('4')
  purchaseOrderId?: string;

  @ApiPropertyOptional({ description: 'Filter by Status (RECEIVED / VERIFIED)' })
  @IsOptional()
  @IsString()
  status?: GrnStatus;

  @ApiPropertyOptional({ description: 'Search term for GRN number, invoice number, or supplier' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
