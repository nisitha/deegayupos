/**
 * ESC/POS Binary Protocol & Thermal Receipt Buffer Generator
 * Supports 80mm (48 cols) and 58mm (32 cols) POS thermal printers.
 * Compatible with Epson, Star Micronics, Sunmi, Xprinter, Rongta, Bixolon, Citizen.
 */

import type { SaleDto } from '@pixelcraft/types';
import { detectUnitConfig } from '../unit-utils';
import { formatSriLankaReceiptDate, formatSriLankaReceiptTime } from '../date-utils';

// Standard ESC/POS Control Byte Constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type PrinterPaperWidth = '80mm' | '58mm';

export interface EscPosReceiptOptions {
  paperWidth?: PrinterPaperWidth;
  storeName?: string;
  storeNameNative?: string;
  branchName?: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  cashierStation?: string;
  footerMessage?: string;
  openCashDrawer?: boolean;
  printBarcode?: boolean;
  printQrCode?: boolean;
  verificationUrl?: string;
  currencySymbol?: string;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private readonly columns: number;

  constructor(width: PrinterPaperWidth = '80mm') {
    this.columns = width === '58mm' ? 32 : 48;
    this.init();
  }

  get columnCount(): number {
    return this.columns;
  }

  /**
   * Reset & initialize printer to defaults (ESC @)
   */
  init(): this {
    this.buffer.push(ESC, 0x40);
    return this;
  }

