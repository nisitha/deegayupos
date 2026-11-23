'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  Sparkles,
  CheckCircle2,
  Building2,
  DollarSign,
  Send,
  Radio,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { ReceiptDocumentDto, SaleDto } from '@pixelcraft/types';
import { posApi } from '../../lib/api-client';
import { PrinterBridge } from '../../lib/hardware/printer-bridge';
import { ReceiptBarcodeBlock } from './receipt-barcode-block';
import { useTenantBranch } from '../../context/tenant-branch-context';
import { detectUnitConfig } from '../../lib/unit-utils';
import { getReceiptColomboDateAndTime } from '../../lib/date-utils';

function formatReceiptQuantity(productName: string, quantity: number | string): string {
  const num = Number(quantity);
  const conf = detectUnitConfig({ name: productName });
  if (conf.mode === 'weight_g') {
    if (num >= 1000) {
      const kg = Math.round((num / 1000) * 1000) / 1000;
      return `${kg} kg (${num.toLocaleString(undefined, { maximumFractionDigits: 3 })} g)`;
    }
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`;
  }
  if (conf.mode === 'volume_ml') {
    if (num >= 1000) {
      const l = Math.round((num / 1000) * 1000) / 1000;
      return `${l} L (${num.toLocaleString(undefined, { maximumFractionDigits: 3 })} ml)`;
    }
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 3 })} ml`;
  }
  if (conf.mode === 'fractional') {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${conf.baseUnit}`;
  }
  return `${num}`;
}

export type PaperSize = 'MM_80' | 'MM_58' | 'A4' | 'A5';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSale?: () => void;
  saleId?: string;
  initialSale?: SaleDto | null;
  currency?: string;
}

export function ReceiptModal({
  isOpen,
  onClose,
  onNewSale,
  saleId,
  initialSale,
  currency = 'LKR',
}: ReceiptModalProps) {
  const { business, branches, user, activeCashier } = useTenantBranch();
  const [receiptData, setReceiptData] = useState<ReceiptDocumentDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('MM_80');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDirectPrinting, setIsDirectPrinting] = useState(false);
  const [directPrintStatus, setDirectPrintStatus] = useState<string | null>(null);

  // Digital Dispatch (Email / SMS)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareRecipient, setShareRecipient] = useState('');
  const [shareMode, setShareMode] = useState<'SMS' | 'EMAIL'>('SMS');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Sync initial hardware setting for default paper width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hw = PrinterBridge.getSettings();
      if (hw.paperWidth === '58mm') {
        setPaperSize('MM_58');
      }
    }
  }, []);

  // Fetch complete receipt document payload from API if saleId is provided
  useEffect(() => {
    if (!isOpen) return;

    const targetId = saleId || initialSale?.id;
    if (!targetId) return;

    let isMounted = true;
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await posApi.getReceiptDocument(targetId);
        if (isMounted && res.data) {
          setReceiptData(res.data);
          if (res.data.settings?.paperSize && res.data.settings.paperSize !== 'MM_80') {
            setPaperSize(res.data.settings.paperSize as PaperSize);
          }
        }
      } catch (err) {
        console.warn('Failed to load complete receipt payload, falling back to initial sale:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReceipt();

    return () => {
      isMounted = false;
    };
  }, [isOpen, saleId, initialSale?.id]);

  const effectiveSale = receiptData?.sale || initialSale;
  const invoiceNumber = effectiveSale?.invoiceNumber || 'INV-DRAFT';
  const verificationUrl =
    receiptData?.barcodeData?.verificationUrl ||
    `https://pos.pixelcraftlk.com/receipt/${invoiceNumber}`;

  // Generate QR Code URL
  useEffect(() => {
    if (verificationUrl && isOpen) {
      QRCode.toDataURL(
        verificationUrl,
        {
          width: paperSize === 'MM_58' ? 90 : 110,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        },
        (err, url) => {
          if (!err && url) {
            setQrCodeUrl(url);
          }
        },
      );
    }
  }, [verificationUrl, isOpen, paperSize]);

  // Keyboard shortcut listener: Enter = Print, Esc = Close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isShareModalOpen) {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape') {
        if (isShareModalOpen) setIsShareModalOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen) return null;

  // Standard Browser Print Trigger
  const handlePrint = () => {
    if (!effectiveSale) return;
    const hw = PrinterBridge.getSettings();
    PrinterBridge.printViaBrowser(
      effectiveSale,
      {
        ...hw,
        paperWidth: paperSize === 'MM_58' ? '58mm' : '80mm',
      },
      {
        storeName: businessName,
        branchName: branchName,
        address: branchAddress,
        phone: branchPhone,
        taxNumber: taxNumber,
        logoUrl: logoUrl || undefined,
      },
    );
  };

  // Direct ESC/POS Thermal Print (Bluetooth / Network RAW / USB)
  const handleDirectEscPosPrint = async () => {
    if (!effectiveSale) return;
    setIsDirectPrinting(true);
    setDirectPrintStatus('Dispatching ESC/POS stream to thermal printer...');
    try {
      await PrinterBridge.printReceipt(
        effectiveSale,
        {
          paperWidth: paperSize === 'MM_58' ? '58mm' : '80mm',
        },
        {
          storeName: businessName,
          branchName: branchName,
          address: branchAddress,
          phone: branchPhone,
          taxNumber: taxNumber,
        },
      );
      setDirectPrintStatus('✓ ESC/POS thermal print dispatched successfully!');
      setTimeout(() => setDirectPrintStatus(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Direct ESC/POS print failed';
      setDirectPrintStatus(`❌ ${msg}`);
      setTimeout(() => setDirectPrintStatus(null), 5000);
    } finally {
      setIsDirectPrinting(false);
    }
  };

  // Trigger Cash Drawer Pulse
  const handleDrawerKick = async () => {
    try {
      await PrinterBridge.kickCashDrawer();
      setDirectPrintStatus('✓ Cash drawer pulse triggered (ESC p 0 25 250)');
      setTimeout(() => setDirectPrintStatus(null), 3000);
    } catch {
      // ignore
    }
  };

  // Handle PDF Download
  const handleDownloadPdf = async () => {
    if (!effectiveSale?.id) return;
    try {
      setIsDownloadingPdf(true);
      await posApi.downloadPdf(effectiveSale.id, effectiveSale.invoiceNumber);
    } catch (err) {
      console.error('Failed to download PDF invoice:', err);
      // Fallback: trigger print dialog in A4 mode
      setPaperSize('A4');
      setTimeout(() => window.print(), 200);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Handle Send Electronic Receipt
  const handleSendDigitalReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareRecipient.trim()) return;
    setShareFeedback(`✓ Receipt #${invoiceNumber} successfully dispatched to ${shareRecipient}!`);
    setTimeout(() => {
      setShareFeedback(null);
      setIsShareModalOpen(false);
      setShareRecipient('');
    }, 2000);
  };

  const formatCurrency = (val?: number) => {
    const num = val ?? 0;
    return `${currency} ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Paper width styles for screen preview
  const getPaperWidthClass = () => {
    switch (paperSize) {
      case 'MM_58':
        return 'w-[270px] text-[10px]';
      case 'A4':
        return 'w-full max-w-[660px] text-xs';
      case 'A5':
        return 'w-full max-w-[500px] text-xs';
      case 'MM_80':
      default:
        return 'w-[340px] text-xs';
    }
  };

  const businessName =
    receiptData?.business?.legalName || receiptData?.business?.name || business?.name || 'DEEGAYU WEDA MADHURA';
  const logoUrl =
    (receiptData?.settings as { logoUrl?: string | null } | undefined)?.logoUrl ||
    (receiptData?.business as { logoUrl?: string | null } | undefined)?.logoUrl ||
    business?.logoUrl;
  const matchedBranch = branches?.find(
    (b) => b.id === (effectiveSale?.branchId || receiptData?.branch?.id)
  );
  const branchName =
    effectiveSale?.branchName ||
    matchedBranch?.name ||
    receiptData?.branch?.name ||
    'Alawwa';
  const branchAddress =
    matchedBranch?.address ||
    receiptData?.branch?.address ||
    business?.address ||
    'Deegayu Weda Madhura, Sri Lanka';
  const branchPhone =
    matchedBranch?.phone ||
    receiptData?.branch?.phone ||
    business?.phone ||
    '0372077180';
  const cashierName =
    receiptData?.cashier?.fullName ||
    effectiveSale?.cashier?.fullName ||
    effectiveSale?.cashierName ||
    activeCashier?.fullName ||
    user?.fullName ||
    'Branch Cashier';
  const { dateStr: billDate, timeStr: billTime } = getReceiptColomboDateAndTime(effectiveSale?.createdAt);
  const taxNumber = receiptData?.settings?.taxNumber || 'VAT-10928392-8000';
  const receiptHeader = receiptData?.settings?.receiptHeader;
  const receiptFooter =
    receiptData?.settings?.receiptFooter || 'Thank You Come Again';
  const returnPolicy = receiptData?.settings?.returnPolicyText;
  const showBarcode = receiptData?.settings ? (receiptData.settings.showBarcode ?? true) : true;
  const showTax = receiptData?.settings ? (receiptData.settings.showTaxDetails ?? true) : true;

  const isA4OrA5 = paperSize === 'A4' || paperSize === 'A5';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Dynamic CSS @media print style */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #pixelcraft-receipt-printable,
          #pixelcraft-receipt-printable * {
            visibility: visible !important;
          }
          #pixelcraft-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperSize === 'MM_58'
          ? '58mm'
          : paperSize === 'A4'
            ? '100%'
            : paperSize === 'A5'
              ? '148mm'
              : '80mm'} !important;
            margin: 0 !important;
            padding: ${isA4OrA5 ? '10mm' : '3mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 0;
            size: ${paperSize === 'A4'
          ? 'A4 portrait'
          : paperSize === 'A5'
            ? 'A5 portrait'
            : paperSize === 'MM_58'
              ? '58mm auto'
              : '80mm auto'};
          }
        }
      `}</style>

      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[94dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Receipt & Printable Tax Invoice</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold border border-indigo-200">
                  #{invoiceNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Direct ESC/POS thermal & A4 wholesale tax invoice engine
              </p>
            </div>
          </div>

          {/* Paper Size Switcher Tabs */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-2xl shadow-2xs">
            {(
              [
                { id: 'MM_80', label: '80mm (3")' },
                { id: 'MM_58', label: '58mm (2")' },
                { id: 'A4', label: 'A4 Tax Invoice' },
                { id: 'A5', label: 'A5' },
              ] as const
            ).map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setPaperSize(size.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${paperSize === size.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close [Esc]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {directPrintStatus && (
          <div
            className={`px-5 py-2 text-xs font-semibold flex items-center justify-between border-b ${directPrintStatus.startsWith('✓')
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : directPrintStatus.startsWith('❌')
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
              }`}
          >
            <span>{directPrintStatus}</span>
            <button
              onClick={() => setDirectPrintStatus(null)}
              className="text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Receipt Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 flex justify-center">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading printable receipt...
            </div>
          ) : isA4OrA5 ? (
            /* =========================================================
               WHOLESALE PHARMACY COMMERCIAL TAX INVOICE (A4 / A5)
            ========================================================= */
            <div
              id="pixelcraft-receipt-printable"
              ref={printAreaRef}
              className={`bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-slate-900 transition-all font-sans ${getPaperWidthClass()}`}
            >
              {/* Official Letterhead */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div className="flex items-start gap-3">
                  {logoUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/80 p-1 shrink-0">
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-black uppercase tracking-tight">
                      {businessName}
                    </h1>
                    <div className="text-sm font-bold text-black mt-1 flex items-center gap-1">
                      <Building2 className="w-4 h-4 text-black shrink-0" />
                      <span>Outlet: {branchName}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-black font-medium mt-0.5 max-w-sm leading-snug">
                      {branchAddress}
                    </div>
                    <div className="text-xs sm:text-sm text-black font-mono font-bold mt-1 space-y-0.5">
                      <div>Giriulla - 0372289339</div>
                      <div>Dambadeniya - 0372266444</div>
                      <div>Alawwa - 0372077180</div>
                      <div>WhatsApp: +94772634497</div>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-black mt-0.5">
                      VAT / Tax Reg ID: {taxNumber}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-extrabold text-black uppercase tracking-wider">
                    TAX INVOICE
                  </div>
                  <div className="mt-2 text-sm sm:text-base font-mono font-bold text-black">
                    #{invoiceNumber}
                  </div>
                  <div className="text-xs sm:text-sm text-black font-mono font-bold">
                    Date: {billDate}
                  </div>
                  <div className="text-xs sm:text-sm text-black font-mono font-bold">
                    Time: {billTime}
                  </div>
                </div>
              </div>

              {/* Billed To / Client Section */}
              <div className="grid grid-cols-2 gap-4 my-4 p-4 bg-slate-50 rounded-2xl border-2 border-black text-xs sm:text-sm text-black font-medium">
                <div>
                  <span className="text-xs uppercase font-extrabold text-black block tracking-wider">
                    Billed To / Customer
                  </span>
                  <div className="font-extrabold text-black text-base sm:text-lg mt-0.5">
                    {effectiveSale?.customerName || 'General Wholesale / Retail Client'}
                  </div>
                  <div className="text-xs sm:text-sm text-black font-mono font-bold mt-0.5">
                    Account Status: Verified Customer
                  </div>
                </div>
                <div className="text-right font-mono text-xs sm:text-sm text-black font-bold">
                  <div>Outlet: <span className="font-extrabold text-black">{branchName}</span></div>
                  <div>Station: REG-01</div>
                  <div>Dispensed By: <span className="font-extrabold text-black">{cashierName}</span></div>
                  <div className="text-black font-extrabold">Original Customer Copy</div>
                </div>
              </div>

              {/* Wholesale Itemized Table */}
              <div className="my-4 overflow-hidden rounded-2xl border-2 border-black">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-black font-extrabold uppercase border-b-2 border-black">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Price ({currency})</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right">Total ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30 font-mono text-xs sm:text-[13px]">
                    {(effectiveSale?.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-black font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-black">
                          <div>{item.productName}</div>
                          {(item.productName.includes('(25-Pack Bulk)') || (item as any).isSpecialBulk) && (
                            <div className="text-[11px] text-slate-600 font-mono font-normal">
                              {item.quantity} × 25-Pack = {item.quantity * 25} units @ LKR {(Number(item.unitPrice) / 25).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-black font-semibold">{item.sku || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-black">{Number(item.unitPrice).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-black">{formatReceiptQuantity(item.productName, item.quantity)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-black">
                          {item.discountAmount && Number(item.discountAmount) > 0
                            ? `-${Number(item.discountAmount).toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-black">
                          {Number(item.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals & Signatures */}
              <div className="grid grid-cols-2 gap-6 mt-4 pt-2">
                <div className="space-y-4">
                  <div className="text-xs sm:text-sm text-black space-y-1 font-bold">
                    <span className="font-extrabold text-black block">Payment Method</span>
                    {(effectiveSale?.payments || []).map((p, idx) => (
                      <div key={idx} className="text-black font-mono">
                        • {p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT' ? 'Store Credit' : p.paymentMethod}: {currency} {Number(p.amount).toFixed(2)}
                      </div>
                    ))}
                  </div>

                  {qrCodeUrl && (
                    <div className="flex items-center gap-3 pt-2">
                      <img src={qrCodeUrl} alt="Verify QR" className="w-16 h-16 border-2 border-black rounded-lg p-0.5" />
                      <div className="text-[11px] text-black font-mono font-bold leading-tight">
                        Authentic Digital Receipt<br />
                        Scan QR code to verify tax certificate & batch validity.
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 font-mono text-sm sm:text-base text-right text-black font-bold">
                  <div className="flex justify-between text-black">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(Number(effectiveSale?.subtotal || 0))}</span>
                  </div>
                  {Number(effectiveSale?.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-black font-extrabold">
                      <span>Total Savings / Discount:</span>
                      <span>-{formatCurrency(Number(effectiveSale?.discountAmount))}</span>
                    </div>
                  )}
                  {Number(effectiveSale?.taxAmount || 0) > 0 && (
                    <div className="flex justify-between text-black">
                      <span>VAT (18%):</span>
                      <span>{formatCurrency(Number(effectiveSale?.taxAmount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg sm:text-2xl font-extrabold text-black pt-2 border-t-2 border-black">
                    <span>NET TOTAL PAYABLE:</span>
                    <span className="text-black">{formatCurrency(Number(effectiveSale?.totalAmount || 0))}</span>
                  </div>
                </div>
              </div>

              {/* Authorized Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-12 mt-6 border-t border-slate-200 text-xs text-slate-500 text-center font-sans">
                <div>
                  <div className="border-t border-slate-400 w-44 mx-auto pt-1 font-bold text-slate-800">
                    Dispensed By / Pharmacist
                  </div>
                  <span className="text-[10px] text-slate-400">Authorized Signature & Seal</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 w-44 mx-auto pt-1 font-bold text-slate-800">
                    Received in Good Condition
                  </div>
                  <span className="text-[10px] text-slate-400">Customer / Agent Signature</span>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================
               STANDARD 80MM / 58MM THERMAL RECEIPT SLIP
            ========================================================= */
            <div
              id="pixelcraft-receipt-printable"
              ref={printAreaRef}
              className={`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm font-mono text-slate-900 transition-all duration-150 ${getPaperWidthClass()}`}
            >
              {/* Header: Store Identity */}
              <div className="text-center space-y-1 pb-2">
                {logoUrl && (
                  <div className="flex justify-center mb-1.5">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/80 p-0.5">
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="text-lg sm:text-xl font-extrabold tracking-tight text-black uppercase">
                  {businessName}
                </div>
                <div className="text-xs sm:text-[13px] font-bold text-black font-sans flex items-center justify-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-black shrink-0" />
                  <span>Outlet: {branchName}</span>
                </div>
                {branchAddress && (
                  <div className="text-xs font-bold text-black font-sans max-w-[260px] mx-auto leading-tight">
                    {branchAddress}
                  </div>
                )}
                <div className="text-[11px] sm:text-xs font-bold text-black font-mono space-y-0.5 pt-1 text-center">
                  <div>Giriulla - 0372289339</div>
                  <div>Dambadeniya - 0372266444</div>
                  <div>Alawwa - 0372077180</div>
                  <div>WhatsApp: +94772634497</div>
                </div>
                {showTax && taxNumber && (
                  <div className="text-xs font-bold text-black pt-0.5">
                    VAT / Tax Reg: {taxNumber}
                  </div>
                )}
              </div>

              {receiptHeader && (
                <div className="py-1 text-center text-xs font-bold text-black border-t border-dotted border-black">
                  {receiptHeader}
                </div>
              )}

              <div className="border-t-2 border-black my-2" />

              {/* Transaction Metadata */}
              <div className="space-y-1 text-xs sm:text-[12.5px] font-bold text-black">
                <div className="flex justify-between">
                  <span>Invoice #:</span>
                  <span className="font-extrabold text-black">#{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-bold text-black">{billDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span className="font-bold text-black">{billTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Outlet:</span>
                  <span className="font-bold text-black">{branchName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Station:</span>
                  <span>REG-01</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span className="font-extrabold text-black">{cashierName}</span>
                </div>
                {effectiveSale?.customerName && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-extrabold text-black">{effectiveSale.customerName}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 border-black my-2" />

              {/* Itemized Table */}
              <div className="flex justify-between text-xs sm:text-[13px] font-extrabold uppercase text-black border-b border-dashed border-black pb-1 mb-1.5">
                <span>Item Description</span>
                <span>Total ({currency})</span>
              </div>
              <div className="space-y-2">
                {(effectiveSale?.items || []).map((item, idx) => (
                  <div key={idx} className="text-xs sm:text-[13.5px]">
                    <div className="flex justify-between">
                      <span className="font-bold text-black truncate max-w-[200px]">
                        {item.productName}
                      </span>
                      <span className="font-extrabold text-black">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                    {(item.productName.includes('(25-Pack Bulk)') || (item as any).isSpecialBulk) && (
                      <div className="text-[11px] text-slate-700 font-mono font-semibold">
                        {item.quantity} × 25-Pack = {item.quantity * 25} units @ LKR {(Number(item.unitPrice) / 25).toFixed(2)}
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold text-black">
                      <span>{formatReceiptQuantity(item.productName, item.quantity)} x {formatCurrency(Number(item.unitPrice))}</span>
                      {item.discountAmount && Number(item.discountAmount) > 0 && (
                        <span className="text-black font-extrabold text-[11px]">
                          (Disc: -{formatCurrency(Number(item.discountAmount))})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black my-2.5" />

              {/* Financial Breakdown */}
              <div className="space-y-1 text-xs sm:text-[13.5px] font-bold text-black">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(effectiveSale?.subtotal || 0))}</span>
                </div>

                {Number(effectiveSale?.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-black font-extrabold">
                    <span>Discount</span>
                    <span>-{formatCurrency(Number(effectiveSale?.discountAmount))}</span>
                  </div>
                )}

                {showTax && Number(effectiveSale?.taxAmount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Sales Tax (VAT)</span>
                    <span>{formatCurrency(Number(effectiveSale?.taxAmount))}</span>
                  </div>
                )}

                <div className="flex justify-between font-extrabold text-lg sm:text-xl py-1.5 border-y-2 border-black text-black">
                  <span>NET TOTAL</span>
                  <span className="font-mono">
                    {formatCurrency(Number(effectiveSale?.totalAmount || 0))}
                  </span>
                </div>

                {/* Tender Breakdown */}
                <div className="pt-1.5 space-y-1 text-xs sm:text-[12.5px] font-bold text-black border-t border-black/30">
                  {(effectiveSale?.payments || []).map((p, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>
                        Paid ({p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT' ? 'Store Credit' : p.paymentMethod}):
                      </span>
                      <span className="font-extrabold text-black">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  ))}

                  {Number(effectiveSale?.changeDue || 0) > 0 && (
                    <div className="flex justify-between text-black font-extrabold text-xs sm:text-sm">
                      <span>Change Given:</span>
                      <span>{formatCurrency(Number(effectiveSale?.changeDue))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Authentic Code128 Barcode & Scannable QR Code */}
              <ReceiptBarcodeBlock
                invoiceNumber={invoiceNumber}
                verificationUrl={verificationUrl}
                paperWidth={paperSize === 'MM_58' ? '58mm' : '80mm'}
                showBarcode={showBarcode}
                showQr={true}
                captionText="Scan to verify receipt online"
              />

              {/* Footer Note & Return Policy */}
              <div className="pt-2 text-center space-y-1 border-t border-dotted border-black mt-2 font-sans">
                {receiptFooter && (
                  <div className="text-xs font-semibold text-black">
                    {receiptFooter}
                  </div>
                )}
                {returnPolicy && (
                  <div className="text-[11px] text-black font-medium italic max-w-[260px] mx-auto leading-tight">
                    {returnPolicy}
                  </div>
                )}
                <div className="text-[9px] text-black font-bold tracking-wider uppercase pt-1">
                  Powered by PixelCraft POS • pos.pixelcraftlk.com
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Controls */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-slate-500" />
              <span>Email/SMS</span>
            </button>

            <button
              type="button"
              onClick={handleDrawerKick}
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Kick cash drawer pulse (ESC p 0 25 250)"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open Drawer</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onNewSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>New Sale</span>
              </button>
            )}

            {/* Direct ESC/POS Thermal Button */}
            <button
              type="button"
              disabled={isDirectPrinting}
              onClick={handleDirectEscPosPrint}
              className="py-2.5 px-3.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Stream direct ESC/POS byte buffer to Bluetooth/LAN/USB printer"
            >
              <Radio className="w-3.5 h-3.5 text-indigo-600" />
              <span>ESC/POS Stream</span>
            </button>

            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print [{paperSize.replace('MM_', '')}mm] <kbd className="text-[10px] opacity-75 font-mono">↵</kbd></span>
            </button>
          </div>
        </div>
      </div>

      {/* Digital Dispatch (SMS / Email) Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span>Send Digital Receipt</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {shareFeedback ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl text-center">
                {shareFeedback}
              </div>
            ) : (
              <form onSubmit={handleSendDigitalReceipt} className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShareMode('SMS')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${shareMode === 'SMS'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareMode('EMAIL')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${shareMode === 'EMAIL'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                  >
                    Email
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {shareMode === 'SMS' ? 'Recipient Mobile (e.g. 077 123 4567)' : 'Recipient Email Address'}
                  </label>
                  <input
                    type={shareMode === 'SMS' ? 'tel' : 'email'}
                    required
                    placeholder={shareMode === 'SMS' ? '077 123 4567' : 'customer@gmail.com'}
                    value={shareRecipient}
                    onChange={(e) => setShareRecipient(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(false)}
                    className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                  >
                    Send Receipt
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
