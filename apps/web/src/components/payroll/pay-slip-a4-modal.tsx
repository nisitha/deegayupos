'use client';

import React from 'react';
import { X, Printer } from 'lucide-react';
import type { PayrollRunItemDto } from '../../lib/payroll-api';

interface PaySlipA4ModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollMonth: string;
  items: PayrollRunItemDto[];
  selectedItem?: PayrollRunItemDto | null;
}

function formatLKR(val: number | undefined | null): string {
  const num = Number(val || 0);
  return 'LKR ' + num.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonthLabel(monthYear: string): string {
  if (!monthYear) return '';
  const [yStr, mStr] = monthYear.split('-');
  const y = parseInt(yStr || '2026', 10);
  const m = parseInt(mStr || '1', 10) - 1;
  const date = new Date(y, m, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function PaySlipA4Modal({
  isOpen,
  onClose,
  payrollMonth,
  items,
  selectedItem,
}: PaySlipA4ModalProps) {
  if (!isOpen) return null;

  // Single slip vs Batch slip printing
  const slipsToRender = selectedItem ? [selectedItem] : items;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:overflow-visible">
      {/* Top Floating Control Toolbar (Hidden during print) */}
      <div className="no-print fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-900 border border-slate-700/80 p-2 rounded-2xl shadow-2xl">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>{selectedItem ? 'Print A4 Pay Slip' : `Print All (${items.length}) Slips`}</span>
        </button>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Embedded Print CSS to guarantee crisp white A4 output */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .pay-slip-container {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            width: 100% !important;
          }
          .a4-page {
            page-break-after: always !important;
            break-after: page !important;
            width: 210mm !important;
            min-height: 290mm !important;
            padding: 15mm 20mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Slip Container */}
      <div className="pay-slip-container w-full max-w-4xl space-y-8 my-8 print:my-0">
        {slipsToRender.map((emp, index) => {
          const shortageList = Array.isArray(emp.shortage_items_json)
            ? emp.shortage_items_json
            : [];

          return (
            <div
              key={emp.id || index}
              className="a4-page bg-white text-slate-900 rounded-2xl border border-slate-300 p-8 sm:p-12 shadow-2xl relative print:rounded-none print:shadow-none print:border-none"
              style={{ minHeight: '280mm' }}
            >
              {/* Document Watermark / Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight uppercase">
                    Deegayu Weda Madhura
                  </h1>
                  <p className="text-xs font-bold text-slate-600 tracking-wide uppercase mt-0.5">
                    Ayurvedic Pharmacy, Medical Center & Healthcare Dispensary
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Head Office: Giriulla Road, Alawwa • Branches: Alawwa | Dambadeniya | Giriulla | Main Store
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 text-slate-900 font-black text-xs uppercase tracking-wider rounded-md font-mono">
                    Pay Slip
                  </span>
                  <div className="text-sm font-extrabold text-slate-900 font-mono mt-1.5">
                    {formatMonthLabel(payrollMonth)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Strictly Private & Confidential
                  </div>
                </div>
              </div>

              {/* Employee Meta Details Card */}
              <div className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    Employee Name
                  </span>
                  <strong className="text-sm font-bold text-slate-950 block mt-0.5">
                    {emp.full_name}
                  </strong>
                  <span className="text-[11px] text-slate-600 font-mono">
                    ID: {emp.employee_code}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    Designation & Branch
                  </span>
                  <strong className="font-semibold text-slate-900 block mt-0.5">
                    {emp.designation || 'Dispensary Staff'}
                  </strong>
                  <span className="text-[11px] text-slate-600">
                    {emp.branch_name || 'Main Dispensary'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    Bank Remittance Account
                  </span>
                  <strong className="font-semibold text-slate-900 block mt-0.5 font-mono">
                    {emp.bank_name ? `${emp.bank_name}` : 'Cash Payment'}
                  </strong>
                  <span className="text-[11px] text-slate-600 font-mono">
                    {emp.bank_account_no ? `Acc: ${emp.bank_account_no}` : (emp.bank_branch || '')}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    Days Worked / Attendance
                  </span>
                  <strong className="font-bold text-slate-900 block mt-0.5 font-mono">
                    {emp.present_days} Days Worked
                  </strong>
                  <span className="text-[11px] text-rose-600 font-medium">
                    {emp.no_pay_days > 0 ? `${emp.no_pay_days} No-Pay Days` : 'Zero No-Pay Leave'}
                  </span>
                </div>
              </div>

              {/* TWO-COLUMN EARNINGS VS DEDUCTIONS LEDGER */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 text-xs">
                {/* 1. EARNINGS COLUMN */}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-800 text-[11px] flex items-center justify-between">
                      <span>Gross Earnings Description</span>
                      <span>Amount (LKR)</span>
                    </div>

                    <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">Basic Monthly Salary</span>
                        <span className="font-mono font-bold text-slate-950">
                          {formatLKR(emp.basic_salary)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-slate-700">Fixed Cost-of-Living Allowance</span>
                        <span className="font-mono text-slate-950">
                          {formatLKR(emp.fixed_allowance)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <span className="text-slate-700 block">Attendance Incentive Bonus</span>
                          <span className="text-[10px] text-slate-400">
                            {emp.no_pay_days > 0 ? 'Forfeited due to no-pay leave' : 'Full attendance reward'}
                          </span>
                        </div>
                        <span className="font-mono text-slate-950">
                          {formatLKR(emp.attendance_bonus)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <span className="text-slate-700 block">Normal Overtime (1.5x)</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {emp.normal_ot_hours.toFixed(2)} hrs @ standard 1.5x
                          </span>
                        </div>
                        <span className="font-mono text-slate-950">
                          {formatLKR(emp.normal_ot_pay)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <span className="text-slate-700 block">Double Overtime (2.0x)</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {emp.double_ot_hours.toFixed(2)} hrs on Poya / Holidays
                          </span>
                        </div>
                        <span className="font-mono text-slate-950">
                          {formatLKR(emp.double_ot_pay)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 px-4 py-3 border-t-2 border-slate-300 flex items-center justify-between font-bold text-slate-950">
                    <span className="uppercase tracking-wider">Total Gross Remuneration (A)</span>
                    <span className="font-mono text-base font-black">
                      {formatLKR(emp.gross_pay)}
                    </span>
                  </div>
                </div>

                {/* 2. DEDUCTIONS COLUMN */}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-800 text-[11px] flex items-center justify-between">
                      <span>Deductions & Recoveries</span>
                      <span>Amount (LKR)</span>
                    </div>

                    <div className="p-4 space-y-2.5 divide-y divide-slate-100">
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-slate-700 block">Employee EPF (8%)</span>
                          <span className="text-[10px] text-slate-400">
                            Statutory pension deduction
                          </span>
                        </div>
                        <span className="font-mono text-slate-950">
                          {formatLKR(emp.epf_employee_8)}
                        </span>
                      </div>

                      {emp.no_pay_deduction > 0 && (
                        <div className="flex items-center justify-between pt-2">
                          <div>
                            <span className="text-rose-700 font-semibold block">No-Pay Leave Deduction</span>
                            <span className="text-[10px] text-rose-500 font-mono">
                              {emp.no_pay_days} day(s) deducted
                            </span>
                          </div>
                          <span className="font-mono text-rose-700 font-bold">
                            {formatLKR(emp.no_pay_deduction)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-slate-700">Salary Advances Recovered</span>
                        <span className="font-mono text-slate-950">
                          {formatLKR(emp.salary_advance_deduction)}
                        </span>
                      </div>

                      {/* Itemized Cashier Shift Shortages */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-rose-800 font-bold block">
                            Cashier Shift Shortages Deducted
                          </span>
                          <span className="font-mono font-bold text-rose-700">
                            {formatLKR(emp.shortage_deduction_total)}
                          </span>
                        </div>

                        {shortageList.length > 0 ? (
                          <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-rose-300">
                            {shortageList.map((shortage, sIdx) => (
                              <div
                                key={shortage.id || sIdx}
                                className="flex items-center justify-between text-[10px] text-rose-900"
                              >
                                <span className="font-mono">
                                  • {shortage.date} ({shortage.branch_name} • {shortage.shift_label})
                                </span>
                                <span className="font-mono font-semibold">
                                  {formatLKR(shortage.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Zero cash shortage penalties recorded
                          </span>
                        )}
                      </div>

                      {emp.other_deductions > 0 && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-700">Other Authorized Deductions</span>
                          <span className="font-mono text-slate-950">
                            {formatLKR(emp.other_deductions)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 px-4 py-3 border-t-2 border-slate-300 flex items-center justify-between font-bold text-slate-950">
                    <span className="uppercase tracking-wider">Total Deductions (B)</span>
                    <span className="font-mono text-base font-black text-rose-700">
                      {formatLKR(emp.total_deductions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* NET SALARY PAYABLE HIGHLIGHT BOX */}
              <div className="my-6 p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl print:bg-slate-100 print:text-slate-950 print:border-2 print:border-slate-900">
                <div>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-300 print:text-slate-600 block">
                    Net Take-Home Salary Payable (A - B)
                  </span>
                  <p className="text-[11px] text-slate-400 print:text-slate-500 mt-0.5">
                    Remitted directly to bank account on or before end of month
                  </p>
                </div>
                <div className="text-3xl font-black font-mono tracking-tight text-emerald-400 print:text-slate-950">
                  {formatLKR(emp.net_pay)}
                </div>
              </div>

              {/* EMPLOYER STATUTORY CONTRIBUTIONS FOOTNOTE */}
              <div className="my-6 p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 uppercase tracking-wider block mb-1">
                  Employer Statutory Contributions (Not Deducted From Employee Pay):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                  <div>
                    Employer EPF (12%): <strong className="text-slate-900">{formatLKR(emp.epf_employer_12)}</strong>
                  </div>
                  <div>
                    Employer ETF (3%): <strong className="text-slate-900">{formatLKR(emp.etf_employer_3)}</strong>
                  </div>
                  <div>
                    Total Company Contribution: <strong className="text-slate-900">{formatLKR(emp.epf_employer_12 + emp.etf_employer_3)}</strong>
                  </div>
                </div>
              </div>

              {/* SIGNATURE BLOCKS */}
              <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs text-slate-700">
                <div className="border-t-2 border-slate-800 pt-2">
                  <p className="font-black text-slate-950 uppercase tracking-wider">
                    Dr. Deegayu (Owner / Managing Director)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Authorized Signatory • Deegayu Weda Madhura
                  </p>
                </div>

                <div className="border-t-2 border-slate-800 pt-2">
                  <p className="font-black text-slate-950 uppercase tracking-wider">
                    {emp.full_name} (Employee Signature)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Acknowledged & Received in Full
                  </p>
                </div>
              </div>

              {/* Security Print Stamp */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono">
                Generated via PixelCraft POS • Deegayu Weda Madhura Automated Remuneration System • Document ID: {emp.id || 'PAY-SLIP'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
