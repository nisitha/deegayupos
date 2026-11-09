export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type GrnStatus = 'RECEIVED' | 'VERIFIED';

export interface SupplierDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  paymentTerms?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    purchaseOrders?: number;
    goodsReceivedNotes?: number;
  };
}

export interface CreateSupplierDto {
  name: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  paymentTerms?: string;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  status?: string;
}

export interface PurchaseOrderItemDto {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  subtotal: number;
}

export interface PurchaseOrderDto {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string;
  supplierId: string;
  supplierName?: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  items: PurchaseOrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderItemDto {
  productId: string;
  orderedQuantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderDto {
  branchId: string;
  supplierId: string;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  items: CreatePurchaseOrderItemDto[];
}

export interface GoodsReceivedNoteItemDto {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  receivedQuantity: number;
  unitCost: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  subtotal: number;
}

export interface GoodsReceivedNoteDto {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string;
  warehouseId: string;
  warehouseName?: string;
  supplierId: string;
  supplierName?: string;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  grnNumber: string;
  supplierInvoiceNo?: string | null;
  receivedDate: string;
  status: GrnStatus;
  totalCost: number;
  receivedByUserId?: string | null;
  receivedByName?: string | null;
  notes?: string | null;
  items: GoodsReceivedNoteItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGrnItemDto {
  productId: string;
  receivedQuantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface CreateGrnDto {
  branchId: string;
  warehouseId: string;
  supplierId: string;
  purchaseOrderId?: string;
  supplierInvoiceNo?: string;
  receivedDate?: string;
  notes?: string;
  items: CreateGrnItemDto[];
}

