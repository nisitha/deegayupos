import { supabase } from './supabase';

export interface DenominationBreakdown {
  [key: number]: number;
}

export const SRI_LANKA_DENOMINATIONS = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

export const SRI_LANKA_BANKS = [
  'BOC',
  'NSB',
  'NTB',
  'Commercial Bank',
  'Sampath Bank',
  'HNB',
  "People's Bank",
  'Seylan Bank',
  'Pan Asia Bank',
  'DFCC Bank',
  'NDB Bank',
  'Union Bank',
  'Amana Bank',
  'Cargills Bank',
] as const;

export interface DailyCashReconciliationRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  reconciliation_date: string;
  opening_float_a: number;
  cash_expenses_b: number;
  denominations: Record<string, number>;
  physical_cash_c: number;
  actual_net_income_d: number;
  total_bank_deposits_e: number;
  closing_cash_f: number;
  system_cash_sales: number;
  variance_amount: number;
  status: 'balanced' | 'shortage' | 'overage';
  notes: string | null;
  submitted_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BankDepositItem {
  id?: string;
  bank_name: string;
  account_number: string;
  account_name?: string;
  amount: number;
  deposit_reference?: string;
  deposited_by?: string;
}

export interface CashierSalesSummary {
  cashier_id: string;
  cashier_name: string;
  cash_sales: number;
  bill_count: number;
}

export interface CashierShortageItem {
  id: string;
  tenant_id: string;
  reconciliation_id: string;
  branch_id: string;
  staff_id: string | null;
  cashier_name: string;
  shortage_date: string;
  amount: number;
  deduction_status: 'pending_payroll' | 'deducted';
  notes: string | null;
  deducted_at: string | null;
  created_at: string;
}

