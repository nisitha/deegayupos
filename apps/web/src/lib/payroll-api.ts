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
// NEW DTO INTERFACES FOR PAYROLL & HR MODULE (PART 1)
// ============================================================================

export interface EmployeeSalaryProfileDto {
  id: string;
  user_id: string;
  branch_id: string | null;
  employee_code: string | null;
  designation: string;
  basic_salary: number;
  fixed_allowance: number;
  attendance_bonus: number;
  epf_eligible: boolean;
  standard_daily_hours: number;
  ot_hourly_rate: number | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_no: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined / Computed fields
  full_name?: string;
  email?: string;
  branch_name?: string;
  computed_normal_ot_rate?: number;
  computed_double_ot_rate?: number;
}

export interface StaffAttendanceLogDto {
  id: string;
  user_id: string;
  branch_id: string | null;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'present' | 'half_day' | 'absent' | 'no_pay' | 'holiday';
  normal_ot_hours: number;
  double_ot_hours: number;
  is_double_ot_day: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  full_name?: string;
  employee_code?: string;
  branch_name?: string;
}

export interface PayrollHolidayDto {
  id: string;
  holiday_date: string;
  holiday_name: string;
  ot_multiplier: number;
}

export interface SalaryAdvanceDto {
  id: string;
  user_id: string;
  branch_id: string | null;
  advance_date: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'deducted';
  payroll_item_id: string | null;
  created_at?: string;
  // Joined fields
  full_name?: string;
  employee_code?: string;
  branch_name?: string;
}

export interface CashierShortageLedgerDto {
  id: string;
  adjustment_date: string;
  branch_id: string;
  branch_name: string;
  shift_id: string;
  shift_number: number;
  employee_id: string | null;
  user_id: string | null;
  employee_name: string;
  amount: number;
  notes: string | null;
  status: 'pending' | 'deducted' | 'waived' | 'deferred';
  payroll_item_id: string | null;
  created_at?: string;
}

export interface ShortageItemBreakdown {
  id: string;
  date: string;
  branch_name: string;
  shift_label: string;
  shift_id: string;
  amount: number;
  notes?: string;
}

export interface PayrollRunItemDto {
  id: string;
  payroll_run_id: string;
  user_id: string;
  branch_id?: string | null;
  basic_salary: number;
  fixed_allowance: number;
  attendance_bonus: number;
  present_days: number;
  no_pay_days: number;
  normal_ot_hours: number;
  normal_ot_pay: number;
  double_ot_hours: number;
  double_ot_pay: number;
  gross_pay: number;
  epf_employee_8: number;
  no_pay_deduction: number;
  salary_advance_deduction: number;
  shortage_deduction_total: number;
  shortage_items_json: ShortageItemBreakdown[];
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  epf_employer_12: number;
  etf_employer_3: number;
  // Joined fields for Pay Slip rendering & Table
  full_name?: string;
  employee_code?: string;
  designation?: string;
  branch_name?: string;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_no?: string | null;
}

export interface MasterPayrollRunDto {
  id: string;
  payroll_month: string;
  branch_id: string | null;
  status: 'draft' | 'approved' | 'paid' | 'DRAFT' | 'APPROVED' | 'PAID';
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_by?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  branch_name?: string;
  items: PayrollRunItemDto[];
}

// ============================================================================
// 1. SALARY PROFILES SERVICE
// ============================================================================

export async function getEmployeeSalaryProfiles(): Promise<EmployeeSalaryProfileDto[]> {
  const [profilesRes, usersRes, branchesRes] = await Promise.all([
    supabase
      .from('employee_salary_profiles')
      .select('*')
      .order('employee_code', { ascending: true }),
    supabase
      .from('users')
      .select('id, full_name, email'),
    supabase
      .from('branches')
      .select('id, name, code'),
  ]);

  if (profilesRes.error) {
    console.error('[payrollApi] getEmployeeSalaryProfiles error:', profilesRes.error.message);
    throw profilesRes.error;
  }

  const userMap = new Map<string, { full_name: string; email: string }>();
  (usersRes.data || []).forEach((u: any) => userMap.set(u.id, u));

  const branchMap = new Map<string, { name: string; code: string }>();
  (branchesRes.data || []).forEach((b: any) => branchMap.set(b.id, b));

  return (profilesRes.data || []).map((row: any) => {
    const basic = Number(row.basic_salary || 0);
    const hourlyBase = basic / 240;
    const computedNormal = row.ot_hourly_rate ? Number(row.ot_hourly_rate) : Math.round(hourlyBase * 1.5 * 100) / 100;
    const computedDouble = row.ot_hourly_rate ? Number(row.ot_hourly_rate) * (2.0 / 1.5) : Math.round(hourlyBase * 2.0 * 100) / 100;

    const u = userMap.get(row.user_id);
    const b = row.branch_id ? branchMap.get(row.branch_id) : undefined;

    return {
      id: row.id,
      user_id: row.user_id,
      branch_id: row.branch_id,
      employee_code: row.employee_code,
      designation: row.designation || 'Pharmacy Staff',
      basic_salary: basic,
      fixed_allowance: Number(row.fixed_allowance || 0),
      attendance_bonus: Number(row.attendance_bonus || 0),
      epf_eligible: row.epf_eligible !== false,
      standard_daily_hours: Number(row.standard_daily_hours || 8.0),
      ot_hourly_rate: row.ot_hourly_rate ? Number(row.ot_hourly_rate) : null,
      bank_name: row.bank_name,
      bank_branch: row.bank_branch,
      bank_account_no: row.bank_account_no,
      is_active: row.is_active !== false,
      created_at: row.created_at,
      updated_at: row.updated_at,
      full_name: u?.full_name || 'Staff Member',
      email: u?.email || '',
      branch_name: b?.name || 'Unassigned',
      computed_normal_ot_rate: computedNormal,
      computed_double_ot_rate: computedDouble,
    };
  });
}

