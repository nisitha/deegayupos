'use client';

import React from 'react';
import { X, Play, Trash2, Clock, User } from 'lucide-react';

export interface HeldTicket {
  id: string;
  timestamp: string;
  customerName: string;
  items: {
    id: string;
    productId: string;
    name: string;
    sku: string;
    barcode?: string;
    price: number;
    originalUnitPrice?: number;
    costPrice?: number;
    quantity: number;
    stockOnHand: number;
    unit: string;
    imageUrl?: string;
    departmentId?: string;
    selectedUnit?: string;
    displayQuantity?: number;
  }[];
  discountType: 'NONE' | 'PERCENT' | 'FLAT';
  discountPercent: number;
  discountFlat: number;
  totalAmount: number;
}

interface HeldTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldTickets: HeldTicket[];
  onRestoreTicket: (ticket: HeldTicket) => void;
  onDiscardTicket: (ticketId: string) => void;
}

export function HeldTicketsModal({
  isOpen,
  onClose,
  heldTickets,
  onRestoreTicket,
  onDiscardTicket,
}: HeldTicketsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Held Tickets Queue</h3>
              <p className="text-[11px] text-slate-500">
                {heldTickets.length} parked {heldTickets.length === 1 ? 'ticket' : 'tickets'} waiting to be recalled
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tickets List */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {heldTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
              <p className="text-xs font-semibold text-slate-700">No tickets currently on hold</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click &quot;Hold Ticket&quot; on any active cart to park it temporarily
              </p>
            </div>
          ) : (
            heldTickets.map((ticket) => {
              const itemCount = ticket.items.reduce((acc, i) => acc + i.quantity, 0);

              return (
                <div
                  key={ticket.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {ticket.customerName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{ticket.timestamp}</span>
                    </div>
                  </div>

                  {/* Summary of Items */}
                  <div className="text-xs text-slate-600 line-clamp-1">
                    {ticket.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-xs font-black font-mono text-slate-900">
                        LKR {ticket.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDiscardTicket(ticket.id)}
                        className="px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 font-semibold"
                        title="Discard held ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Discard</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRestoreTicket(ticket);
                          onClose();
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Recall Ticket</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
