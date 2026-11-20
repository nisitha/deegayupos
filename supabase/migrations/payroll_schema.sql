-- ============================================================================
-- DEEGAYU WEDA MADHURA — PAYROLL SCHEMA MIGRATION
-- Engine: Supabase PostgreSQL (Asia/Colombo Timezone)
-- ============================================================================

-- 1. Table: public.payroll_employees
CREATE TABLE IF NOT EXISTS public.payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_code VARCHAR(32) UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  nic TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  salary_type VARCHAR(16) NOT NULL DEFAULT 'DAILY' CHECK (salary_type IN ('DAILY', 'MONTHLY')),
  normal_daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 1200.00,
  holiday_daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 2800.00,
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ot_rate_type VARCHAR(16) NOT NULL DEFAULT 'FORMULA' CHECK (ot_rate_type IN ('FORMULA', 'FIXED_HOURLY')),
  fixed_ot_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shift_start_time TIME NOT NULL DEFAULT '08:30',
  shift_end_time TIME NOT NULL DEFAULT '17:30',
  break_minutes INT NOT NULL DEFAULT 60,
  epf_etf_eligible BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_payroll_employees_status ON public.payroll_employees(status);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_branch ON public.payroll_employees(branch_id);

-- 2. Table: public.payroll_special_days
CREATE TABLE IF NOT EXISTS public.payroll_special_days (
  date DATE PRIMARY KEY,
  title TEXT NOT NULL,
  holiday_category VARCHAR(32) NOT NULL DEFAULT 'COMMERCIAL' CHECK (holiday_category IN ('COMMERCIAL', 'PUBLIC', 'POYA', 'CUSTOM')),
  day_type VARCHAR(32) NOT NULL DEFAULT 'DOUBLE_OT' CHECK (day_type IN ('DOUBLE_OT', 'HOLIDAY_OFF'))
);

CREATE INDEX IF NOT EXISTS idx_payroll_special_days_date ON public.payroll_special_days(date);

-- 3. Table: public.payroll_attendance
CREATE TABLE IF NOT EXISTS public.payroll_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.payroll_employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  in_time TIMESTAMPTZ,
  out_time TIMESTAMPTZ,
  regular_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  normal_ot_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  double_ot_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  is_double_ot_day BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  CONSTRAINT uq_payroll_attendance_emp_date UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_attendance_date ON public.payroll_attendance(date);
CREATE INDEX IF NOT EXISTS idx_payroll_attendance_emp ON public.payroll_attendance(employee_id);

-- 4. Table: public.payroll_runs
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.payroll_employees(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- e.g. '2026-11'
  normal_days_worked INT NOT NULL DEFAULT 0,
  holiday_days_worked INT NOT NULL DEFAULT 0,
  total_normal_ot_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  total_double_ot_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  base_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  holiday_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  normal_ot_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  double_ot_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  employee_epf_8 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  employer_epf_12 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  employer_etf_3 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  advances_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_company_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PAID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_runs_emp_month UNIQUE(employee_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month ON public.payroll_runs(month_year);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_emp ON public.payroll_runs(employee_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_special_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users and anon clients (POS web client) to perform CRUD
DO $$
BEGIN
  -- Employees
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_employees' AND policyname = 'payroll_employees_access_policy') THEN
    CREATE POLICY "payroll_employees_access_policy" ON public.payroll_employees FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
  END IF;

  -- Special Days
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_special_days' AND policyname = 'payroll_special_days_access_policy') THEN
    CREATE POLICY "payroll_special_days_access_policy" ON public.payroll_special_days FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
  END IF;

  -- Attendance
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_attendance' AND policyname = 'payroll_attendance_access_policy') THEN
    CREATE POLICY "payroll_attendance_access_policy" ON public.payroll_attendance FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
  END IF;

  -- Payroll Runs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_runs' AND policyname = 'payroll_runs_access_policy') THEN
    CREATE POLICY "payroll_runs_access_policy" ON public.payroll_runs FOR ALL TO PUBLIC USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 6. SEED DATA: Active Staff
-- ============================================================================

INSERT INTO public.payroll_employees (
  emp_code, full_name, salary_type, normal_daily_rate, holiday_daily_rate,
  basic_salary, ot_rate_type, fixed_ot_rate, shift_start_time, shift_end_time,
  break_minutes, epf_etf_eligible, status
)
VALUES
  ('EMP-ANU', 'Anusha', 'DAILY', 1200.00, 2800.00, 0.00, 'FORMULA', 0.00, '08:30', '17:30', 60, true, 'ACTIVE'),
  ('EMP-GIN', 'Gindika', 'DAILY', 1200.00, 2800.00, 0.00, 'FORMULA', 0.00, '08:30', '17:30', 60, true, 'ACTIVE'),
  ('EMP-KUM', 'Kumari', 'DAILY', 1200.00, 2800.00, 0.00, 'FORMULA', 0.00, '08:30', '17:30', 60, true, 'ACTIVE'),
  ('EMP-SHA', 'Shashini', 'DAILY', 1200.00, 2800.00, 0.00, 'FORMULA', 0.00, '08:30', '17:30', 60, true, 'ACTIVE'),
  ('EMP-THA', 'Tharindu', 'DAILY', 1200.00, 2800.00, 0.00, 'FORMULA', 0.00, '08:30', '17:30', 60, true, 'ACTIVE')
ON CONFLICT (emp_code) DO NOTHING;

-- Seed Sri Lankan 2026 Core Holidays into public.payroll_special_days
INSERT INTO public.payroll_special_days (date, title, holiday_category, day_type)
VALUES
  ('2026-01-03', 'Duruthu Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-01-15', 'Tamil Thai Pongal Day', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-02-01', 'Navam Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-02-04', 'National Day (Independence Day)', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-02-15', 'Mahasivarathri Day', 'PUBLIC', 'DOUBLE_OT'),
  ('2026-03-03', 'Medin Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-03-20', 'Id-Ul-Fitr (Ramazan Festival Day)', 'PUBLIC', 'DOUBLE_OT'),
  ('2026-04-01', 'Bak Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-04-03', 'Good Friday', 'PUBLIC', 'DOUBLE_OT'),
  ('2026-04-13', 'Day prior to Sinhala & Tamil New Year Day', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-04-14', 'Sinhala & Tamil New Year Day', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-05-01', 'May Day (International Workers Day)', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-05-02', 'Day following Vesak Full Moon Poya Day', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-05-27', 'Id-Ul-Alha (Hadji Festival Day)', 'PUBLIC', 'DOUBLE_OT'),
  ('2026-05-30', 'Poson Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-06-29', 'Adhi Poson Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-07-28', 'Esala Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-08-25', 'Milad-Un-Nabi (Holy Prophet Birthday)', 'PUBLIC', 'DOUBLE_OT'),
  ('2026-08-27', 'Nikini Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-09-25', 'Binara Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-10-25', 'Vap Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-11-08', 'Deepavali Festival Day', 'COMMERCIAL', 'DOUBLE_OT'),
  ('2026-11-23', 'Il Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-12-23', 'Unduvap Full Moon Poya Day', 'POYA', 'DOUBLE_OT'),
  ('2026-12-25', 'Christmas Day', 'COMMERCIAL', 'DOUBLE_OT')
ON CONFLICT (date) DO NOTHING;
