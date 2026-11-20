'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Edit2,
  RefreshCw,
  X,
  CheckCircle2,
  Building2,
  Sparkles,
} from 'lucide-react';
import { payrollEmployeesApi } from '../../../../lib/payroll-api';
import { PayrollEmployee } from '../../../../lib/payroll-calculator';
import { supabase } from '../../../../lib/supabase';

function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PayrollEmployeesPage() {
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DAILY' | 'MONTHLY'>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    emp_code: '',
    full_name: '',
    phone: '',
    nic: '',
    branch_id: '',
    salary_type: 'DAILY' as 'DAILY' | 'MONTHLY',
    normal_daily_rate: '1200.00',
    holiday_daily_rate: '2800.00',
    basic_salary: '0.00',
    ot_rate_type: 'FORMULA' as 'FORMULA' | 'FIXED_HOURLY',
    fixed_ot_rate: '0.00',
    shift_start_time: '08:30',
    shift_end_time: '17:30',
    break_minutes: '60',
    epf_etf_eligible: true,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [empData, { data: branchData }] = await Promise.all([
        payrollEmployeesApi.getAll('ALL'),
        supabase.from('branches').select('id, name, code').order('name'),
      ]);

      setEmployees(empData);
      setBranches(branchData || []);
    } catch (err: any) {
      console.error('[PayrollEmployees] Failed to load data:', err);
      showToast('Error loading employees. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // 2. Computed KPI Stats
  const stats = useMemo(() => {
    let total = 0;
    let active = 0;
    let daily = 0;
    let monthly = 0;
    let epf = 0;

    employees.forEach((emp) => {
      total++;
      if (emp.status === 'ACTIVE') active++;
      if (emp.salary_type === 'DAILY') daily++;
      else monthly++;
      if (emp.epf_etf_eligible) epf++;
    });

    return { total, active, daily, monthly, epf };
  }, [employees]);

  // 3. Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && emp.salary_type !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = emp.full_name.toLowerCase().includes(q);
        const matchesCode = emp.emp_code.toLowerCase().includes(q);
        const matchesPhone = (emp.phone || '').toLowerCase().includes(q);
        const matchesNic = (emp.nic || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesPhone && !matchesNic) {
          return false;
        }
      }

      return true;
    });
  }, [employees, statusFilter, typeFilter, searchQuery]);

  // 4. Modal Open/Close Handlers
  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      emp_code: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
      full_name: '',
      phone: '',
      nic: '',
      branch_id: branches[0]?.id || '',
      salary_type: 'DAILY',
      normal_daily_rate: '1200.00',
      holiday_daily_rate: '2800.00',
      basic_salary: '0.00',
      ot_rate_type: 'FORMULA',
      fixed_ot_rate: '0.00',
      shift_start_time: '08:30',
      shift_end_time: '17:30',
      break_minutes: '60',
      epf_etf_eligible: true,
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (emp: PayrollEmployee) => {
    setEditingEmployee(emp);
    setFormData({
      emp_code: emp.emp_code,
      full_name: emp.full_name,
      phone: emp.phone || '',
      nic: emp.nic || '',
      branch_id: emp.branch_id || '',
      salary_type: emp.salary_type,
      normal_daily_rate: String(emp.normal_daily_rate || 1200),
      holiday_daily_rate: String(emp.holiday_daily_rate || 2800),
      basic_salary: String(emp.basic_salary || 0),
      ot_rate_type: emp.ot_rate_type,
      fixed_ot_rate: String(emp.fixed_ot_rate || 0),
      shift_start_time: emp.shift_start_time || '08:30',
      shift_end_time: emp.shift_end_time || '17:30',
      break_minutes: String(emp.break_minutes || 60),
      epf_etf_eligible: emp.epf_etf_eligible,
      status: emp.status,
    });
    setModalOpen(true);
  };

  // 5. Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.emp_code.trim() || !formData.full_name.trim()) {
      alert('Employee Code and Full Name are required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        emp_code: formData.emp_code.trim().toUpperCase(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || null,
        nic: formData.nic.trim() || null,
        branch_id: formData.branch_id || null,
        salary_type: formData.salary_type,
        normal_daily_rate: parseFloat(formData.normal_daily_rate) || 1200,
        holiday_daily_rate: parseFloat(formData.holiday_daily_rate) || 2800,
        basic_salary: parseFloat(formData.basic_salary) || 0,
        ot_rate_type: formData.ot_rate_type,
        fixed_ot_rate: parseFloat(formData.fixed_ot_rate) || 0,
        shift_start_time: formData.shift_start_time || '08:30',
        shift_end_time: formData.shift_end_time || '17:30',
        break_minutes: parseInt(formData.break_minutes, 10) || 60,
        epf_etf_eligible: formData.epf_etf_eligible,
        status: formData.status,
      };

      if (editingEmployee) {
        await payrollEmployeesApi.update(editingEmployee.id, payload);
        showToast(`Employee ${payload.full_name} updated successfully.`);
      } else {
        await payrollEmployeesApi.create(payload);
        showToast(`Employee ${payload.full_name} created successfully.`);
      }

      setModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('[PayrollEmployees] Save error:', err);
      alert(`Failed to save employee: ${err.message || 'Validation error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-250">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Obsidian Header Banner */}
      <div className="bg-[#0F172A] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Deegayu Weda Madhura
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-400 text-xs font-medium">Payroll & Human Resources Desk</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-indigo-400" />
                Employee & Wage Master
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                Staff wage definitions, daily normal (Rs. 1,200) and holiday (Rs. 2,800) rates, standard shift schedules, and statutory EPF/ETF eligibility rules.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Employee</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Staff</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
            <p className="text-xs text-slate-400 mt-0.5">Enrolled employees</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active Staff</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{stats.active}</div>
            <p className="text-xs text-slate-400 mt-0.5">Eligible for shifts</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Daily Wage</span>
            <div className="text-2xl font-black text-indigo-700 mt-1">{stats.daily}</div>
            <p className="text-xs text-slate-400 mt-0.5">Rs. 1,200 / 2,800</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Monthly Salaried</span>
            <div className="text-2xl font-black text-purple-700 mt-1">{stats.monthly}</div>
            <p className="text-xs text-slate-400 mt-0.5">Fixed basic salary</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">EPF/ETF Enrolled</span>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.epf}</div>
            <p className="text-xs text-slate-400 mt-0.5">Statutory 20% C-Form</p>
          </div>
        </section>

        {/* Search & Filters */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, code, phone, or NIC..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="ALL">All Wage Types</option>
                <option value="DAILY">Daily Wage (1200/2800)</option>
                <option value="MONTHLY">Monthly Salaried</option>
              </select>
            </div>
          </div>
        </section>

        {/* Employee Table */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Code & Staff Name</th>
                  <th className="px-4 py-3.5">Contact & NIC</th>
                  <th className="px-4 py-3.5">Assigned Branch</th>
                  <th className="px-4 py-3.5">Wage Model & Rates</th>
                  <th className="px-4 py-3.5">Overtime Rule</th>
                  <th className="px-4 py-3.5">Shift Window</th>
                  <th className="px-4 py-3.5 text-center">EPF/ETF</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Loading staff records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      No employees match your search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                      {/* Code & Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{emp.full_name}</div>
                        <span className="font-mono text-[11px] text-slate-500 font-semibold">{emp.emp_code}</span>
                      </td>

                      {/* Contact & NIC */}
                      <td className="px-4 py-3.5 text-slate-600">
                        <div>{emp.phone || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">NIC: {emp.nic || '—'}</div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {emp.branch_name || 'All Branches'}
                        </span>
                      </td>

                      {/* Wage Model */}
                      <td className="px-4 py-3.5">
                        {emp.salary_type === 'DAILY' ? (
                          <div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              DAILY WAGE
                            </span>
                            <div className="text-[11px] font-semibold text-slate-800 mt-1">
                              Normal: {formatCurrency(emp.normal_daily_rate)}
                            </div>
                            <div className="text-[10px] text-purple-700 font-medium">
                              Holiday: {formatCurrency(emp.holiday_daily_rate)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              MONTHLY
                            </span>
                            <div className="text-[11px] font-black text-slate-900 mt-1">
                              {formatCurrency(emp.basic_salary)}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* OT Rule */}
                      <td className="px-4 py-3.5">
                        {emp.ot_rate_type === 'FORMULA' ? (
                          <span className="text-[11px] text-slate-700 font-medium">
                            Formula (1.5x / 2.0x)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-700 font-semibold">
                            Fixed: Rs. {emp.fixed_ot_rate.toFixed(2)}/hr
                          </span>
                        )}
                      </td>

                      {/* Shift Window */}
                      <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                        <div>{emp.shift_start_time || '08:30'} – {emp.shift_end_time || '17:30'}</div>
                        <div className="text-[10px] text-slate-400">Break: {emp.break_minutes}m</div>
                      </td>

                      {/* EPF/ETF */}
                      <td className="px-4 py-3.5 text-center">
                        {emp.epf_etf_eligible ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            20% C-Form
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                            Exempt
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {emp.status === 'ACTIVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded text-xs font-semibold transition cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ====================================================================
          ADD / EDIT EMPLOYEE MODAL
      ==================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingEmployee ? `Edit Employee: ${editingEmployee.full_name}` : 'Enroll New Employee'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure wage structure, standard shift schedules, and statutory deductions.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4 py-4 text-xs">
              {/* Row 1: Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Employee Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.emp_code}
                    onChange={(e) => setFormData({ ...formData, emp_code: e.target.value })}
                    placeholder="e.g. EMP-001"
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Full Staff Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Kumari Wickramasinghe"
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Row 2: Phone, NIC, Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0771234567"
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIC Number</label>
                  <input
                    type="text"
                    value={formData.nic}
                    onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                    placeholder="199212345678"
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Branch</label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || 'BR'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Wage Model Segment */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Wage Model & Daily / Monthly Rates
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, salary_type: 'DAILY' })}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition border ${
                        formData.salary_type === 'DAILY'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      DAILY WAGE
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, salary_type: 'MONTHLY' })}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition border ${
                        formData.salary_type === 'MONTHLY'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      MONTHLY SALARY
                    </button>
                  </div>
                </div>

                {formData.salary_type === 'DAILY' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Normal Daily Rate (Rs.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.normal_daily_rate}
                        onChange={(e) => setFormData({ ...formData, normal_daily_rate: e.target.value })}
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Standard working day rate</span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Commercial Holiday Rate (Rs.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.holiday_daily_rate}
                        onChange={(e) => setFormData({ ...formData, holiday_daily_rate: e.target.value })}
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900"
                      />
                      <span className="text-[10px] text-purple-600 mt-0.5 block">Holiday shift rate (first 8h)</span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Monthly Basic Salary (Rs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.basic_salary}
                      onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Fixed monthly base salary</span>
                  </div>
                )}
              </div>

              {/* Overtime Configuration */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider block">
                  Overtime Calculation Mode
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">OT Rate Method</label>
                    <select
                      value={formData.ot_rate_type}
                      onChange={(e) => setFormData({ ...formData, ot_rate_type: e.target.value as any })}
                      className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                    >
                      <option value="FORMULA">Formula: Daily / 8 (or Basic / 240)</option>
                      <option value="FIXED_HOURLY">Fixed Hourly Rate</option>
                    </select>
                  </div>

                  {formData.ot_rate_type === 'FIXED_HOURLY' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Fixed Hourly OT Rate (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fixed_ot_rate}
                        onChange={(e) => setFormData({ ...formData, fixed_ot_rate: e.target.value })}
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Shift Hours & Break Window */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    value={formData.shift_start_time}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift End Time</label>
                  <input
                    type="time"
                    value={formData.shift_end_time}
                    onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Meal Break (Minutes)</label>
                  <input
                    type="number"
                    value={formData.break_minutes}
                    onChange={(e) => setFormData({ ...formData, break_minutes: e.target.value })}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Toggles: EPF/ETF & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={formData.epf_etf_eligible}
                    onChange={(e) => setFormData({ ...formData, epf_etf_eligible: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Statutory EPF & ETF Eligible</span>
                    <span className="text-[10px] text-slate-400 block">Deduct 8% employee, contribute 12% + 3% employer</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={formData.status === 'ACTIVE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Employee Status Active</span>
                    <span className="text-[10px] text-slate-400 block">Allow attendance logging and monthly payroll runs</span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingEmployee ? 'Update Employee' : 'Save Employee'}</span>
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
