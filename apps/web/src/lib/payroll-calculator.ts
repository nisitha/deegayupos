import { z } from 'zod';

// ============================================================================
// 1. ZOD SCHEMAS & TYPES
// ============================================================================

export const SalaryTypeSchema = z.enum(['DAILY', 'MONTHLY']);
export type SalaryType = z.infer<typeof SalaryTypeSchema>;

export const OtRateTypeSchema = z.enum(['FORMULA', 'FIXED_HOURLY']);
export type OtRateType = z.infer<typeof OtRateTypeSchema>;

export const EmployeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

export const HolidayCategorySchema = z.enum(['COMMERCIAL', 'PUBLIC', 'POYA', 'CUSTOM']);
export type HolidayCategory = z.infer<typeof HolidayCategorySchema>;

export const DayTypeSchema = z.enum(['DOUBLE_OT', 'HOLIDAY_OFF']);
export type DayType = z.infer<typeof DayTypeSchema>;

export const PayrollRunStatusSchema = z.enum(['DRAFT', 'PAID']);
export type PayrollRunStatus = z.infer<typeof PayrollRunStatusSchema>;

export const PayrollEmployeeSchema = z.object({
  id: z.string().uuid(),
  emp_code: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  nic: z.string().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  branch_name: z.string().optional(),
  salary_type: SalaryTypeSchema.default('DAILY'),
  normal_daily_rate: z.number().nonnegative().default(1200.0),
  holiday_daily_rate: z.number().nonnegative().default(2800.0),
  basic_salary: z.number().nonnegative().default(0.0),
  ot_rate_type: OtRateTypeSchema.default('FORMULA'),
  fixed_ot_rate: z.number().nonnegative().default(0.0),
  shift_start_time: z.string().default('08:30'),
  shift_end_time: z.string().default('17:30'),
  break_minutes: z.number().int().nonnegative().default(60),
  epf_etf_eligible: z.boolean().default(true),
  status: EmployeeStatusSchema.default('ACTIVE'),
  created_at: z.string().optional(),
});
export type PayrollEmployee = z.infer<typeof PayrollEmployeeSchema>;

export const PayrollSpecialDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  holiday_category: HolidayCategorySchema.default('COMMERCIAL'),
  day_type: DayTypeSchema.default('DOUBLE_OT'),
});
export type PayrollSpecialDay = z.infer<typeof PayrollSpecialDaySchema>;

export const PayrollAttendanceSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  in_time: z.string().nullable().optional(),
  out_time: z.string().nullable().optional(),
  regular_hours: z.number().nonnegative().default(0),
  normal_ot_hours: z.number().nonnegative().default(0),
  double_ot_hours: z.number().nonnegative().default(0),
  is_double_ot_day: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});
export type PayrollAttendance = z.infer<typeof PayrollAttendanceSchema>;

export const PayrollRunSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  month_year: z.string().regex(/^\d{4}-\d{2}$/),
  normal_days_worked: z.number().int().nonnegative().default(0),
  holiday_days_worked: z.number().int().nonnegative().default(0),
  total_normal_ot_hours: z.number().nonnegative().default(0),
  total_double_ot_hours: z.number().nonnegative().default(0),
  base_pay: z.number().nonnegative().default(0),
  holiday_pay: z.number().nonnegative().default(0),
  normal_ot_pay: z.number().nonnegative().default(0),
  double_ot_pay: z.number().nonnegative().default(0),
  employee_epf_8: z.number().nonnegative().default(0),
  employer_epf_12: z.number().nonnegative().default(0),
  employer_etf_3: z.number().nonnegative().default(0),
  advances_deducted: z.number().nonnegative().default(0),
  net_salary: z.number().nonnegative().default(0),
  total_company_cost: z.number().nonnegative().default(0),
  status: PayrollRunStatusSchema.default('DRAFT'),
  created_at: z.string().optional(),
});
export type PayrollRun = z.infer<typeof PayrollRunSchema>;

// ============================================================================
// 2. MATHEMATICAL CALCULATION INTERFACES
// ============================================================================

export interface CalculateDailyHoursParams {
  inTime: Date | string;
  outTime: Date | string;
  shiftEndTime?: string; // e.g. "17:30"
  breakMinutes?: number; // e.g. 60
  isDoubleOtDay?: boolean;
}

