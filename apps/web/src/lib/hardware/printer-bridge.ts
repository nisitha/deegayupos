/**
 * PixelCraft POS — Multi-Interface Direct Hardware Printing Engine
 * Supports Web Print API, Web Bluetooth, WebUSB, and Network Raw IP (Port 9100).
 */

import type { SaleDto } from '@pixelcraft/types';
import {
  generateEscPosReceipt,
  generateDrawerKickBuffer,
  generateTestReceiptBuffer,
  type PrinterPaperWidth,
  type EscPosReceiptOptions,
} from './escpos-generator';
import { generateReceiptBarcodeHtml } from '../../components/pos/receipt-barcode-block';
import { detectUnitConfig } from '../unit-utils';
import { formatSriLankaReceiptDate, formatSriLankaReceiptTime } from '../date-utils';

export type PrinterConnectionType =
  | 'BROWSER_PRINT'
  | 'BLUETOOTH'
  | 'NETWORK_RAW'
  | 'WEB_USB';

export interface HardwareSettings {
  connectionType: PrinterConnectionType;
  paperWidth: PrinterPaperWidth;
  networkIp: string;
  networkPort: number;
  autoPrintReceipt: boolean;
  autoOpenCashDrawer: boolean;
  printBarcode: boolean;
  printQrCode: boolean;
  printLogo?: boolean;
  footerMessage: string;
  bluetoothDeviceName?: string | null;
}

export const DEFAULT_HARDWARE_SETTINGS: HardwareSettings = {
  connectionType: 'BROWSER_PRINT',
  paperWidth: '80mm',
  networkIp: '192.168.1.200',
  networkPort: 9100,
  autoPrintReceipt: true,
  autoOpenCashDrawer: true,
  printBarcode: true,
  printQrCode: true,
  printLogo: true,
  footerMessage: 'Thank You Come Again',
  bluetoothDeviceName: null,
};

const STORAGE_KEY = 'pixelcraft_hardware_settings';

interface UsbEndpointLike {
  direction: string;
  endpointNumber: number;
}

interface UsbDeviceLike {
  open(): Promise<void>;
  configuration: {
    interfaces: Array<{
      alternate: {
        endpoints: UsbEndpointLike[];
      };
    }>;
  } | null;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<unknown>;
}

interface BluetoothCharacteristicLike {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(value: Uint8Array): Promise<void>;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: {
    connected?: boolean;
    connect(): Promise<{
      getPrimaryServices(): Promise<
        Array<{
          getCharacteristics(): Promise<BluetoothCharacteristicLike[]>;
        }>
      >;
    }>;
  };
}

interface NavigatorWithHardware extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }): Promise<BluetoothDeviceLike>;
  };
  usb?: {
    requestDevice(options: {
      filters: Array<{ classCode?: number }>;
    }): Promise<UsbDeviceLike>;
  };
}

export class PrinterBridge {
  private static cachedBluetoothDevice: BluetoothDeviceLike | null = null;
  private static cachedBluetoothCharacteristic: BluetoothCharacteristicLike | null = null;

