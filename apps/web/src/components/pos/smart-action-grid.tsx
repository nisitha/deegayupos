'use client';

import React from 'react';
import {
  UserPlus,
  Tag,
  Percent,
  Package,
  Bookmark,
  MoreHorizontal,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

export interface SmartActionGridProps {
  customerName: string;
  isWalkIn: boolean;
  onOpenCustomerModal: () => void;
  onOpenCustomSaleModal: () => void;
  onOpenDiscountModal: () => void;
  onOpenShippingModal: () => void;
  onHoldCart: () => void;
  onOpenHeldCartsModal: () => void;
  onOpenMoreActionsModal: () => void;
  discountPercent: number;
  discountAmount: number;
  heldCartsCount: number;
  cartItemCount: number;
  hasShipping: boolean;
  shippingFee: number;
}

export function SmartActionGrid({
  customerName,
  isWalkIn,
  onOpenCustomerModal,
  onOpenCustomSaleModal,
  onOpenDiscountModal,
  onOpenShippingModal,
  onHoldCart,
  onOpenHeldCartsModal,
  onOpenMoreActionsModal,
  discountPercent,
  discountAmount,
  heldCartsCount,
  cartItemCount,
  hasShipping,
  shippingFee,
}: SmartActionGridProps) {
  const tiles = [
    {
      id: 'customer',
      title: isWalkIn ? 'Add Customer' : 'Customer Attached',
      subtitle: isWalkIn ? 'Attach VIP loyalty or credit profile' : customerName,
      icon: isWalkIn ? UserPlus : UserCheck,
      iconColor: isWalkIn ? 'text-slate-700' : 'text-[#005BD3]',
      bg: isWalkIn
        ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/90 text-slate-800'
        : 'bg-blue-50/80 hover:bg-blue-100/80 border-blue-200/90 text-blue-900',
      badge: isWalkIn ? 'Walk-In' : 'Active Profile',
      badgeClass: isWalkIn
        ? 'bg-slate-200/70 text-slate-700'
        : 'bg-blue-200/70 text-[#005BD3] font-bold',
      onClick: onOpenCustomerModal,
    },
    {
      id: 'custom-sale',
      title: 'Add Custom Sale',
      subtitle: 'Manual service fee or unlisted product',
      icon: Tag,
      iconColor: 'text-amber-600',
      bg: 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-200/70 text-amber-950',
      badge: '+ Misc Item',
      badgeClass: 'bg-amber-100 text-amber-800 font-semibold',
      onClick: onOpenCustomSaleModal,
    },
    {
      id: 'discount',
      title: discountPercent > 0 || discountAmount > 0 ? 'Discount Active' : 'Apply Discount',
      subtitle:
        discountPercent > 0
          ? `${discountPercent}% cart discount applied`
          : discountAmount > 0
            ? `LKR ${discountAmount.toFixed(2)} flat discount`
            : 'Percentage (%), Flat LKR, or Promo',
      icon: Percent,
      iconColor: 'text-emerald-600',
      bg:
        discountPercent > 0 || discountAmount > 0
          ? 'bg-emerald-100/70 hover:bg-emerald-200/70 border-emerald-300 text-emerald-950'
          : 'bg-emerald-50/60 hover:bg-emerald-100/60 border-emerald-200/70 text-emerald-950',
      badge:
        discountPercent > 0
          ? `${discountPercent}% OFF`
          : discountAmount > 0
            ? `-LKR ${discountAmount.toFixed(0)}`
            : '0%',
      badgeClass:
        discountPercent > 0 || discountAmount > 0
          ? 'bg-emerald-600 text-white font-bold'
          : 'bg-emerald-100 text-emerald-800 font-semibold',
      onClick: onOpenDiscountModal,
    },
    {
      id: 'shipping',
      title: hasShipping ? 'Courier Delivery' : 'Ship to Customer',
      subtitle: hasShipping
        ? `PromptX / Domex (+LKR ${shippingFee.toFixed(2)})`
        : 'Dispatch delivery & courier tracking',
      icon: Package,
      iconColor: 'text-rose-600',
      bg: hasShipping
        ? 'bg-rose-100/80 hover:bg-rose-200/80 border-rose-300 text-rose-950'
        : 'bg-rose-50/60 hover:bg-rose-100/60 border-rose-200/70 text-rose-950',
      badge: hasShipping ? `Delivery Active` : 'In-Store',
      badgeClass: hasShipping
        ? 'bg-rose-600 text-white font-bold'
        : 'bg-rose-100 text-rose-800 font-semibold',
      onClick: onOpenShippingModal,
    },
    {
      id: 'hold',
      title: cartItemCount > 0 ? 'Hold Active Cart' : 'Held Tickets',
      subtitle:
        cartItemCount > 0
          ? `Park ticket (${cartItemCount} items) for next customer`
          : heldCartsCount > 0
            ? `${heldCartsCount} parked tickets waiting to resume`
            : 'No tickets on hold',
      icon: Bookmark,
      iconColor: 'text-indigo-600',
      bg:
        cartItemCount > 0
          ? 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-200/80 text-indigo-950'
          : 'bg-indigo-50/40 hover:bg-indigo-100/50 border-indigo-200/60 text-indigo-900',
      badge: heldCartsCount > 0 ? `${heldCartsCount} On Hold` : 'Ticket [F4]',
      badgeClass:
        heldCartsCount > 0
          ? 'bg-indigo-600 text-white font-bold'
          : 'bg-indigo-100 text-indigo-800 font-semibold',
      onClick: cartItemCount > 0 ? onHoldCart : onOpenHeldCartsModal,
    },
    {
      id: 'more-actions',
      title: 'More Terminal Actions',
      subtitle: 'Open drawer, print last slip, X-Report',
      icon: MoreHorizontal,
      iconColor: 'text-purple-600',
      bg: 'bg-purple-50/60 hover:bg-purple-100/60 border-purple-200/70 text-purple-950',
      badge: 'Terminal Tools',
      badgeClass: 'bg-purple-100 text-purple-800 font-semibold',
      onClick: onOpenMoreActionsModal,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Smart Grid Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Shopify Smart Action Tiles
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200/70 text-slate-700">
            Smart Grid v11.5
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
          High-frequency cashier workflows
        </span>
      </div>

      {/* 2-Column / 3-Column Tactile Squircle Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={tile.onClick}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between min-h-[96px] sm:min-h-[108px] shadow-card hover:shadow-card-hover active:scale-[0.98] select-none touch-manipulation group ${tile.bg}`}
            >
              {/* Top Row: Icon & Dynamic Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/90 border border-black/5 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Icon className={`w-5 h-5 ${tile.iconColor}`} />
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${tile.badgeClass}`}>
                  {tile.badge}
                </span>
              </div>

              {/* Bottom Row: Title & Subtitle */}
              <div className="mt-2.5">
                <div className="text-xs sm:text-sm font-bold flex items-center justify-between">
                  <span className="truncate">{tile.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                </div>
                <p className="text-[10px] sm:text-[11px] opacity-75 truncate mt-0.5 font-medium">
                  {tile.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