export interface DailyHoursResult {
  regularHours: number;
  normalOtHours: number;
  doubleOtHours: number;
  totalWorkedHours: number;
  grossDurationHours: number;
}

export interface CalculateOtPayParams {
  salaryType: SalaryType;
  normalDailyRate: number;
  basicSalary: number;
  otRateType: OtRateType;
  fixedOtRate: number;
  normalOtHours: number;
  doubleOtHours: number;
}

export interface OtPayResult {
  normalOtPay: number;
  doubleOtPay: number;
  totalOtPay: number;
  hourlyBaseRate: number;
}

export interface StatutoryContributionsResult {
  employeeEpf8: number;
  employerEpf12: number;
  employerEtf3: number;
  totalEpf20: number;
  totalCompanyStatutory: number;
}

export interface MonthlyPayrollCalculationResult {
  employeeId: string;
  empCode: string;
  fullName: string;
  monthYear: string;
  salaryType: SalaryType;
  normalDailyRate: number;
  holidayDailyRate: number;
  totalDaysWorked: number;
  normalDaysWorked: number;
  holidayDaysWorked: number;
  totalNormalOtHours: number;
  totalDoubleOtHours: number;
  basePay: number;
  holidayPay: number;
  normalOtPay: number;
  doubleOtPay: number;
  totalOtPay: number;
  grossPay: number;
  employeeEpf8: number;
  employerEpf12: number;
  employerEtf3: number;
  totalEpf20: number;
  advancesDeducted: number;
  netSalary: number;
  totalCompanyCost: number;
}

// ============================================================================
// 3. PURE CALCULATION ENGINE
// ============================================================================

/**
 * Rounds hours DOWN to the nearest 15-minute (0.25h) increment.
 * e.g., 1.45h -> 1.25h, 1.74h -> 1.50h, 1.75h -> 1.75h.
 */
export function roundToQuarterHour(hours: number): number {
  if (hours <= 0) return 0;
  return Math.floor((hours + 0.0001) * 4) / 4;
}

/**
 * Rounds monetary amounts to 2 decimal places with epsilon safety.
 */
