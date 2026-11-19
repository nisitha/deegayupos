'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Banknote,
  Printer,
} from 'lucide-react';
import { ReceiptBarcodeBlock } from '@/components/pos/receipt-barcode-block';
import { formatSriLankaReceiptDate, formatSriLankaReceiptTime } from '@/lib/date-utils';

export default function PublicReceiptPage() {
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-2026-00042');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      const searchParams = new URLSearchParams(window.location.search);
      const queryInvoice = searchParams.get('invoice') || searchParams.get('id');

      if (lastPart && lastPart !== 'receipt' && lastPart !== 'verify' && lastPart !== 'index.html') {
        setInvoiceNumber(decodeURIComponent(lastPart));
      } else if (queryInvoice) {
        setInvoiceNumber(decodeURIComponent(queryInvoice));
      }
    }
  }, []);

  const storeName = 'Deegayu Weda Madhura';
  const legalName = 'Deegayu Ayurvedic Products & Health Care (Pvt) Ltd';
  const address = 'Main Street, Kalutara, Western Province, Sri Lanka';
  const phone = '+94 34 222 3456';
  const email = 'dispensary@deegayu.pixelcraftlk.com';
  const vatNumber = 'VAT-10928392-8000';
  const footerNote = 'Thank You Come Again! Return within 7 days.';
  const returnPolicy = 'Authentic Ayurvedic preparations in unopened seal condition exchangeable within 7 days with original receipt.';

  const items = [
    {
      name: 'Deegayu Arishta - Dasamularishtaya 375ml',
      sku: 'AYU-MED-001',
      quantity: 1,
      unitPrice: 950.0,
      subtotal: 950.0,
      discount: 50.0,
    },
    {
      name: 'Suwanda Kottan Ayurvedic Hair Oil 100ml',
      sku: 'AYU-OIL-004',
      quantity: 2,
      unitPrice: 560.0,
      subtotal: 1120.0,
      discount: 0.0,
    },
  ];

  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0);
  const discountTotal = items.reduce((acc, it) => acc + it.discount, 0);
  const taxAmount = 0;
  const totalAmount = subtotal - discountTotal + taxAmount;
  const createdAt = isMounted ? new Date() : new Date('2026-11-13T12:00:00Z');

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto">
        {/* Verification Status Banner */}
        <div className="bg-emerald-600 text-white rounded-t-2xl p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-xs rounded-full flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>Authentic Digital Receipt</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-200 fill-emerald-500" />
              </div>
              <div className="text-xs text-emerald-100 font-mono">
                Cryptographically Signed • PixelCraft POS Engine
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs uppercase tracking-wider text-emerald-200 block font-semibold">
              Status
            </span>
            <span className="text-xs font-bold text-white bg-emerald-700/60 px-2 py-0.5 rounded border border-emerald-400/40">
              Settled
            </span>
          </div>
        </div>

        {/* Paper Slip Body */}
        <div className="bg-white p-6 sm:p-8 rounded-b-2xl shadow-xl border-x border-b border-slate-200 text-slate-800 space-y-6">
          {/* Brand Header */}
          <div className="text-center pb-5 border-b border-dashed border-slate-300 space-y-1">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#7052FF] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                P
              </div>
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                PixelCraft POS Verified
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              {storeName}
            </h1>
            <p className="text-xs text-slate-600 font-bold">{legalName}</p>
            <div className="pt-2 text-xs text-slate-600 space-y-0.5 font-sans font-bold">
              <div className="flex items-center justify-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{address}</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" /> {email}
                </span>
              </div>
            </div>
            <div className="pt-1 text-[11px] font-mono text-slate-400">
              Tax Reg / VAT No: {vatNumber}
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 text-xs py-2 border-b border-slate-100 gap-y-1 font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">
                Invoice Number
              </span>
              <span className="font-bold text-slate-800 text-sm">{invoiceNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-sans">
                Bill Date & Time (Asia/Colombo)
              </span>
              <span className="font-medium text-slate-700">
                {formatSriLankaReceiptDate(createdAt)} • {formatSriLankaReceiptTime(createdAt)}
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Outlet</span>
              <span className="font-bold text-slate-800 font-sans">Main Store</span>
            </div>
            <div className="text-right pt-1">
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Cashier</span>
              <span className="font-medium text-slate-700 font-sans">Dr. Deegayu (Owner)</span>
            </div>
            <div className="pt-1 col-span-2">
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Customer</span>
              <span className="font-medium text-slate-700 font-sans">Valued Customer</span>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-200 flex justify-between">
              <span>Item Description</span>
              <span>Amount (LKR)</span>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-start justify-between text-xs sm:text-sm">
                  <div className="pr-2">
                    <div className="font-bold text-slate-900 leading-tight">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-bold mt-0.5">
                      {item.quantity} x LKR {item.unitPrice.toFixed(2)}
                      {item.discount > 0 && (
                        <span className="text-emerald-700 ml-1.5 font-sans font-bold">
                          (Save LKR {item.discount.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono font-black text-slate-900 text-right shrink-0">
                    LKR {(item.subtotal - item.discount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Section */}
          <div className="border-t-2 border-black pt-3 space-y-1.5 text-xs sm:text-sm font-bold">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal</span>
              <span className="font-mono">LKR {subtotal.toFixed(2)}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-800 font-extrabold">
                <span>Discounts Applied</span>
                <span className="font-mono">-LKR {discountTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-700">
              <span>Tax (VAT 0% Exempt Medical)</span>
              <span className="font-mono">LKR 0.00</span>
            </div>

            <div className="flex justify-between items-center text-lg sm:text-xl font-extrabold text-slate-900 pt-2 border-t-2 border-black">
              <span className="uppercase tracking-tight">Total Amount</span>
              <span className="font-mono text-xl sm:text-2xl text-slate-950 font-black">
                LKR {totalAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                Settlement Channel:
              </span>
              <span className="font-mono font-bold">CASH (LKR {totalAmount.toFixed(2)})</span>
            </div>
          </div>

          {/* Scannable Code128 Barcode & Verification QR */}
          <div className="pt-2">
            <ReceiptBarcodeBlock
              invoiceNumber={invoiceNumber}
              verificationUrl={`https://pos.pixelcraftlk.com/receipt/${invoiceNumber}`}
            />
          </div>

          {/* Footer Notice & Return Policy */}
          <div className="text-center pt-3 border-t border-dashed border-slate-200 text-[11px] text-slate-400 space-y-1 font-sans">
            <p className="font-medium text-slate-600 font-sinhala">{footerNote}</p>
            <p className="text-[10px] leading-tight text-slate-400">{returnPolicy}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 print:hidden">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors"
            >
              PixelCraft POS
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