export interface CompanyBankAccountRecord {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_name: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface DailyAccountsLedgerRecord {
  id: string;
  tenant_id: string;
  branch_id: string;
  reconciliation_id: string | null;
  entry_date: string;
  actual_net_income: number;
  system_sales: number;
  cash_expenses: number;
  banked_amount: number;
  closing_cash: number;
  variance: number;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface ReconciliationPayload {
  tenantId: string;
  branchId: string;
  reconciliationDate: string; // YYYY-MM-DD
  openingFloatA: number;
  cashExpensesB: number;
  denominations: Record<number, number>;
  physicalCashC: number;
  actualNetIncomeD: number;
  totalBankDepositsE: number;
  closingCashF: number;
  systemCashSales: number;
  varianceAmount: number;
  status: 'balanced' | 'shortage' | 'overage';
  notes?: string;
  submittedBy?: string;
  bankDeposits: BankDepositItem[];
  shortageAttributions?: {
    cashier_id?: string;
    cashier_name: string;
    amount: number;
  }[];
}

/**
 * Returns date bounds in Sri Lanka Timezone (UTC+05:30) for a given YYYY-MM-DD string.
 */
export function getSriLankaDateBounds(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+05:30`).toISOString();
  const end = new Date(`${dateStr}T23:59:59.999+05:30`).toISOString();
  return { start, end };
}

export const reconciliationApi = {
  /**
   * Fetch company bank accounts for the tenant.
   */
  async getBankAccounts(tenantId: string): Promise<CompanyBankAccountRecord[]> {
    try {
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('bank_name', { ascending: true });

      if (error) {
        console.warn('[ReconciliationApi] getBankAccounts error:', error.message);
        return [];
      }
      return (data || []) as CompanyBankAccountRecord[];
    } catch (err) {
      console.error('[ReconciliationApi] getBankAccounts fatal:', err);
      return [];
    }
  },

  /**
   * Add a new company bank account.
   */
  async addBankAccount(account: {
    tenant_id: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    branch_name?: string;
  }): Promise<CompanyBankAccountRecord | null> {
    try {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .insert({
          id,
          tenant_id: account.tenant_id,
          bank_name: account.bank_name,
          account_number: account.account_number,
          account_name: account.account_name,
          branch_name: account.branch_name || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[ReconciliationApi] addBankAccount error:', error.message);
        return null;
      }
      return data as CompanyBankAccountRecord;
    } catch (err) {
      console.error('[ReconciliationApi] addBankAccount fatal:', err);
      return null;
    }
  },

  /**
   * Load existing reconciliation (if already saved) and calculate live daily cash sales
   * plus yesterday's closing cash for opening float A.
   */
  async loadReconciliationWorksheet(branchId: string, dateStr: string) {
    const { start, end } = getSriLankaDateBounds(dateStr);

    try {
      // 1. Check if reconciliation already exists for this branch and date
      const { data: existingRec } = await supabase
        .from('daily_cash_reconciliations')
        .select('*')
        .eq('branch_id', branchId)
        .eq('reconciliation_date', dateStr)
        .maybeSingle();

      // 2. Fetch existing bank deposits if reconciliation exists
      let existingDeposits: BankDepositItem[] = [];
      if (existingRec) {
        const { data: depData } = await supabase
          .from('daily_bank_deposits')
          .select('*')
          .eq('reconciliation_id', existingRec.id);
        if (depData) {
          existingDeposits = depData.map((d: any) => ({
            id: d.id,
            bank_name: d.bank_name,
            account_number: d.account_number,
            account_name: d.account_name,
            amount: Number(d.amount) || 0,
            deposit_reference: d.deposit_reference,
            deposited_by: d.deposited_by,
          }));
        }
      }

      // 3. Find previous day's closing cash (Float F) to serve as Float A
      let previousClosingF: number | null = null;
      const { data: prevRec } = await supabase
        .from('daily_cash_reconciliations')
        .select('closing_cash_f, reconciliation_date')
        .eq('branch_id', branchId)
        .lt('reconciliation_date', dateStr)
        .order('reconciliation_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevRec && prevRec.closing_cash_f !== undefined && prevRec.closing_cash_f !== null) {
        previousClosingF = Number(prevRec.closing_cash_f);
      }

      // 4. Query sales completed on this day to compute System Cash Sales and Cashier breakdown
      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('id, total_amount, cashier_id, cashier_name, status, created_at, sale_payments(payment_method, amount)')
        .eq('branch_id', branchId)
        .gte('created_at', start)
        .lte('created_at', end)
        .neq('status', 'VOIDED');

      if (salesErr) {
        console.warn('[ReconciliationApi] sales query error:', salesErr.message);
      }

      let systemCashSales = 0;
      const cashierMap = new Map<string, CashierSalesSummary>();

      if (salesData && salesData.length > 0) {
        for (const s of salesData) {
          const payments = (s as any).sale_payments || [];
          let saleCashAmt = 0;

          if (payments.length > 0) {
            for (const p of payments) {
              const pm = (p.payment_method || '').toUpperCase();
              if (pm.includes('CASH') || pm === 'CASH') {
                saleCashAmt += Number(p.amount) || 0;
              }
            }
          } else {
            // Default: if no separate payments row, assume cash
            saleCashAmt = Number(s.total_amount) || 0;
          }

          if (saleCashAmt > 0) {
            systemCashSales += saleCashAmt;

            const cId = s.cashier_id || 'unassigned';
            const cName = s.cashier_name || 'Terminal Cashier';
            const existing = cashierMap.get(cId) || {
              cashier_id: cId,
              cashier_name: cName,
              cash_sales: 0,
              bill_count: 0,
            };
            existing.cash_sales += saleCashAmt;
            existing.bill_count += 1;
            cashierMap.set(cId, existing);
          }
        }
      }

      // 5. Query any recorded cash drawer pay-outs / cash expenses
      let autoCashExpenses = 0;
      try {
        const { data: drawerEvents } = await supabase
          .from('cash_drawer_events')
          .select('amount, event_type, created_at')
          .eq('event_type', 'PAY_OUT')
          .gte('created_at', start)
          .lte('created_at', end);

        if (drawerEvents && drawerEvents.length > 0) {
          autoCashExpenses = drawerEvents.reduce((acc, ev) => acc + (Number(ev.amount) || 0), 0);
        }
      } catch (err) {
        console.warn('[ReconciliationApi] cash_drawer_events error:', err);
      }

      return {
        existingRec: existingRec as DailyCashReconciliationRecord | null,
        existingDeposits,
        previousClosingF,
        systemCashSales,
        autoCashExpenses,
        cashierBreakdown: Array.from(cashierMap.values()),
      };
    } catch (err) {
      console.error('[ReconciliationApi] loadReconciliationWorksheet error:', err);
      return {
        existingRec: null,
        existingDeposits: [],
        previousClosingF: null,
        systemCashSales: 0,
        autoCashExpenses: 0,
        cashierBreakdown: [],
      };
    }
  },

  /**
   * Submit end-of-day reconciliation:
   * 1. Upserts `daily_cash_reconciliations`
   * 2. Replaces rows in `daily_bank_deposits`
   * 3. Posts to `daily_accounts_ledger`
   * 4. If shortage exists, creates rows in `cashier_shortages`
   */
  async submitReconciliation(payload: ReconciliationPayload) {
    const {
      tenantId,
      branchId,
      reconciliationDate,
      openingFloatA,
      cashExpensesB,
      denominations,
      physicalCashC,
      actualNetIncomeD,
      totalBankDepositsE,
      closingCashF,
      systemCashSales,
      varianceAmount,
      status,
      notes,
      submittedBy,
      bankDeposits,
      shortageAttributions,
    } = payload;

    // 1. Generate or determine reconciliation record id
    const recId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;

    // Upsert into daily_cash_reconciliations using (branch_id, reconciliation_date)
    const { data: recData, error: recError } = await supabase
      .from('daily_cash_reconciliations')
      .upsert(
        {
          id: recId,
          tenant_id: tenantId,
          branch_id: branchId,
          reconciliation_date: reconciliationDate,
          opening_float_a: openingFloatA,
          cash_expenses_b: cashExpensesB,
          denominations,
          physical_cash_c: physicalCashC,
          actual_net_income_d: actualNetIncomeD,
          total_bank_deposits_e: totalBankDepositsE,
          closing_cash_f: closingCashF,
          system_cash_sales: systemCashSales,
          variance_amount: varianceAmount,
          status,
          notes: notes || null,
          submitted_by: submittedBy || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id,reconciliation_date' }
      )
      .select()
      .single();

    if (recError) {
      throw new Error(`Failed to save reconciliation: ${recError.message}`);
    }

    const savedRecId = recData.id;

    // 2. Save Bank Deposits
    // Delete existing deposits for this reconciliation to prevent duplicates
    await supabase.from('daily_bank_deposits').delete().eq('reconciliation_id', savedRecId);

    if (bankDeposits && bankDeposits.length > 0) {
      const depositInserts = bankDeposits
        .filter((d) => d.amount > 0 && d.bank_name)
        .map((d) => ({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined,
          tenant_id: tenantId,
          reconciliation_id: savedRecId,
          bank_name: d.bank_name,
          account_number: d.account_number,
          account_name: d.account_name || null,
          amount: d.amount,
          deposit_reference: d.deposit_reference || null,
          deposited_by: d.deposited_by || null,
        }));

      if (depositInserts.length > 0) {
        const { error: depError } = await supabase.from('daily_bank_deposits').insert(depositInserts);
        if (depError) {
          console.warn('[ReconciliationApi] Failed to insert bank deposits:', depError.message);
        }
      }
    }

    // 3. Post to daily_accounts_ledger
    const ledgerId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
    const { error: ledgerError } = await supabase
      .from('daily_accounts_ledger')
      .upsert(
        {
          id: ledgerId,
          tenant_id: tenantId,
          branch_id: branchId,
          reconciliation_id: savedRecId,
          entry_date: reconciliationDate,
          actual_net_income: actualNetIncomeD,
          system_sales: systemCashSales,
          cash_expenses: cashExpensesB,
          banked_amount: totalBankDepositsE,
          closing_cash: closingCashF,
          variance: varianceAmount,
          status: 'posted',
          notes: notes || null,
        },
        { onConflict: 'branch_id,entry_date' }
      );

    if (ledgerError) {
      console.warn('[ReconciliationApi] Failed to post daily accounts ledger:', ledgerError.message);
    }

    // 4. Record Cashier Shortage if variance indicates a shortage
    if (status === 'shortage' && shortageAttributions && shortageAttributions.length > 0) {
      // Remove any existing pending shortage for this reconciliation
      await supabase
        .from('cashier_shortages')
        .delete()
        .eq('reconciliation_id', savedRecId)
        .eq('deduction_status', 'pending_payroll');

      const shortageInserts = shortageAttributions
        .filter((s) => s.amount > 0)
        .map((s) => ({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined,
          tenant_id: tenantId,
          reconciliation_id: savedRecId,
          branch_id: branchId,
          staff_id: s.cashier_id && s.cashier_id !== 'unassigned' ? s.cashier_id : null,
          cashier_name: s.cashier_name,
          shortage_date: reconciliationDate,
          amount: s.amount,
          deduction_status: 'pending_payroll',
          notes: `Automatic cash drawer shortage attribution for ${reconciliationDate}`,
        }));

      if (shortageInserts.length > 0) {
        const { error: shortageErr } = await supabase.from('cashier_shortages').insert(shortageInserts);
        if (shortageErr) {
          console.warn('[ReconciliationApi] Failed to record cashier shortages:', shortageErr.message);
        }
      }
    }

    return recData as DailyCashReconciliationRecord;
  },

  /**
   * Fetch all cashier shortages for payroll deduction review.
   */
  async getShortages(branchId?: string, statusFilter?: 'all' | 'pending_payroll' | 'deducted'): Promise<CashierShortageItem[]> {
    try {
      let query = supabase
        .from('cashier_shortages')
        .select('*')
        .order('shortage_date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('deduction_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[ReconciliationApi] getShortages error:', error.message);
        return [];
      }
      return (data || []) as CashierShortageItem[];
    } catch (err) {
      console.error('[ReconciliationApi] getShortages fatal:', err);
      return [];
    }
  },

  /**
   * Mark a cashier shortage as deducted from salary/payroll.
   */
  async markShortageDeducted(shortageId: string, notes?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cashier_shortages')
        .update({
          deduction_status: 'deducted',
          deducted_at: new Date().toISOString(),
          notes: notes ? notes : undefined,
        })
        .eq('id', shortageId);

      if (error) {
        console.error('[ReconciliationApi] markShortageDeducted error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[ReconciliationApi] markShortageDeducted fatal:', err);
      return false;
    }
  },

  /**
   * Fetch daily accounts ledger history.
   */
  async getAccountsLedger(branchId?: string, limit = 30): Promise<DailyAccountsLedgerRecord[]> {
    try {
      let query = supabase
        .from('daily_accounts_ledger')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(limit);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[ReconciliationApi] getAccountsLedger error:', error.message);
        return [];
      }
      return (data || []) as DailyAccountsLedgerRecord[];
    } catch (err) {
      console.error('[ReconciliationApi] getAccountsLedger fatal:', err);
      return [];
    }
  },
};
