'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UtensilsCrossed,
  Users,
  X,
} from 'lucide-react';
import { useTenantBranch } from '../../../context/tenant-branch-context';

type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BOOKED' | 'BILLED';

interface DiningTable {
  id: string;
  code: string;
  seats: number;
  status: TableStatus;
  zone: 'Main Hall' | 'VIP Lounge' | 'Outdoor Terrace';
  orderId?: string;
  currentTotal?: number;
  guestCount?: number;
  timeSeated?: string;
}

const INITIAL_TABLES: DiningTable[] = [
  { id: '1', code: 'T-01', seats: 2, status: 'AVAILABLE', zone: 'Main Hall' },
  { id: '2', code: 'T-02', seats: 2, status: 'OCCUPIED', zone: 'Main Hall', currentTotal: 3450, guestCount: 2, timeSeated: '12:45 PM' },
  { id: '3', code: 'T-03', seats: 4, status: 'BILLED', zone: 'Main Hall', currentTotal: 6200, guestCount: 4, timeSeated: '12:15 PM' },
  { id: '4', code: 'T-04', seats: 4, status: 'AVAILABLE', zone: 'Main Hall' },
  { id: '5', code: 'T-05', seats: 6, status: 'BOOKED', zone: 'Main Hall', guestCount: 6, timeSeated: '01:30 PM (Reserved)' },
  { id: '6', code: 'T-06', seats: 6, status: 'OCCUPIED', zone: 'Main Hall', currentTotal: 8900, guestCount: 5, timeSeated: '12:30 PM' },
  { id: '7', code: 'VIP-1', seats: 8, status: 'AVAILABLE', zone: 'VIP Lounge' },
  { id: '8', code: 'VIP-2', seats: 10, status: 'OCCUPIED', zone: 'VIP Lounge', currentTotal: 18500, guestCount: 8, timeSeated: '12:00 PM' },
  { id: '9', code: 'TER-1', seats: 4, status: 'AVAILABLE', zone: 'Outdoor Terrace' },
  { id: '10', code: 'TER-2', seats: 4, status: 'AVAILABLE', zone: 'Outdoor Terrace' },
  { id: '11', code: 'TER-3', seats: 2, status: 'BOOKED', zone: 'Outdoor Terrace', guestCount: 2, timeSeated: '02:00 PM (Reserved)' },
  { id: '12', code: 'TER-4', seats: 4, status: 'OCCUPIED', zone: 'Outdoor Terrace', currentTotal: 4200, guestCount: 3, timeSeated: '12:50 PM' },
];

