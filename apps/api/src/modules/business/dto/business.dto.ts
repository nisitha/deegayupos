import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdateBusinessSettingsDto {
  @ApiPropertyOptional({
    description: 'Invoice numbering prefix (e.g., INV-, RET-)',
    example: 'INV-',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  invoicePrefix?: string;

  @ApiPropertyOptional({
    description: 'Corporate VAT / Tax registration identifier',
    example: 'VAT-987654321',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Standard percentage sales tax rate (0.00 to 100.00)',
    example: 8.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Whether product retail prices are inclusive of tax',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether loyalty points reward engine is enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  enableLoyalty?: boolean;

  @ApiPropertyOptional({
    description: 'Custom notes printed at the footer of receipts',
    example: 'Thank you for shopping with PixelCraft Retail!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  receiptFooter?: string | null;

  @ApiPropertyOptional({
    description: 'Preferred thermal receipt paper size',
    enum: ['MM_58', 'MM_80', 'A4'],
    example: 'MM_80',
  })
  @IsOptional()
  @IsEnum(['MM_58', 'MM_80', 'A4'])
  receiptPaperSize?: 'MM_58' | 'MM_80' | 'A4';

  @ApiPropertyOptional({
    description: 'Whether business logo is rendered on thermal receipts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showLogoOnReceipt?: boolean;

  @ApiPropertyOptional({
    description: 'Whether tax / VAT details are rendered on receipts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showTaxDetails?: boolean;

  @ApiPropertyOptional({
    description: 'Whether Code128 barcode is rendered on receipts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showBarcodeOnReceipt?: boolean;

  @ApiPropertyOptional({
    description: 'Custom message/address header rendered atop receipts',
    example: 'Welcome to Colombo Flagship Store',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  receiptHeader?: string | null;

  @ApiPropertyOptional({
    description: 'Detailed return and exchange policy note',
    example: 'Goods once sold can be exchanged within 7 days in original condition.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnPolicyText?: string | null;

  @ApiPropertyOptional({
    description: 'Policy when attempting to sell out-of-stock items (DISALLOW, ALLOW, WARN)',
    enum: ['DISALLOW', 'ALLOW', 'WARN'],
    example: 'DISALLOW',
  })
  @IsOptional()
  @IsEnum(['DISALLOW', 'ALLOW', 'WARN'])
  negativeStockPolicy?: string;
}

export class UpdateReceiptSettingsDto {
  @ApiPropertyOptional({
    description: 'Preferred thermal receipt paper size',
    enum: ['MM_58', 'MM_80', 'A4'],
    example: 'MM_80',
  })
  @IsOptional()
  @IsEnum(['MM_58', 'MM_80', 'A4'])
  receiptPaperSize?: 'MM_58' | 'MM_80' | 'A4';

  @ApiPropertyOptional({
    description: 'Whether business logo is rendered on thermal receipts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showLogoOnReceipt?: boolean;

  @ApiPropertyOptional({
    description: 'Whether tax / VAT details are rendered on receipts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showTaxDetails?: boolean;

  @ApiPropertyOptional({
    description: 'Whether Code128 barcode is rendered on receipts',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  showBarcodeOnReceipt?: boolean;

  @ApiPropertyOptional({
    description: 'Custom message/address header rendered atop receipts',
    example: 'Welcome to Colombo Flagship Store',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  receiptHeader?: string | null;

  @ApiPropertyOptional({
    description: 'Custom greeting/terms printed at the footer of receipts',
    example: 'Thank you for shopping with us! Exchange within 7 days with bill.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  receiptFooter?: string | null;

  @ApiPropertyOptional({
    description: 'Detailed return and exchange policy note',
    example: 'Goods once sold can be exchanged within 7 days in original condition.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnPolicyText?: string | null;
}

export class BusinessProfileBranchDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'MAIN-01' })
  code!: string;

  @ApiProperty({ example: 'Main Flagship Branch' })
  name!: string;

  @ApiPropertyOptional({ example: '123 Galle Road, Colombo 03' })
  address?: string | null;

  @ApiPropertyOptional({ example: '+94 11 234 5678' })
  phone?: string | null;

  @ApiProperty({ example: true })
  isPrimary!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class BusinessSettingsDto {
  @ApiProperty({ example: '22222222-2222-2222-2222-222222222222' })
  id!: string;

  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  tenantId!: string;

  @ApiProperty({ example: 'INV-' })
  invoicePrefix!: string;

  @ApiPropertyOptional({ example: 'VAT-987654321' })
  taxNumber?: string | null;

  @ApiProperty({ example: 8.0 })
  taxRate!: number;

  @ApiProperty({ example: false })
  isTaxInclusive!: boolean;

  @ApiProperty({ example: false })
  enableLoyalty!: boolean;

  @ApiProperty({ example: 'MM_80', enum: ['MM_58', 'MM_80', 'A4'] })
  receiptPaperSize!: 'MM_58' | 'MM_80' | 'A4';

  @ApiProperty({ example: true })
  showLogoOnReceipt!: boolean;

  @ApiProperty({ example: true })
  showTaxDetails!: boolean;

  @ApiProperty({ example: true })
  showBarcodeOnReceipt!: boolean;

  @ApiPropertyOptional({ example: 'Welcome to Colombo Flagship Store' })
  receiptHeader?: string | null;

  @ApiPropertyOptional({ example: 'Thank you for shopping with us!' })
  receiptFooter?: string | null;

  @ApiPropertyOptional({ example: 'Goods once sold can be exchanged within 7 days.' })
  returnPolicyText?: string | null;

  @ApiProperty({ example: 'DISALLOW' })
  negativeStockPolicy!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-09T00:00:00.000Z' })
  updatedAt!: string;
}

export class BusinessProfileDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id!: string;

  @ApiProperty({ example: 'PixelCraft Flagship Store' })
  name!: string;

  @ApiProperty({ example: 'pixelcraft-lk' })
  slug!: string;

  @ApiPropertyOptional({ example: 'PixelCraft LK Private Limited' })
  legalName?: string | null;

  @ApiProperty({ example: 'RETAIL' })
  businessType!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 'LKR' })
  currency!: string;

  @ApiProperty({ example: 'Asia/Colombo' })
  timezone!: string;

  @ApiPropertyOptional({ type: BusinessProfileBranchDto })
  primaryBranch?: BusinessProfileBranchDto | null;

  @ApiProperty({ type: [BusinessProfileBranchDto] })
  branches!: BusinessProfileBranchDto[];

  @ApiPropertyOptional({ type: BusinessSettingsDto })
  settings?: BusinessSettingsDto | null;
}

export class UpdateTenantStoreSettingsDto {
  @ApiPropertyOptional({ example: 'Deegayu Weda Madhura' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Deegayu Ayurvedic Products & Health Care (Pvt) Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string | null;

  @ApiPropertyOptional({ example: 'https://pos.pixelcraftlk.com/images/deegayu-logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: '+94 34 222 3456' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @ApiPropertyOptional({ example: 'info@deegayu.pixelcraftlk.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ example: 'Main Street, Kalutara, Sri Lanka' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @ApiPropertyOptional({ example: 'VAT-10928392-8000' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vatNumber?: string | null;

  @ApiPropertyOptional({ example: 'Welcome to Deegayu Weda Madhura • Traditional Ayurvedic Dispensary' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  receiptHeaderNote?: string | null;

  @ApiPropertyOptional({ example: 'නිරෝගී සුවය පතමු! Return within 7 days.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  receiptFooterNote?: string | null;

  @ApiPropertyOptional({ example: 'Goods once sold can be exchanged within 7 days with original receipt.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnPolicy?: string | null;

  @ApiPropertyOptional({ enum: ['80mm', '58mm'], example: '80mm' })
  @IsOptional()
  @IsEnum(['80mm', '58mm'])
  receiptPaperWidth?: '80mm' | '58mm';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showVat?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showBarcode?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showQr?: boolean;
}


