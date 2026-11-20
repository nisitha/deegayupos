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
  card_sales?: number;
  qr_sales?: number;
  credit_sales?: number;
  total_sales?: number;
  bill_count: number;
}

export interface ShiftHandoverSummary {
  id: string;
  shift_number: number;
  shift_date: string;
  cashier_id: string;
  cashier_name: string;
  branch_id: string;
  branch_name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  pos_total_bills: number;
  pos_cash_sales: number;
  pos_card_sales: number;
  pos_qr_sales: number;
  pos_credit_sales: number;
  pos_gross_sales: number;
  modaka_total_sold_qty?: number;
  modaka_total_amount?: number;
  opening_float: number;
  declared_shift_sale: number;
  total_cash_available: number;
  goods_purchased_paid: number;
  other_expenses: number;
  expected_cash_before_bank: number;
  counted_drawer_cash: number;
  banked_amount: number;
  closing_drawer_float: number;
  cash_variance: number;
  expected_remaining_drawer_cash?: number;
  counted_remaining_drawer_cash?: number;
  tally_status?: string;
  salary_deduction_amount?: number;
  extra_income_amount?: number;
  denominations_json: Record<string, number>;
  handover_notes: string | null;
}

export interface ReconciliationWorksheetData {
  existingRec: DailyCashReconciliationRecord | null;
  existingDeposits: BankDepositItem[];
  previousClosingF: number | null;
  systemCashSales: number;
  systemCardSales: number;
  systemQrSales: number;
  systemCreditSales: number;
  totalGrossSales: number;
  totalCompletedBills: number;
  modakaSalesTotal: number;
  modakaUnitsTotal: number;
  autoCashExpenses: number;
  cashierBreakdown: CashierSalesSummary[];
  shifts: ShiftHandoverSummary[];
  isHistorical: boolean;
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

export interface ConsolidatedReconciliationRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string;
  reconciliation_date: string;
  opening_float_a: number;
  cash_expenses_b: number;
  denominations: Record<number, number>;
  physical_cash_c: number;
  actual_net_income_d: number;
  total_bank_deposits_e: number;
  closing_cash_f: number;
  system_cash_sales: number;
  variance_amount: number;
  status: 'balanced' | 'shortage' | 'overage';
  notes: string | null;
  submitted_by: string | null;
  submitter_name: string;
  created_at?: string;
  updated_at?: string;
  bank_deposits?: BankDepositItem[];
}

export interface ConsolidatedBankDepositRow {
  id: string;
  reconciliation_id: string;
  reconciliation_date: string;
  branch_id: string;
  branch_name: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  amount: number;
  deposit_reference: string | null;
  deposited_by: string | null;
  created_at?: string;
}

export interface CashierShortageRow extends CashierShortageItem {
  branch_name: string;
}

