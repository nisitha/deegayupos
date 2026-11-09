import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class DashboardMetricsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter metrics strictly to a specific retail branch ID',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsOptional()
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  branchId?: string;
}

export class DashboardChartsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of past days to generate timeline data points for (1-90)',
    default: 7,
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 7;

  @ApiPropertyOptional({
    description: 'Filter chart statistics to a specific branch ID',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsOptional()
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  branchId?: string;
}

export class DashboardActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of recent events to return (1-100)',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter events by specific branch ID',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @IsOptional()
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  branchId?: string;
}

export class DashboardMetricsDto {
  @ApiProperty({ example: 125000.5, description: "Total gross sales for today in organization's currency" })
  todaySales!: number;

  @ApiProperty({ example: 110000.0, description: "Total gross sales for yesterday" })
  yesterdaySales!: number;

  @ApiProperty({ example: 13.6, description: 'Day-over-day percentage sales growth' })
  salesGrowthPercent!: number;

  @ApiProperty({ example: 42, description: "Count of completed sales transactions today" })
  transactionCount!: number;

  @ApiProperty({ example: 2976.2, description: 'Average ticket / transaction value' })
  avgTransactionValue!: number;

  @ApiProperty({ example: 3, description: 'Number of product variants currently below their minimum safety stock threshold' })
  lowStockCount!: number;

  @ApiProperty({ example: 2, description: 'Number of operational cash registers' })
  activeRegistersCount!: number;
}

export class DailySalesTimelinePointDto {
  @ApiProperty({ example: '2026-11-08' })
  date!: string;

  @ApiProperty({ example: 45000.0 })
  revenue!: number;

  @ApiProperty({ example: 18 })
  orders!: number;
}

export class PaymentMethodDistributionDto {
  @ApiProperty({ example: 'CASH' })
  method!: string;

  @ApiProperty({ example: 75000.0 })
  total!: number;

  @ApiProperty({ example: 25 })
  count!: number;
}

export class DashboardChartsDto {
  @ApiProperty({ type: [DailySalesTimelinePointDto] })
  timeline!: DailySalesTimelinePointDto[];

  @ApiProperty({ type: [PaymentMethodDistributionDto] })
  paymentMix!: PaymentMethodDistributionDto[];
}

export class DashboardActivityUserDto {
  @ApiProperty({ example: 'Kasun Perera' })
  fullName!: string;

  @ApiProperty({ example: 'kasun@pixelcraftlk.com' })
  email!: string;
}

export class DashboardActivityItemDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id!: string;

  @ApiProperty({ example: 'BUSINESS_ONBOARDED' })
  action!: string;

  @ApiProperty({ example: 'Business' })
  entity!: string;

  @ApiPropertyOptional({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  entityId?: string | null;

  @ApiPropertyOptional({ example: 'Organization onboarded successfully' })
  description?: string | null;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ type: DashboardActivityUserDto })
  user?: DashboardActivityUserDto | null;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown> | null;
}
