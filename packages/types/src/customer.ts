export type CustomerType = 'WALK_IN' | 'RETAIL_CREDIT' | 'WHOLESALE';

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED';

export type CustomerLedgerEntryType =
  | 'CREDIT_SALE'
  | 'PAYMENT_RECEIVED'
  | 'REFUND_CREDIT'
  | 'ADJUSTMENT';

export type CustomerPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER';

export interface CustomerDto {
  id: string;
  tenantId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  nicNumber?: string | null;
  address?: string | null;
  customerType: CustomerType;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  loyaltyPoints: number;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sales?: number;
    ledgerEntries?: number;
    payments?: number;
  };
}

export interface CreateCustomerDto {
  name: string;
  phone?: string;
  email?: string;
  nicNumber?: string;
  address?: string;
  customerType?: CustomerType;
  creditLimit?: number;
  loyaltyPoints?: number;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  status?: CustomerStatus;
}

export interface CustomerLedgerDto {
  id: string;
  tenantId: string;
  customerId: string;
  customerName?: string;
  entryType: CustomerLedgerEntryType;
  referenceId?: string | null;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
}

export interface RecordCustomerPaymentDto {
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface CustomerPaymentDto {
  id: string;
  tenantId: string;
  customerId: string;
  customerName?: string;
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  referenceNumber?: string | null;
  receiptNumber: string;
  notes?: string | null;
  receivedById?: string | null;
  createdAt: string;
}

export interface CustomerFilterParams {
  search?: string;
  customerType?: CustomerType;
  status?: CustomerStatus;
  hasDebtOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface CustomerTelemetryDto {
  totalCustomers: number;
  totalReceivables: number;
  activeCreditAccounts: number;
  totalCreditLimit: number;
}
