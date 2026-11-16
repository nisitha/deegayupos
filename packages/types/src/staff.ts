export type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STAFF' | 'ARCHIVED';

export interface StaffUserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: StaffRole;
  roleName?: string;
  roleId?: string;
  hasPin: boolean;
  pinCode?: string | null;
  isActive: boolean;
  branchId?: string | null;
  branchName?: string | null;
  assignedBranches?: string[];
  grnBranches?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStaffUserDto {
  fullName: string;
  email: string;
  password?: string;
  pinCode?: string; // 4-digit PIN
  role: StaffRole;
  branchId?: string | null;
  phone?: string | null;
}

export interface UpdateStaffUserDto {
  fullName?: string;
  email?: string;
  password?: string;
  pinCode?: string | null;
  role?: StaffRole;
  branchId?: string | null;
  isActive?: boolean;
  phone?: string | null;
}

export interface StaffIncentiveDto {
  id: string;
  tenantId?: string;
  staffId: string;
  staffName?: string;
  branchId?: string | null;
  branchName?: string;
  incentiveDate: string;
  title: string;
  amount: number;
  status: 'approved' | 'paid';
  notes?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  createdAt?: string;
}

export interface CreateStaffIncentiveDto {
  staffId: string;
  branchId?: string | null;
  incentiveDate: string;
  title: string;
  amount: number;
  status?: 'approved' | 'paid';
  notes?: string | null;
  createdBy?: string | null;
}

export interface CashierShortageDto {
  id: string;
  tenantId?: string;
  reconciliationId?: string;
  branchId: string;
  branchName?: string;
  staffId?: string | null;
  cashierName: string;
  shortageDate: string;
  amount: number;
  deductionStatus: 'pending_payroll' | 'deducted' | 'waived';
  notes?: string | null;
  deductedAt?: string | null;
  createdAt?: string;
}


