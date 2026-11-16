'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  X,
  Loader2,
  Layers,
  Lock,
  UserCheck,
  Building2,
  RefreshCw,
  Sparkles,
  Coins,
  Calendar,
} from 'lucide-react';
import type { StaffRole, StaffUserDto, StaffIncentiveDto, CashierShortageDto } from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { staffApi, incentivesApi } from '../../../lib/api-client';

export default function StaffManagementPage() {
  const router = useRouter();
  const { branches, activeCashier, setActiveCashier, isOwner, user } = useTenantBranch();

  // Data state
  const [staffList, setStaffList] = useState<StaffUserDto[]>([]);
  const [incentivesList, setIncentivesList] = useState<StaffIncentiveDto[]>([]);
  const [shortagesList, setShortagesList] = useState<CashierShortageDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | StaffRole>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUserDto | null>(null);

  // Form State - Create
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    pinCode: '',
    role: 'CASHIER' as StaffRole,
    branchId: '',
    phone: '',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State - Edit
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    password: '',
    pinCode: '',
    role: 'CASHIER' as StaffRole,
    branchId: '',
    phone: '',
    isActive: true,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Form State - Award Incentive Modal
  const [isIncentiveModalOpen, setIsIncentiveModalOpen] = useState(false);
  const [incentiveForm, setIncentiveForm] = useState({
    staffId: '',
    branchId: '',
    incentiveDate: '',
    title: 'Monthly Dispensary Sales Target Bonus',
    amount: '2500',
    notes: '',
    status: 'approved' as 'approved' | 'paid',
  });
  const [isSubmittingIncentive, setIsSubmittingIncentive] = useState(false);
  const [incentiveError, setIncentiveError] = useState<string | null>(null);

  // Fetch Staff List, Incentives & Cashier Shortages in parallel
  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [res, incRes, shortRes] = await Promise.all([
        staffApi.list(),
        incentivesApi.getStaffIncentives(),
        incentivesApi.getStaffShortages(),
      ]);

      if (res.data) {
        setStaffList(res.data);
      }
      if (incRes.data) {
        setIncentivesList(incRes.data);
      }
      if (shortRes.data) {
        setShortagesList(shortRes.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load staff list & payroll figures:', err);
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load staff accounts.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Open Award Incentive Modal
  const openAwardIncentiveModal = (staff?: StaffUserDto) => {
    const today = new Date().toISOString().slice(0, 10);
    const targetStaff = staff || staffList.find((s) => s.role !== 'OWNER') || staffList[0];
    setIncentiveForm({
      staffId: targetStaff ? targetStaff.id : '',
      branchId: targetStaff?.branchId || '',
      incentiveDate: today,
      title: 'Monthly Dispensary Sales Target Bonus',
      amount: '2500',
      notes: '',
      status: 'approved',
    });
    setIncentiveError(null);
    setIsIncentiveModalOpen(true);
  };

  // Handle Incentive Submit
  const handleIncentiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incentiveForm.staffId) {
      setIncentiveError('Please select a staff member.');
      return;
    }
    const amt = parseFloat(incentiveForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setIncentiveError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!incentiveForm.title.trim()) {
      setIncentiveError('Please enter an incentive title.');
      return;
    }

    setIsSubmittingIncentive(true);
    setIncentiveError(null);
    try {
      const target = staffList.find((s) => s.id === incentiveForm.staffId);
      const res = await incentivesApi.createStaffIncentive({
        staffId: incentiveForm.staffId,
        branchId: incentiveForm.branchId || target?.branchId || null,
        incentiveDate: incentiveForm.incentiveDate,
        title: incentiveForm.title.trim(),
        amount: amt,
        status: incentiveForm.status,
        notes: incentiveForm.notes.trim() || null,
        createdBy: user?.id || null,
      });

      if (res.success) {
        setSuccessMessage(`Incentive of LKR ${amt.toLocaleString()} awarded to ${target?.fullName || 'staff member'} successfully.`);
        setTimeout(() => setSuccessMessage(null), 4000);
        setIsIncentiveModalOpen(false);
        fetchStaff();
      } else {
        setIncentiveError(res.error?.message || 'Failed to award incentive.');
      }
    } catch (err: any) {
      setIncentiveError(err?.message || 'Failed to award incentive.');
    } finally {
      setIsSubmittingIncentive(false);
    }
  };

  // Telemetry Metrics including Incentives & Deductions
  const metrics = useMemo(() => {
    const total = staffList.length;
    const cashiers = staffList.filter((s) => s.role === 'CASHIER' && s.isActive).length;
    const managers = staffList.filter((s) => s.role === 'MANAGER' && s.isActive).length;
    const pinEnabled = staffList.filter((s) => s.hasPin && s.isActive).length;
    const totalIncentives = incentivesList.reduce((sum, i) => sum + i.amount, 0);
    const pendingShortages = shortagesList.filter((s) => s.deductionStatus === 'pending_payroll');
    const totalPendingShortages = pendingShortages.reduce((sum, s) => sum + s.amount, 0);
    return {
      total,
      cashiers,
      managers,
      pinEnabled,
      totalIncentives,
      totalPendingShortages,
      pendingShortagesCount: pendingShortages.length,
    };
  }, [staffList, incentivesList, shortagesList]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = staff.fullName.toLowerCase().includes(query);
        const matchEmail = staff.email.toLowerCase().includes(query);
        const matchPhone = staff.phone ? staff.phone.toLowerCase().includes(query) : false;
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      if (roleFilter !== 'ALL' && staff.role !== roleFilter) return false;
      if (branchFilter !== 'ALL' && staff.branchId !== branchFilter) return false;
      if (statusFilter === 'ACTIVE' && !staff.isActive) return false;
      if (statusFilter === 'INACTIVE' && staff.isActive) return false;
      return true;
    });
  }, [staffList, searchQuery, roleFilter, branchFilter, statusFilter]);

  // Handle Create Staff
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim() || !createForm.email.trim()) {
      setCreateError('Full name and email are mandatory.');
      return;
    }
    if (createForm.pinCode && !/^\d{4}$/.test(createForm.pinCode)) {
      setCreateError('Terminal PIN must be exactly 4 digits.');
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      await staffApi.create({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password || undefined,
        pinCode: createForm.pinCode || undefined,
        role: createForm.role,
        branchId: createForm.branchId || undefined,
        phone: createForm.phone.trim() || undefined,
      });

      setSuccessMessage(`Staff member "${createForm.fullName}" added successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setIsCreateModalOpen(false);
      setCreateForm({
        fullName: '',
        email: '',
        password: '',
        pinCode: '',
        role: 'CASHIER',
        branchId: '',
        phone: '',
      });
      fetchStaff();
    } catch (err: unknown) {
      console.error('Create staff error:', err);
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to create staff member.';
      setCreateError(msg);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (staff: StaffUserDto) => {
    setEditingStaff(staff);
    setEditForm({
      fullName: staff.fullName,
      email: staff.email,
      password: '',
      pinCode: '',
      role: staff.role,
      branchId: staff.branchId || '',
      phone: staff.phone || '',
      isActive: staff.isActive,
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (editForm.pinCode && !/^\d{4}$/.test(editForm.pinCode)) {
      setEditError('Terminal PIN must be exactly 4 digits.');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await staffApi.update(editingStaff.id, {
        fullName: editForm.fullName.trim() || undefined,
        email: editForm.email.trim().toLowerCase() || undefined,
        password: editForm.password || undefined,
        pinCode: editForm.pinCode ? editForm.pinCode : undefined,
        role: editForm.role,
        branchId: editForm.branchId || null,
        phone: editForm.phone.trim() || null,
        isActive: editForm.isActive,
      });

      // If updating active cashier, refresh context
      if (activeCashier?.id === editingStaff.id) {
        setActiveCashier({
          id: editingStaff.id,
          fullName: editForm.fullName.trim() || editingStaff.fullName,
          role: editForm.role,
          email: editForm.email.trim().toLowerCase() || editingStaff.email,
        });
      }

      setSuccessMessage(`Updated profile for "${editForm.fullName}".`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setIsEditModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err: unknown) {
      console.error('Update staff error:', err);
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update staff member.';
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete / Revoke Staff
  const handleDeleteStaff = async (staff: StaffUserDto) => {
    if (staff.role === 'OWNER') {
      alert('Cannot delete the organization Owner account.');
      return;
    }
    const confirmed = confirm(
      `Are you sure you want to revoke access for ${staff.fullName} (${staff.email})?`,
    );
    if (!confirmed) return;

    try {
      await staffApi.delete(staff.id);
      if (activeCashier?.id === staff.id) {
        setActiveCashier(null);
      }
      setSuccessMessage(`Revoked access for ${staff.fullName}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchStaff();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to remove staff member.';
      alert(msg);
    }
  };

  // Quick switch cashier and go to POS
  const handleSwitchToTerminal = (staff: StaffUserDto) => {
    setActiveCashier({
      id: staff.id,
      fullName: staff.fullName,
      role: staff.role,
      email: staff.email,
    });
    setSuccessMessage(`Switched active terminal cashier to ${staff.fullName}. Opening POS...`);
    setTimeout(() => {
      router.push('/dashboard/pos');
    }, 600);
  };

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((b) => {
      map[b.id] = b.name;
    });
    return map;
  }, [branches]);

  if (!isOwner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          Staff and team permission management is restricted to the Organization Owner (Dr. Deegayu).
        </p>
        <button
          onClick={() => router.push('/dashboard/pos')}
          className="px-4 py-2 bg-[#005BD3] text-white text-xs font-semibold rounded-xl hover:bg-[#004bb5] transition cursor-pointer"
        >
          Return to POS Terminal
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50 pb-16">
      {/* 1. Header & Breadcrumbs */}
      <div className="px-6 py-6 bg-white border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>Platform</span>
              <span>/</span>
              <span className="text-[#7052FF]">Staff & Team Access</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Staff & Cashier Management
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create accounts, enforce Role-Based Access Control (RBAC), and manage 4-digit terminal PINs for receipt attribution.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchStaff}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs cursor-pointer"
              title="Refresh staff roster"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#7052FF]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openAwardIncentiveModal()}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Award Incentive</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setIsCreateModalOpen(true);
              }}
              className="bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-95 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-[#7052FF]/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 w-full space-y-6">
        {/* Banner Feedback */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 2. Top Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Team
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#7052FF] flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-3">{metrics.total}</div>
            <div className="text-xs text-slate-400 mt-1">Across all branches</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Cashiers
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-3">{metrics.cashiers}</div>
            <div className="text-xs text-slate-400 mt-1">POS sales enabled</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                PIN Access
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-3">{metrics.pinEnabled}</div>
            <div className="text-xs text-slate-400 mt-1">4-digit login set</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Awarded Incentives
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-3">
              LKR {metrics.totalIncentives.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-700/80 mt-1 font-semibold">
              {incentivesList.length} bonus records
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Pending Deductions
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-3">
              LKR {metrics.totalPendingShortages.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-rose-700/80 mt-1 font-semibold">
              {metrics.pendingShortagesCount} shortages to deduct
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by staff name, email, or phone number..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'ALL' | StaffRole)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owners Only</option>
            <option value="MANAGER">Managers Only</option>
            <option value="CASHIER">Cashiers Only</option>
          </select>

          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 cursor-pointer"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {/* 4. Staff Directory Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Staff Member</th>
                  <th className="py-3.5 px-4">Role & Access</th>
                  <th className="py-3.5 px-4">Assigned Branch & GRN</th>
                  <th className="py-3.5 px-4">Terminal PIN</th>
                  <th className="py-3.5 px-4">Payroll & Incentives</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#7052FF]" />
                        <span className="text-xs font-semibold">Loading team members...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-bold text-slate-600">No staff members match criteria</p>
                        <p className="text-xs text-slate-400">Try modifying your search or filter settings.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const isOwner = staff.role === 'OWNER';
                    const isManager = staff.role === 'MANAGER';

                    const roleBadgeColor = isOwner
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : isManager
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

                    const isCurrentCashier = activeCashier?.id === staff.id;

                    // Compute per-staff incentives and shortages
                    const staffShortages = shortagesList.filter(
                      (s) =>
                        s.staffId === staff.id ||
                        (s.cashierName && s.cashierName.toLowerCase().includes(staff.fullName.toLowerCase()))
                    );
                    const pendingShortages = staffShortages.filter((s) => s.deductionStatus === 'pending_payroll');
                    const pendingShortagesSum = pendingShortages.reduce((sum, s) => sum + s.amount, 0);

                    const staffIncentives = incentivesList.filter((i) => i.staffId === staff.id);
                    const totalIncentivesSum = staffIncentives.reduce((sum, i) => sum + i.amount, 0);

                    return (
                      <tr
                        key={staff.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isCurrentCashier ? 'bg-purple-50/30' : ''
                        }`}
                      >
                        {/* Name & Contact */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  {staff.fullName}
                                </span>
                                {isCurrentCashier && (
                                  <span className="text-[10px] font-bold bg-[#7052FF] text-white px-2 py-0.5 rounded-full shadow-2xs">
                                    Current POS Cashier
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  <span>{staff.email}</span>
                                </span>
                                {staff.phone && (
                                  <span className="flex items-center gap-1 hidden sm:flex">
                                    <Phone className="w-3 h-3" />
                                    <span>{staff.phone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-4 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shadow-2xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOwner ? 'bg-purple-600' : isManager ? 'bg-blue-600' : 'bg-emerald-600'}`} />
                            <span className={roleBadgeColor.split(' ')[1]}>{staff.role}</span>
                          </div>
                        </td>

                        {/* Branch & GRN Privileges */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {staff.role === 'OWNER' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <Building2 className="w-3 h-3 text-purple-600" />
                                  All 5 Branches
                                </span>
                              ) : staff.assignedBranches && staff.assignedBranches.length > 0 ? (
                                staff.assignedBranches.map((bId) => (
                                  <span
                                    key={bId}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    <Building2 className="w-3 h-3 text-slate-500" />
                                    {branchMap[bId] || 'Branch'}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">All Branches</span>
                              )}
                            </div>
                            <div>
                              {staff.role === 'OWNER' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700">
                                  <ShieldCheck className="w-3 h-3" />
                                  Full GRN & Purchasing
                                </span>
                              ) : staff.grnBranches && staff.grnBranches.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  GRN Stock Officer ({staff.grnBranches.map((bId) => branchMap[bId] || 'Branch').join(', ')})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                  <Lock className="w-2.5 h-2.5 text-slate-300" />
                                  No GRN Entry
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Terminal PIN */}
                        <td className="py-4 px-4">
                          {staff.hasPin ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                              <KeyRound className="w-3 h-3" />
                              <span>4-Digit Set</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold">
                              <Lock className="w-3 h-3" />
                              <span>No PIN</span>
                            </span>
                          )}
                        </td>

                        {/* Payroll & Incentives */}
                        <td className="py-4 px-4">
                          {isOwner ? (
                            <span className="text-xs text-slate-400 font-medium">Exempt / Owner</span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-500">Incentives:</span>
                                <span className={`text-xs font-bold ${totalIncentivesSum > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {totalIncentivesSum > 0 ? `+LKR ${totalIncentivesSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'LKR 0.00'}
                                </span>
                                {staffIncentives.length > 0 && (
                                  <span className="text-[10px] text-emerald-700/80 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                                    {staffIncentives.length}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-500">Shortages:</span>
                                {pendingShortagesSum > 0 ? (
                                  <span className="text-xs font-bold text-rose-600">
                                    -LKR ${pendingShortagesSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400">LKR 0.00</span>
                                )}
                                {pendingShortages.length > 0 && (
                                  <span className="text-[10px] text-rose-700/80 font-bold bg-rose-50 px-1.5 py-0.2 rounded">
                                    {pendingShortages.length} pending
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                              staff.isActive ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                staff.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                            <span>{staff.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Award Incentive Button */}
                            <button
                              type="button"
                              onClick={() => openAwardIncentiveModal(staff)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Award target bonus or performance incentive"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">+ Incentive</span>
                            </button>

                            {/* Switch to Cashier */}
                            <button
                              type="button"
                              onClick={() => handleSwitchToTerminal(staff)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-[#7052FF] text-[#7052FF] hover:text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                              title="Set as active terminal cashier and launch POS"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Set Cashier</span>
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => openEditModal(staff)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              title="Edit user details, roles, or PIN"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete (disabled for sole owners) */}
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(staff)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Revoke organization access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: ADD NEW STAFF MEMBER
      ===================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#7052FF]/10 text-[#7052FF] flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add Staff Account</h2>
                  <p className="text-xs text-slate-500">Configure role permissions and terminal login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kamal Perera"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="kamal@deegayu.pixelcraftlk.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                />
              </div>

              {/* Phone & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+94 77 123 4567"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as StaffRole })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF] cursor-pointer"
                  >
                    <option value="CASHIER">CASHIER (POS Only)</option>
                    <option value="MANAGER">MANAGER (Inventory, Reports)</option>
                    <option value="OWNER">OWNER (Full Enterprise Access)</option>
                  </select>
                </div>
              </div>

              {/* Branch Assignment */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Branch</label>
                <select
                  value={createForm.branchId}
                  onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF] cursor-pointer"
                >
                  <option value="">All Branches (Default Primary)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4-Digit PIN & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>4-Digit Terminal PIN</span>
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="e.g. 1234"
                    value={createForm.pinCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCreateForm({ ...createForm, pinCode: val });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">For instant POS switch</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Initial Password</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Default: PixelCraft@2026</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2.5 rounded-xl bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#7052FF]/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmittingCreate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Staff Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: EDIT STAFF MEMBER
      ===================================================================== */}
      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Edit Staff Member</h2>
                  <p className="text-xs text-slate-500">{editingStaff.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                />
              </div>

              {/* Phone & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as StaffRole })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF] cursor-pointer"
                  >
                    <option value="CASHIER">CASHIER (POS Only)</option>
                    <option value="MANAGER">MANAGER (Inventory, Reports)</option>
                    <option value="OWNER">OWNER (Full Enterprise Access)</option>
                  </select>
                </div>
              </div>

              {/* Branch Assignment */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Branch</label>
                <select
                  value={editForm.branchId}
                  onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF] cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset 4-Digit PIN & Reset Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Reset 4-Digit PIN</span>
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder={editingStaff.hasPin ? '•••• (Leave blank to keep)' : 'Enter 4 digits'}
                    value={editForm.pinCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setEditForm({ ...editForm, pinCode: val });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Password</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7052FF]/20 focus:border-[#7052FF]"
                  />
                </div>
              </div>

              {/* Active Account Toggle */}
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Account Status</span>
                  <span className="text-[11px] text-slate-500">Allow this user to sign in and handle sales</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    editForm.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                      editForm.isActive ? 'left-6.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#7052FF]/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. Award Staff Incentive & Bonus Modal                                */}
      {/* ===================================================================== */}
      {isIncentiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Award Staff Incentive / Bonus
                  </h3>
                  <p className="text-xs text-slate-500">
                    Recognize performance, attendance, and dispensary targets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIncentiveModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleIncentiveSubmit} className="p-6 space-y-4">
              {incentiveError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{incentiveError}</span>
                </div>
              )}

              {/* Staff Member Select */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>Staff Member</span>
                  <span className="text-[10px] text-slate-400">Target recipient</span>
                </label>
                <select
                  value={incentiveForm.staffId}
                  onChange={(e) => {
                    const st = staffList.find((s) => s.id === e.target.value);
                    setIncentiveForm({
                      ...incentiveForm,
                      staffId: e.target.value,
                      branchId: st?.branchId || '',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  required
                >
                  <option value="" disabled>Select Staff Member</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role} • {s.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Incentive Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Award Date</span>
                </label>
                <input
                  type="date"
                  value={incentiveForm.incentiveDate}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, incentiveDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              {/* Title & Quick Presets */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Incentive Reason / Title
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Monthly Dispensary Sales Target Bonus',
                    'Punctuality & Accuracy Incentive',
                    'Customer Service & Advisory Excellence',
                    'Stock Management & Audit Bonus',
                    'Counter Speed & Attendance Incentive',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setIncentiveForm({ ...incentiveForm, title: preset })}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        incentiveForm.title === preset
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                          : 'bg-slate-100/80 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {preset.split(' ')[0]} {preset.split(' ')[1]}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Monthly Dispensary Sales Target Bonus"
                  value={incentiveForm.title}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              {/* Amount (LKR) & Quick Presets */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>Incentive Amount (LKR)</span>
                  <span className="text-[10px] text-slate-400">Added to payroll bonus</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['1500', '2000', '2500', '3000', '3500', '5000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setIncentiveForm({ ...incentiveForm, amount: amt })}
                      className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                        incentiveForm.amount === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      LKR {Number(amt).toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    LKR
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="2500.00"
                    value={incentiveForm.amount}
                    onChange={(e) => setIncentiveForm({ ...incentiveForm, amount: e.target.value })}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Notes / Justification */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Justification / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Commended by patients for exceptional ayurvedic herbal consultation"
                  value={incentiveForm.notes}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Status Select */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Approval Status</span>
                  <span className="text-[11px] text-slate-500">Approved bonuses are included on next payroll run</span>
                </div>
                <select
                  value={incentiveForm.status}
                  onChange={(e) => setIncentiveForm({ ...incentiveForm, status: e.target.value as 'approved' | 'paid' })}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-800 cursor-pointer"
                >
                  <option value="approved">Approved</option>
                  <option value="paid">Paid on Payroll</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsIncentiveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIncentive}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmittingIncentive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Awarding Incentive...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Award Incentive (LKR {parseFloat(incentiveForm.amount || '0').toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
