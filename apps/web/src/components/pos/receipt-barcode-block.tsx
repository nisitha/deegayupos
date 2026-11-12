'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import clsx from 'clsx';

export type ReceiptPaperWidth = '80mm' | '58mm' | 'MM_80' | 'MM_58' | 'A4' | 'A5';

export interface ReceiptBarcodeBlockProps {
  invoiceNumber: string;
  verificationUrl?: string;
  paperWidth?: ReceiptPaperWidth;
  showBarcode?: boolean;
  showQr?: boolean;
  showCaption?: boolean;
  captionText?: string;
  className?: string;
  barcodeHeight?: number;
  barcodeWidth?: number;
}

/**
 * Standard public receipt verification URL builder
 */
export function getReceiptVerificationUrl(invoiceNumber: string): string {
  const cleanId = (invoiceNumber || 'INV-DRAFT').trim();
  return `https://pos.pixelcraftlk.com/receipt/${cleanId}`;
}

/**
 * Generate standalone SVG string for Code128 Barcode (Client-safe)
 */
export function generateBarcodeSvgString(
  invoiceNumber: string,
  is58mm = false
): string {
  if (typeof document === 'undefined') return '';
  const cleanNumber = (invoiceNumber || 'INV-DRAFT').trim();
  try {
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgNode, cleanNumber, {
      format: 'CODE128',
      width: is58mm ? 1.2 : 1.5,
      height: is58mm ? 32 : 38,
      displayValue: true,
      font: 'monospace',
      fontSize: 10,
      textMargin: 2,
      margin: 2,
      background: 'transparent',
      lineColor: '#000000',
    });
    svgNode.setAttribute('style', 'shape-rendering: crispEdges; max-width: 100%;');
    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    console.warn('Failed to generate Code128 barcode SVG string:', err);
    return '';
  }
}

/**
 * Generate standalone SVG string for QR Code
 */