export async function upsertEmployeeSalaryProfile(
  profile: Partial<EmployeeSalaryProfileDto>
): Promise<EmployeeSalaryProfileDto> {
  const payload = {
    user_id: profile.user_id,
    branch_id: profile.branch_id || null,
    employee_code: profile.employee_code || null,
    designation: profile.designation || 'Pharmacy Staff',
    basic_salary: Number(profile.basic_salary || 35000),
    fixed_allowance: Number(profile.fixed_allowance || 0),
    attendance_bonus: Number(profile.attendance_bonus || 0),
    epf_eligible: profile.epf_eligible !== false,
    standard_daily_hours: Number(profile.standard_daily_hours || 8.0),
    ot_hourly_rate: profile.ot_hourly_rate !== null && profile.ot_hourly_rate !== undefined ? Number(profile.ot_hourly_rate) : null,
    bank_name: profile.bank_name || null,
    bank_branch: profile.bank_branch || null,
    bank_account_no: profile.bank_account_no || null,
    is_active: profile.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('employee_salary_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[payrollApi] upsertEmployeeSalaryProfile error:', error.message);
    throw error;
  }
  return data;
}

// ============================================================================
// 2. ATTENDANCE & OT SERVICE
// ============================================================================

export async function getAttendanceLogs(
  month: string,
  branchId?: string
): Promise<StaffAttendanceLogDto[]> {
  const startDate = `${month}-01`;
  const parts = month.split('-');
  const y = parseInt(parts[0] || '2026', 10);
  const m = parseInt(parts[1] || '1', 10);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  let query = supabase
    .from('staff_attendance_logs')
    .select('*')
    .gte('work_date', startDate)
    .lt('work_date', nextMonth)
    .order('work_date', { ascending: false });

  if (branchId && branchId !== 'ALL' && branchId !== 'all') {
    query = query.eq('branch_id', branchId);
  }

  const [logsRes, usersRes, branchesRes, profilesRes] = await Promise.all([
    query,
    supabase.from('users').select('id, full_name'),
    supabase.from('branches').select('id, name'),
    supabase.from('employee_salary_profiles').select('user_id, employee_code'),
  ]);

  if (logsRes.error) {
    console.error('[payrollApi] getAttendanceLogs error:', logsRes.error.message);
    throw logsRes.error;
  }

  const userMap = new Map<string, string>();
  (usersRes.data || []).forEach((u: any) => userMap.set(u.id, u.full_name));

  const branchMap = new Map<string, string>();
  (branchesRes.data || []).forEach((b: any) => branchMap.set(b.id, b.name));

  const codeMap = new Map<string, string>();
  (profilesRes.data || []).forEach((p: any) => codeMap.set(p.user_id, p.employee_code));

  return (logsRes.data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    branch_id: row.branch_id,
    work_date: row.work_date,
    clock_in: row.clock_in,
    clock_out: row.clock_out,
    status: row.status || 'present',
    normal_ot_hours: Number(row.normal_ot_hours || 0),
    double_ot_hours: Number(row.double_ot_hours || 0),
    is_double_ot_day: Boolean(row.is_double_ot_day),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    full_name: userMap.get(row.user_id) || 'Staff Member',
    employee_code: codeMap.get(row.user_id) || 'EMP',
    branch_name: (row.branch_id && branchMap.get(row.branch_id)) || 'Main Store',
  }));
}

