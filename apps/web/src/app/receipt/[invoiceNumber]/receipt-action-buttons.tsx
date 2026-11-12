'use client';

import React from 'react';
import Link from 'next/link';
import { Printer } from 'lucide-react';

export function ReceiptActionButtons() {
  return (
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
  );
}

