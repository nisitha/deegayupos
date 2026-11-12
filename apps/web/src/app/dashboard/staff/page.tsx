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
} from 'lucide-react';
import type { StaffRole, StaffUserDto } from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { staffApi } from '../../../lib/api-client';

export default function StaffManagementPage() {
  const router = useRouter();
  const { branches, activeCashier, setActiveCashier } = useTenantBranch();

  // Data state
  const [staffList, setStaffList] = useState<StaffUserDto[]>([]);
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

  // Fetch Staff List
  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await staffApi.list();
      if (res.data) {
        setStaffList(res.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load staff list:', err);
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

  // Telemetry Metrics
  const metrics = useMemo(() => {
    const total = staffList.length;
    const cashiers = staffList.filter((s) => s.role === 'CASHIER' && s.isActive).length;
    const managers = staffList.filter((s) => s.role === 'MANAGER' && s.isActive).length;
    const pinEnabled = staffList.filter((s) => s.hasPin && s.isActive).length;
    return { total, cashiers, managers, pinEnabled };
  }, [staffList]);

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

          <div className="flex items-center gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Team Members
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
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-3">{metrics.cashiers}</div>
            <div className="text-xs text-slate-400 mt-1">Authorized for POS sales</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Store Managers
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-3">{metrics.managers}</div>
            <div className="text-xs text-slate-400 mt-1">Supervisors & Approvers</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                PIN Terminals Enabled
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-3">{metrics.pinEnabled}</div>
            <div className="text-xs text-slate-400 mt-1">Instant 4-digit switch</div>
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
                  <th className="py-3.5 px-4">Assigned Branch</th>
                  <th className="py-3.5 px-4">Terminal PIN</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#7052FF]" />
                        <span className="text-xs font-semibold">Loading team members...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
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

                        {/* Branch */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{staff.branchName || 'All Branches'}</span>
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
    </div>
  );
}
