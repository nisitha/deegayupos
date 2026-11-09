// ==========================================
// INVENTORY & STOCK MOVEMENT TYPES & DTOS
// ==========================================

export type StockMovementType =
  | 'SALE'
  | 'PURCHASE_RECEIPT'
  | 'TRANSFER_DISPATCH'
  | 'TRANSFER_RECEIPT'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_SUB'
  | 'RETURN_RESTOCK'
  | 'DAMAGE_LOSS';

export type StockAdjustmentReason =
  | 'PHYSICAL_COUNT'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'LOST_STOLEN'
  | 'CORRECTION';

export type StockAdjustmentStatus = 'APPLIED' | 'REVERSED';

export type StockTransferStatus = 'PENDING' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';

export interface StockLevelDto {
  id: string;
  tenantId: string;
  warehouseId: string;
  warehouseName?: string;
  branchId?: string;
  branchName?: string;
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  categoryName?: string | null;
  unit?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  tenantId: string;
  warehouseId: string;
  warehouseName?: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string | null;
  variantName?: string | null;
  movementType: StockMovementType;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface StockAdjustmentItemDto {
  id: string;
  adjustmentId: string;
  productId: string;
  productName?: string;
  sku?: string;
  variantId?: string | null;
  countedQuantity: number;
  discrepancyQuantity: number;
}

export interface StockAdjustmentDto {
  id: string;
  tenantId: string;
  warehouseId: string;
  warehouseName?: string;
  adjustedById: string;
  adjustedByName?: string;
  reason: StockAdjustmentReason;
  status: StockAdjustmentStatus;
  notes?: string | null;
  items: StockAdjustmentItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockAdjustmentItemDto {
  productId: string;
  variantId?: string | null;
  countedQuantity: number;
}

export interface CreateStockAdjustmentDto {
  warehouseId: string;
  reason: StockAdjustmentReason;
  notes?: string;
  items: CreateStockAdjustmentItemDto[];
}

export interface StockTransferItemDto {
  id: string;
  transferId: string;
  productId: string;
  productName?: string;
  sku?: string;
  variantId?: string | null;
  quantityRequested: number;
  quantityDispatched: number;
  quantityReceived: number;
}

export interface StockTransferDto {
  id: string;
  tenantId: string;
  sourceWarehouseId: string;
  sourceWarehouseName?: string;
  targetWarehouseId: string;
  targetWarehouseName?: string;
  requestedById: string;
  requestedByName?: string;
  status: StockTransferStatus;
  trackingNumber: string;
  notes?: string | null;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: StockTransferItemDto[];
}

export interface CreateStockTransferItemDto {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CreateStockTransferDto {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  notes?: string;
  items: CreateStockTransferItemDto[];
}

export interface InventoryTelemetryDto {
  totalItemsTracked: number;
  lowStockAlertsCount: number;
  outOfStockCount: number;
  totalStockUnits: number;
}

export interface StockFilterParams {
  branchId?: string;
  warehouseId?: string;
  categoryId?: string;
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface MovementFilterParams {
  warehouseId?: string;
  productId?: string;
  movementType?: StockMovementType;
  search?: string;
  page?: number;
  limit?: number;
}

