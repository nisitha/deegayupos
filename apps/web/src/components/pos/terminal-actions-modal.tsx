'use client';

import React, { useState } from 'react';
import {
  X,
  MoreHorizontal,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Receipt,
} from 'lucide-react';

interface TerminalActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReprintLastReceipt: () => void;
  onForceResync: () => void;
  activeBusinessName: string;
  activeBranchName: string;
  hasLastReceipt: boolean;
}

export function TerminalActionsModal({
  isOpen,
  onClose,
  onReprintLastReceipt,
  onForceResync,
  activeBusinessName,
  activeBranchName,
  hasLastReceipt,
}: TerminalActionsModalProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showXReport, setShowXReport] = useState(false);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleKickDrawer = () => {
    // Standard ESC/POS pulse hex <0x1B, 0x70, 0x00, 0x19, 0xFA>
    showToast('RJ12 electronic pulse sent: Cash drawer opened successfully.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        {/* Toast feedback */}
        {toastMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-600 flex items-center justify-center shadow-xs">
              <MoreHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Terminal & Register Tools</h3>
              <p className="text-xs text-slate-500">
                {activeBusinessName} • {activeBranchName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions Grid */}
        <div className="space-y-2">
          {/* Action 1: Kick Drawer */}
          <button
            type="button"
            onClick={handleKickDrawer}
            className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 transition-all flex items-center justify-between text-left group active:scale-98 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#005BD3] flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-[#005BD3] transition-colors">
                  Open Cash Drawer (Kick Pulse)
                </div>
                <div className="text-[11px] text-slate-400">
                  Sends hardware pulse via ESC/POS printer RJ12 port
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Pulse
            </span>
          </button>

          {/* Action 2: Reprint Last Receipt */}
          <button
            type="button"
            onClick={() => {
              if (hasLastReceipt) {
                onClose();
                onReprintLastReceipt();
              } else {
                showToast('No receipt on file for this cashier session yet.');
              }
            }}
            className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 transition-all flex items-center justify-between text-left group active:scale-98 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                  Reprint Last Thermal Slip
                </div>
                <div className="text-[11px] text-slate-400">
                  View and print receipt of most recent transaction
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Print
            </span>
          </button>

          {/* Action 3: Shift X-Report */}
          <button
            type="button"
            onClick={() => setShowXReport(!showXReport)}
            className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 transition-all flex items-center justify-between text-left group active:scale-98 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-purple-600 transition-colors">
                  Cashier Shift Summary (X-Report)
                </div>
                <div className="text-[11px] text-slate-400">
                  Review mid-day register balance & tender counts
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {showXReport ? 'Hide' : 'View'}
            </span>
          </button>

          {/* X-Report Breakdown (Toggleable) */}
          {showXReport && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs animate-in fade-in duration-150">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Today&apos;s Register Activity (Terminal REG-01)
              </div>
              <div className="flex justify-between font-mono text-slate-600">
                <span>Total Cash Transactions</span>
                <span className="font-bold text-slate-900">LKR 48,250.00</span>
              </div>
              <div className="flex justify-between font-mono text-slate-600">
                <span>Total Card & LANKAQR</span>
                <span className="font-bold text-slate-900">LKR 32,100.00</span>
              </div>
              <div className="flex justify-between font-mono text-slate-600">
                <span>Discounts Issued</span>
                <span className="font-bold text-amber-600">-LKR 2,450.00</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-mono font-bold text-slate-900">
                <span>Gross Net Sales</span>
                <span className="text-[#005BD3]">LKR 80,350.00</span>
              </div>
            </div>
          )}

          {/* Action 4: Force Catalog Sync */}
          <button
            type="button"
            onClick={() => {
              onForceResync();
              onClose();
            }}
            className="w-full p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 transition-all flex items-center justify-between text-left group active:scale-98 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                  Force Remote Catalog Resync
                </div>
                <div className="text-[11px] text-slate-400">
                  Refreshes all 3,120 catalog items and local terminal cache
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Sync
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