  /**
   * Set text alignment: 'left' | 'center' | 'right' (ESC a n)
   */
  align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(ESC, 0x61, code);
    return this;
  }

  /**
   * Toggle bold/emphasized text (ESC E n)
   */
  bold(enable = true): this {
    this.buffer.push(ESC, 0x45, enable ? 1 : 0);
    return this;
  }

  /**
   * Toggle double strike (ESC G n)
   */
  doubleStrike(enable = true): this {
    this.buffer.push(ESC, 0x47, enable ? 1 : 0);
    return this;
  }

  /**
   * Toggle underline (ESC - n)
   */
  underline(enable = true): this {
    this.buffer.push(ESC, 0x2d, enable ? 1 : 0);
    return this;
  }

  /**
   * Set font size magnification (GS ! n)
   * normal = 0x00, title = 0x11 (2x width + 2x height), wide = 0x10, tall = 0x01
   */
  size(mode: 'normal' | 'tall' | 'wide' | 'title'): this {
    let code = 0x00;
    if (mode === 'title') code = 0x11;
    else if (mode === 'wide') code = 0x10;
    else if (mode === 'tall') code = 0x01;
    this.buffer.push(GS, 0x21, code);
    return this;
  }

  /**
   * Append raw text string encoded in UTF-8
   */
  text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (const b of bytes) {
      this.buffer.push(b);
    }
    return this;
  }

  /**
   * Append text followed by a newline (LF)
   */
  textLine(str = ''): this {
    this.text(str);
    this.buffer.push(LF);
    return this;
  }

  /**
   * Feed n lines (ESC d n)
   */
  feed(lines = 1): this {
    this.buffer.push(ESC, 0x64, lines);
    return this;
  }

  /**
   * Print a repeated divider line matching receipt width
   */
  divider(char = '-'): this {
    const line = char.repeat(this.columns);
    this.textLine(line);
    return this;
  }

  /**
   * Print a two-column row with left and right aligned text
   */
  row(left: string, right: string): this {
    const totalSpaces = this.columns - left.length - right.length;
    if (totalSpaces <= 0) {
      // If line is too long, wrap
      this.textLine(left);
      this.align('right').textLine(right).align('left');
    } else {
      this.textLine(left + ' '.repeat(totalSpaces) + right);
    }
    return this;
  }

  /**
   * Print a 3-column line item row (Name, Qty, Total)
   */
  itemRow(name: string, qtyText: string, totalText: string): this {
    // If name is long, print name on its own line, then qty & total on line 2
    const rightSide = `${qtyText}  ${totalText}`;
    const availableForName = this.columns - rightSide.length - 1;

    if (name.length > availableForName) {
      this.textLine(name);
      this.row(`  ${qtyText}`, totalText);
    } else {
      const spaces = this.columns - name.length - rightSide.length;
      this.textLine(name + ' '.repeat(Math.max(1, spaces)) + rightSide);
    }
    return this;
  }

  /**
   * Kick Cash Drawer Pulse (ESC p m t1 t2)
   * Pin 2: m = 0, t1 = 25 (50ms on), t2 = 250 (500ms off)
   * Pin 5: m = 1
   */
  cashDrawerKick(pin: 0 | 1 = 0): this {
    this.buffer.push(ESC, 0x70, pin, 25, 250);
    return this;
  }

  /**
   * Print Code128 Barcode (GS k 73 len bytes...)
   */
  barcodeCode128(data: string): this {
    const cleanData = data.replace(/[^\x20-\x7E]/g, ''); // ASCII printable only
    if (!cleanData) return this;

    this.align('center');
    // Set HRI characters below barcode: GS H 2
    this.buffer.push(GS, 0x48, 2);
    // Set Barcode height in dots (50 dots): GS h 50
    this.buffer.push(GS, 0x68, 50);
    // Set Barcode module width (2 dots): GS w 2
    this.buffer.push(GS, 0x77, this.columns === 32 ? 2 : 2);

    // Code128 print command: GS k 73 <length> <data>
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(cleanData);
    this.buffer.push(GS, 0x6b, 73, dataBytes.length);
    for (const b of dataBytes) {
      this.buffer.push(b);
    }
    this.buffer.push(LF);
    this.align('left');
    return this;
  }

  /**
   * Print 2D QR Code using standard ESC/POS GS ( k commands
   */
  qrCode(data: string, moduleSize = 4): this {
    if (!data) return this;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const len = bytes.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    this.align('center');

    // 1. Model: GS ( k 4 0 49 65 50 0 (Model 2)
    this.buffer.push(GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0);

    // 2. Module Size: GS ( k 3 0 49 67 <size>
    const size = this.columns === 32 ? Math.min(3, moduleSize) : moduleSize;
    this.buffer.push(GS, 0x28, 0x6b, 3, 0, 49, 67, size);

    // 3. Error Correction Level: GS ( k 3 0 49 69 48 (Level L: 48)
    this.buffer.push(GS, 0x28, 0x6b, 3, 0, 49, 69, 48);

    // 4. Store Data: GS ( k pL pH 49 80 48 <data...>
    this.buffer.push(GS, 0x28, 0x6b, pL, pH, 49, 80, 48);
    for (const b of bytes) {
      this.buffer.push(b);
    }

    // 5. Print QR Code: GS ( k 3 0 49 81 48
    this.buffer.push(GS, 0x28, 0x6b, 3, 0, 49, 81, 48);
    this.buffer.push(LF);
    this.align('left');
    return this;
  }

  /**
   * Feed and Paper Cut (Partial Cut: GS V 66 0 / Full Cut: GS V 65 0)
   */
  cut(partial = true): this {
    this.feed(3);
    this.buffer.push(GS, 0x56, partial ? 66 : 65, 0);
    return this;
  }

  /**
   * Returns complete Uint8Array buffer ready for USB / Bluetooth / RAW socket transmission
   */
  getBuffer(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate standard ESC/POS Thermal Receipt Byte Buffer from Sale DTO
 */
export function generateEscPosReceipt(
  sale: SaleDto,
  options: EscPosReceiptOptions = {},
): Uint8Array {
  const width = options.paperWidth || '80mm';
  const builder = new EscPosBuilder(width);

  // 1. Optional Cash Drawer Pulse before print
  if (options.openCashDrawer) {
    builder.cashDrawerKick(0);
  }

  // 2. Header
  builder.align('center');
  builder.bold(true).size('title');
  builder.textLine(options.storeName || 'DEEGAYU WEDA MADURA');
  builder.size('normal');

  const outletDisplayName = options.branchName || (sale as any).branchName || 'Main Store';
  builder.bold(true).textLine(`Outlet: ${outletDisplayName}`).bold(false);

  if (options.address) builder.textLine(options.address);
  if (options.phone) builder.textLine(`Tel: ${options.phone}`);
  if (options.taxNumber) builder.textLine(`Tax Reg: ${options.taxNumber}`);

  builder.divider('=');

  // 3. Receipt Details
  builder.align('left');
  builder.bold(true).textLine(`TAX INVOICE / RECEIPT #${sale.invoiceNumber}`);
  builder.bold(false);

  const billDate = formatSriLankaReceiptDate(sale.createdAt);
  const billTime = formatSriLankaReceiptTime(sale.createdAt);

  builder.row('Date:', billDate);
  builder.row('Time:', billTime);
  builder.row('Outlet:', outletDisplayName);
  builder.row('Station:', options.cashierStation || 'REG-01');
  const cashierDisplayName = sale.cashier?.fullName || sale.cashierName || 'Branch Cashier';
  builder.row('Cashier:', cashierDisplayName);
  if (sale.customerName && sale.customerName !== 'Walk-in Customer') {
    builder.row('Customer:', sale.customerName);
  }

  builder.divider('-');

  // 4. Line Items Table Header
  builder.bold(true);
  if (width === '80mm') {
    builder.row('Item Description', 'Qty x Price     Total');
  } else {
    builder.row('Item', 'Qty x Price  Total');
  }
  builder.bold(false);
  builder.divider('-');

  // 5. Line Items
  const currency = options.currencySymbol || 'LKR';
  let totalSavings = 0;

  for (const item of sale.items) {
    const conf = detectUnitConfig({ name: item.productName });
    const num = Number(item.quantity);
    let formattedQty = `${num}`;
    if (conf.mode === 'weight_g') {
      if (num >= 1000) {
        const kg = Math.round((num / 1000) * 1000) / 1000;
        formattedQty = `${kg}kg (${num}g)`;
      } else {
        formattedQty = `${num}g`;
      }
    } else if (conf.mode === 'volume_ml') {
      if (num >= 1000) {
        const l = Math.round((num / 1000) * 1000) / 1000;
        formattedQty = `${l}L (${num}ml)`;
      } else {
        formattedQty = `${num}ml`;
      }
    } else if (conf.mode === 'fractional') {
      formattedQty = `${num} ${conf.baseUnit}`;
    }

    const qtyText = `${formattedQty} x ${Number(item.unitPrice).toFixed(2)}`;
    const lineTotalText = `${currency} ${Number(item.subtotal).toFixed(2)}`;

    builder.itemRow(item.productName, qtyText, lineTotalText);

    if (item.discountAmount && Number(item.discountAmount) > 0) {
      totalSavings += Number(item.discountAmount);
      builder.align('right').textLine(`(Disc: -${currency} ${Number(item.discountAmount).toFixed(2)})`).align('left');
    }
  }

  builder.divider('-');

  // 6. Financial Summary
  builder.align('left');
  builder.row('Subtotal:', `${currency} ${Number(sale.subtotal).toFixed(2)}`);

  if (sale.discountAmount && Number(sale.discountAmount) > 0) {
    totalSavings += Number(sale.discountAmount);
    builder.row('Order Discount:', `-${currency} ${Number(sale.discountAmount).toFixed(2)}`);
  }

  if (sale.taxAmount && Number(sale.taxAmount) > 0) {
    builder.row('Tax (VAT):', `${currency} ${Number(sale.taxAmount).toFixed(2)}`);
  }

  builder.divider('=');
  builder.bold(true).size('wide');
  builder.row('NET TOTAL:', `${currency} ${Number(sale.totalAmount).toFixed(2)}`);
  builder.bold(false).size('normal');
  builder.divider('=');

  // 7. Payments Breakdown
  if (sale.payments && sale.payments.length > 0) {
    for (const p of sale.payments) {
      const pMethod =
        p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT'
          ? 'Store Credit'
          : p.paymentMethod;
      builder.row(`Paid via ${pMethod}:`, `${currency} ${Number(p.amount).toFixed(2)}`);
    }
  }

  if (sale.changeDue && Number(sale.changeDue) > 0) {
    builder.bold(true).row('Change Due:', `${currency} ${Number(sale.changeDue).toFixed(2)}`).bold(false);
  }

  if (totalSavings > 0) {
    builder.align('center');
    builder.bold(true);
    builder.textLine(`*** YOU SAVED: ${currency} ${totalSavings.toFixed(2)} ***`);
    builder.bold(false);
    builder.align('left');
  }

  builder.divider('-');

  // 8. Barcode / QR Code
  if (options.printBarcode !== false) {
    builder.barcodeCode128(sale.invoiceNumber);
  }

  if (options.printQrCode !== false && options.verificationUrl) {
    builder.qrCode(options.verificationUrl, width === '58mm' ? 3 : 4);
  }

  // 9. Footer & Cut
  builder.align('center');
  builder.textLine(options.footerMessage || 'Thank You Come Again');
  builder.textLine('PixelCraft POS Engine • pos.pixelcraftlk.com');
  builder.cut(true);

  return builder.getBuffer();
}

/**
 * Generate Standalone Cash Drawer Kick Buffer (`ESC p 0 25 250`)
 */
export function generateDrawerKickBuffer(pin: 0 | 1 = 0): Uint8Array {
  const builder = new EscPosBuilder('80mm');
  builder.cashDrawerKick(pin);
  return builder.getBuffer();
}

/**
 * Generate Diagnostic Test Print Buffer
 */
export function generateTestReceiptBuffer(width: PrinterPaperWidth = '80mm'): Uint8Array {
  const builder = new EscPosBuilder(width);
  builder.align('center');
  builder.bold(true).size('title');
  builder.textLine('PIXELCRAFT POS');
  builder.size('normal').bold(false);
  builder.textLine('ESC/POS Direct Hardware Test');
  builder.divider('=');
  builder.align('left');
  builder.row('Printer Width:', width);
  builder.row('Columns:', String(builder.columnCount));
  builder.row('Protocol:', 'ESC/POS Standard (UTF-8)');
  builder.row('Timestamp:', formatSriLankaReceiptTime(new Date()));
  builder.divider('-');
  builder.align('center');
  builder.textLine('Line Wrap Diagnostic Check:');
  builder.textLine('123456789012345678901234567890123456789012345678');
  builder.divider('-');
  builder.barcodeCode128('TEST-80MM-OK');
  builder.qrCode('https://pos.pixelcraftlk.com/hardware-test', width === '58mm' ? 3 : 4);
  builder.textLine('*** HARDWARE TEST SUCCESSFUL ***');
  builder.cut(true);
  return builder.getBuffer();
}
