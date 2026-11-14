export type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface StaffUserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: StaffRole;
  roleName?: string;
  roleId?: string;
  hasPin: boolean;
  isActive: boolean;
  branchId?: string | null;
  branchName?: string | null;
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