export interface ConsolidatedLedgerRow extends DailyAccountsLedgerRecord {
  branch_name: string;
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
export function getSriLankaDateBounds(dateStr: string, endDateStr?: string) {
  const start = new Date(`${dateStr}T00:00:00+05:30`).toISOString();
  const end = new Date(`${endDateStr || dateStr}T23:59:59.999+05:30`).toISOString();
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
   * Aggregates live & historical sales across payment methods (Cash, Card, QR, Credit)
   * and queries shift handovers (cashier_shifts) for the selected date and branch.
   */
  async loadReconciliationWorksheet(branchId: string, dateStr: string, endDateStr?: string): Promise<ReconciliationWorksheetData> {
    const { start, end } = getSriLankaDateBounds(dateStr, endDateStr);
    const isAllBranches = !branchId || branchId === 'ALL';
    const isRange = Boolean(endDateStr && endDateStr !== dateStr);

    try {
      // 1. Fetch branches & users for enrichment
      const [{ data: branchesData }, { data: usersData }] = await Promise.all([
        supabase.from('branches').select('id, name'),
        supabase.from('users').select('id, full_name, email'),
      ]);
      const branchMap = new Map<string, string>();
      (branchesData || []).forEach((b: any) => branchMap.set(b.id, b.name));
      const userMap = new Map<string, string>();
      (usersData || []).forEach((u: any) => userMap.set(u.id, u.full_name || u.email || 'Staff Cashier'));

      // 2. Check if reconciliation already exists for this branch/all and date
      let recQuery = supabase.from('daily_cash_reconciliations').select('*');
      if (isRange) {
        recQuery = recQuery.gte('reconciliation_date', dateStr).lte('reconciliation_date', endDateStr!);
      } else {
        recQuery = recQuery.eq('reconciliation_date', dateStr);
      }
      if (!isAllBranches) {
        recQuery = recQuery.eq('branch_id', branchId);
      }
      const { data: recList } = await recQuery;
      const existingRec = recList && recList.length > 0 ? (recList[0] as DailyCashReconciliationRecord) : null;

      // 3. Fetch existing bank deposits if reconciliation exists
      let existingDeposits: BankDepositItem[] = [];
      if (recList && recList.length > 0) {
        const recIds = recList.map((r: any) => r.id);
        const { data: depData } = await supabase
          .from('daily_bank_deposits')
          .select('*')
          .in('reconciliation_id', recIds);
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

      // 4. Find previous day's closing cash (Float F) to serve as Float A
      let previousClosingF: number | null = null;
      let prevRecQuery = supabase
        .from('daily_cash_reconciliations')
        .select('closing_cash_f, reconciliation_date')
        .lt('reconciliation_date', dateStr)
        .order('reconciliation_date', { ascending: false })
        .limit(1);
      if (!isAllBranches) {
        prevRecQuery = prevRecQuery.eq('branch_id', branchId);
      }
      const { data: prevRec } = await prevRecQuery.maybeSingle();
      if (prevRec && prevRec.closing_cash_f !== undefined && prevRec.closing_cash_f !== null) {
        previousClosingF = Number(prevRec.closing_cash_f);
      }

      // 5. Query live & historical sales for that date + branch (using sold_at index)
      let salesQuery = supabase
        .from('sales')
        .select('id, invoice_number, branch_id, cashier_id, cashier_name, total_amount, paid_amount, payment_method, status, sold_at, created_at, shift_id, legacy_sale_id, sale_payments(payment_method, amount)')
        .gte('sold_at', start)
        .lte('sold_at', end)
        .is('legacy_sale_id', null)
        .not('invoice_number', 'ilike', 'LEG-SALE-%');
      if (!isAllBranches) {
        salesQuery = salesQuery.eq('branch_id', branchId);
      }

      const { data: salesData, error: salesErr } = await salesQuery;
      if (salesErr) {
        console.warn('[ReconciliationApi] sales query error:', salesErr.message);
      }

      let totalCompletedBills = 0;
      let totalGrossSales = 0;
      let systemCashSales = 0;
      let systemCardSales = 0;
      let systemQrSales = 0;
      let systemCreditSales = 0;
      const cashierMap = new Map<string, CashierSalesSummary>();

      if (salesData && salesData.length > 0) {
        for (const s of salesData) {
          const inv = String(s.invoice_number || '');
          if (inv.startsWith('LEG-SALE-') || s.legacy_sale_id) continue;

          const st = String(s.status || '').toUpperCase();
          if (['VOID', 'VOIDED', 'CANCELLED', 'CANCELED', 'REFUNDED'].includes(st)) continue;
          if (st !== 'COMPLETED' && st !== 'PAID') continue;

          totalCompletedBills++;
          const tot = Number(s.total_amount ?? s.paid_amount ?? 0);
          totalGrossSales += tot;

          const payments = (s as any).sale_payments || [];
          let saleCash = 0;
          let saleCard = 0;
          let saleQr = 0;
          let saleCredit = 0;

          if (payments.length > 0) {
            for (const p of payments) {
              const pm = (p.payment_method || '').toUpperCase();
              const pAmt = Number(p.amount) || 0;
              if (pm === 'CASH') saleCash += pAmt;
              else if (pm === 'CARD') saleCard += pAmt;
              else if (pm === 'QR_PAYMENT' || pm === 'LANKA_QR') saleQr += pAmt;
              else if (pm === 'CUSTOMER_CREDIT' || pm === 'STORE_CREDIT') saleCredit += pAmt;
              else saleCash += pAmt;
            }
            saleCash = Math.min(saleCash, tot);
          } else {
            const pm = String(s.payment_method || 'CASH').toUpperCase();
            if (pm === 'CASH') saleCash = tot;
            else if (pm === 'CARD') saleCard = tot;
            else if (pm === 'QR_PAYMENT' || pm === 'LANKA_QR') saleQr = tot;
            else if (pm === 'CUSTOMER_CREDIT' || pm === 'STORE_CREDIT') saleCredit = tot;
            else saleCash = tot;
          }

          systemCashSales += saleCash;
          systemCardSales += saleCard;
          systemQrSales += saleQr;
          systemCreditSales += saleCredit;

          const cId = s.cashier_id || 'unassigned';
          const cName = s.cashier_name || userMap.get(cId) || 'Terminal Cashier';
          const existing = cashierMap.get(cId) || {
            cashier_id: cId,
            cashier_name: cName,
            cash_sales: 0,
            card_sales: 0,
            qr_sales: 0,
            credit_sales: 0,
            total_sales: 0,
            bill_count: 0,
          };
          existing.cash_sales += saleCash;
          existing.card_sales = (existing.card_sales || 0) + saleCard;
          existing.qr_sales = (existing.qr_sales || 0) + saleQr;
          existing.credit_sales = (existing.credit_sales || 0) + saleCredit;
          existing.total_sales = (existing.total_sales || 0) + tot;
          existing.bill_count += 1;
          cashierMap.set(cId, existing);
        }
      }

      // 6. Query cashier_shifts for that date + branch
      let shiftQuery = supabase
        .from('cashier_shifts')
        .select('*');
      if (isRange) {
        shiftQuery = shiftQuery
          .gte('shift_date', dateStr)
          .lte('shift_date', endDateStr!)
          .order('shift_date', { ascending: false })
          .order('shift_number', { ascending: true });
      } else {
        shiftQuery = shiftQuery
          .eq('shift_date', dateStr)
          .order('shift_number', { ascending: true });
      }
      if (!isAllBranches) {
        shiftQuery = shiftQuery.eq('branch_id', branchId);
      }
      const { data: shiftRows, error: shiftErr } = await shiftQuery;
      if (shiftErr) {
        console.warn('[ReconciliationApi] cashier_shifts error:', shiftErr.message);
      }

      const shifts: ShiftHandoverSummary[] = (shiftRows || []).map((sh: any) => {
        let posCash = Number(sh.pos_cash_sales) || 0;
        let posBills = Number(sh.pos_total_bills) || 0;
        let posGross = Number(sh.pos_gross_sales) || 0;

        // If shift is currently open and salesData exists, calculate live POS cash accurately
        if (sh.status === 'open' && salesData && salesData.length > 0) {
          const shiftStartEpoch = sh.started_at ? Date.parse(sh.started_at) : NaN;
          const shiftEndEpoch = sh.ended_at ? Date.parse(sh.ended_at) : Infinity;
          let openCash = 0;
          let openBills = 0;
          let openGross = 0;

          salesData.forEach((s: any) => {
            const st = String(s.status || '').toUpperCase();
            if (['VOID', 'VOIDED', 'CANCELLED', 'CANCELED', 'REFUNDED'].includes(st)) return;
            if (st !== 'COMPLETED' && st !== 'PAID') return;

            let belongs = false;
            if (s.shift_id === sh.id) {
              belongs = true;
            } else if (!s.shift_id && !isNaN(shiftStartEpoch)) {
              const saleEpoch = Date.parse(s.sold_at || s.created_at || '');
              if (!isNaN(saleEpoch) && saleEpoch >= shiftStartEpoch - 30000 && saleEpoch <= shiftEndEpoch + 30000) {
                belongs = true;
              }
            }

            if (!belongs) return;

            const tot = Number(s.total_amount ?? s.paid_amount ?? 0);
            openGross += tot;

            const payments = (s as any).sale_payments || [];
            let bCash = 0;
            if (payments.length > 0) {
              payments.forEach((p: any) => {
                if (String(p.payment_method || '').toUpperCase() === 'CASH') {
                  bCash += Number(p.amount || 0);
                }
              });
              bCash = Math.min(bCash, tot);
            } else {
              if (String(s.payment_method || 'CASH').toUpperCase() === 'CASH') {
                bCash = tot;
              }
            }

            if (bCash > 0) {
              openCash += bCash;
              openBills += 1;
            }
          });

          if (openCash > 0 || openBills > 0) {
            posCash = openCash;
            posBills = openBills;
            posGross = openGross;
          }
        }

        const openingF = Number(sh.opening_float || 0);
        const specialStockAmt = Number(sh.modaka_total_amount || 0);
        const goodsPaid = Number(sh.goods_purchased_paid || 0);
        const expenses = Number(sh.other_expenses || 0);
        const banked = Number(sh.banked_amount || 0);

        // Expected Remaining Drawer Cash: round2((opening + pos_cash + special) - (purchases + expenses + banked))
        const expectedRemainingCash = Math.round(
          ((openingF + posCash + specialStockAmt) - (goodsPaid + expenses + banked)) * 100
        ) / 100;

        // Cashier Declared Remaining Drawer: round2(closing_float)
        const declaredRemainingCash = Math.round(
          Number(sh.closing_float ?? sh.closing_drawer_float ?? sh.counted_remaining_drawer_cash ?? sh.counted_drawer_cash ?? 0) * 100
        ) / 100;

        // Variance: round2(declared - expected)
        const variance = sh.status === 'closed'
          ? Math.round((declaredRemainingCash - expectedRemainingCash) * 100) / 100
          : 0;

        let tallyStatus = sh.tally_status || (sh.status === 'closed' ? 'balanced' : 'open');
        let salaryDeduction = Number(sh.salary_deduction_amount) || 0;
        let extraIncome = Number(sh.extra_income_amount) || 0;

        if (sh.status === 'closed') {
          if (variance < -0.01) {
            tallyStatus = 'shortage';
            salaryDeduction = Math.abs(variance);
            extraIncome = 0;
          } else if (variance > 0.01) {
            tallyStatus = 'excess';
            extraIncome = variance;
            salaryDeduction = 0;
          } else {
            tallyStatus = 'balanced';
            salaryDeduction = 0;
            extraIncome = 0;
          }
        }

        return {
          id: sh.id,
          shift_number: Number(sh.shift_number) || 1,
          shift_date: sh.shift_date,
          cashier_id: sh.cashier_id,
          cashier_name: userMap.get(sh.cashier_id) || sh.cashier_name || 'Staff Cashier',
          branch_id: sh.branch_id,
          branch_name: branchMap.get(sh.branch_id) || 'Main Branch',
          status: sh.status || 'open',
          started_at: sh.started_at,
          ended_at: sh.ended_at,
          pos_total_bills: posBills,
          pos_cash_sales: posCash,
          pos_card_sales: Number(sh.pos_card_sales) || 0,
          pos_qr_sales: Number(sh.pos_qr_sales) || 0,
          pos_credit_sales: Number(sh.pos_credit_sales) || 0,
          pos_gross_sales: posGross,
          modaka_total_sold_qty: Number(sh.modaka_total_sold_qty) || 0,
          modaka_total_amount: Number(sh.modaka_total_amount) || 0,
          opening_float: openingF,
          declared_shift_sale: Number(sh.declared_shift_sale) || posCash,
          total_cash_available: Math.round((openingF + posCash + specialStockAmt) * 100) / 100,
          goods_purchased_paid: goodsPaid,
          other_expenses: expenses,
          expected_cash_before_bank: Math.round(((openingF + posCash + specialStockAmt) - (goodsPaid + expenses)) * 100) / 100,
          counted_drawer_cash: declaredRemainingCash,
          banked_amount: banked,
          closing_drawer_float: declaredRemainingCash,
          cash_variance: variance,
          expected_remaining_drawer_cash: expectedRemainingCash,
          counted_remaining_drawer_cash: declaredRemainingCash,
          tally_status: tallyStatus,
          salary_deduction_amount: salaryDeduction,
          extra_income_amount: extraIncome,
          denominations_json: (sh.denominations_json || {}) as Record<string, number>,
          handover_notes: sh.handover_notes || null,
        };
      });

      // 7. Modaka Sales Aggregation across shifts & shift_modaka_entries
      let modakaSalesTotal = shifts.reduce((acc, sh) => acc + (sh.modaka_total_amount || 0), 0);
      let modakaUnitsTotal = shifts.reduce((acc, sh) => acc + (sh.modaka_total_sold_qty || 0), 0);

      if (modakaSalesTotal === 0 && shifts.length > 0) {
        try {
          const shiftIds = shifts.map((s) => s.id);
          const { data: sme } = await supabase
            .from('shift_modaka_entries')
            .select('sold_qty, total_amount')
            .in('shift_id', shiftIds);
          if (sme && sme.length > 0) {
            modakaUnitsTotal = sme.reduce((sum: number, r: any) => sum + Number(r.sold_qty || 0), 0);
            modakaSalesTotal = sme.reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
          }
        } catch (e) {
          console.warn('[ReconciliationApi] shift_modaka_entries error:', e);
        }
      } else if (modakaSalesTotal === 0) {
        try {
          let smeQuery = supabase
            .from('shift_modaka_entries')
            .select('sold_qty, total_amount')
            .gte('created_at', start)
            .lte('created_at', end);
          if (!isAllBranches) {
            smeQuery = smeQuery.eq('branch_id', branchId);
          }
          const { data: sme } = await smeQuery;
          if (sme && sme.length > 0) {
            modakaUnitsTotal = sme.reduce((sum: number, r: any) => sum + Number(r.sold_qty || 0), 0);
            modakaSalesTotal = sme.reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
          }
        } catch (e) {
          // ignore
        }
      }

      // 8. Auto cash expenses (drawer events)
      let autoCashExpenses = 0;
      try {
        let drawerEventsQuery = supabase
          .from('cash_drawer_events')
          .select('amount, event_type, created_at')
          .eq('event_type', 'PAY_OUT')
          .gte('created_at', start)
          .lte('created_at', end);
        if (!isAllBranches) {
          drawerEventsQuery = drawerEventsQuery.eq('branch_id', branchId);
        }
        const { data: drawerEvents } = await drawerEventsQuery;
        if (drawerEvents && drawerEvents.length > 0) {
          autoCashExpenses = drawerEvents.reduce((acc: number, ev: any) => acc + (Number(ev.amount) || 0), 0);
        }
      } catch (err) {
        console.warn('[ReconciliationApi] cash_drawer_events error:', err);
      }

      // If shifts have other_expenses or goods_purchased_paid, combine them
      if (shifts.length > 0) {
        const shiftExpenses = shifts.reduce((acc, sh) => acc + sh.other_expenses + sh.goods_purchased_paid, 0);
        if (shiftExpenses > autoCashExpenses) {
          autoCashExpenses = shiftExpenses;
        }
      }

      const isHistorical = !existingRec && shifts.length === 0 && totalCompletedBills > 0;

      return {
        existingRec,
        existingDeposits,
        previousClosingF,
        systemCashSales,
        systemCardSales,
        systemQrSales,
        systemCreditSales,
        totalGrossSales,
        totalCompletedBills,
        modakaSalesTotal,
        modakaUnitsTotal,
        autoCashExpenses,
        cashierBreakdown: Array.from(cashierMap.values()),
        shifts,
        isHistorical,
      };
    } catch (err) {
      console.error('[ReconciliationApi] loadReconciliationWorksheet error:', err);
      return {
        existingRec: null,
        existingDeposits: [],
        previousClosingF: null,
        systemCashSales: 0,
        systemCardSales: 0,
        systemQrSales: 0,
        systemCreditSales: 0,
        totalGrossSales: 0,
        totalCompletedBills: 0,
        modakaSalesTotal: 0,
        modakaUnitsTotal: 0,
        autoCashExpenses: 0,
        cashierBreakdown: [],
        shifts: [],
        isHistorical: false,
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

  /**
   * Fetch multi-branch consolidated reconciliation history with filters.
   */
  async getReconciliationHistory(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<ConsolidatedReconciliationRow[]> {
    try {
      let query = supabase
        .from('daily_cash_reconciliations')
        .select('*')
        .order('reconciliation_date', { ascending: false });

      if (params?.branchId && params.branchId !== 'ALL') {
        query = query.eq('branch_id', params.branchId);
      }
      if (params?.startDate) {
        query = query.gte('reconciliation_date', params.startDate);
      }
      if (params?.endDate) {
        query = query.lte('reconciliation_date', params.endDate);
      }
      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }

      const { data: recs, error } = await query;
      if (error) {
        console.warn('[ReconciliationApi] getReconciliationHistory error:', error.message);
      }

      // Fetch branches, users, and deposits for complete enrichment
      const [{ data: branches }, { data: users }, { data: deposits }] = await Promise.all([
        supabase.from('branches').select('id, name'),
        supabase.from('users').select('id, full_name, email'),
        supabase.from('daily_bank_deposits').select('*'),
      ]);

      const branchMap = new Map<string, string>();
      (branches || []).forEach((b: any) => branchMap.set(b.id, b.name));

      const userMap = new Map<string, string>();
      (users || []).forEach((u: any) => userMap.set(u.id, u.full_name || u.email || 'Staff Cashier'));

      const depositsMap = new Map<string, BankDepositItem[]>();
      (deposits || []).forEach((d: any) => {
        const list = depositsMap.get(d.reconciliation_id) || [];
        list.push({
          id: d.id,
          bank_name: d.bank_name,
          account_number: d.account_number,
          account_name: d.account_name,
          amount: Number(d.amount) || 0,
          deposit_reference: d.deposit_reference,
          deposited_by: d.deposited_by,
        });
        depositsMap.set(d.reconciliation_id, list);
      });

      const existingRows: ConsolidatedReconciliationRow[] = (recs || []).map((r: any) => ({
        id: r.id,
        tenant_id: r.tenant_id,
        branch_id: r.branch_id,
        branch_name: branchMap.get(r.branch_id) || 'Unknown Branch',
        reconciliation_date: r.reconciliation_date,
        opening_float_a: Number(r.opening_float_a) || 0,
        cash_expenses_b: Number(r.cash_expenses_b) || 0,
        denominations: (r.denominations || {}) as Record<number, number>,
        physical_cash_c: Number(r.physical_cash_c) || 0,
        actual_net_income_d: Number(r.actual_net_income_d) || 0,
        total_bank_deposits_e: Number(r.total_bank_deposits_e) || 0,
        closing_cash_f: Number(r.closing_cash_f) || 0,
        system_cash_sales: Number(r.system_cash_sales) || 0,
        variance_amount: Number(r.variance_amount) || 0,
        status: r.status,
        notes: r.notes || null,
        submitted_by: r.submitted_by || null,
        submitter_name: (r.submitted_by && userMap.get(r.submitted_by)) || 'Staff Cashier',
        created_at: r.created_at,
        updated_at: r.updated_at,
        bank_deposits: depositsMap.get(r.id) || [],
      }));

      // Check dates already present in existingRows
      const existingDateBranchKeys = new Set(existingRows.map((r) => `${r.reconciliation_date}_${r.branch_id}`));

      // Synthesize historical days from completed sales
      let salesQuery = supabase
        .from('sales')
        .select('branch_id, total_amount, sold_at')
        .neq('status', 'VOIDED');
      if (params?.branchId && params.branchId !== 'ALL') {
        salesQuery = salesQuery.eq('branch_id', params.branchId);
      }
      if (params?.startDate) {
        salesQuery = salesQuery.gte('sold_at', `${params.startDate}T00:00:00+05:30`);
      }
      if (params?.endDate) {
        salesQuery = salesQuery.lte('sold_at', `${params.endDate}T23:59:59.999+05:30`);
      }
      salesQuery = salesQuery.order('sold_at', { ascending: false }).limit(2000);

      const { data: salesRows } = await salesQuery;

      if (salesRows && salesRows.length > 0) {
        const histMap = new Map<string, { date: string; branchId: string; totalCash: number; count: number }>();
        for (const s of salesRows) {
          const sDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(s.sold_at));

          const bId = s.branch_id;
          const key = `${sDate}_${bId}`;
          if (existingDateBranchKeys.has(key)) continue;

          const entry = histMap.get(key) || { date: sDate, branchId: bId, totalCash: 0, count: 0 };
          entry.totalCash += Number(s.total_amount || 0);
          entry.count += 1;
          histMap.set(key, entry);
        }

        for (const [key, val] of histMap.entries()) {
          existingRows.push({
            id: `hist_${key}`,
            tenant_id: '0fef1423-5d89-4147-8af8-17c7e641c88a',
            branch_id: val.branchId,
            branch_name: branchMap.get(val.branchId) || 'Main Branch',
            reconciliation_date: val.date,
            opening_float_a: 0,
            cash_expenses_b: 0,
            denominations: {},
            physical_cash_c: val.totalCash,
            actual_net_income_d: val.totalCash,
            total_bank_deposits_e: 0,
            closing_cash_f: val.totalCash,
            system_cash_sales: val.totalCash,
            variance_amount: 0,
            status: 'balanced',
            notes: `Historical System Ledger (${val.count} bills)`,
            submitted_by: null,
            submitter_name: 'Historical System Ledger',
            created_at: `${val.date}T23:59:59Z`,
            updated_at: `${val.date}T23:59:59Z`,
            bank_deposits: [],
          });
        }
      }

      return existingRows.sort((a, b) => b.reconciliation_date.localeCompare(a.reconciliation_date));
    } catch (err) {
      console.error('[ReconciliationApi] getReconciliationHistory fatal:', err);
      return [];
    }
  },

  /**
   * Fetch consolidated bank deposits across branches with bank/account grouping.
   */
  async getBankDepositsReport(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    bankName?: string;
  }): Promise<ConsolidatedBankDepositRow[]> {
    try {
      let depQuery = supabase.from('daily_bank_deposits').select('*').order('created_at', { ascending: false });

      if (params?.bankName && params.bankName !== 'ALL') {
        depQuery = depQuery.eq('bank_name', params.bankName);
      }

      const [{ data: deposits, error: depErr }, { data: recs }, { data: branches }] = await Promise.all([
        depQuery,
        supabase.from('daily_cash_reconciliations').select('id, branch_id, reconciliation_date'),
        supabase.from('branches').select('id, name'),
      ]);

      if (depErr || !deposits) {
        console.warn('[ReconciliationApi] getBankDepositsReport error:', depErr?.message);
        return [];
      }

      const branchMap = new Map<string, string>();
      (branches || []).forEach((b: any) => branchMap.set(b.id, b.name));

      const recMap = new Map<string, { branch_id: string; reconciliation_date: string }>();
      (recs || []).forEach((r: any) => recMap.set(r.id, { branch_id: r.branch_id, reconciliation_date: r.reconciliation_date }));

      const rows: ConsolidatedBankDepositRow[] = [];

      for (const d of deposits) {
        const rec = recMap.get(d.reconciliation_id);
        const recDate = rec?.reconciliation_date || (d.created_at ? d.created_at.slice(0, 10) : '');
        const branchId = rec?.branch_id || '';

        if (params?.branchId && params.branchId !== 'ALL' && branchId !== params.branchId) {
          continue;
        }
        if (params?.startDate && recDate < params.startDate) {
          continue;
        }
        if (params?.endDate && recDate > params.endDate) {
          continue;
        }

        rows.push({
          id: d.id,
          reconciliation_id: d.reconciliation_id,
          reconciliation_date: recDate,
          branch_id: branchId,
          branch_name: branchMap.get(branchId) || 'Unknown Branch',
          bank_name: d.bank_name,
          account_number: d.account_number,
          account_name: d.account_name || 'Main Account',
          amount: Number(d.amount) || 0,
          deposit_reference: d.deposit_reference || null,
          deposited_by: d.deposited_by || null,
          created_at: d.created_at,
        });
      }

      return rows.sort((a, b) => b.reconciliation_date.localeCompare(a.reconciliation_date));
    } catch (err) {
      console.error('[ReconciliationApi] getBankDepositsReport fatal:', err);
      return [];
    }
  },

  /**
   * Fetch consolidated cashier shortages with cashier, branch, date, and status filters.
   */
  async getShortagesReport(params?: {
    branchId?: string;
    cashierName?: string;
    statusFilter?: 'all' | 'pending_payroll' | 'deducted';
    startDate?: string;
    endDate?: string;
  }): Promise<CashierShortageRow[]> {
    try {
      let query = supabase.from('cashier_shortages').select('*').order('shortage_date', { ascending: false });

      if (params?.branchId && params.branchId !== 'ALL') {
        query = query.eq('branch_id', params.branchId);
      }
      if (params?.cashierName && params.cashierName !== 'ALL') {
        query = query.ilike('cashier_name', `%${params.cashierName}%`);
      }
      if (params?.statusFilter && params.statusFilter !== 'all') {
        query = query.eq('deduction_status', params.statusFilter);
      }
      if (params?.startDate) {
        query = query.gte('shortage_date', params.startDate);
      }
      if (params?.endDate) {
        query = query.lte('shortage_date', params.endDate);
      }

      const [{ data, error }, { data: branches }] = await Promise.all([
        query,
        supabase.from('branches').select('id, name'),
      ]);

      if (error) {
        console.warn('[ReconciliationApi] getShortagesReport error:', error.message);
        return [];
      }

      const branchMap = new Map<string, string>();
      (branches || []).forEach((b: any) => branchMap.set(b.id, b.name));

      return (data || []).map((item: any) => ({
        ...item,
        branch_name: branchMap.get(item.branch_id) || 'Unknown Branch',
      }));
    } catch (err) {
      console.error('[ReconciliationApi] getShortagesReport fatal:', err);
      return [];
    }
  },

  /**
   * Fetch consolidated daily accounts ledger across branches.
   */
  async getConsolidatedLedger(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ConsolidatedLedgerRow[]> {
    try {
      let query = supabase.from('daily_accounts_ledger').select('*').order('entry_date', { ascending: false });

      if (params?.branchId && params.branchId !== 'ALL') {
        query = query.eq('branch_id', params.branchId);
      }
      if (params?.startDate) {
        query = query.gte('entry_date', params.startDate);
      }
      if (params?.endDate) {
        query = query.lte('entry_date', params.endDate);
      }
      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const [{ data, error }, { data: branches }] = await Promise.all([
        query,
        supabase.from('branches').select('id, name'),
      ]);

      if (error) {
        console.warn('[ReconciliationApi] getConsolidatedLedger error:', error.message);
        return [];
      }

      const branchMap = new Map<string, string>();
      (branches || []).forEach((b: any) => branchMap.set(b.id, b.name));

      return (data || []).map((item: any) => ({
        ...item,
        branch_name: branchMap.get(item.branch_id) || 'Unknown Branch',
      }));
    } catch (err) {
      console.error('[ReconciliationApi] getConsolidatedLedger fatal:', err);
      return [];
    }
  },
};
