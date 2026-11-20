import { supabase } from './supabase';
import {
  PayrollEmployee,
  PayrollSpecialDay,
  PayrollAttendance,
  PayrollRun,
  calculateMonthlyPayroll,
  MonthlyPayrollCalculationResult,
} from './payroll-calculator';

// ============================================================================
// 1. EMPLOYEES API
// ============================================================================

export const payrollEmployeesApi = {
  /**
   * Fetches all payroll employees, optionally filtered by status ('ACTIVE' | 'INACTIVE' | 'ALL').
   */
  getAll: async (status: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ACTIVE'): Promise<PayrollEmployee[]> => {
    let query = supabase
      .from('payroll_employees')
      .select('*, branches(id, name, code)')
      .order('full_name', { ascending: true });

    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[payrollEmployeesApi] getAll error:', error.message);
      throw error;
    }

    return (data || []).map((row: any) => ({
      ...row,
      branch_name: row.branches?.name,
    }));
  },

  /**
   * Fetches a single employee by ID.
   */
  getById: async (id: string): Promise<PayrollEmployee | null> => {
    const { data, error } = await supabase
      .from('payroll_employees')
      .select('*, branches(id, name, code)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[payrollEmployeesApi] getById error:', error.message);
      throw error;
    }
    if (!data) return null;

    return {
      ...data,
      branch_name: data.branches?.name,
    };
  },

  /**
   * Creates a new employee record.
   */
  create: async (payload: Omit<PayrollEmployee, 'id' | 'created_at' | 'branch_name'>): Promise<PayrollEmployee> => {
    const { data, error } = await supabase
      .from('payroll_employees')
      .insert({
        emp_code: payload.emp_code,
        full_name: payload.full_name,
        phone: payload.phone || null,
        nic: payload.nic || null,
        branch_id: payload.branch_id || null,
        salary_type: payload.salary_type,
        normal_daily_rate: payload.normal_daily_rate,
        holiday_daily_rate: payload.holiday_daily_rate,
        basic_salary: payload.basic_salary,
        ot_rate_type: payload.ot_rate_type,
        fixed_ot_rate: payload.fixed_ot_rate,
        shift_start_time: payload.shift_start_time,
        shift_end_time: payload.shift_end_time,
        break_minutes: payload.break_minutes,
        epf_etf_eligible: payload.epf_etf_eligible,
        status: payload.status,
      })
      .select()
      .single();

    if (error) {
      console.error('[payrollEmployeesApi] create error:', error.message);
      throw error;
    }

    return data;
  },

  /**
   * Updates an existing employee record.
   */
  update: async (id: string, payload: Partial<PayrollEmployee>): Promise<PayrollEmployee> => {
    // Exclude computed fields
    const { branch_name, created_at, id: _id, ...cleanPayload } = payload;

    const { data, error } = await supabase
      .from('payroll_employees')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[payrollEmployeesApi] update error:', error.message);
      throw error;
    }

    return data;
  },

  /**
   * Soft-deletes or deactivates an employee.
   */
  deactivate: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('payroll_employees')
      .update({ status: 'INACTIVE' })
      .eq('id', id);

    if (error) {
      console.error('[payrollEmployeesApi] deactivate error:', error.message);
      throw error;
    }
    return true;
  },
};

// ============================================================================
// 2. SPECIAL DAYS (HOLIDAYS) API
// ============================================================================