export default function TablesFloorPage() {
  const router = useRouter();
  const { currency, setPosMode } = useTenantBranch();

  const [tables, setTables] = useState<DiningTable[]>(INITIAL_TABLES);
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeTableModal, setActiveTableModal] = useState<DiningTable | null>(null);

  const zones = ['All Zones', 'Main Hall', 'VIP Lounge', 'Outdoor Terrace'];

  const filteredTables = tables.filter((t) => {
    if (selectedZone !== 'All Zones' && t.zone !== selectedZone) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    return true;
  });

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          label: 'Available',
        };
      case 'OCCUPIED':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
          label: 'Occupied',
        };
      case 'BOOKED':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          label: 'Booked',
        };
      case 'BILLED':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Billed',
        };
    }
  };

  const handleOpenTableOrder = (table: DiningTable) => {
    setPosMode('restaurant');
    router.push(`/dashboard/pos?table=${table.code}`);
  };

  const handleClearTable = (tableId: string) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId ? { ...t, status: 'AVAILABLE', currentTotal: undefined, guestCount: undefined } : t,
      ),
    );
    setActiveTableModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Floor Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Table & Floor View
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Live Dining
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time visual table statuses, seated guests, and direct POS order routing.
          </p>
        </div>

        {/* Status Legend Floating Bar */}
        <div className="flex items-center gap-3 p-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-pos-card text-xs">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all ${
              selectedStatus === 'ALL' ? 'bg-[#2F65F6] text-white shadow-pos-btn' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Tables ({tables.length})
          </button>
          <button
            onClick={() => setSelectedStatus('AVAILABLE')}
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all ${
              selectedStatus === 'AVAILABLE' ? 'bg-blue-100 font-bold text-blue-800' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Available</span>
          </button>
          <button
            onClick={() => setSelectedStatus('OCCUPIED')}
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all ${
              selectedStatus === 'OCCUPIED' ? 'bg-rose-100 font-bold text-rose-800' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Occupied</span>
          </button>
          <button
            onClick={() => setSelectedStatus('BOOKED')}
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all ${
              selectedStatus === 'BOOKED' ? 'bg-amber-100 font-bold text-amber-800' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Booked</span>
          </button>
          <button
            onClick={() => setSelectedStatus('BILLED')}
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all ${
              selectedStatus === 'BILLED' ? 'bg-emerald-100 font-bold text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Billed</span>
          </button>
        </div>
      </div>

      {/* Zone Tabs Toolbar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {zones.map((zone) => (
          <button
            key={zone}
            onClick={() => setSelectedZone(zone)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedZone === zone
                ? 'bg-white text-[#2F65F6] border border-[#2F65F6] shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {zone}
          </button>
        ))}
      </div>

      {/* Interactive Floor Plan Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredTables.map((table) => {
          const badge = getStatusBadge(table.status);
          return (
            <div
              key={table.id}
              onClick={() => setActiveTableModal(table)}
              className="group relative bg-white border border-slate-200/90 rounded-3xl p-4 flex flex-col items-center justify-between cursor-pointer hover:border-[#2F65F6] hover:shadow-pos-card-hover transition-all duration-200 active:scale-95 min-h-[160px]"
            >
              {/* Chair Simulation Dots at Top */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(table.seats, 4) }).map((_, i) => (
                  <div key={i} className="w-3 h-1.5 rounded-full bg-slate-200 group-hover:bg-[#2F65F6]/40 transition-colors" />
                ))}
              </div>

              {/* Table Center Circle Badge */}
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center my-2 group-hover:bg-[#EFF6FF] group-hover:border-[#BFDBFE] transition-colors">
                <span className="text-sm font-bold text-slate-900 group-hover:text-[#2F65F6]">
                  {table.code}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />
                  {table.seats}
                </span>
              </div>

              {/* Status Pill */}
              <div className="w-full flex items-center justify-center">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
              </div>

              {/* Bill preview if active */}
              {table.currentTotal && (
                <div className="text-[11px] font-mono font-bold text-slate-800 mt-1">
                  {currency} {table.currentTotal.toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table Detail / Action Dialog */}
      {activeTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2F65F6] flex items-center justify-center font-bold text-sm">
                  {activeTableModal.code}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Table {activeTableModal.code}</h3>
                  <p className="text-xs text-slate-400">{activeTableModal.zone} • Capacity: {activeTableModal.seats} seats</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTableModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Information */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Current Status</span>
                <span className="font-semibold text-slate-800">{activeTableModal.status}</span>
              </div>
              {activeTableModal.timeSeated && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Timing</span>
                  <span className="font-mono text-slate-700">{activeTableModal.timeSeated}</span>
                </div>
              )}
              {activeTableModal.currentTotal && (
                <div className="flex justify-between py-1 text-sm font-bold">
                  <span className="text-slate-700">Accumulated Bill</span>
                  <span className="text-[#2F65F6] font-mono">
                    {currency} {activeTableModal.currentTotal.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => handleOpenTableOrder(activeTableModal)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white text-xs font-bold shadow-pos-btn flex items-center justify-center gap-2 transition-all"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>{activeTableModal.status === 'AVAILABLE' ? 'Start New Table Order' : 'Open Current Order'}</span>
              </button>

              {activeTableModal.status !== 'AVAILABLE' && (
                <button
                  onClick={() => handleClearTable(activeTableModal.id)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Clear & Mark Available
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
