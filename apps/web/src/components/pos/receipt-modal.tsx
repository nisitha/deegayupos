'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  Sparkles,
  CheckCircle2,
  Building2,
  Phone,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { ReceiptDocumentDto, SaleDto } from '@pixelcraft/types';
import { posApi } from '../../lib/api-client';

export type PaperSize = 'MM_80' | 'MM_58' | 'A4';

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
  const [receiptData, setReceiptData] = useState<ReceiptDocumentDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('MM_80');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

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
          if (res.data.settings?.paperSize) {
            setPaperSize(res.data.settings.paperSize);
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
    `https://pos.pixelcraftlk.com/verify/${invoiceNumber}`;

  // Generate Barcode SVG
  useEffect(() => {
    if (barcodeRef.current && invoiceNumber && isOpen) {
      try {
        JsBarcode(barcodeRef.current, invoiceNumber, {
          format: 'CODE128',
          width: paperSize === 'MM_58' ? 1.2 : 1.5,
          height: paperSize === 'MM_58' ? 32 : 40,
          displayValue: true,
          fontSize: 9,
          font: 'monospace',
          margin: 2,
        });
      } catch (err) {
        console.warn('Barcode rendering warning:', err);
      }
    }
  }, [invoiceNumber, isOpen, paperSize, receiptData]);

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

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!effectiveSale?.id) return;
    try {
      setIsDownloadingPdf(true);
      await posApi.downloadPdf(effectiveSale.id, effectiveSale.invoiceNumber);
    } catch (err) {
      console.error('Failed to download PDF invoice:', err);
      alert('Could not download PDF invoice. Please try printing directly.');
    } finally {
      setIsDownloadingPdf(false);
    }
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
        return 'w-[260px] text-[10px]';
      case 'A4':
        return 'w-full max-w-[620px] text-xs';
      case 'MM_80':
      default:
        return 'w-[330px] text-xs';
    }
  };

  const businessName =
    receiptData?.business.legalName || receiptData?.business.name || 'PixelCraft POS Store';
  const branchName = receiptData?.branch.name || 'Main Flagship Branch';
  const branchAddress = receiptData?.branch.address;
  const branchPhone = receiptData?.branch.phone;
  const taxNumber = receiptData?.settings.taxNumber;
  const receiptHeader = receiptData?.settings.receiptHeader;
  const receiptFooter =
    receiptData?.settings.receiptFooter || 'Thank you for shopping with us! Please come again.';
  const returnPolicy = receiptData?.settings.returnPolicyText;
  const showBarcode = receiptData ? receiptData.settings.showBarcode : true;
  const showTax = receiptData ? receiptData.settings.showTaxDetails : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
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
                : '80mm'} !important;
            margin: 0 !important;
            padding: ${paperSize === 'A4' ? '12mm' : '3mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 0;
            size: ${paperSize === 'A4'
              ? 'A4 portrait'
              : paperSize === 'MM_58'
                ? '58mm auto'
                : '80mm auto'};
          }
        }
      `}</style>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Receipt & Tax Invoice</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-[#2F65F6] font-mono font-semibold">
                  #{invoiceNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Hardware-agnostic thermal & A4 print engine
              </p>
            </div>
          </div>

          {/* Paper Size Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'MM_80', label: '80mm (3")' },
                { id: 'MM_58', label: '58mm (2")' },
                { id: 'A4', label: 'A4 Invoice' },
              ] as const
            ).map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setPaperSize(size.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  paperSize === size.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 flex justify-center">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-[#2F65F6] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading printable receipt...
            </div>
          ) : (
            /* Printable Document Shell */
            <div
              id="pixelcraft-receipt-printable"
              ref={printAreaRef}
              className={`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm font-mono text-slate-900 transition-all duration-150 ${getPaperWidthClass()}`}
            >
              {/* Header: Store Identity */}
              <div className="text-center space-y-1 pb-2">
                <div className="text-base font-black tracking-tight text-slate-950 uppercase">
                  {businessName}
                </div>
                <div className="text-[11px] text-slate-600 font-sans font-medium flex items-center justify-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>{branchName}</span>
                </div>
                {branchAddress && (
                  <div className="text-[10px] text-slate-500 font-sans max-w-[240px] mx-auto leading-tight">
                    {branchAddress}
                  </div>
                )}
                {branchPhone && (
                  <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{branchPhone}</span>
                  </div>
                )}
                {showTax && taxNumber && (
                  <div className="text-[10px] font-bold text-slate-700 pt-0.5">
                    VAT / Tax Reg: {taxNumber}
                  </div>
                )}
              </div>

              {/* Custom Header Note (if configured) */}
              {receiptHeader && (
                <div className="py-1 text-center text-[10px] italic text-slate-600 border-t border-dotted border-slate-200">
                  {receiptHeader}
                </div>
              )}

              {/* Metadata Divider */}
              <div className="border-t border-dashed border-slate-300 my-2" />

              {/* Transaction Metadata */}
              <div className="space-y-0.5 text-[10px] text-slate-600">
                <div className="flex justify-between">
                  <span>Invoice #:</span>
                  <span className="font-bold text-slate-900">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>
                    {effectiveSale?.createdAt
                      ? new Date(effectiveSale.createdAt).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span>
                    {effectiveSale?.createdAt
                      ? new Date(effectiveSale.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>
                    {receiptData?.cashier?.fullName ||
                      effectiveSale?.cashier?.fullName ||
                      'Station Staff'}
                  </span>
                </div>
                {effectiveSale?.customerName && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-semibold text-slate-800">
                      {effectiveSale.customerName}
                    </span>
                  </div>
                )}
                {effectiveSale?.tableNumber && (
                  <div className="flex justify-between">
                    <span>Dining Table:</span>
                    <span className="font-semibold text-slate-800">
                      {effectiveSale.tableNumber}
                    </span>
                  </div>
                )}
              </div>

              {/* Items Divider */}
              <div className="border-t border-dashed border-slate-300 my-2" />

              {/* Itemized Table */}
              <div className="space-y-1.5">
                {paperSize === 'A4' && (
                  <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-200">
                    <span className="w-1/2">Item Description</span>
                    <span className="w-1/6 text-right">Price</span>
                    <span className="w-1/6 text-right">Qty</span>
                    <span className="w-1/6 text-right">Total</span>
                  </div>
                )}

                {(effectiveSale?.items || []).map((item, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-900 truncate max-w-[190px]">
                        {item.productName}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>
                        {item.quantity} x {formatCurrency(Number(item.unitPrice))}
                      </span>
                      {item.notes && (
                        <span className="italic text-[#2F65F6] text-[9px] truncate max-w-[120px]">
                          &quot;{item.notes}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Divider */}
              <div className="border-t border-dashed border-slate-300 my-2.5" />

              {/* Financial Breakdown */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(effectiveSale?.subtotal || 0))}</span>
                </div>

                {Number(effectiveSale?.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount</span>
                    <span>-{formatCurrency(Number(effectiveSale?.discountAmount))}</span>
                  </div>
                )}

                {showTax && Number(effectiveSale?.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Sales Tax{' '}
                      {receiptData?.taxBreakdown?.[0]?.rate
                        ? `(${receiptData.taxBreakdown[0].rate}%)`
                        : ''}
                    </span>
                    <span>{formatCurrency(Number(effectiveSale?.taxAmount))}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-sm pt-1.5 border-t border-slate-900 text-slate-950">
                  <span>TOTAL DUE</span>
                  <span className="text-base font-mono">
                    {formatCurrency(Number(effectiveSale?.totalAmount || 0))}
                  </span>
                </div>

                {/* Tender Breakdown */}
                <div className="pt-1.5 space-y-0.5 text-[10px] text-slate-600 border-t border-slate-100">
                  {(effectiveSale?.payments || []).map((p, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Tender ({p.paymentMethod}):</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  ))}

                  {Number(effectiveSale?.changeDue || 0) > 0 && (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Change Given:</span>
                      <span>{formatCurrency(Number(effectiveSale?.changeDue))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Barcode & Verification QR Section */}
              <div className="pt-3 border-t border-dashed border-slate-300 text-center space-y-2">
                {showBarcode && (
                  <div className="flex flex-col items-center justify-center">
                    <svg ref={barcodeRef} className="max-w-full" />
                  </div>
                )}

                {qrCodeUrl && (
                  <div className="flex flex-col items-center justify-center pt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl}
                      alt="Verification QR"
                      className="w-20 h-20 object-contain rounded-lg border border-slate-200 p-0.5"
                    />
                    <span className="text-[9px] text-slate-400 mt-0.5 font-sans">
                      Scan to verify authenticity
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Note & Return Policy */}
              <div className="pt-2 text-center space-y-1 border-t border-dotted border-slate-200 mt-2 font-sans">
                {receiptFooter && (
                  <div className="text-[10px] font-semibold text-slate-700">
                    {receiptFooter}
                  </div>
                )}
                {returnPolicy && (
                  <div className="text-[9px] text-slate-400 italic max-w-[260px] mx-auto leading-tight">
                    {returnPolicy}
                  </div>
                )}
                <div className="text-[8px] text-slate-300 tracking-wider uppercase pt-1">
                  Powered by PixelCraft POS • pos.pixelcraftlk.com
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Controls */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download A4 PDF'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onNewSale && (
              <button
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>New Sale</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="py-2.5 px-5 rounded-xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white text-xs font-bold shadow-pos-btn flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt ({paperSize.replace('MM_', '')}mm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
