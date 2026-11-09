import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthTenant,
  AuthUser,
  BrandDto,
  BulkImportResult,
  CategoryDto,
  PaginatedResult,
  ProductDto,
  ProductLookupResult,
  UnitDto,
} from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import {
  BrandResponseDto,
  BulkImportProductDto,
  BulkImportResultDto,
  CategoryResponseDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  CreateUnitDto,
  ProductLookupQueryDto,
  ProductLookupResultDto,
  ProductQueryDto,
  ProductResponseDto,
  UnitResponseDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateUnitDto,
} from './dto/products.dto';
import { ProductsService } from './products.service';

@ApiTags('Products & Catalogue Management')
@Controller('products')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  required: false,
  description: 'Optional organization tenant UUID to switch active session scope',
})
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ==========================================
  // TAXONOMY: CATEGORIES
  // ==========================================

  @Get('categories')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'List Product Categories' })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async getCategories(@CurrentTenant() tenant: AuthTenant): Promise<CategoryDto[]> {
    return this.productsService.getCategories(tenant.id);
  }

  @Post('categories')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Create Product Category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async createCategory(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.productsService.createCategory(tenant.id, user.id, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Update Product Category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async updateCategory(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.productsService.updateCategory(tenant.id, user.id, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Delete Product Category' })
  async deleteCategory(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.productsService.deleteCategory(tenant.id, user.id, id);
  }

  // ==========================================
  // TAXONOMY: BRANDS
  // ==========================================

  @Get('brands')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'List Product Brands' })
  @ApiOkResponse({ type: [BrandResponseDto] })
  async getBrands(@CurrentTenant() tenant: AuthTenant): Promise<BrandDto[]> {
    return this.productsService.getBrands(tenant.id);
  }

  @Post('brands')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Create Brand' })
  @ApiOkResponse({ type: BrandResponseDto })
  async createBrand(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBrandDto,
  ): Promise<BrandDto> {
    return this.productsService.createBrand(tenant.id, user.id, dto);
  }

  @Patch('brands/:id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Update Brand' })
  @ApiOkResponse({ type: BrandResponseDto })
  async updateBrand(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandDto> {
    return this.productsService.updateBrand(tenant.id, user.id, id, dto);
  }

  @Delete('brands/:id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Delete Brand' })
  async deleteBrand(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.productsService.deleteBrand(tenant.id, user.id, id);
  }

  // ==========================================
  // TAXONOMY: UNITS
  // ==========================================

  @Get('units')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'List Units of Measurement' })
  @ApiOkResponse({ type: [UnitResponseDto] })
  async getUnits(@CurrentTenant() tenant: AuthTenant): Promise<UnitDto[]> {
    return this.productsService.getUnits(tenant.id);
  }

  @Post('units')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Create Unit of Measurement' })
  @ApiOkResponse({ type: UnitResponseDto })
  async createUnit(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUnitDto,
  ): Promise<UnitDto> {
    return this.productsService.createUnit(tenant.id, user.id, dto);
  }

  @Patch('units/:id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Update Unit of Measurement' })
  @ApiOkResponse({ type: UnitResponseDto })
  async updateUnit(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ): Promise<UnitDto> {
    return this.productsService.updateUnit(tenant.id, user.id, id, dto);
  }

  @Delete('units/:id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Delete Unit of Measurement' })
  async deleteUnit(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.productsService.deleteUnit(tenant.id, user.id, id);
  }

  // ==========================================
  // PRODUCTS: LOOKUP, BULK & EXPORT
  // ==========================================

  @Get('lookup')
  @RequireAnyPermissions('pos:access', 'inventory:view')
  @ApiOperation({ summary: 'Rapid Barcode & SKU Scanner Lookup' })
  @ApiOkResponse({ type: ProductLookupResultDto })
  async lookup(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: ProductLookupQueryDto,
  ): Promise<ProductLookupResult> {
    return this.productsService.lookup(tenant.id, query.barcode, query.sku);
  }

  @Get('export')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'Export Product Catalogue Payload' })
  @ApiOkResponse({ type: [ProductResponseDto] })
  async exportProducts(@CurrentTenant() tenant: AuthTenant): Promise<ProductDto[]> {
    return this.productsService.exportProducts(tenant.id);
  }

  @Post('bulk-import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Bulk Ingest Validated Product Catalog Rows' })
  @ApiOkResponse({ type: BulkImportResultDto })
  async bulkImport(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkImportProductDto,
  ): Promise<BulkImportResult> {
    return this.productsService.bulkImport(tenant.id, user.id, dto.products);
  }

  // ==========================================
  // PRODUCTS: LIST, CREATE, GET, UPDATE, DELETE
  // ==========================================

  @Get()
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'Paginated Product Catalogue' })
  async getProducts(
    @CurrentTenant() tenant: AuthTenant,
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductDto>> {
    return this.productsService.getProducts(tenant.id, query);
  }

  @Get(':id')
  @RequirePermissions('inventory:view')
  @ApiOperation({ summary: 'Get Product Details by ID' })
  @ApiOkResponse({ type: ProductResponseDto })
  async getProductById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<ProductDto> {
    return this.productsService.getProductById(tenant.id, id);
  }

  @Post()
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Create New Standard or Variable Product' })
  @ApiOkResponse({ type: ProductResponseDto })
  async createProduct(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.createProduct(tenant.id, user.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Update Existing Product' })
  @ApiOkResponse({ type: ProductResponseDto })
  async updateProduct(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.updateProduct(tenant.id, user.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Soft-Delete Product' })
  async deleteProduct(
    @CurrentTenant() tenant: AuthTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.productsService.deleteProduct(tenant.id, user.id, id);
  }
}

