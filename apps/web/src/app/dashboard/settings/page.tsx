'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Save,
  Printer,
  CheckCircle2,
  Sparkles,
  Building2,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import type { PaperSize } from '../../../components/pos/receipt-modal';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { businessApi } from '../../../lib/api-client';

export default function SettingsDocumentPage() {
  const { business, currency, refreshProfile, hasPermission } = useTenantBranch();

  // Settings states
  const [paperSize, setPaperSize] = useState<PaperSize>('MM_80');
  const [showLogo, setShowLogo] = useState(true);
  const [showTax, setShowTax] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [returnPolicyText, setReturnPolicyText] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial settings from business profile
  useEffect(() => {
    if (business?.settings) {
      const s = business.settings;
      if (s.receiptPaperSize) setPaperSize(s.receiptPaperSize as PaperSize);
      if (s.showLogoOnReceipt !== undefined) setShowLogo(s.showLogoOnReceipt);
      if (s.showTaxDetails !== undefined) setShowTax(s.showTaxDetails);
      if (s.showBarcodeOnReceipt !== undefined) setShowBarcode(s.showBarcodeOnReceipt);
      if (s.receiptHeader) setReceiptHeader(s.receiptHeader);
      if (s.receiptFooter) setReceiptFooter(s.receiptFooter);
      if (s.returnPolicyText) setReturnPolicyText(s.returnPolicyText);
    } else {
      // Default initial templates
      setReceiptHeader('Welcome to PixelCraft Flagship Store!');
      setReceiptFooter('Thank you for shopping with us! Exchange within 7 days with original receipt.');
      setReturnPolicyText('Goods in original condition exchangeable within 7 days. Perishables are non-returnable.');
    }
  }, [business?.settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('settings:manage')) {
      alert('You do not have permission to manage store settings.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await businessApi.updateReceiptSettings({
        receiptPaperSize: paperSize === 'A5' ? 'A4' : paperSize,
        showLogoOnReceipt: showLogo,
        showTaxDetails: showTax,
        showBarcodeOnReceipt: showBarcode,
        receiptHeader: receiptHeader.trim() || null,
        receiptFooter: receiptFooter.trim() || null,
        returnPolicyText: returnPolicyText.trim() || null,
      });

      setSaveSuccess(true);
      await refreshProfile();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.error('Failed to save receipt settings:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to save settings.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (preset: 'retail' | 'cafe' | 'wholesale') => {
    if (preset === 'retail') {
      setPaperSize('MM_80');
      setShowLogo(true);
      setShowTax(true);
      setShowBarcode(true);
      setReceiptHeader('Welcome to PixelCraft Retail • Always Fresh!');
      setReceiptFooter('Thank you for shopping with us! Please check goods before leaving.');
      setReturnPolicyText('Exchange permitted within 7 days with this receipt. No refunds.');
    } else if (preset === 'cafe') {
      setPaperSize('MM_58');
      setShowLogo(true);
      setShowTax(false);
      setShowBarcode(true);
      setReceiptHeader('PixelCraft Artisan Cafe & Bakery');
      setReceiptFooter('Baked with love! Have a wonderful day!');
      setReturnPolicyText('Food and beverage items once prepared cannot be returned.');
    } else if (preset === 'wholesale') {
      setPaperSize('A4');
      setShowLogo(true);
      setShowTax(true);
      setShowBarcode(true);
      setReceiptHeader('PixelCraft Wholesale Distributors • Official Commercial Tax Invoice');
      setReceiptFooter('Payment due within 30 days of invoice date. Late interest 2% per month.');
      setReturnPolicyText('Damaged shipments must be reported within 48 hours with photographic proof.');
    }
  };

  const getPreviewWidthClass = () => {
    switch (paperSize) {
      case 'MM_58':
        return 'w-[250px] text-[10px]';
      case 'A4':
        return 'w-full max-w-[460px] text-xs';
      case 'MM_80':
      default:
        return 'w-[320px] text-xs';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Dynamic CSS print rule for test print */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #settings-receipt-live-preview,
          #settings-receipt-live-preview * {
            visibility: visible !important;
          }
          #settings-receipt-live-preview {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperSize === 'MM_58' ? '58mm' : paperSize === 'A4' ? '100%' : '80mm'} !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 0;
            size: ${paperSize === 'A4' ? 'A4 portrait' : paperSize === 'MM_58' ? '58mm auto' : '80mm auto'};
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Document & Receipt Settings
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-[#2F65F6] border border-blue-200">
              ESC/POS & Invoicing
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure thermal paper widths, store branding, VAT details, custom header/footer notes, and return policies.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('retail')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              80mm
            </button>
            <button
              type="button"
              onClick={() => applyPreset('cafe')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              58mm
            </button>
            <button
              type="button"
              onClick={() => applyPreset('wholesale')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              A4
            </button>
          </div>

          {/* Tab Navigation between Document Design and Hardware Bridge */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
            <div className="px-3.5 py-1.5 rounded-xl bg-white text-indigo-600 shadow-xs font-bold">
              Receipt Template
            </div>
            <Link
              href="/dashboard/settings/hardware"
              className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
            >
              Hardware & ESC/POS
            </Link>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Settings Configuration Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Section 1: Paper Size */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Thermal Paper Roll & Invoice Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    id: 'MM_80',
                    title: '80mm (3-inch)',
                    desc: 'Standard retail touch POS roll',
                  },
                  {
                    id: 'MM_58',
                    title: '58mm (2-inch)',
                    desc: 'Compact mobile / cafe roll',
                  },
                  {
                    id: 'A4',
                    title: 'A4 / Letter',
                    desc: 'Corporate tax invoice format',
                  },
                ].map((item) => {
                  const isSelected = paperSize === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setPaperSize(item.id as PaperSize)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#2F65F6] bg-blue-50/60 ring-2 ring-[#2F65F6]/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{item.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Visual Elements Toggles */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Visual Branding & Document Badges
              </label>
              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show Brand Logo</div>
                    <div className="text-[11px] text-slate-400">Renders store logo and monogram atop receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show VAT / Tax Details</div>
                    <div className="text-[11px] text-slate-400">Renders VAT registration number and tax breakdown lines</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showTax}
                    onChange={(e) => setShowTax(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show Barcode (Code128) & Verification QR</div>
                    <div className="text-[11px] text-slate-400">Enables barcode scanner re-entry and customer digital receipt verification</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2F65F6] focus:ring-[#2F65F6]"
                  />
                </label>
              </div>
            </div>

            {/* Section 3: Custom Text Fields */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Custom Headers, Footers & Terms
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Header Note (Greeting / Sub-header)
                </label>
                <textarea
                  rows={2}
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  placeholder="e.g. Welcome to Colombo Flagship Store • Open daily 8 AM - 10 PM"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Footer Message
                </label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="e.g. Thank you for shopping with us! Exchange within 7 days with original receipt."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return & Exchange Policy
                </label>
                <textarea
                  rows={2}
                  value={returnPolicyText}
                  onChange={(e) => setReturnPolicyText(e.target.value)}
                  placeholder="e.g. Goods in original packaging exchangeable within 7 days. Perishables cannot be returned."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6]"
                />
              </div>
            </div>

            {/* Error or Success notification */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Receipt template settings saved successfully! Changes reflect on all new receipts immediately.</span>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="py-2.5 px-6 rounded-xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white text-xs font-bold shadow-pos-btn flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Document Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Interactive Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2F65F6]" />
              Live Receipt Preview ({paperSize.replace('MM_', '')}mm)
            </span>
            <button
              onClick={() => window.print()}
              className="py-1 px-3 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"
              title="Test printer output"
            >
              <Printer className="w-3 h-3 text-slate-500" />
              <span>Test Print</span>
            </button>
          </div>

          {/* Live Preview Paper Card */}
          <div
            id="settings-receipt-live-preview"
            className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-md font-mono text-slate-900 transition-all duration-200 ${getPreviewWidthClass()}`}
          >
            {/* Header */}
            <div className="text-center space-y-1 pb-2">
              <div className="text-sm font-black tracking-tight text-slate-950 uppercase">
                {business?.legalName || business?.name || 'PixelCraft POS Store'}
              </div>
              <div className="text-[10px] text-slate-600 font-sans font-medium flex items-center justify-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>{business?.primaryBranch?.name || 'Flagship Branch'}</span>
              </div>
              <div className="text-[9px] text-slate-400 font-sans">
                123 Galle Road, Colombo 03 • Tel: +94 11 234 5678
              </div>
              {showTax && (
                <div className="text-[9px] font-bold text-slate-700 pt-0.5">
                  VAT Reg: {business?.settings?.taxNumber || 'VAT-987654321'}
                </div>
              )}
            </div>

            {/* Custom Header */}
            {receiptHeader && (
              <div className="py-1 text-center text-[9px] italic text-slate-600 border-t border-dotted border-slate-200">
                {receiptHeader}
              </div>
            )}

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Transaction Info */}
            <div className="space-y-0.5 text-[9px] text-slate-600">
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <span className="font-bold text-slate-900">INV-2026-00042</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>Cashier Station 01</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-slate-800">Walk-in Customer</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Sample Items */}
            <div className="space-y-1.5 text-[10px]">
              <div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-900">Ceylon Earl Grey Tea (100g)</span>
                  <span className="font-bold">{currency} 1,700.00</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>2 x {currency} 850.00</span>
                  <span className="italic text-[#2F65F6]">Gift wrap</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-900">Roasted Cashew Nuts (200g)</span>
                  <span className="font-bold">{currency} 1,450.00</span>
                </div>
                <div className="text-[9px] text-slate-400">
                  <span>1 x {currency} 1,450.00</span>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Financials */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{currency} 3,150.00</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Discount (5%)</span>
                <span>-{currency} 157.50</span>
              </div>
              {showTax && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT (8%)</span>
                  <span>{currency} 239.40</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-900 text-slate-950">
                <span>TOTAL DUE</span>
                <span>{currency} 3,231.90</span>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 pt-1">
                <span>Paid (CASH)</span>
                <span>{currency} 3,500.00</span>
              </div>
              <div className="flex justify-between text-[9px] text-emerald-700 font-bold">
                <span>Change Given</span>
                <span>{currency} 268.10</span>
              </div>
            </div>

            {/* Barcode & QR */}
            {showBarcode && (
              <div className="pt-2.5 border-t border-dashed border-slate-300 text-center space-y-1">
                <div className="font-mono text-[9px] tracking-widest text-slate-400 py-1 bg-slate-50 rounded">
                  ||| | ||||| || |||| |||| |||
                </div>
                <div className="text-[9px] font-mono text-slate-500">INV-2026-00042</div>
                <div className="w-12 h-12 border border-slate-200 rounded mx-auto flex items-center justify-center bg-slate-50">
                  <QrCode className="w-8 h-8 text-slate-700" />
                </div>
                <div className="text-[8px] text-slate-400 font-sans">
                  pos.pixelcraftlk.com/verify/INV-2026-00042
                </div>
              </div>
            )}

            {/* Footer & Policy */}
            <div className="pt-2 text-center space-y-0.5 border-t border-dotted border-slate-200 mt-2 font-sans">
              {receiptFooter && (
                <div className="text-[9px] font-semibold text-slate-700">
                  {receiptFooter}
                </div>
              )}
              {returnPolicyText && (
                <div className="text-[8px] text-slate-400 italic leading-tight">
                  {returnPolicyText}
                </div>
              )}
              <div className="text-[7px] text-slate-300 uppercase tracking-wider pt-1">
                Powered by PixelCraft POS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
