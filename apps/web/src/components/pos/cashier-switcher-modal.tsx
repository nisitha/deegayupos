'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  KeyRound,
  ShieldAlert,
  Loader2,
  Users,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { StaffUserDto } from '@pixelcraft/types';
import { staffApi } from '../../lib/api-client';

interface CashierSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCashierName: string;
  onCashierSwitched: (cashier: {
    id: string;
    fullName: string;
    role: string;
    email?: string;
    assignedBranchIds?: string[];
    grnBranchIds?: string[];
  }) => void;
}

export function CashierSwitcherModal({
  isOpen,
  onClose,
  currentCashierName,
  onCashierSwitched,
}: CashierSwitcherModalProps) {
  const [pin, setPin] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffUserDto[]>([]);
  const [activeTab, setActiveTab] = useState<'pin' | 'list'>('pin');

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg(null);
      setSuccessMsg(null);
      // Fetch staff list for quick selection
      staffApi
        .list()
        .then((res) => {
          if (res.data) setStaffList(res.data);
        })
        .catch((err) => console.warn('Could not load staff list:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setErrorMsg(null);
      if (newPin.length === 4) {
        verifyPinCode(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg(null);
  };

  const verifyPinCode = async (pinToVerify: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await staffApi.verifyPin(pinToVerify);
      if (res.data) {
        const staff = res.data;
        setSuccessMsg(`Welcome, ${staff.fullName}!`);
        setTimeout(() => {
          onCashierSwitched({
            id: staff.id,
            fullName: staff.fullName,
            role: staff.role,
            email: staff.email,
            assignedBranchIds: staff.assignedBranches,
            grnBranchIds: staff.grnBranches,
          });
          onClose();
        }, 500);
      } else {
        setErrorMsg('Invalid PIN code. Please try again.');
        setPin('');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Verification failed. Try again.';
      setErrorMsg(msg);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectStaff = (staff: StaffUserDto) => {
    onCashierSwitched({
      id: staff.id,
      fullName: staff.fullName,
      role: staff.role,
      email: staff.email,
      assignedBranchIds: staff.assignedBranches,
      grnBranchIds: staff.grnBranches,
    });
    setSuccessMsg(`Switched cashier to ${staff.fullName}`);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7052FF]/10 text-[#7052FF] flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Switch Cashier Profile</h2>
              <p className="text-xs text-slate-500">
                Active: <span className="font-semibold text-slate-700">{currentCashierName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'pin'
                ? 'bg-[#7052FF] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>4-Digit PIN Pad</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[#7052FF] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Directory</span>
          </button>
        </div>

        {/* Tab 1: PIN Pad */}
        {activeTab === 'pin' && (
          <div className="p-6 flex flex-col items-center">
            {/* PIN Dots Display */}
            <div className="flex gap-4 mb-5">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      filled
                        ? 'bg-[#7052FF] border-[#7052FF] scale-110 shadow-sm shadow-[#7052FF]/40'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error or Success notification */}
            {errorMsg && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Tactile Numpad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-xs">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  disabled={isLoading}
                  className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 font-bold text-xl border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading || pin.length === 0}
                className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-500 font-bold text-xs uppercase tracking-wider border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                disabled={isLoading}
                className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 font-bold text-xl border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={isLoading || pin.length === 0}
                className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 font-bold text-lg border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
              >
                ⌫
              </button>
            </div>

            {isLoading && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#7052FF]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying credentials...</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Staff Directory List */}
        {activeTab === 'list' && (
          <div className="p-6 max-h-80 overflow-y-auto divide-y divide-slate-100">
            {successMsg && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {staffList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No other staff accounts loaded.
              </div>
            ) : (
              staffList.map((staff) => {
                const isCurrent = staff.fullName === currentCashierName;
                const roleBadgeColor =
                  staff.role === 'OWNER'
                    ? 'bg-purple-100 text-purple-700'
                    : staff.role === 'MANAGER'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-emerald-100 text-emerald-700';

                return (
                  <div
                    key={staff.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {staff.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {staff.fullName}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${roleBadgeColor}`}>
                            {staff.role}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 truncate block">
                          {staff.email}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectStaff(staff)}
                      disabled={isCurrent}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-[#7052FF] hover:bg-[#5E3FE6] text-white shadow-sm'
                      }`}
                    >
                      {isCurrent ? 'Active' : 'Select'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Encrypted terminal PIN authentication</span>
          </div>
          <span>PixelCraft POS v2.6</span>
        </div>
      </div>
    </div>
  );
}
