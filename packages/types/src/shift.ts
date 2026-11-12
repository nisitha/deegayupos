export type ShiftStatus = 'OPEN' | 'CLOSED';

export type CashDrawerEventType =
  | 'OPENING_FLOAT'
  | 'PAY_IN'
  | 'PAY_OUT'
  | 'SALE_CASH'
  | 'REFUND_CASH'
  | 'SAFE_DROP';

export interface CashDenominationBreakdown {
  note5000?: number;
  note1000?: number;
  note500?: number;
  note100?: number;
  note50?: number;
  note20?: number;
  coin10?: number;
  coin5?: number;
  coin2?: number;
  coin1?: number;
}

export interface CashDrawerEventDto {
  id: string;
  shiftId: string;
  tenantId: string;
  eventType: CashDrawerEventType;
  amount: number;
  reason?: string | null;
  authorizedById?: string | null;
  createdAt: string;
}

export interface RegisterShiftDto {
  id: string;
  tenantId: string;
  branchId: string;
  registerId: string;
  cashierId: string;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number;
  closingFloatExpected?: number | null;
  closingFloatActual?: number | null;
  variance?: number | null;
  status: ShiftStatus;
  totalSalesCash: number;
  totalSalesCard: number;
  totalSalesCredit: number;
  totalRefunds: number;
  notes?: string | null;
  cashier?: {
    id: string;
    fullName: string;
    email: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  events?: CashDrawerEventDto[];
}

export interface OpenShiftDto {
  registerId?: string;
  openingFloat: number;
  notes?: string;
}

export interface CashDropDto {
  eventType: 'PAY_IN' | 'PAY_OUT' | 'SAFE_DROP';
  amount: number;
  reason: string;
  authorizedById?: string;
}

export interface CloseShiftDto {
  closingFloatActual: number;
  denominations?: CashDenominationBreakdown;
  notes?: string;
}

export interface ShiftXReportDto {
  reportType: 'X_REPORT';
  shiftId: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  registerId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  generatedAt: string;
  openingFloat: number;
  sales: {
    cash: number;
    card: number;
    credit: number;
    total: number;
    transactionCount: number;
  };
  cashDrawer: {
    openingFloat: number;
    cashSales: number;
    payIns: number;
    payOuts: number;
    safeDrops: number;
    refundsCash: number;
    expectedCashInDrawer: number;
  };
  recentEvents: CashDrawerEventDto[];
}

export interface ShiftZReportDto {
  reportType: 'Z_REPORT';
  shiftId: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  registerId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  generatedAt: string;
  openingFloat: number;
  sales: {
    cash: number;
    card: number;
    credit: number;
    total: number;
    transactionCount: number;
  };
  cashDrawer: {
    openingFloat: number;
    cashSales: number;
    payIns: number;
    payOuts: number;
    safeDrops: number;
    refundsCash: number;
    expectedCashInDrawer: number;
  };
  closingFloatActual: number;
  closingFloatExpected: number;
  variance: number;
  varianceStatus: 'BALANCED' | 'OVER' | 'SHORT';
  denominations?: CashDenominationBreakdown;
  notes?: string | null;
  recentEvents: CashDrawerEventDto[];
}

