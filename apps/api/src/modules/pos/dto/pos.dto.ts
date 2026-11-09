import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  OrderType,
  SalePaymentMethod,
} from '@pixelcraft/types';

export class CheckoutItemDto {
  @ApiPropertyOptional({ example: 'b5113d74-c5a9-46e3-8260-22cba2b52b34' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: '8cf13531-4131-40ef-afcb-38c531061f1c' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 'Ceylon Earl Grey Tea 100g' })
  @IsString()
  productName!: string;

  @ApiProperty({ example: 'TEA-EG-100' })
  @IsString()
  sku!: string;

  @ApiProperty({ example: 450.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ example: 0.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 36.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiProperty({ example: 900.0 })
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiPropertyOptional({ example: 'Less sugar, hot water separate' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckoutPaymentDto {
  @ApiProperty({
    enum: ['CASH', 'CARD', 'QR_PAYMENT', 'BANK_TRANSFER', 'STORE_CREDIT', 'CUSTOMER_CREDIT'],
    example: 'CASH',
  })
  @IsEnum(['CASH', 'CARD', 'QR_PAYMENT', 'BANK_TRANSFER', 'STORE_CREDIT', 'CUSTOMER_CREDIT'])
  paymentMethod!: SalePaymentMethod;

  @ApiProperty({ example: 1000.0 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'TXN-984218' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CheckoutRequestDto {
  @ApiProperty({ example: 'b5113d74-c5a9-46e3-8260-22cba2b52b34' })
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({ example: '8cf13531-4131-40ef-afcb-38c531061f1c' })
  @IsOptional()
  @IsUUID()
  registerId?: string;

  @ApiPropertyOptional({ example: 'a1113d74-c5a9-46e3-8260-22cba2b52b34' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    enum: ['RETAIL_WALKIN', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'],
    default: 'RETAIL_WALKIN',
  })
  @IsOptional()
  @IsEnum(['RETAIL_WALKIN', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'])
  orderType?: OrderType;

  @ApiPropertyOptional({ example: 'T-10' })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty({ type: [CheckoutPaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments!: CheckoutPaymentDto[];

  @ApiProperty({ example: 900.0 })
  @IsNumber()
  @Min(0)
  subtotal!: number;

  @ApiPropertyOptional({ example: 0.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 72.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiProperty({ example: 972.0 })
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({ example: 1000.0 })
  @IsNumber()
  @Min(0)
  paidAmount!: number;

  @ApiPropertyOptional({ example: 28.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeDue?: number;

  @ApiPropertyOptional({ example: 'idemp-pos-checkout-001' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: 'Customer requested printed receipt' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class HoldCartRequestDto {
  @ApiProperty({ example: 'b5113d74-c5a9-46e3-8260-22cba2b52b34' })
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({ example: '8cf13531-4131-40ef-afcb-38c531061f1c' })
  @IsOptional()
  @IsUUID()
  registerId?: string;

  @ApiProperty({ example: 'Table T-12 (Party of 4)' })
  @IsString()
  cartReference!: string;

  @ApiProperty({
    example: {
      orderType: 'DINE_IN',
      tableNumber: 'T-12',
      items: [],
      discountAmount: 0,
    },
  })
  cartData!: Record<string, unknown>;
}

export class VoidSaleRequestDto {
  @ApiProperty({ example: 'Customer changed mind before leaving counter' })
  @IsString()
  reason!: string;
}