export function roundCurrency(val: number): number {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Pure calculation function: calculateDailyHours
 * - Calculates total worked duration between inTime and outTime.
 * - Deducts meal break_minutes ONLY when worked duration exceeds 4.0 hours.
 * - Holiday / Double OT Day:
 *   * First 8.0h count as Holiday Shift Hours (regularHours), paid at holiday_daily_rate.
 *   * Hours after 8.0h (Math.max(0, workedHours - 8.0)) = Double OT (2.0x, 0.25h precision).
 *   * Normal OT is 0.
 * - Normal Working Day:
 *   * Hours after shift_end_time = Normal OT (1.5x, 0.25h precision).
 *   * Double OT is 0.
 *   * Regular hours = worked hours minus normal OT hours.
 */
export function calculateDailyHours(params: CalculateDailyHoursParams): DailyHoursResult {
  const {
    inTime,
    outTime,
    shiftEndTime = '17:30',
    breakMinutes = 60,
    isDoubleOtDay = false,
  } = params;

  const inDate = new Date(inTime);
  let outDate = new Date(outTime);

  // Handle overnight shifts rolling past midnight
  if (outDate.getTime() < inDate.getTime()) {
    outDate = new Date(outDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const durationMs = outDate.getTime() - inDate.getTime();
  if (durationMs <= 0) {
    return {
      regularHours: 0,
      normalOtHours: 0,
      doubleOtHours: 0,
      totalWorkedHours: 0,
      grossDurationHours: 0,
    };
  }

  const grossMinutes = Math.floor(durationMs / (1000 * 60));
  const grossDurationHours = roundCurrency(grossMinutes / 60);

  // Deduct break minutes ONLY when worked duration > 4 hours
  let effectiveBreakMinutes = 0;
  if (grossMinutes > 240) {
    effectiveBreakMinutes = breakMinutes || 0;
  }

  const netWorkedMinutes = Math.max(0, grossMinutes - effectiveBreakMinutes);
  const totalWorkedHours = roundCurrency(netWorkedMinutes / 60);

  // 1. Holiday / Double OT Day Rule
  if (isDoubleOtDay) {
    const regularHours = Math.min(8.0, totalWorkedHours);
    const doubleOtHours = roundToQuarterHour(Math.max(0, totalWorkedHours - 8.0));
    return {
      regularHours: roundCurrency(regularHours),
      normalOtHours: 0,
      doubleOtHours,
      totalWorkedHours,
      grossDurationHours,
    };
  }

  // 2. Normal Day Rule
  const [endH, endM] = (shiftEndTime || '17:30').split(':').map((v) => parseInt(v, 10));
  const scheduledShiftEndDate = new Date(inDate);
  scheduledShiftEndDate.setHours(endH || 17, endM || 30, 0, 0);

  let otMinutes = 0;
  if (outDate.getTime() > scheduledShiftEndDate.getTime()) {
    otMinutes = Math.floor((outDate.getTime() - scheduledShiftEndDate.getTime()) / (1000 * 60));
  }

  // Cap OT minutes at net worked minutes
  otMinutes = Math.min(netWorkedMinutes, otMinutes);
  const normalOtHours = roundToQuarterHour(otMinutes / 60);
  const regularHours = roundCurrency(Math.max(0, totalWorkedHours - normalOtHours));

  return {
    regularHours,
    normalOtHours,
    doubleOtHours: 0,
    totalWorkedHours,
    grossDurationHours,
  };
}

/**
 * Calculates hourly base rate:
 * - FIXED_HOURLY: uses fixed_ot_rate.
 * - FORMULA:
 *   * DAILY employee: normal_daily_rate / 8 standard hours
 *   * MONTHLY employee: basic_salary / 240 standard hours
 */
export function calculateHourlyBaseRate(params: {
  salaryType: SalaryType;
  normalDailyRate: number;
  basicSalary: number;
  otRateType: OtRateType;
  fixedOtRate: number;
}): number {
  const { salaryType, normalDailyRate, basicSalary, otRateType, fixedOtRate } = params;

  if (otRateType === 'FIXED_HOURLY' && fixedOtRate > 0) {
    return roundCurrency(fixedOtRate);
  }

  if (salaryType === 'DAILY') {
    const rate = Number(normalDailyRate) > 0 ? Number(normalDailyRate) : 1200.0;
    return roundCurrency(rate / 8.0);
  } else {
    const basic = Number(basicSalary) > 0 ? Number(basicSalary) : 0.0;
    return roundCurrency(basic / 240.0);
  }
}

/**
 * Calculates Overtime Pay:
 * - Normal OT: Hourly Base Rate * 1.5
 * - Double OT: Hourly Base Rate * 2.0
 */
export function calculateOtPay(params: CalculateOtPayParams): OtPayResult {
  const { normalOtHours, doubleOtHours } = params;

  const hourlyBaseRate = calculateHourlyBaseRate(params);

  const normalOtPay = roundCurrency(normalOtHours * (hourlyBaseRate * 1.5));
  const doubleOtPay = roundCurrency(doubleOtHours * (hourlyBaseRate * 2.0));
  const totalOtPay = roundCurrency(normalOtPay + doubleOtPay);

  return {
    normalOtPay,
    doubleOtPay,
    totalOtPay,
    hourlyBaseRate,
  };
}

/**
 * Sri Lankan Labor Law Statutory EPF/ETF:
 * - Employee EPF: 8% (deducted from gross earnings)
 * - Employer EPF: 12% (company contribution)
 * - Employer ETF: 3% (company contribution)
 * - Total C-Form Contribution: 20%
 *
 * CRITICAL RULE: EPF/ETF applies strictly to qualifying earnings (Base Pay + Holiday Pay).
 * Overtime (Normal OT & Double OT) is statutory-exempt.
 */
export function calculateStatutoryContributions(
  qualifyingEarnings: number,
  eligible: boolean = true
): StatutoryContributionsResult {
  if (!eligible || qualifyingEarnings <= 0) {
    return {
      employeeEpf8: 0,
      employerEpf12: 0,
      employerEtf3: 0,
      totalEpf20: 0,
      totalCompanyStatutory: 0,
    };
  }

  const earnings = roundCurrency(qualifyingEarnings);
  const employeeEpf8 = roundCurrency(earnings * 0.08);
  const employerEpf12 = roundCurrency(earnings * 0.12);
  const employerEtf3 = roundCurrency(earnings * 0.03);
  const totalEpf20 = roundCurrency(employeeEpf8 + employerEpf12);
  const totalCompanyStatutory = roundCurrency(employerEpf12 + employerEtf3);

  return {
    employeeEpf8,
    employerEpf12,
    employerEtf3,
    totalEpf20,
    totalCompanyStatutory,
  };
}

/**
 * Aggregates monthly payroll figures for an employee:
 * - Base Pay & Holiday Pay
 * - Normal & Double Overtime Pay
 * - EPF 8%, 12%, and ETF 3%
 * - Advance Deductions
 * - Net Salary & Total Employer Cost
 */
export function calculateMonthlyPayroll(params: {
  employee: PayrollEmployee;
  monthYear: string;
  attendances: PayrollAttendance[];
  advancesDeducted?: number;
}): MonthlyPayrollCalculationResult {
  const { employee, monthYear, attendances, advancesDeducted = 0 } = params;

  // Filter worked days (days with logged hours)
  const workedDays = attendances.filter(
    (att) => (att.regular_hours || 0) > 0 || (att.normal_ot_hours || 0) > 0 || (att.double_ot_hours || 0) > 0
  );

  const holidayDaysWorked = workedDays.filter((att) => att.is_double_ot_day === true).length;
  const normalDaysWorked = workedDays.length - holidayDaysWorked;
  const totalDaysWorked = workedDays.length;

  const totalNormalOtHours = roundToQuarterHour(
    workedDays.reduce((sum, att) => sum + (att.normal_ot_hours || 0), 0)
  );
  const totalDoubleOtHours = roundToQuarterHour(
    workedDays.reduce((sum, att) => sum + (att.double_ot_hours || 0), 0)
  );

  const salaryType = employee.salary_type || 'DAILY';
  const normalDailyRate = Number(employee.normal_daily_rate) > 0 ? Number(employee.normal_daily_rate) : 1200.0;
  const holidayDailyRate = Number(employee.holiday_daily_rate) > 0 ? Number(employee.holiday_daily_rate) : 2800.0;
  const basicSalary = Number(employee.basic_salary) > 0 ? Number(employee.basic_salary) : 0.0;

  // Base Pay and Holiday Pay
  let basePay = 0;
  let holidayPay = 0;

  if (salaryType === 'DAILY') {
    basePay = roundCurrency(normalDaysWorked * normalDailyRate);
    holidayPay = roundCurrency(holidayDaysWorked * holidayDailyRate);
  } else {
    basePay = roundCurrency(basicSalary);
    const effectiveHolidayDailyRate = holidayDailyRate > 0 ? holidayDailyRate : roundCurrency(basicSalary / 25.0);
    holidayPay = roundCurrency(holidayDaysWorked * effectiveHolidayDailyRate);
  }

  // Overtime Calculation
  const otResult = calculateOtPay({
    salaryType,
    normalDailyRate,
    basicSalary,
    otRateType: employee.ot_rate_type || 'FORMULA',
    fixedOtRate: Number(employee.fixed_ot_rate || 0),
    normalOtHours: totalNormalOtHours,
    doubleOtHours: totalDoubleOtHours,
  });

  // Statutory EPF / ETF (on basePay + holidayPay)
  const qualifyingEarnings = roundCurrency(basePay + holidayPay);
  const statutory = calculateStatutoryContributions(
    qualifyingEarnings,
    employee.epf_etf_eligible !== false
  );

  const safeAdvances = roundCurrency(Math.max(0, advancesDeducted));
  const grossPay = roundCurrency(basePay + holidayPay + otResult.totalOtPay);
  const netSalary = roundCurrency(Math.max(0, grossPay - statutory.employeeEpf8 - safeAdvances));
  const totalCompanyCost = roundCurrency(grossPay + statutory.employerEpf12 + statutory.employerEtf3);

  return {
    employeeId: employee.id,
    empCode: employee.emp_code,
    fullName: employee.full_name,
    monthYear,
    salaryType,
    normalDailyRate,
    holidayDailyRate,
    totalDaysWorked,
    normalDaysWorked,
    holidayDaysWorked,
    totalNormalOtHours,
    totalDoubleOtHours,
    basePay,
    holidayPay,
    normalOtPay: otResult.normalOtPay,
    doubleOtPay: otResult.doubleOtPay,
    totalOtPay: otResult.totalOtPay,
    grossPay,
    employeeEpf8: statutory.employeeEpf8,
    employerEpf12: statutory.employerEpf12,
    employerEtf3: statutory.employerEtf3,
    totalEpf20: statutory.totalEpf20,
    advancesDeducted: safeAdvances,
    netSalary,
    totalCompanyCost,
  };
}