  /**
   * Load hardware settings from browser localStorage
   */
  static getSettings(): HardwareSettings {
    if (typeof window === 'undefined') return DEFAULT_HARDWARE_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_HARDWARE_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse hardware settings from localStorage:', e);
    }
    return DEFAULT_HARDWARE_SETTINGS;
  }

  /**
   * Persist hardware settings to localStorage
   */
  static saveSettings(settings: Partial<HardwareSettings>): HardwareSettings {
    if (typeof window === 'undefined') return DEFAULT_HARDWARE_SETTINGS;
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save hardware settings:', e);
    }
    return updated;
  }

  /**
   * 1. Standard Web Print API Fallback (Hidden Iframe)
   */
  static async printViaBrowser(
    sale: SaleDto,
    settings: HardwareSettings,
    storeDetails?: {
      storeName?: string;
      branchName?: string;
      address?: string;
      phone?: string;
      taxNumber?: string;
      logoUrl?: string;
    },
  ): Promise<boolean> {
    const paperWidth = settings.paperWidth;
    const iframeId = 'pixelcraft-silent-print-frame';

    // Generate authentic Code128 and QR code markup
    let barcodeBlockHtml = '';
    try {
      barcodeBlockHtml = await generateReceiptBarcodeHtml({
        invoiceNumber: sale.invoiceNumber,
        verificationUrl: `https://pos.pixelcraftlk.com/receipt/${sale.invoiceNumber}`,
        paperWidth: settings.paperWidth,
        showBarcode: settings.printBarcode !== false,
        showQr: settings.printQrCode !== false,
      });
    } catch (err) {
      console.warn('Failed to generate print barcode/QR block:', err);
    }

    return new Promise((resolve) => {
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        resolve(true);
        return;
      }

      const currency = 'LKR';
      const itemsHtml = sale.items
        .map(
          (item) => {
            const conf = detectUnitConfig({ name: item.productName });
            const num = Number(item.quantity);
            let formattedQty = `${num}`;
            if (conf.mode === 'weight_g') {
              if (num >= 1000) {
                const kg = Math.round((num / 1000) * 1000) / 1000;
                formattedQty = `${kg} kg (${num.toLocaleString()} g)`;
              } else {
                formattedQty = `${num.toLocaleString()} g`;
              }
            } else if (conf.mode === 'volume_ml') {
              if (num >= 1000) {
                const l = Math.round((num / 1000) * 1000) / 1000;
                formattedQty = `${l} L (${num.toLocaleString()} ml)`;
              } else {
                formattedQty = `${num.toLocaleString()} ml`;
              }
            } else if (conf.mode === 'fractional') {
              formattedQty = `${num.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${conf.baseUnit}`;
            }

            const isBulk = String(item.productName || '').includes('(25-Pack Bulk)') || (item as any).isSpecialBulk;
            const bulkSubline = isBulk
              ? `<div style="font-size: 11px; font-weight: 600; color: #222222; margin-top: 1px;">${item.quantity} × 25-Pack = ${Number(item.quantity) * 25} units @ LKR ${(Number(item.unitPrice) / 25).toFixed(2)}</div>`
              : '';

            return `
          <div style="margin-bottom: 5px;">
            <div style="font-weight: 700; font-size: ${paperWidth === '58mm' ? '12px' : '13.5px'}; color: #000000 !important; line-height: 1.25;">${item.productName}</div>
            ${bulkSubline}
            <div style="display: flex; justify-content: space-between; font-size: ${paperWidth === '58mm' ? '11px' : '12.5px'}; font-weight: 700; color: #000000 !important; margin-top: 1px;">
              <span>${formattedQty} x ${Number(item.unitPrice).toFixed(2)}</span>
              <span style="font-weight: 800; color: #000000 !important;">${currency} ${Number(item.subtotal).toFixed(2)}</span>
            </div>
            ${item.discountAmount && Number(item.discountAmount) > 0
                ? `<div style="text-align: right; font-size: ${paperWidth === '58mm' ? '10px' : '11px'}; font-weight: 700; color: #000000 !important;">(Disc: -${currency} ${Number(item.discountAmount).toFixed(2)})</div>`
                : ''
              }
          </div>
        `;
          },
        )
        .join('');

      const paymentsHtml = sale.payments
        .map((p) => {
          const m =
            p.paymentMethod === 'CUSTOMER_CREDIT' || p.paymentMethod === 'STORE_CREDIT'
              ? 'Store Credit'
              : p.paymentMethod;
          return `
          <div style="display: flex; justify-content: space-between; font-size: ${paperWidth === '58mm' ? '11.5px' : '13px'}; font-weight: 700; color: #000000 !important;">
            <span>Paid via ${m}:</span>
            <span style="font-weight: 800;">${currency} ${Number(p.amount).toFixed(2)}</span>
          </div>
        `;
        })
        .join('');

      const resolvedBranchName = storeDetails?.branchName || (sale as any).branchName || 'Alawwa';
      const cashierName = sale.cashier?.fullName || sale.cashierName || 'Branch Cashier';
      const billDate = formatSriLankaReceiptDate(sale.createdAt);
      const billTime = formatSriLankaReceiptTime(sale.createdAt);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt #${sale.invoiceNumber}</title>
          <style>
            @page {
              margin: 0;
              size: ${paperWidth === '58mm' ? '58mm auto' : '80mm auto'};
            }
            * {
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: ${paperWidth === '58mm' ? '2.5mm' : '4.5mm'};
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", Courier, monospace;
              font-size: ${paperWidth === '58mm' ? '12px' : '13px'};
              font-weight: 700;
              color: #000000 !important;
              background: #fff;
              width: ${paperWidth === '58mm' ? '50mm' : '72mm'};
              line-height: 1.3;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: 700; }
            .extrabold { font-weight: 800; }
            .divider { border-bottom: 1.5px dashed #000000; margin: 4.5px 0; }
            .divider-double { border-bottom: 2.5px solid #000000; margin: 5px 0; }
            .row {
              display: flex;
              justify-content: space-between;
              font-size: ${paperWidth === '58mm' ? '11.5px' : '13px'};
              font-weight: 700;
              line-height: 1.3;
            }
            svg {
              shape-rendering: crispEdges !important;
              image-rendering: pixelated !important;
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          ${settings.printLogo !== false && storeDetails?.logoUrl ? `
            <div class="center" style="margin-bottom: 6px;">
              <img src="${storeDetails.logoUrl}" style="max-height: 48px; max-width: 140px; object-fit: contain;" />
            </div>
          ` : ''}
          <div class="center extrabold" style="font-size: ${paperWidth === '58mm' ? '16px' : '19px'}; line-height: 1.15; text-transform: uppercase;">
            ${storeDetails?.storeName || 'DEEGAYU WEDA MADHURA'}
          </div>
          <div class="center bold" style="font-size: ${paperWidth === '58mm' ? '12px' : '13px'}; margin-top: 3px;">
            Outlet: ${resolvedBranchName}
          </div>
          ${storeDetails?.address ? `<div class="center bold" style="font-size: ${paperWidth === '58mm' ? '11px' : '12px'}; margin-top: 2px;">${storeDetails.address}</div>` : ''}
          <div class="center bold" style="font-size: ${paperWidth === '58mm' ? '10.5px' : '11.5px'}; margin-top: 3px; line-height: 1.35;">
            <div>Giriulla - 0372289339</div>
            <div>Dambadeniya - 0372266444</div>
            <div>Alawwa - 0372077180</div>
            <div>WhatsApp: +94772634497</div>
          </div>
          ${storeDetails?.taxNumber ? `<div class="center bold" style="font-size: ${paperWidth === '58mm' ? '11px' : '12px'};">Tax Reg: ${storeDetails.taxNumber}</div>` : ''}

          <div class="divider-double"></div>
          <div class="extrabold center" style="font-size: ${paperWidth === '58mm' ? '13px' : '14px'}; letter-spacing: 0.05em;">
            TAX INVOICE / RECEIPT
          </div>
          <div class="row"><span>Invoice:</span><span class="extrabold">#${sale.invoiceNumber}</span></div>
          <div class="row"><span>Date:</span><span class="bold">${billDate}</span></div>
          <div class="row"><span>Time:</span><span class="bold">${billTime}</span></div>
          <div class="row"><span>Outlet:</span><span class="bold">${resolvedBranchName}</span></div>
          <div class="row"><span>Station:</span><span class="bold">REG-01</span></div>
          <div class="row"><span>Cashier:</span><span class="extrabold">${cashierName}</span></div>
          ${sale.customerName ? `<div class="row"><span>Customer:</span><span class="bold">${sale.customerName}</span></div>` : ''}

          <div class="divider"></div>
          <div class="row extrabold" style="font-size: ${paperWidth === '58mm' ? '12px' : '13px'}; text-transform: uppercase;">
            <span>Description</span>
            <span>Total (${currency})</span>
          </div>
          <div class="divider"></div>

          ${itemsHtml}

          <div class="divider"></div>
          <div class="row bold" style="font-size: ${paperWidth === '58mm' ? '12px' : '14px'};">
            <span>Subtotal:</span>
            <span>${currency} ${Number(sale.subtotal).toFixed(2)}</span>
          </div>
          ${sale.discountAmount && Number(sale.discountAmount) > 0
          ? `<div class="row bold" style="font-size: ${paperWidth === '58mm' ? '12px' : '14px'};"><span>Discount:</span><span>-${currency} ${Number(sale.discountAmount).toFixed(2)}</span></div>`
          : ''
        }
          ${sale.taxAmount && Number(sale.taxAmount) > 0
          ? `<div class="row bold" style="font-size: ${paperWidth === '58mm' ? '12px' : '14px'};"><span>Tax (VAT):</span><span>${currency} ${Number(sale.taxAmount).toFixed(2)}</span></div>`
          : ''
        }
          <div class="divider-double"></div>
          <div class="row extrabold" style="font-size: ${paperWidth === '58mm' ? '16px' : '19px'}; padding: 2px 0;">
            <span>NET TOTAL:</span>
            <span>${currency} ${Number(sale.totalAmount).toFixed(2)}</span>
          </div>
          <div class="divider-double"></div>

          ${paymentsHtml}
          ${sale.changeDue && Number(sale.changeDue) > 0
          ? `<div class="row bold" style="font-size: ${paperWidth === '58mm' ? '12px' : '14px'}; margin-top: 2px;"><span>Change Due:</span><span>${currency} ${Number(sale.changeDue).toFixed(2)}</span></div>`
          : ''
        }

          ${barcodeBlockHtml}

          <div class="divider"></div>
          <div class="center bold" style="margin-top: 6px; font-size: ${paperWidth === '58mm' ? '11px' : '12px'};">
            ${settings.footerMessage || 'Thank You Come Again'}
          </div>
          <div class="center" style="font-size: 9px; font-weight: 600; margin-top: 4px; letter-spacing: 0.05em;">
            PixelCraft POS Engine • pos.pixelcraftlk.com
          </div>
        </body>
        </html>
      `;

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
        resolve(true);
      }, 350);
    });
  }

  /**
   * 2. Web Bluetooth Direct Thermal Printing
   * Connects via Web Bluetooth Generic or POS Serial Characteristics
   */
  static async printViaBluetooth(buffer: Uint8Array): Promise<boolean> {
    const nav = navigator as NavigatorWithHardware;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome/Edge or Web Print fallback.');
    }

    let characteristic = this.cachedBluetoothCharacteristic;

    if (!characteristic || !this.cachedBluetoothDevice?.gatt?.connected) {
      // Common thermal printer Bluetooth service UUIDs
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Serial
          '0000ff00-0000-1000-8000-00805f9b34fb',
        ],
      });

      this.cachedBluetoothDevice = device;
      this.saveSettings({ bluetoothDeviceName: device.name || 'Thermal Bluetooth Printer' });

      if (!device.gatt) {
        throw new Error('Bluetooth GATT server is not accessible on the selected thermal printer.');
      }

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();

      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              this.cachedBluetoothCharacteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch {
          // Continue searching services
        }
      }
    }

    if (!characteristic) {
      throw new Error('Could not find a writable Bluetooth characteristic on the selected thermal printer.');
    }

    // Send chunks (512 bytes each to prevent buffer overflow)
    const chunkSize = 512;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      if (characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 20));
    }

    return true;
  }

  /**
   * 3. Network RAW IP Printer Driver (Port 9100)
   * Dispatches binary ESC/POS payload via local network socket bridge or direct fetch
   */
  static async printViaNetworkRaw(buffer: Uint8Array, settings: HardwareSettings): Promise<boolean> {
    const ip = settings.networkIp || '192.168.1.200';
    const port = settings.networkPort || 9100;

    // Send via local proxy or hardware daemon at port 9100
    try {
      await fetch(`http://${ip}:${port}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer as unknown as BodyInit,
        mode: 'no-cors',
      });
      return true;
    } catch {
      // Local hardware bridge fallback (e.g. PixelCraft Agent daemon)
      try {
        await fetch('http://127.0.0.1:9100/raw', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetIp: ip,
            targetPort: port,
            data: Array.from(buffer),
          }),
        });
        return true;
      } catch (agentErr) {
        console.warn('Network print bridge unreachable, falling back to Browser Print:', agentErr);
        throw new Error(`Could not communicate with Network Printer at ${ip}:${port}. Please verify printer IP or install the local print agent.`);
      }
    }
  }

  /**
   * 4. WebUSB Direct Thermal Printing
   */
  static async printViaWebUsb(buffer: Uint8Array): Promise<boolean> {
    const nav = navigator as NavigatorWithHardware;
    if (!nav.usb) {
      throw new Error('WebUSB is not supported in this browser. Please use Web Print or Web Bluetooth.');
    }

    const device = await nav.usb.requestDevice({
      filters: [{ classCode: 7 }], // USB Printer Class
    });

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    // Find OUT endpoint
    const endpoint = device.configuration?.interfaces[0]?.alternate.endpoints.find(
      (e) => e.direction === 'out',
    );

    if (!endpoint) {
      throw new Error('No OUT endpoint found on USB printer.');
    }

    await device.transferOut(endpoint.endpointNumber, buffer);
    return true;
  }

  /**
   * High-level Universal Print Dispatcher
   */
  static async printReceipt(
    sale: SaleDto,
    overrideSettings?: Partial<HardwareSettings>,
    storeDetails?: {
      storeName?: string;
      branchName?: string;
      address?: string;
      phone?: string;
      taxNumber?: string;
    },
  ): Promise<boolean> {
    const settings = { ...this.getSettings(), ...overrideSettings };

    // Construct raw ESC/POS binary buffer
    const escposOptions: EscPosReceiptOptions = {
      paperWidth: settings.paperWidth,
      storeName: storeDetails?.storeName || 'DEEGAYU WEDA MADHURA',
      branchName: storeDetails?.branchName || (sale as any).branchName || 'Alawwa',
      address: storeDetails?.address,
      phone: storeDetails?.phone,
      taxNumber: storeDetails?.taxNumber,
      cashierStation: 'REG-01',
      footerMessage: settings.footerMessage,
      openCashDrawer:
        settings.autoOpenCashDrawer &&
        sale.payments?.some((p) => p.paymentMethod === 'CASH'),
      printBarcode: settings.printBarcode,
      printQrCode: settings.printQrCode,
      verificationUrl: `https://pos.pixelcraftlk.com/receipt/${sale.invoiceNumber}`,
      currencySymbol: 'LKR',
    };

    const buffer = generateEscPosReceipt(sale, escposOptions);

    switch (settings.connectionType) {
      case 'BLUETOOTH':
        try {
          return await this.printViaBluetooth(buffer);
        } catch (err) {
          console.warn('Bluetooth print failed, falling back to Web Print:', err);
          return this.printViaBrowser(sale, settings, storeDetails);
        }

      case 'NETWORK_RAW':
        try {
          return await this.printViaNetworkRaw(buffer, settings);
        } catch (err) {
          console.warn('Network print failed, falling back to Web Print:', err);
          return this.printViaBrowser(sale, settings, storeDetails);
        }

      case 'WEB_USB':
        try {
          return await this.printViaWebUsb(buffer);
        } catch (err) {
          console.warn('WebUSB print failed, falling back to Web Print:', err);
          return this.printViaBrowser(sale, settings, storeDetails);
        }

      case 'BROWSER_PRINT':
      default:
        return this.printViaBrowser(sale, settings, storeDetails);
    }
  }

  /**
   * Trigger Cash Drawer Kick Pulse
   */
  static async kickCashDrawer(): Promise<boolean> {
    const settings = this.getSettings();
    const buffer = generateDrawerKickBuffer(0);

    switch (settings.connectionType) {
      case 'BLUETOOTH':
        try {
          return await this.printViaBluetooth(buffer);
        } catch {
          return false;
        }

      case 'NETWORK_RAW':
        try {
          return await this.printViaNetworkRaw(buffer, settings);
        } catch {
          return false;
        }

      case 'WEB_USB':
        try {
          return await this.printViaWebUsb(buffer);
        } catch {
          return false;
        }

      case 'BROWSER_PRINT':
      default:
        // Browser print has no direct electrical pin drawer access without ESC/POS
        console.info('Cash drawer pulse simulated for Browser Print mode.');
        return true;
    }
  }

  /**
   * Diagnostic Test Print Dispatcher
   */
  static async testPrint(width: PrinterPaperWidth = '80mm'): Promise<boolean> {
    const settings = this.getSettings();
    const buffer = generateTestReceiptBuffer(width);

    switch (settings.connectionType) {
      case 'BLUETOOTH':
        return this.printViaBluetooth(buffer);
      case 'NETWORK_RAW':
        return this.printViaNetworkRaw(buffer, settings);
      case 'WEB_USB':
        return this.printViaWebUsb(buffer);
      case 'BROWSER_PRINT':
      default: {
        // Mock dummy sale for test print
        const mockSale: SaleDto = {
          id: 'test-sale',
          tenantId: 'deegayu',
          branchId: 'branch-1',
          cashierId: 'cashier-1',
          invoiceNumber: `TEST-${width.toUpperCase()}`,
          orderType: 'RETAIL_WALKIN',
          status: 'COMPLETED',
          subtotal: 1500,
          discountAmount: 150,
          taxAmount: 0,
          totalAmount: 1350,
          paidAmount: 1500,
          changeDue: 150,
          customerName: 'Test Diagnostic Client',
          items: [
            {
              id: 'item-1',
              saleId: 'test-sale',
              productName: 'Deegayu Arishta Herbal 375ml',
              sku: 'ARI-375',
              unitPrice: 650,
              quantity: 2,
              subtotal: 1300,
              discountAmount: 100,
              taxAmount: 0,
            },
            {
              id: 'item-2',
              saleId: 'test-sale',
              productName: 'Siddhalepa Herbal Balm 50g',
              sku: 'BALM-50',
              unitPrice: 200,
              quantity: 1,
              subtotal: 200,
              discountAmount: 50,
              taxAmount: 0,
            },
          ],
          payments: [
            {
              id: 'pay-1',
              saleId: 'test-sale',
              paymentMethod: 'CASH',
              amount: 1500,
              status: 'SUCCESS',
              createdAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return this.printViaBrowser(mockSale, { ...settings, paperWidth: width });
      }
    }
  }
}
