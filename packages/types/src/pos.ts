export type OrderType = 'RETAIL_WALKIN' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export type SaleStatus = 'COMPLETED' | 'HELD' | 'VOIDED' | 'REFUNDED';

export type SalePaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'QR_PAYMENT'
  | 'BANK_TRANSFER'
  | 'STORE_CREDIT'
  | 'CUSTOMER_CREDIT';

export type SalePaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'COMPLETED';

export interface SaleItemDto {
  id: string;
  saleId: string;
  productId?: string;
  variantId?: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  taxAmount: number;
  subtotal: number;
  notes?: string;
}

export interface SalePaymentDto {
  id: string;
  saleId: string;
  paymentMethod: SalePaymentMethod;
  amount: number;
  reference?: string;
  status: SalePaymentStatus;
  createdAt: string | Date;
}

export interface SaleDto {
  id: string;
  tenantId: string;
  branchId: string;
  registerId?: string;
  shiftId?: string;
  cashierId: string;
  cashierName?: string;
  customerId?: string;
  customerName?: string;
  invoiceNumber: string;
  orderType: OrderType;
  tableNumber?: string;
  status: SaleStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeDue: number;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: SaleItemDto[];
  payments: SalePaymentDto[];
  cashier?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface CreateSaleItemPayload {
  productId?: string;
  variantId?: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxAmount?: number;
  subtotal: number;
  notes?: string;
}

export interface CreateSalePaymentPayload {
  paymentMethod: SalePaymentMethod;
  amount: number;
  reference?: string;
}

export interface CheckoutPayload {
  branchId: string;
  registerId?: string;
  cashierId?: string;
  cashierName?: string;
  customerId?: string;
  customerName?: string;
  orderType?: OrderType;
  tableNumber?: string;
  items: CreateSaleItemPayload[];
  payments: CreateSalePaymentPayload[];
  paymentMethod?: SalePaymentMethod;
  subtotal: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  changeDue?: number;
  idempotencyKey?: string;
  notes?: string;
}

export interface HeldCartDto {
  id: string;
  tenantId?: string;
  branchId: string;
  registerId?: string;
  shiftId?: string;
  cashierId?: string;
  cartReference?: string;
  cartData?: Record<string, unknown>;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items?: any[];
  totalAmount?: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface HoldCartPayload {
  branchId?: string;
  registerId?: string;
  cartReference?: string;
  cartData?: Record<string, unknown>;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items?: any[];
}

export interface VoidSalePayload {
  reason: string;
}

export interface ReceiptTaxBreakdownItem {
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface ReceiptDocumentDto {
  sale: SaleDto;
  business: {
    id: string;
    name: string;
    legalName?: string | null;
    businessType: string;
    currency: string;
    logoUrl?: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
    phone?: string | null;
  };
  cashier: {
    id: string;
    fullName: string;
    email: string;
  };
  settings: {
    paperSize: 'MM_58' | 'MM_80' | 'A4';
    showLogo: boolean;
    showTaxDetails: boolean;
    showBarcode: boolean;
    taxNumber?: string | null;
    receiptHeader?: string | null;
    receiptFooter?: string | null;
    returnPolicyText?: string | null;
  };
  barcodeData: {
    format: 'CODE128';
    code: string;
    verificationUrl: string;
  };
  taxBreakdown: ReceiptTaxBreakdownItem[];
}