export async function generateQrSvgString(
  url: string,
  is58mm = false
): Promise<string> {
  const size = is58mm ? 72 : 96;
  try {
    return await QRCode.toString(url, {
      type: 'svg',
      width: size,
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.warn('Failed to generate QR Code SVG string:', err);
    return '';
  }
}

/**
 * Generate HTML markup of both Barcode & QR code for silent print iframes
 */
export async function generateReceiptBarcodeHtml(options: {
  invoiceNumber: string;
  verificationUrl?: string;
  paperWidth?: ReceiptPaperWidth;
  showBarcode?: boolean;
  showQr?: boolean;
}): Promise<string> {
  const is58mm = options.paperWidth === '58mm' || options.paperWidth === 'MM_58';
  const showBarcode = options.showBarcode !== false;
  const showQr = options.showQr !== false;
  const invoiceNumber = (options.invoiceNumber || 'INV-DRAFT').trim();
  const vUrl = options.verificationUrl || getReceiptVerificationUrl(invoiceNumber);

  let barcodeSvg = '';
  let qrSvg = '';

  if (showBarcode) {
    barcodeSvg = generateBarcodeSvgString(invoiceNumber, is58mm);
  }

  if (showQr) {
    qrSvg = await generateQrSvgString(vUrl, is58mm);
  }

  if (!barcodeSvg && !qrSvg) return '';

  return `
    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #000; text-align: center; shape-rendering: crispEdges;">
      ${
        showBarcode && barcodeSvg
          ? `<div style="display: flex; justify-content: center; margin-bottom: 6px;">${barcodeSvg}</div>`
          : ''
      }
      ${
        showQr && qrSvg
          ? `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 4px;">
            <div style="display: inline-block; padding: 2px; background: #fff;">
              ${qrSvg}
            </div>
            <div style="font-size: 8px; font-family: sans-serif; color: #444; margin-top: 2px;">Scan to verify receipt online</div>
            <div style="font-size: 7px; font-family: monospace; color: #666; word-break: break-all;">${vUrl}</div>
          </div>
        `
          : ''
      }
    </div>
  `;
}

/**
 * Reusable Code128 Barcode & Scannable QR Code Receipt Block
 */
export function ReceiptBarcodeBlock({
  invoiceNumber,
  verificationUrl,
  paperWidth = '80mm',
  showBarcode = true,
  showQr = true,
  showCaption = true,
  captionText = 'Scan to verify receipt online',
  className,
  barcodeHeight,
  barcodeWidth,
}: ReceiptBarcodeBlockProps) {
  const is58mm = paperWidth === '58mm' || paperWidth === 'MM_58';
  const effectiveInvoiceNumber = (invoiceNumber || 'INV-2026-00042').trim();
  const effectiveUrl = useMemo(
    () => verificationUrl || getReceiptVerificationUrl(effectiveInvoiceNumber),
    [verificationUrl, effectiveInvoiceNumber]
  );

  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // 1. Render Code128 Vector Barcode via JsBarcode
  useEffect(() => {
    if (!showBarcode || !barcodeRef.current || !effectiveInvoiceNumber) return;

    try {
      setBarcodeError(null);
      JsBarcode(barcodeRef.current, effectiveInvoiceNumber, {
        format: 'CODE128',
        width: barcodeWidth ?? (is58mm ? 1.2 : 1.5),
        height: barcodeHeight ?? (is58mm ? 32 : 38),
        displayValue: true,
        font: 'monospace',
        fontSize: 10,
        textMargin: 2,
        margin: 2,
        background: 'transparent',
        lineColor: '#000000',
      });
    } catch (err: unknown) {
      console.warn('JsBarcode Code128 rendering error:', err);
      setBarcodeError(err instanceof Error ? err.message : 'Invalid Barcode');
    }
  }, [effectiveInvoiceNumber, showBarcode, is58mm, barcodeWidth, barcodeHeight]);

  // 2. Render Pure Vector QR Code via QRCode.toString
  useEffect(() => {
    if (!showQr || !effectiveUrl) {
      setQrSvg('');
      return;
    }

    let isSubscribed = true;
    const qrDimension = is58mm ? 72 : 96;

    QRCode.toString(
      effectiveUrl,
      {
        type: 'svg',
        width: qrDimension,
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (err, svgString) => {
        if (!isSubscribed) return;
        if (err || !svgString) {
          console.warn('QRCode generation error:', err);
          setQrSvg('');
        } else {
          setQrSvg(svgString);
        }
      }
    );

    return () => {
      isSubscribed = false;
    };
  }, [effectiveUrl, showQr, is58mm]);

  if (!showBarcode && !showQr) {
    return null;
  }

  return (
    <div
      className={clsx(
        'pt-2.5 border-t border-dashed border-slate-300 text-center space-y-2 select-none print:pt-2 print:border-black',
        className
      )}
      style={{ shapeRendering: 'crispEdges' }}
    >
      {/* Code128 Barcode */}
      {showBarcode && (
        <div className="flex flex-col items-center justify-center">
          {barcodeError ? (
            <div className="text-[10px] font-mono text-red-500 bg-red-50 px-2 py-1 rounded">
              Barcode error: {barcodeError}
            </div>
          ) : (
            <svg
              ref={barcodeRef}
              className="max-w-full overflow-hidden print:w-auto"
              style={{
                shapeRendering: 'crispEdges',
                imageRendering: 'pixelated',
              }}
              aria-label={`Code128 Barcode: ${effectiveInvoiceNumber}`}
            />
          )}
        </div>
      )}

      {/* Scannable Verification QR Code */}
      {showQr && (
        <div className="flex flex-col items-center justify-center pt-1 space-y-1">
          <div
            className={clsx(
              'border border-slate-200 bg-white rounded-lg p-1 flex items-center justify-center shadow-2xs print:border-none print:shadow-none',
              is58mm ? 'w-[76px] h-[76px]' : 'w-[100px] h-[100px]'
            )}
            style={{
              shapeRendering: 'crispEdges',
              imageRendering: 'pixelated',
            }}
          >
            {qrSvg ? (
              <div
                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                style={{ shapeRendering: 'crispEdges' }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="w-12 h-12 bg-slate-100 animate-pulse rounded" />
            )}
          </div>

          {showCaption && (
            <div className="text-center px-1">
              <div className="text-[9px] font-sans font-medium text-slate-500 leading-tight print:text-black">
                {captionText}
              </div>
              <div className="text-[8px] font-mono text-slate-400 mt-0.5 max-w-[240px] truncate leading-tight print:text-black">
                {effectiveUrl.replace(/^https?:\/\//, '')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

