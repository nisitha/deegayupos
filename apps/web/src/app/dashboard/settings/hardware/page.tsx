'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  Bluetooth,
  Network,
  Usb,
  Save,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Sliders,
  DollarSign,
  Maximize2,
  Check,
} from 'lucide-react';
import {
  PrinterBridge,
  type HardwareSettings,
  type PrinterConnectionType,
  DEFAULT_HARDWARE_SETTINGS,
} from '../../../../lib/hardware/printer-bridge';
import type { PrinterPaperWidth } from '../../../../lib/hardware/escpos-generator';

export default function HardwareSettingsPage() {
  const [settings, setSettings] = useState<HardwareSettings>(DEFAULT_HARDWARE_SETTINGS);
  const [isSaved, setIsSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Load stored settings on mount
  useEffect(() => {
    setSettings(PrinterBridge.getSettings());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    PrinterBridge.saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset hardware and printer configuration to system defaults?')) {
      const def = PrinterBridge.saveSettings(DEFAULT_HARDWARE_SETTINGS);
      setSettings(def);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handleTestPrint = async (width: PrinterPaperWidth) => {
    setIsTesting(true);
    setTestStatus(`Dispatching ${width} ESC/POS test receipt via ${settings.connectionType}...`);
    try {
      await PrinterBridge.testPrint(width);
      setTestStatus(`✓ Test print successful on ${width} printer!`);
    } catch (err: unknown) {
      console.error('Test print error:', err);
      const msg = err instanceof Error ? err.message : 'Print dispatch failed';
      setTestStatus(`❌ ${msg}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestStatus(null), 5000);
    }
  };

  const handleKickDrawer = async () => {
    setIsTesting(true);
    setTestStatus('Sending cash drawer pulse (ESC p 0 25 250)...');
    try {
      await PrinterBridge.kickCashDrawer();
      setTestStatus('✓ Cash drawer kick command sent!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cash drawer pulse failed';
      setTestStatus(`❌ ${msg}`);
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  return (
    <div className="flex flex-col h-full w-full space-y-6 max-w-5xl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Hardware & Thermal Printer Engine</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  ESC/POS 80mm/58mm
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Configure direct POS thermal printing, cash drawer kick, and connection bridges
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation between Document Design and Hardware Bridge */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-semibold">
          <Link
            href="/dashboard/settings"
            className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
          >
            Receipt Template
          </Link>
          <div className="px-3.5 py-1.5 rounded-xl bg-white text-indigo-600 shadow-xs font-bold">
            Hardware & ESC/POS
          </div>
        </div>
      </div>

      {testStatus && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium border flex items-center justify-between animate-in fade-in duration-150 ${
            testStatus.startsWith('✓')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : testStatus.startsWith('❌')
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <span>{testStatus}</span>
          <button
            type="button"
            onClick={() => setTestStatus(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Connection Mode Selector */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Printer Connection Interface</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select how your POS terminal communicates with the receipt printer
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'BROWSER_PRINT',
                title: 'Web Print (Standard)',
                desc: 'Universal browser print dialog. Zero driver install needed.',
                icon: Printer,
                badge: 'Recommended',
              },
              {
                id: 'BLUETOOTH',
                title: 'Web Bluetooth (Wireless)',
                desc: 'Direct ESC/POS stream to mobile Bluetooth thermal printers.',
                icon: Bluetooth,
                badge: 'Mobile / Tablet',
              },
              {
                id: 'NETWORK_RAW',
                title: 'Network RAW (Port 9100)',
                desc: 'LAN thermal printers via TCP socket (Epson, Sunmi, Xprinter).',
                icon: Network,
                badge: 'High Speed LAN',
              },
              {
                id: 'WEB_USB',
                title: 'WebUSB Direct',
                desc: 'Direct binary USB printer channel without OS print spooler.',
                icon: Usb,
                badge: 'Direct USB',
              },
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = settings.connectionType === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      connectionType: mode.id as PrinterConnectionType,
                    }))
                  }
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {mode.badge}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-900">{mode.title}</div>
                    <p className="text-[11px] text-slate-500 leading-snug">{mode.desc}</p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px]">
                    <span className={isSelected ? 'text-indigo-700 font-bold' : 'text-slate-400'}>
                      {isSelected ? 'Active Interface' : 'Select'}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Network IP Specific Input */}
          {settings.connectionType === 'NETWORK_RAW' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-slate-900">Network Printer Configuration (Raw Socket)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Printer IP Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.200"
                    value={settings.networkIp}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, networkIp: e.target.value.trim() }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Raw Port (Default 9100)</label>
                  <input
                    type="number"
                    value={settings.networkPort}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        networkPort: parseInt(e.target.value, 10) || 9100,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bluetooth Device Name */}
          {settings.connectionType === 'BLUETOOTH' && settings.bluetoothDeviceName && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-900 font-medium">
                <Bluetooth className="w-4 h-4 text-indigo-600" />
                <span>Last Paired Bluetooth Device: <strong>{settings.bluetoothDeviceName}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, bluetoothDeviceName: null }))}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Forget
              </button>
            </div>
          )}
        </div>

        {/* 2. Paper Geometry & Thermal Specs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-indigo-600" />
              <span>Thermal Receipt Geometry</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard 80mm roll (48 columns) or compact 58mm roll (32 columns)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                id: '80mm',
                name: 'Standard 80mm Roll (48 Columns)',
                desc: 'Full-width receipt printer with itemized column alignment (Epson TM-T88, Star TSP100, Sunmi).',
                specs: 'Printable width: 72mm • Font A: 48 chars • Font B: 64 chars',
              },
              {
                id: '58mm',
                name: 'Compact 58mm Roll (32 Columns)',
                desc: 'Pocket/portable mobile Bluetooth thermal printer for tablet & delivery operations.',
                specs: 'Printable width: 48mm • Font A: 32 chars • Font B: 42 chars',
              },
            ].map((p) => {
              const isSelected = settings.paperWidth === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      paperWidth: p.id as PrinterPaperWidth,
                    }))
                  }
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900">{p.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">{p.desc}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400">
                    {p.specs}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Automation & Cash Drawer Triggers */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Checkout Automation & Hardware Triggers</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Control auto-printing and physical cash drawer pulse triggers
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors cursor-pointer">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Auto-print receipt upon checkout completion
                </span>
                <span className="text-[11px] text-slate-500">
                  Instantly sends receipt payload to the configured printer when the cashier clicks &quot;Charge&quot;
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPrintReceipt}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, autoPrintReceipt: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors cursor-pointer">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Kick cash drawer on cash transactions (`ESC p 0 25 250`)
                </span>
                <span className="text-[11px] text-slate-500">
                  Sends electrical solenoid pulse to Pin 2 / Pin 5 on RJ-11/RJ-12 cash drawers
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoOpenCashDrawer}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, autoOpenCashDrawer: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors cursor-pointer">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Print Code128 barcode on receipt footer
                </span>
                <span className="text-[11px] text-slate-500">
                  Allows quick scan returns and invoice lookup using barcode scanner gun
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.printBarcode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, printBarcode: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors cursor-pointer">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Print QR Code for online verification
                </span>
                <span className="text-[11px] text-slate-500">
                  Customer can scan receipt to view electronic warranty and prescription authenticity
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.printQrCode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, printQrCode: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 4. Custom Footer Message */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Custom Thermal Footer Message</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Appears centered at the bottom of the thermal slip before the paper cut
            </p>
          </div>
          <input
            type="text"
            value={settings.footerMessage}
            onChange={(e) => setSettings((prev) => ({ ...prev, footerMessage: e.target.value }))}
            placeholder="Thank You Come Again"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
          />
        </div>

        {/* 5. Diagnostic Testing Section */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Hardware Diagnostics & Live Test Print</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify printer communication and cash drawer pulse without creating a live sale
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
              Interface: {settings.connectionType}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleTestPrint('80mm')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Test Print 80mm Receipt</span>
            </button>

            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleTestPrint('58mm')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold transition-all border border-slate-700 active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Test Print 58mm Receipt</span>
            </button>

            <button
              type="button"
              disabled={isTesting}
              onClick={handleKickDrawer}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>Test Cash Drawer Pulse</span>
            </button>
          </div>
        </div>

        {/* 6. Form Save Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Configuration Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Hardware Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