export const payrollSpecialDaysApi = {
  /**
   * Fetches special days for a specific year, or all special days.
   */
  getAll: async (year?: number): Promise<PayrollSpecialDay[]> => {
    let query = supabase
      .from('payroll_special_days')
      .select('*')
      .order('date', { ascending: true });

    if (year) {
      query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[payrollSpecialDaysApi] getAll error:', error.message);
      throw error;
    }

    return data || [];
  },

  /**
   * Checks whether a specific date string (YYYY-MM-DD) is a registered special holiday.
   */
  isSpecialDay: async (dateStr: string): Promise<PayrollSpecialDay | null> => {
    const { data, error } = await supabase
      .from('payroll_special_days')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();

    if (error) {
      console.error('[payrollSpecialDaysApi] isSpecialDay error:', error.message);
      return null;
    }
    return data || null;
  },

  /**
   * Upserts a special day.
   */
  upsert: async (payload: PayrollSpecialDay): Promise<PayrollSpecialDay> => {
    const { data, error } = await supabase
      .from('payroll_special_days')
      .upsert(payload, { onConflict: 'date' })
      .select()
      .single();

    if (error) {
      console.error('[payrollSpecialDaysApi] upsert error:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Deletes a special day by date string.
   */
  delete: async (dateStr: string): Promise<boolean> => {
    const { error } = await supabase
      .from('payroll_special_days')
      .delete()
      .eq('date', dateStr);

    if (error) {
      console.error('[payrollSpecialDaysApi] delete error:', error.message);
      throw error;
    }
    return true;
  },
};

// ============================================================================
// 3. ATTENDANCE API
// ============================================================================

export const payrollAttendanceApi = {
  /**
   * Fetches attendance records for a specific month (YYYY-MM).
   */
  getByMonth: async (monthYear: string, employeeId?: string): Promise<PayrollAttendance[]> => {
    const startDate = `${monthYear}-01`;
    // Approximate month end boundary
    const parts = monthYear.split('-');
    const y = parseInt(parts[0] || '2026', 10);
    const m = parseInt(parts[1] || '1', 10);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    let query = supabase
      .from('payroll_attendance')
      .select('*')
      .gte('date', startDate)
      .lt('date', nextMonth)
      .order('date', { ascending: true });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[payrollAttendanceApi] getByMonth error:', error.message);
      throw error;
    }

    return data || [];
  },

  /**
   * Upserts a single daily attendance record.
   */
  upsert: async (record: Omit<PayrollAttendance, 'id'>): Promise<PayrollAttendance> => {
    const { data, error } = await supabase
      .from('payroll_attendance')
      .upsert(record, { onConflict: 'employee_id,date' })
      .select()
      .single();

    if (error) {
      console.error('[payrollAttendanceApi] upsert error:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Bulk upserts attendance records.
   */
  bulkUpsert: async (records: Omit<PayrollAttendance, 'id'>[]): Promise<number> => {
    if (!records || records.length === 0) return 0;

    const { error } = await supabase
      .from('payroll_attendance')
      .upsert(records, { onConflict: 'employee_id,date' });

    if (error) {
      console.error('[payrollAttendanceApi] bulkUpsert error:', error.message);
      throw error;
    }
    return records.length;
  },

  /**
   * Deletes an attendance record by ID.
   */
  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('payroll_attendance')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[payrollAttendanceApi] delete error:', error.message);
      throw error;
    }
    return true;
  },
};

// ============================================================================
// 4. PAYROLL RUNS API
// ============================================================================

export interface DetailedPayrollRun extends PayrollRun {
  employee_name?: string;
  emp_code?: string;
  employee_nic?: string;
  salary_type?: string;
  branch_name?: string;
  normal_daily_rate?: number;
  holiday_daily_rate?: number;
  basic_salary?: number;
  epf_etf_eligible?: boolean;
}

export const payrollRunsApi = {
  /**
   * Fetches all payroll runs for a given month (YYYY-MM) with full employee and branch details.
   */
  getByMonth: async (monthYear: string): Promise<DetailedPayrollRun[]> => {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*, payroll_employees(id, emp_code, full_name, nic, phone, salary_type, normal_daily_rate, holiday_daily_rate, basic_salary, epf_etf_eligible, branch_id, branches(id, name, code))')
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[payrollRunsApi] getByMonth error:', error.message);
      throw error;
    }

    return (data || []).map((row: any) => {
      const emp = row.payroll_employees;
      return {
        ...row,
        employee_name: emp?.full_name,
        emp_code: emp?.emp_code,
        employee_nic: emp?.nic || '',
        salary_type: emp?.salary_type || 'DAILY',
        branch_name: emp?.branches?.name || 'Main Dispensary',
        normal_daily_rate: emp?.normal_daily_rate ? Number(emp.normal_daily_rate) : 1200,
        holiday_daily_rate: emp?.holiday_daily_rate ? Number(emp.holiday_daily_rate) : 2800,
        basic_salary: emp?.basic_salary ? Number(emp.basic_salary) : 0,
        epf_etf_eligible: emp?.epf_etf_eligible !== false,
      };
    });
  },

  /**
   * Generates or recalculates a payroll run for a single employee in a given month.
   */
  generateForEmployee: async (
    employeeId: string,
    monthYear: string,
    advancesDeducted?: number
  ): Promise<MonthlyPayrollCalculationResult> => {
    // 1. Fetch employee
    const employee = await payrollEmployeesApi.getById(employeeId);
    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    // 2. Fetch employee's attendance for the month
    const attendances = await payrollAttendanceApi.getByMonth(monthYear, employeeId);

    // 3. Check for existing advances if not explicitly provided
    let effectiveAdvances = advancesDeducted;
    if (effectiveAdvances === undefined) {
      const { data: existingRun } = await supabase
        .from('payroll_runs')
        .select('advances_deducted')
        .eq('employee_id', employeeId)
        .eq('month_year', monthYear)
        .maybeSingle();

      effectiveAdvances = existingRun ? Number(existingRun.advances_deducted || 0) : 0;
    }

    // 4. Compute payroll using pure calculation engine
    const result = calculateMonthlyPayroll({
      employee,
      monthYear,
      attendances,
      advancesDeducted: effectiveAdvances,
    });

    // 5. Upsert into public.payroll_runs table
    const { error: upsertErr } = await supabase
      .from('payroll_runs')
      .upsert(
        {
          employee_id: employeeId,
          month_year: monthYear,
          normal_days_worked: result.normalDaysWorked,
          holiday_days_worked: result.holidayDaysWorked,
          total_normal_ot_hours: result.totalNormalOtHours,
          total_double_ot_hours: result.totalDoubleOtHours,
          base_pay: result.basePay,
          holiday_pay: result.holidayPay,
          normal_ot_pay: result.normalOtPay,
          double_ot_pay: result.doubleOtPay,
          employee_epf_8: result.employeeEpf8,
          employer_epf_12: result.employerEpf12,
          employer_etf_3: result.employerEtf3,
          advances_deducted: result.advancesDeducted,
          net_salary: result.netSalary,
          total_company_cost: result.totalCompanyCost,
          status: 'DRAFT',
        },
        { onConflict: 'employee_id,month_year' }
      );

    if (upsertErr) {
      console.error('[payrollRunsApi] upsert payroll_runs error:', upsertErr.message);
      throw upsertErr;
    }

    return result;
  },

  /**
   * Generates payroll runs for ALL active employees for a given month.
   */
  generateAllForMonth: async (monthYear: string): Promise<MonthlyPayrollCalculationResult[]> => {
    const activeEmployees = await payrollEmployeesApi.getAll('ACTIVE');
    const results: MonthlyPayrollCalculationResult[] = [];

    for (const emp of activeEmployees) {
      try {
        const res = await payrollRunsApi.generateForEmployee(emp.id, monthYear);
        results.push(res);
      } catch (err) {
        console.error(`[payrollRunsApi] Failed to generate payroll for ${emp.full_name}:`, err);
      }
    }

    return results;
  },

  /**
   * Updates advances and recalculates net salary for a run.
   */
  updateAdvances: async (
    id: string,
    advancesDeducted: number,
    netSalary: number
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('payroll_runs')
      .update({
        advances_deducted: Math.max(0, advancesDeducted),
        net_salary: Math.max(0, netSalary),
      })
      .eq('id', id);

    if (error) {
      console.error('[payrollRunsApi] updateAdvances error:', error.message);
      throw error;
    }
    return true;
  },

  /**
   * Updates the status of a payroll run ('DRAFT' | 'PAID').
   */
  updateStatus: async (id: string, status: 'DRAFT' | 'PAID'): Promise<boolean> => {
    const { error } = await supabase
      .from('payroll_runs')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('[payrollRunsApi] updateStatus error:', error.message);
      throw error;
    }
    return true;
  },

  /**
   * Marks a payroll run as PAID.
   */
  markAsPaid: async (id: string): Promise<boolean> => {
    return payrollRunsApi.updateStatus(id, 'PAID');
  },

  /**
   * Helper to query recorded POS cash shortages for an employee in a given month.
   */
  getPendingShortages: async (
    employeeName: string,
    monthYear: string
  ): Promise<{ totalShortage: number; records: { id: string; date: string; amount: number; notes?: string }[] }> => {
    if (!monthYear) return { totalShortage: 0, records: [] };
    const startDate = `${monthYear}-01`;
    const parts = monthYear.split('-');
    const y = parseInt(parts[0] || '2026', 10);
    const m = parseInt(parts[1] || '1', 10);
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const nextMonth = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    try {
      const { data, error } = await supabase
        .from('cashier_shortages')
        .select('id, shortage_date, amount, notes, cashier_name, deduction_status')
        .ilike('cashier_name', `%${employeeName.trim()}%`)
        .gte('shortage_date', startDate)
        .lt('shortage_date', nextMonth);

      if (error || !data) {
        return { totalShortage: 0, records: [] };
      }

      const matching = data.filter((row: any) => row.deduction_status !== 'deducted');
      const totalShortage = matching.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
      const records = matching.map((r: any) => ({
        id: r.id,
        date: r.shortage_date,
        amount: Number(r.amount || 0),
        notes: r.notes || undefined,
      }));

      return { totalShortage, records };
    } catch {
      return { totalShortage: 0, records: [] };
    }
  },
};