export async function upsertAttendanceLog(
  entry: Partial<StaffAttendanceLogDto>
): Promise<StaffAttendanceLogDto> {
  const payload = {
    user_id: entry.user_id,
    branch_id: entry.branch_id || null,
    work_date: entry.work_date,
    clock_in: entry.clock_in || null,
    clock_out: entry.clock_out || null,
    status: entry.status || 'present',
    normal_ot_hours: Number(entry.normal_ot_hours || 0),
    double_ot_hours: Number(entry.double_ot_hours || 0),
    is_double_ot_day: Boolean(entry.is_double_ot_day),
    notes: entry.notes || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('staff_attendance_logs')
    .upsert(payload, { onConflict: 'user_id,work_date' })
    .select()
    .single();

  if (error) {
    console.error('[payrollApi] upsertAttendanceLog error:', error.message);
    throw error;
  }
  return data;
}

export async function bulkImportAttendanceLogs(
  rows: Array<Partial<StaffAttendanceLogDto>>
): Promise<number> {
  if (!rows || rows.length === 0) return 0;

  const payloads = rows.map((entry) => ({
    user_id: entry.user_id,
    branch_id: entry.branch_id || null,
    work_date: entry.work_date,
    clock_in: entry.clock_in || null,
    clock_out: entry.clock_out || null,
    status: entry.status || 'present',
    normal_ot_hours: Number(entry.normal_ot_hours || 0),
    double_ot_hours: Number(entry.double_ot_hours || 0),
    is_double_ot_day: Boolean(entry.is_double_ot_day),
    notes: entry.notes || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('staff_attendance_logs')
    .upsert(payloads, { onConflict: 'user_id,work_date' });

  if (error) {
    console.error('[payrollApi] bulkImportAttendanceLogs error:', error.message);
    throw error;
  }
  return payloads.length;
}

export async function getHolidayCalendar(year?: number): Promise<PayrollHolidayDto[]> {
  let query = supabase
    .from('payroll_holiday_calendar')
    .select('*')
    .order('holiday_date', { ascending: true });

  if (year) {
    query = query.gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[payrollApi] getHolidayCalendar error:', error.message);
    throw error;
  }

  return (data || []).map((h: any) => ({
    id: h.id,
    holiday_date: h.holiday_date,
    holiday_name: h.holiday_name,
    ot_multiplier: Number(h.ot_multiplier || 2.0),
  }));
}

export async function addHoliday(
  date: string,
  name: string,
  multiplier: number = 2.0
): Promise<PayrollHolidayDto> {
  const { data, error } = await supabase
    .from('payroll_holiday_calendar')
    .upsert(
      {
        holiday_date: date,
        holiday_name: name,
        ot_multiplier: multiplier,
      },
      { onConflict: 'holiday_date' }
    )
    .select()
    .single();

  if (error) {
    console.error('[payrollApi] addHoliday error:', error.message);
    throw error;
  }
  return data;
}

export async function deleteHoliday(idOrDate: string): Promise<boolean> {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(idOrDate);
  const { error } = isDate
    ? await supabase.from('payroll_holiday_calendar').delete().eq('holiday_date', idOrDate)
    : await supabase.from('payroll_holiday_calendar').delete().eq('id', idOrDate);

  if (error) {
    console.error('[payrollApi] deleteHoliday error:', error.message);
    throw error;
  }
  return true;
}

// ============================================================================
// 3. CASHIER SHORTAGES & SALARY ADVANCES LEDGER SERVICE
// ============================================================================

export async function getCashierShortagesLedger(
  month?: string,
  branchId?: string
): Promise<CashierShortageLedgerDto[]> {
  let query = supabase
    .from('shift_financial_adjustments')
    .select('*')
    .order('adjustment_date', { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const parts = month.split('-');
    const y = parseInt(parts[0] || '2026', 10);
    const m = parseInt(parts[1] || '1', 10);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    query = query.gte('adjustment_date', startDate).lt('adjustment_date', nextMonth);
  }

  if (branchId && branchId !== 'ALL' && branchId !== 'all') {
    query = query.eq('branch_id', branchId);
  }

  const [adjRes, branchesRes] = await Promise.all([
    query,
    supabase.from('branches').select('id, name, code'),
  ]);

  if (adjRes.error) {
    console.error('[payrollApi] getCashierShortagesLedger error:', adjRes.error.message);
    throw adjRes.error;
  }

  const branchMap = new Map<string, string>();
  (branchesRes.data || []).forEach((b: any) => branchMap.set(b.id, b.name));

  return (adjRes.data || [])
    .filter((row: any) => row.adjustment_type === 'salary_deduction' || Number(row.amount) > 0)
    .map((row: any) => ({
      id: row.id,
      adjustment_date: String(row.adjustment_date).split('T')[0] || String(row.adjustment_date || ''),
      branch_id: row.branch_id,
      branch_name: branchMap.get(row.branch_id) || 'Main Branch',
      shift_id: row.shift_id,
      shift_number: Number(row.shift_number || 1),
      employee_id: row.employee_id || row.user_id || null,
      user_id: row.user_id || row.employee_id || null,
      employee_name: row.employee_name || 'Cashier',
      amount: Math.abs(Number(row.amount || 0)),
      notes: row.notes,
      status: (row.status || 'pending') as 'pending' | 'deducted' | 'waived' | 'deferred',
      payroll_item_id: row.payroll_item_id || null,
      created_at: row.created_at,
    }));
}

export async function updateShortageStatus(
  id: string,
  status: 'pending' | 'waived' | 'deferred' | 'deducted'
): Promise<boolean> {
  const { error } = await supabase
    .from('shift_financial_adjustments')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('[payrollApi] updateShortageStatus error:', error.message);
    throw error;
  }
  return true;
}

export async function getSalaryAdvances(
  month?: string,
  branchId?: string
): Promise<SalaryAdvanceDto[]> {
  let query = supabase
    .from('salary_advances')
    .select('*')
    .order('advance_date', { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const parts = month.split('-');
    const y = parseInt(parts[0] || '2026', 10);
    const m = parseInt(parts[1] || '1', 10);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    query = query.gte('advance_date', startDate).lt('advance_date', nextMonth);
  }

  if (branchId && branchId !== 'ALL' && branchId !== 'all') {
    query = query.eq('branch_id', branchId);
  }

  const [advRes, usersRes, branchesRes, profilesRes] = await Promise.all([
    query,
    supabase.from('users').select('id, full_name'),
    supabase.from('branches').select('id, name'),
    supabase.from('employee_salary_profiles').select('user_id, employee_code'),
  ]);

  if (advRes.error) {
    console.error('[payrollApi] getSalaryAdvances error:', advRes.error.message);
    throw advRes.error;
  }

  const userMap = new Map<string, string>();
  (usersRes.data || []).forEach((u: any) => userMap.set(u.id, u.full_name));

  const branchMap = new Map<string, string>();
  (branchesRes.data || []).forEach((b: any) => branchMap.set(b.id, b.name));

  const codeMap = new Map<string, string>();
  (profilesRes.data || []).forEach((p: any) => codeMap.set(p.user_id, p.employee_code));

  return (advRes.data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    branch_id: row.branch_id,
    advance_date: String(row.advance_date).split('T')[0] || String(row.advance_date || ''),
    amount: Number(row.amount || 0),
    reason: row.reason,
    status: row.status || 'pending',
    payroll_item_id: row.payroll_item_id || null,
    created_at: row.created_at,
    full_name: userMap.get(row.user_id) || 'Staff Member',
    employee_code: codeMap.get(row.user_id) || 'EMP',
    branch_name: (row.branch_id && branchMap.get(row.branch_id)) || 'Main Store',
  }));
}

export async function createSalaryAdvance(payload: {
  user_id: string;
  branch_id?: string | null;
  advance_date: string;
  amount: number;
  reason?: string;
}): Promise<SalaryAdvanceDto> {
  const { data, error } = await supabase
    .from('salary_advances')
    .insert({
      user_id: payload.user_id,
      branch_id: payload.branch_id || null,
      advance_date: payload.advance_date,
      amount: payload.amount,
      reason: payload.reason || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[payrollApi] createSalaryAdvance error:', error.message);
    throw error;
  }
  return data;
}

export async function updateSalaryAdvanceStatus(
  id: string,
  status: 'pending' | 'deducted'
): Promise<boolean> {
  const { error } = await supabase
    .from('salary_advances')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('[payrollApi] updateSalaryAdvanceStatus error:', error.message);
    throw error;
  }
  return true;
}

// ============================================================================
// 4. MONTHLY GROSS-TO-NET PAYROLL GENERATOR & APPROVAL LIFECYCLE (PART 2)
// ============================================================================

export async function generateMonthlyPayrollRun(
  payrollMonth: string,
  branchId?: string | null,
  createdBy?: string | null
): Promise<MasterPayrollRunDto> {
  // 1. Fetch active employee profiles, branches, and users
  const [profilesRes, usersRes, branchesRes] = await Promise.all([
    supabase
      .from('employee_salary_profiles')
      .select('*')
      .eq('is_active', true)
      .order('employee_code', { ascending: true }),
    supabase.from('users').select('id, full_name, email'),
    supabase.from('branches').select('id, name, code'),
  ]);

  if (profilesRes.error) {
    console.error('[payrollApi] generateMonthlyPayrollRun error fetching profiles:', profilesRes.error.message);
    throw profilesRes.error;
  }

  const userMap = new Map<string, { full_name: string; email: string }>();
  (usersRes.data || []).forEach((u: any) => userMap.set(u.id, u));

  const branchMap = new Map<string, { name: string; code: string }>();
  (branchesRes.data || []).forEach((b: any) => branchMap.set(b.id, b));

  let profiles = profilesRes.data || [];
  if (branchId && branchId !== 'ALL' && branchId !== 'all') {
    profiles = profiles.filter((p: any) => p.branch_id === branchId);
  }

  // 2. Date window for the month
  const startDate = `${payrollMonth}-01`;
  const parts = payrollMonth.split('-');
  const y = parseInt(parts[0] || '2026', 10);
  const m = parseInt(parts[1] || '1', 10);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  // 3. Fetch attendance logs, pending shortages, and pending salary advances in parallel
  const [attendanceRes, shortagesRes, advancesRes] = await Promise.all([
    supabase
      .from('staff_attendance_logs')
      .select('*')
      .gte('work_date', startDate)
      .lt('work_date', nextMonth),
    supabase
      .from('shift_financial_adjustments')
      .select('*')
      .gte('adjustment_date', startDate)
      .lt('adjustment_date', nextMonth),
    supabase
      .from('salary_advances')
      .select('*')
      .gte('advance_date', startDate)
      .lt('advance_date', nextMonth),
  ]);

  const allAttendance = attendanceRes.data || [];
  const allShortages = (shortagesRes.data || []).filter(
    (s: any) => s.status !== 'deducted' && s.status !== 'waived' && Number(s.amount || 0) !== 0
  );
  const allAdvances = (advancesRes.data || []).filter(
    (a: any) => a.status !== 'deducted' && Number(a.amount || 0) > 0
  );

  // 4. Compute line items for each active employee
  const itemsToInsert: any[] = [];
  let sumGross = 0;
  let sumDeductions = 0;
  let sumNet = 0;

  for (const prof of profiles) {
    const basic = Number(prof.basic_salary || 0);
    const allowance = Number(prof.fixed_allowance || 0);
    const standardBonus = Number(prof.attendance_bonus || 0);
    const hourlyBase = basic / 240;
    const normalOtRate = prof.ot_hourly_rate ? Number(prof.ot_hourly_rate) : Math.round(hourlyBase * 1.5 * 100) / 100;
    const doubleOtRate = prof.ot_hourly_rate ? Number(prof.ot_hourly_rate) * (2.0 / 1.5) : Math.round(hourlyBase * 2.0 * 100) / 100;

    // Attendance aggregation
    const empAttendance = allAttendance.filter((att: any) => att.user_id === prof.user_id);
    let presentDays = 0;
    let noPayDays = 0;
    let normalOtHours = 0;
    let doubleOtHours = 0;

    for (const att of empAttendance) {
      if (att.status === 'present') presentDays += 1;
      else if (att.status === 'half_day') presentDays += 0.5;
      else if (att.status === 'no_pay') noPayDays += 1;

      normalOtHours += Number(att.normal_ot_hours || 0);
      doubleOtHours += Number(att.double_ot_hours || 0);
    }

    // Sri Lanka standard overtime pay calculation
    const normalOtPay = Math.round(normalOtHours * normalOtRate * 100) / 100;
    const doubleOtPay = Math.round(doubleOtHours * doubleOtRate * 100) / 100;

    // Attendance bonus: forfeited if any no-pay leave taken
    const attendanceBonus = noPayDays > 0 ? 0 : standardBonus;

    // Gross Pay
    const grossPay = Math.round((basic + allowance + attendanceBonus + normalOtPay + doubleOtPay) * 100) / 100;

    // No-Pay leave deduction (basic / 26 days)
    const dailyWageRate = basic / 26;
    const noPayDeduction = Math.round(noPayDays * dailyWageRate * 100) / 100;

    // Statutory EPF base = max(0, Basic - NoPay)
    const epfBase = Math.max(0, basic - noPayDeduction);
    const epfEmployee8 = prof.epf_eligible ? Math.round(epfBase * 0.08 * 100) / 100 : 0;
    const epfEmployer12 = prof.epf_eligible ? Math.round(epfBase * 0.12 * 100) / 100 : 0;
    const etfEmployer3 = prof.epf_eligible ? Math.round(epfBase * 0.03 * 100) / 100 : 0;

    // Pending salary advances
    const empAdvances = allAdvances.filter((adv: any) => adv.user_id === prof.user_id);
    const salaryAdvanceDeduction = empAdvances.reduce((acc: number, adv: any) => acc + Number(adv.amount || 0), 0);

    // Itemized cashier shift shortages
    const uInfo = userMap.get(prof.user_id);
    const empShortages = allShortages.filter((s: any) => {
      if (s.user_id && s.user_id === prof.user_id) return true;
      if (s.employee_id && s.employee_id === prof.id) return true;
      if (uInfo && s.employee_name && s.employee_name.toLowerCase().includes(uInfo.full_name.toLowerCase())) return true;
      if (prof.employee_code && s.employee_name && s.employee_name.includes(prof.employee_code)) return true;
      return false;
    });

    const shortageBreakdowns: ShortageItemBreakdown[] = empShortages.map((s: any) => {
      const bObj = s.branch_id ? branchMap.get(s.branch_id) : undefined;
      const bName = bObj ? bObj.name : 'Branch';
      const shiftLabel = s.employee_name ? `Cashier: ${s.employee_name}` : 'Cashier Shift';
      return {
        id: s.id,
        date: String(s.adjustment_date).split('T')[0] || String(s.adjustment_date || ''),
        branch_name: bName,
        shift_label: shiftLabel,
        shift_id: s.shift_id || '',
        amount: Math.abs(Number(s.amount || 0)),
        notes: s.notes || undefined,
      };
    });

    const shortageDeductionTotal = shortageBreakdowns.reduce((acc, sb) => acc + sb.amount, 0);
    const otherDeductions = 0;

    // Total deductions & Net Pay
    const totalDeductions = Math.round((epfEmployee8 + noPayDeduction + salaryAdvanceDeduction + shortageDeductionTotal + otherDeductions) * 100) / 100;
    const netPay = Math.max(0, Math.round((grossPay - totalDeductions) * 100) / 100);

    sumGross += grossPay;
    sumDeductions += totalDeductions;
    sumNet += netPay;

    itemsToInsert.push({
      user_id: prof.user_id,
      branch_id: prof.branch_id || null,
      basic_salary: basic,
      fixed_allowance: allowance,
      attendance_bonus: attendanceBonus,
      present_days: presentDays,
      no_pay_days: noPayDays,
      normal_ot_hours: normalOtHours,
      normal_ot_pay: normalOtPay,
      double_ot_hours: doubleOtHours,
      double_ot_pay: doubleOtPay,
      gross_pay: grossPay,
      epf_employee_8: epfEmployee8,
      no_pay_deduction: noPayDeduction,
      salary_advance_deduction: salaryAdvanceDeduction,
      shortage_deduction_total: shortageDeductionTotal,
      shortage_items_json: shortageBreakdowns,
      other_deductions: otherDeductions,
      total_deductions: totalDeductions,
      net_pay: netPay,
      epf_employer_12: epfEmployer12,
      etf_employer_3: etfEmployer3,
      // Metadata for presentation
      full_name: uInfo?.full_name || 'Staff Member',
      employee_code: prof.employee_code || 'EMP',
      designation: prof.designation || 'Staff',
      branch_name: (prof.branch_id && branchMap.get(prof.branch_id)?.name) || 'Main Store',
      bank_name: prof.bank_name,
      bank_branch: prof.bank_branch,
      bank_account_no: prof.bank_account_no,
    });
  }

  // 5. Check if draft run already exists for this month & branch
  let existingQuery = supabase
    .from('payroll_runs')
    .select('id, status')
    .eq('payroll_month', payrollMonth);

  if (branchId && branchId !== 'ALL' && branchId !== 'all') {
    existingQuery = existingQuery.eq('branch_id', branchId);
  } else {
    existingQuery = existingQuery.is('branch_id', null);
  }

  const { data: existingRuns } = await existingQuery;
  let runId: string;

  if (existingRuns && existingRuns.length > 0) {
    const existing = existingRuns[0];
    if (existing?.status && (existing.status.toLowerCase() === 'paid' || existing.status.toLowerCase() === 'approved')) {
      throw new Error(`A finalized/paid payroll run for ${payrollMonth} already exists.`);
    }
    runId = existing!.id;
    // Update existing master record
    await supabase
      .from('payroll_runs')
      .update({
        total_gross: Math.round(sumGross * 100) / 100,
        total_deductions: Math.round(sumDeductions * 100) / 100,
        total_net: Math.round(sumNet * 100) / 100,
        status: 'draft',
      })
      .eq('id', runId);

    // Delete previous items to replace with fresh calculation
    await supabase.from('payroll_run_items').delete().eq('payroll_run_id', runId);
  } else {
    // Insert new master run
    const { data: newRun, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        payroll_month: payrollMonth,
        branch_id: branchId && branchId !== 'ALL' && branchId !== 'all' ? branchId : null,
        total_gross: Math.round(sumGross * 100) / 100,
        total_deductions: Math.round(sumDeductions * 100) / 100,
        total_net: Math.round(sumNet * 100) / 100,
        status: 'draft',
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (runErr || !newRun) {
      console.error('[payrollApi] Error inserting master payroll_run:', runErr?.message);
      throw runErr || new Error('Failed to create payroll run record.');
    }
    runId = newRun.id;
  }

  // 6. Insert child payroll_run_items
  const itemsToDb = itemsToInsert.map((item) => ({
    payroll_run_id: runId,
    user_id: item.user_id,
    branch_id: item.branch_id,
    basic_salary: item.basic_salary,
    fixed_allowance: item.fixed_allowance,
    attendance_bonus: item.attendance_bonus,
    present_days: item.present_days,
    no_pay_days: item.no_pay_days,
    normal_ot_hours: item.normal_ot_hours,
    normal_ot_pay: item.normal_ot_pay,
    double_ot_hours: item.double_ot_hours,
    double_ot_pay: item.double_ot_pay,
    gross_pay: item.gross_pay,
    epf_employee_8: item.epf_employee_8,
    no_pay_deduction: item.no_pay_deduction,
    salary_advance_deduction: item.salary_advance_deduction,
    shortage_deduction_total: item.shortage_deduction_total,
    shortage_items_json: item.shortage_items_json,
    other_deductions: item.other_deductions,
    total_deductions: item.total_deductions,
    net_pay: item.net_pay,
    epf_employer_12: item.epf_employer_12,
    etf_employer_3: item.etf_employer_3,
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from('payroll_run_items')
    .insert(itemsToDb)
    .select();

  if (itemsErr) {
    console.error('[payrollApi] Error inserting payroll_run_items:', itemsErr.message);
    throw itemsErr;
  }

  // Stitch back joined metadata with newly generated item IDs
  const fullItems: PayrollRunItemDto[] = (insertedItems || []).map((row: any, idx: number) => {
    const meta = itemsToInsert[idx];
    return {
      ...row,
      full_name: meta?.full_name || 'Staff Member',
      employee_code: meta?.employee_code || 'EMP',
      designation: meta?.designation || 'Staff',
      branch_name: meta?.branch_name || 'Main Store',
      bank_name: meta?.bank_name,
      bank_branch: meta?.bank_branch,
      bank_account_no: meta?.bank_account_no,
      shortage_items_json: row.shortage_items_json || [],
    };
  });

  return {
    id: runId,
    payroll_month: payrollMonth,
    branch_id: branchId && branchId !== 'ALL' && branchId !== 'all' ? branchId : null,
    status: 'draft',
    total_gross: Math.round(sumGross * 100) / 100,
    total_deductions: Math.round(sumDeductions * 100) / 100,
    total_net: Math.round(sumNet * 100) / 100,
    created_by: createdBy || null,
    items: fullItems,
  };
}

export async function getPayrollRuns(
  payrollMonth?: string,
  branchId?: string | null
): Promise<MasterPayrollRunDto[]> {
  let query = supabase
    .from('payroll_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (payrollMonth) {
    query = query.eq('payroll_month', payrollMonth);
  }
  if (branchId && branchId !== 'ALL' && branchId !== 'all') {
    query = query.eq('branch_id', branchId);
  }

  const [runsRes, usersRes, branchesRes, profilesRes] = await Promise.all([
    query,
    supabase.from('users').select('id, full_name, email'),
    supabase.from('branches').select('id, name, code'),
    supabase.from('employee_salary_profiles').select('*'),
  ]);

  if (runsRes.error) {
    console.error('[payrollApi] getPayrollRuns error:', runsRes.error.message);
    throw runsRes.error;
  }

  const runs = runsRes.data || [];
  if (runs.length === 0) return [];

  const runIds = runs.map((r: any) => r.id);
  const { data: itemsData, error: itemsErr } = await supabase
    .from('payroll_run_items')
    .select('*')
    .in('payroll_run_id', runIds)
    .order('created_at', { ascending: true });

  if (itemsErr) {
    console.error('[payrollApi] getPayrollRuns items error:', itemsErr.message);
    throw itemsErr;
  }

  const userMap = new Map<string, { full_name: string; email: string }>();
  (usersRes.data || []).forEach((u: any) => userMap.set(u.id, u));

  const branchMap = new Map<string, { name: string; code: string }>();
  (branchesRes.data || []).forEach((b: any) => branchMap.set(b.id, b));

  const profileMap = new Map<string, any>();
  (profilesRes.data || []).forEach((p: any) => profileMap.set(p.user_id, p));

  const itemsByRun = new Map<string, PayrollRunItemDto[]>();
  (itemsData || []).forEach((item: any) => {
    const u = userMap.get(item.user_id);
    const p = profileMap.get(item.user_id);
    const b = item.branch_id ? branchMap.get(item.branch_id) : (p?.branch_id ? branchMap.get(p.branch_id) : undefined);

    const dtoItem: PayrollRunItemDto = {
      ...item,
      basic_salary: Number(item.basic_salary || 0),
      fixed_allowance: Number(item.fixed_allowance || 0),
      attendance_bonus: Number(item.attendance_bonus || 0),
      present_days: Number(item.present_days || 0),
      no_pay_days: Number(item.no_pay_days || 0),
      normal_ot_hours: Number(item.normal_ot_hours || 0),
      normal_ot_pay: Number(item.normal_ot_pay || 0),
      double_ot_hours: Number(item.double_ot_hours || 0),
      double_ot_pay: Number(item.double_ot_pay || 0),
      gross_pay: Number(item.gross_pay || 0),
      epf_employee_8: Number(item.epf_employee_8 || 0),
      no_pay_deduction: Number(item.no_pay_deduction || 0),
      salary_advance_deduction: Number(item.salary_advance_deduction || 0),
      shortage_deduction_total: Number(item.shortage_deduction_total || 0),
      shortage_items_json: Array.isArray(item.shortage_items_json) ? item.shortage_items_json : [],
      other_deductions: Number(item.other_deductions || 0),
      total_deductions: Number(item.total_deductions || 0),
      net_pay: Number(item.net_pay || 0),
      epf_employer_12: Number(item.epf_employer_12 || 0),
      etf_employer_3: Number(item.etf_employer_3 || 0),
      full_name: u?.full_name || 'Staff Member',
      employee_code: p?.employee_code || 'EMP',
      designation: p?.designation || 'Staff',
      branch_name: b?.name || 'Main Store',
      bank_name: p?.bank_name,
      bank_branch: p?.bank_branch,
      bank_account_no: p?.bank_account_no,
    };

    const arr = itemsByRun.get(item.payroll_run_id) || [];
    arr.push(dtoItem);
    itemsByRun.set(item.payroll_run_id, arr);
  });

  return runs.map((r: any) => ({
    id: r.id,
    payroll_month: r.payroll_month || '',
    branch_id: r.branch_id,
    status: r.status ? (r.status.toLowerCase() as any) : 'draft',
    total_gross: Number(r.total_gross || 0),
    total_deductions: Number(r.total_deductions || 0),
    total_net: Number(r.total_net || 0),
    created_by: r.created_by,
    approved_at: r.approved_at,
    paid_at: r.paid_at,
    created_at: r.created_at,
    branch_name: r.branch_id ? branchMap.get(r.branch_id)?.name : 'All Branches Combined',
    items: itemsByRun.get(r.id) || [],
  }));
}

export async function updatePayrollItemOtherDeduction(
  itemId: string,
  otherDeductions: number
): Promise<boolean> {
  const { data: item, error: fetchErr } = await supabase
    .from('payroll_run_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchErr || !item) {
    console.error('[payrollApi] updatePayrollItemOtherDeduction item not found:', fetchErr?.message);
    throw fetchErr || new Error('Payroll item not found.');
  }

  const epf = Number(item.epf_employee_8 || 0);
  const noPay = Number(item.no_pay_deduction || 0);
  const adv = Number(item.salary_advance_deduction || 0);
  const shortages = Number(item.shortage_deduction_total || 0);
  const newOther = Math.max(0, Number(otherDeductions || 0));
  const newTotalDeductions = Math.round((epf + noPay + adv + shortages + newOther) * 100) / 100;
  const gross = Number(item.gross_pay || 0);
  const newNetPay = Math.max(0, Math.round((gross - newTotalDeductions) * 100) / 100);

  const { error: updateErr } = await supabase
    .from('payroll_run_items')
    .update({
      other_deductions: newOther,
      total_deductions: newTotalDeductions,
      net_pay: newNetPay,
    })
    .eq('id', itemId);

  if (updateErr) {
    console.error('[payrollApi] updatePayrollItemOtherDeduction update error:', updateErr.message);
    throw updateErr;
  }

  const runId = item.payroll_run_id;
  const { data: allItems } = await supabase
    .from('payroll_run_items')
    .select('gross_pay, total_deductions, net_pay')
    .eq('payroll_run_id', runId);

  if (allItems) {
    const sumGross = allItems.reduce((acc, i) => acc + Number(i.gross_pay || 0), 0);
    const sumDeductions = allItems.reduce((acc, i) => acc + Number(i.total_deductions || 0), 0);
    const sumNet = allItems.reduce((acc, i) => acc + Number(i.net_pay || 0), 0);

    await supabase
      .from('payroll_runs')
      .update({
        total_gross: Math.round(sumGross * 100) / 100,
        total_deductions: Math.round(sumDeductions * 100) / 100,
        total_net: Math.round(sumNet * 100) / 100,
      })
      .eq('id', runId);
  }

  return true;
}

export async function approveAndPayPayrollRun(runId: string): Promise<boolean> {
  const timestamp = new Date().toISOString();

  const { error: runErr } = await supabase
    .from('payroll_runs')
    .update({
      status: 'PAID',
      approved_at: timestamp,
      paid_at: timestamp,
    })
    .eq('id', runId);

  if (runErr) {
    console.error('[payrollApi] approveAndPayPayrollRun error updating run:', runErr.message);
    throw runErr;
  }

  const { data: items, error: itemsErr } = await supabase
    .from('payroll_run_items')
    .select('id, user_id, shortage_items_json, salary_advance_deduction')
    .eq('payroll_run_id', runId);

  if (itemsErr) {
    console.error('[payrollApi] approveAndPayPayrollRun error fetching items:', itemsErr.message);
    throw itemsErr;
  }

  for (const item of (items || [])) {
    if (Array.isArray(item.shortage_items_json) && item.shortage_items_json.length > 0) {
      const shortageIds = item.shortage_items_json
        .map((s: any) => s.id)
        .filter(Boolean);

      if (shortageIds.length > 0) {
        await supabase
          .from('shift_financial_adjustments')
          .update({
            status: 'deducted',
            payroll_item_id: item.id,
          })
          .in('id', shortageIds);
      }
    }

    if (Number(item.salary_advance_deduction || 0) > 0 && item.user_id) {
      await supabase
        .from('salary_advances')
        .update({
          status: 'deducted',
          payroll_item_id: item.id,
        })
        .eq('user_id', item.user_id)
        .eq('status', 'pending');
    }
  }

  return true;
}

// Grouped object export
export const payrollApi = {
  getEmployeeSalaryProfiles,
  upsertEmployeeSalaryProfile,
  getAttendanceLogs,
  upsertAttendanceLog,
  bulkImportAttendanceLogs,
  getHolidayCalendar,
  addHoliday,
  deleteHoliday,
  getCashierShortagesLedger,
  updateShortageStatus,
  getSalaryAdvances,
  createSalaryAdvance,
  updateSalaryAdvanceStatus,
  generateMonthlyPayrollRun,
  getPayrollRuns,
  updatePayrollItemOtherDeduction,
  approveAndPayPayrollRun,
};

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS (PRESERVING PREVIOUS PAGES)
// ============================================================================

export const payrollEmployeesApi = {
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

  update: async (id: string, payload: Partial<PayrollEmployee>): Promise<PayrollEmployee> => {
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

export const payrollSpecialDaysApi = {
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

export const payrollAttendanceApi = {
  getByMonth: async (monthYear: string, employeeId?: string): Promise<PayrollAttendance[]> => {
    const startDate = `${monthYear}-01`;
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

  generateForEmployee: async (
    employeeId: string,
    monthYear: string,
    advancesDeducted?: number
  ): Promise<MonthlyPayrollCalculationResult> => {
    const employee = await payrollEmployeesApi.getById(employeeId);
    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    const attendances = await payrollAttendanceApi.getByMonth(monthYear, employeeId);

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

    const result = calculateMonthlyPayroll({
      employee,
      monthYear,
      attendances,
      advancesDeducted: effectiveAdvances,
    });

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

  markAsPaid: async (id: string): Promise<boolean> => {
    return payrollRunsApi.updateStatus(id, 'PAID');
  },

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
        .from('shift_financial_adjustments')
        .select('id, adjustment_date, amount, notes, employee_name, status')
        .ilike('employee_name', `%${employeeName.trim()}%`)
        .gte('adjustment_date', startDate)
        .lt('adjustment_date', nextMonth);

      if (error || !data) {
        return { totalShortage: 0, records: [] };
      }

      const matching = data.filter((row: any) => row.status !== 'deducted' && row.status !== 'waived');
      const totalShortage = matching.reduce((sum: number, r: any) => sum + Math.abs(Number(r.amount || 0)), 0);
      const records = matching.map((r: any) => ({
        id: r.id,
        date: String(r.adjustment_date).split('T')[0] || String(r.adjustment_date || ''),
        amount: Math.abs(Number(r.amount || 0)),
        notes: r.notes || undefined,
      }));

      return { totalShortage, records };
    } catch {
      return { totalShortage: 0, records: [] };
    }
  },
};
