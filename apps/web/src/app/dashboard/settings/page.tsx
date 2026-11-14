'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Save,
  Printer,
  CheckCircle2,
  Sparkles,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShieldAlert,
  Image as ImageIcon,
  RotateCcw,
  Check,
  UploadCloud,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import type { TenantStoreSettingsDto } from '@pixelcraft/types';
import { ReceiptBarcodeBlock } from '@/components/pos/receipt-barcode-block';
import { uploadStoreLogo } from '../../../lib/upload-store-logo';
import { supabase } from '../../../lib/supabase';

export default function SettingsDocumentPage() {
  const router = useRouter();
  const { business, refreshProfile, hasPermission } = useTenantBranch();

  // 1. Store Identity & Contact States
  const [storeName, setStoreName] = useState('දීගායු වෙද මැදුර / Deegayu Weda Madura');
  const [legalName, setLegalName] = useState('Deegayu Ayurvedic Products & Health Care (Pvt) Ltd');
  const [branchName, setBranchName] = useState('Kalutara Flagship Dispensary');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('+94 34 222 3456');
  const [email, setEmail] = useState('dispensary@deegayu.pixelcraftlk.com');
  const [address, setAddress] = useState('Main Street, Kalutara, Western Province, Sri Lanka');
  const [vatNumber, setVatNumber] = useState('VAT-10928392-8000');

  // 2. Receipt Layout & Visual Toggles
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [showLogo, setShowLogo] = useState(true);
  const [showVat, setShowVat] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showQr, setShowQr] = useState(true);

  // 3. Custom Receipt Notes & Policy
  const [receiptHeaderNote, setReceiptHeaderNote] = useState(
    'Welcome to Deegayu Weda Madura • Traditional Ayurvedic Dispensary',
  );
  const [receiptFooterNote, setReceiptFooterNote] = useState(
    'නිරෝගී සුවය පතමු! / Wishing you healthy living! Return within 7 days.',
  );
  const [returnPolicy, setReturnPolicy] = useState(
    'Authentic Ayurvedic preparations in unopened seal condition exchangeable within 7 days with original receipt.',
  );

  // Status & Telemetry
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Logo Upload States & Ref
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);
  const [receiptLogoFailed, setReceiptLogoFailed] = useState(false);
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoPreviewFailed(false);
    setReceiptLogoFailed(false);
  }, [logoUrl]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('Logo image must be under 5MB');
      return;
    }

    const previousLogo = logoUrl;
    setLogoUploadError(null);
    setIsUploadingLogo(true);
    setLogoPreviewFailed(false);
    setReceiptLogoFailed(false);

    // Optimistic local preview
    const objectUrl = URL.createObjectURL(file);
    setLogoUrl(objectUrl);

    try {
      const uploadedUrl = await uploadStoreLogo(file, 'deegayu');
      if (!uploadedUrl) throw new Error('No logo URL returned from upload');

      // Cache-busting preview URL for immediate display
      const cacheBustedPreview = uploadedUrl.includes('?')
        ? `${uploadedUrl}&t=${Date.now()}`
        : `${uploadedUrl}?t=${Date.now()}`;
      setLogoUrl(cacheBustedPreview);

      // Auto-persist clean URL immediately to database & localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('pixelcraft_store_settings');
        const prevObj = stored ? JSON.parse(stored) : {};
        localStorage.setItem(
          'pixelcraft_store_settings',
          JSON.stringify({ ...prevObj, logoUrl: uploadedUrl })
        );
      }

      try {
        await supabase
          .from('businesses')
          .update({ logo_url: uploadedUrl })
          .eq('slug', 'deegayu');
      } catch (sbErr) {
        console.warn('Could not update logo_url in Supabase businesses:', sbErr);
      }

      await refreshProfile();
      router.refresh();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.error('Failed to upload store logo:', err);
      const msg = err instanceof Error ? err.message : 'Logo upload failed';
      setLogoUploadError(msg);
      setLogoUrl(previousLogo);
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  const handleLogoRemove = async () => {
    const previousLogo = logoUrl;
    setIsUploadingLogo(true);
    setLogoUploadError(null);
    setLogoUrl('');

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('pixelcraft_store_settings');
        const prevObj = stored ? JSON.parse(stored) : {};
        localStorage.setItem(
          'pixelcraft_store_settings',
          JSON.stringify({ ...prevObj, logoUrl: null })
        );
      }

      try {
        await supabase
          .from('businesses')
          .update({ logo_url: null })
          .eq('slug', 'deegayu');
      } catch (sbErr) {
        console.warn('Could not remove logo_url in Supabase businesses:', sbErr);
      }

      await refreshProfile();
      router.refresh();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.error('Failed to remove store logo:', err);
      const msg = err instanceof Error ? err.message : 'Failed to remove logo';
      setLogoUploadError(msg);
      setLogoUrl(previousLogo);
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  // Fetch settings from Supabase / localStorage on load
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      let resData: Partial<TenantStoreSettingsDto> | null = null;

      // 1. Check localStorage first
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('pixelcraft_store_settings');
          if (stored) {
            resData = JSON.parse(stored);
          }
        } catch {
          // Ignore parse errors
        }
      }

      // 2. Fetch from Supabase directly
      try {
        const { data: sbBiz, error: sbErr } = await supabase
          .from('businesses')
          .select('*, settings:business_settings(*)')
          .eq('slug', 'deegayu')
          .maybeSingle();

        if (!sbErr && sbBiz) {
          resData = {
            ...resData,
            name: sbBiz.name || resData?.name,
            legalName: sbBiz.legal_name || sbBiz.legalName || resData?.legalName,
            logoUrl: sbBiz.logo_url || sbBiz.logoUrl || resData?.logoUrl,
            phone: sbBiz.phone || resData?.phone,
            email: sbBiz.email || resData?.email,
            address: sbBiz.address || resData?.address,
            receiptHeaderNote: sbBiz.settings?.receipt_header || resData?.receiptHeaderNote,
            receiptFooterNote: sbBiz.settings?.receipt_footer || resData?.receiptFooterNote,
            returnPolicy: sbBiz.settings?.return_policy_text || resData?.returnPolicy,
          };
        }
      } catch (sbErr) {
        console.warn('Could not load settings from Supabase businesses:', sbErr);
      }

      if (resData) {
        const d = resData;
        if (d.name) setStoreName(d.name);
        if (d.legalName) setLegalName(d.legalName);
        if (d.logoUrl) setLogoUrl(d.logoUrl);
        else setLogoUrl('');
        if (d.phone) setPhone(d.phone);
        if (d.email) setEmail(d.email);
        if (d.address) setAddress(d.address);
        if (d.vatNumber) setVatNumber(d.vatNumber);
        if (d.receiptHeaderNote) setReceiptHeaderNote(d.receiptHeaderNote);
        if (d.receiptFooterNote) setReceiptFooterNote(d.receiptFooterNote);
        if (d.returnPolicy) setReturnPolicy(d.returnPolicy);
        if (d.receiptPaperWidth) setPaperWidth(d.receiptPaperWidth);
        if (d.showLogo !== undefined) setShowLogo(d.showLogo);
        if (d.showVat !== undefined) setShowVat(d.showVat);
        if (d.showBarcode !== undefined) setShowBarcode(d.showBarcode);
        if (d.showQr !== undefined) setShowQr(d.showQr);
      }
    } catch (err) {
      console.warn('Could not load tenant settings, using default store profile:', err);
      // Fallback to business profile context if available
      if (business) {
        if (business.name) setStoreName(business.name);
        if (business.legalName) setLegalName(business.legalName);
        if (business.logoUrl) setLogoUrl(business.logoUrl);
        if (business.primaryBranch?.name) setBranchName(business.primaryBranch.name);
        if (business.primaryBranch?.address) setAddress(business.primaryBranch.address);
        if (business.primaryBranch?.phone) setPhone(business.primaryBranch.phone);
        if (business.settings?.taxNumber) setVatNumber(business.settings.taxNumber);
      }
    } finally {
      setIsLoading(false);
    }
  }, [business]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasPermission('settings:manage')) {
      alert('You do not have permission to manage store settings.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const payload: Partial<TenantStoreSettingsDto> = {
        name: storeName.trim(),
        legalName: legalName.trim() || null,
        logoUrl: logoUrl.trim() || null,
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim(),
        vatNumber: vatNumber.trim() || null,
        receiptHeaderNote: receiptHeaderNote.trim() || null,
        receiptFooterNote: receiptFooterNote.trim() || null,
        returnPolicy: returnPolicy.trim() || null,
        receiptPaperWidth: paperWidth,
        showLogo,
        showVat,
        showBarcode,
        showQr,
      };

      // 1. Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('pixelcraft_store_settings', JSON.stringify(payload));
      }

      // 2. Persist to Supabase
      try {
        await supabase
          .from('businesses')
          .update({
            name: payload.name,
            legal_name: payload.legalName,
            logo_url: payload.logoUrl,
            phone: payload.phone,
            email: payload.email,
            address: payload.address,
          })
          .eq('slug', 'deegayu');
      } catch (sbErr) {
        console.warn('Could not update Supabase businesses:', sbErr);
      }

      setSaveSuccess(true);
      setIsDirty(false);
      await refreshProfile();
      router.refresh();
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: unknown) {
      console.error('Failed to save store settings:', err);
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to save store settings.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (preset: 'deegayu-kalutara' | 'deegayu-colombo' | 'compact-58mm') => {
    setIsDirty(true);
    if (preset === 'deegayu-kalutara') {
      setStoreName('දීගායු වෙද මැදුර / Deegayu Weda Madura');
      setLegalName('Deegayu Ayurvedic Products & Health Care (Pvt) Ltd');
      setBranchName('Kalutara Flagship Dispensary');
      setAddress('Main Street, Kalutara, Western Province, Sri Lanka');
      setPhone('+94 34 222 3456');
      setEmail('dispensary@deegayu.pixelcraftlk.com');
      setVatNumber('VAT-10928392-8000');
      setPaperWidth('80mm');
      setShowLogo(true);
      setShowVat(true);
      setShowBarcode(true);
      setShowQr(true);
      setReceiptHeaderNote('Welcome to Deegayu Weda Madura • Traditional Ayurvedic Dispensary');
      setReceiptFooterNote('නිරෝගී සුවය පතමු! / Wishing you healthy living! Return within 7 days.');
      setReturnPolicy('Authentic Ayurvedic preparations in unopened seal condition exchangeable within 7 days with original receipt.');
    } else if (preset === 'deegayu-colombo') {
      setStoreName('දීගායු වෙද මැදුර / Deegayu Express');
      setLegalName('Deegayu Ayurvedic Health Care (Pvt) Ltd');
      setBranchName('Colombo Central Clinic & Store');
      setAddress('142 Galle Road, Bambalapitiya, Colombo 04');
      setPhone('+94 11 258 7890');
      setEmail('colombo@deegayu.pixelcraftlk.com');
      setVatNumber('VAT-10928392-8000');
      setPaperWidth('80mm');
      setShowLogo(true);
      setShowVat(true);
      setShowBarcode(true);
      setShowQr(true);
      setReceiptHeaderNote('Deegayu Express Wellness Hub • Colombo 04');
      setReceiptFooterNote('නිරෝගී දිවියකට ආයුර්වේද සත්කාරය • Thank you!');
      setReturnPolicy('Valid invoice required for exchanges within 7 business days.');
    } else if (preset === 'compact-58mm') {
      setPaperWidth('58mm');
      setShowLogo(false);
      setShowVat(true);
      setShowBarcode(true);
      setShowQr(false);
      setReceiptHeaderNote('Deegayu Weda Madura (Quick Dispense)');
      setReceiptFooterNote('නිරෝගී සුවය පතමු! Thank you!');
    }
  };

  const getPreviewWidthClass = () => {
    return paperWidth === '58mm' ? 'w-[260px] text-[10px]' : 'w-[340px] text-xs';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
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
            width: ${paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 0;
            size: ${paperWidth === '58mm' ? '58mm auto' : '80mm auto'};
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#7052FF]">
              Retail Operations
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Phase 15
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5 mt-1">
            Store Profile & Receipt Branding Engine
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Active Tenant: Deegayu
            </span>
            {isLoading && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                Syncing...
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure store business identity, Kalutara clinic address, contact telemetry, VAT registration, and real-time 80mm/58mm thermal receipt branding.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => applyPreset('deegayu-kalutara')}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              Kalutara Flagship
            </button>
            <button
              type="button"
              onClick={() => applyPreset('deegayu-colombo')}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              Colombo Express
            </button>
            <button
              type="button"
              onClick={() => applyPreset('compact-58mm')}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              58mm Compact
            </button>
          </div>

          {/* Navigation Pill */}
          <Link
            href="/dashboard/settings/hardware"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            Hardware & ESC/POS &rarr;
          </Link>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Settings Configuration Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Store Identity & Legal Entity */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      1. Store Identity & Legal Branding
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Display name and registered business credentials on customer receipts
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Store Brand Name (Display) *
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => {
                      setStoreName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. දීගායු වෙද මැදුර / Deegayu Weda Madura"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Sinhala & English bilingual name</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Legal Business Name
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => {
                      setLegalName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Deegayu Ayurvedic Products & Health Care (Pvt) Ltd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Official registered company name</p>
                </div>
              </div>

              {/* Brand Logo Management Widget (Button-Driven, No Raw URL Inputs) */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#7052FF]" />
                    <span>Store Brand Logo</span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    Propagates to Sidebar, POS Header & 80mm Receipts
                  </span>
                </label>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={logoFileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90">
                  {/* 80x80 Squircle Preview Box */}
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0 overflow-hidden p-1 relative group">
                    {logoUrl && !logoPreviewFailed ? (
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        className="w-full h-full object-contain"
                        onError={() => setLogoPreviewFailed(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#7052FF] to-[#5939e6] rounded-xl flex items-center justify-center text-white shadow-xs">
                        <span className="text-2xl font-black tracking-tight">
                          {storeName.trim().charAt(0) || 'D'}
                        </span>
                      </div>
                    )}
                    {isUploadingLogo && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                        <Loader2 className="w-6 h-6 text-[#7052FF] animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Actions & Instructions */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#7052FF] hover:bg-[#5e3fed] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{logoUrl ? 'Change Logo' : 'Upload Store Logo'}</span>
                          </>
                        )}
                      </button>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          disabled={isUploadingLogo}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200/80 text-xs font-semibold rounded-xl shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      PNG, SVG, or WebP up to 5MB • Transparent background recommended for 80mm thermal receipts.
                    </p>

                    {logoUploadError && (
                      <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>{logoUploadError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Branch Location, Contact & VAT Details */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Branch Location, Contacts & Tax ID
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Dispensary address, telephone numbers, and VAT tax number
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Display Name
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => {
                      setBranchName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Kalutara Flagship Dispensary"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    VAT / Tax Registration Number
                  </label>
                  <input
                    type="text"
                    value={vatNumber}
                    onChange={(e) => {
                      setVatNumber(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. VAT-10928392-8000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Street Address & City *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Main Street, Kalutara, Western Province, Sri Lanka"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone Number(s) *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. +94 34 222 3456"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. dispensary@deegayu.pixelcraftlk.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Thermal Paper Width & Visual Branding Toggles */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      3. Paper Roll Width & Badging Toggles
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Select receipt width and configure visual badges
                    </p>
                  </div>
                </div>
              </div>

              {/* Paper Roll Width Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Receipt Paper Width (Roll Size)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      id: '80mm',
                      title: '80mm (3-Inch)',
                      desc: 'Standard desktop POS receipt width (Deegayu recommended)',
                    },
                    {
                      id: '58mm',
                      title: '58mm (2-Inch)',
                      desc: 'Compact mobile Bluetooth / handheld receipt width',
                    },
                  ].map((p) => {
                    const isSelected = paperWidth === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPaperWidth(p.id as '80mm' | '58mm');
                          setIsDirty(true);
                        }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#7052FF] bg-purple-50/50 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{p.title}</span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#7052FF] text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 Badging Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show Store Logo</div>
                    <div className="text-[10px] text-slate-400">Renders brand mark atop receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => {
                      setShowLogo(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="w-4 h-4 rounded text-[#7052FF] focus:ring-[#7052FF]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show VAT / Tax Reg</div>
                    <div className="text-[10px] text-slate-400">Prints corporate tax identifier</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showVat}
                    onChange={(e) => {
                      setShowVat(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="w-4 h-4 rounded text-[#7052FF] focus:ring-[#7052FF]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show Barcode (Code128)</div>
                    <div className="text-[10px] text-slate-400">Barcode scanner re-entry</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => {
                      setShowBarcode(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="w-4 h-4 rounded text-[#7052FF] focus:ring-[#7052FF]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Show Verification QR</div>
                    <div className="text-[10px] text-slate-400">Digital verification portal link</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showQr}
                    onChange={(e) => {
                      setShowQr(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="w-4 h-4 rounded text-[#7052FF] focus:ring-[#7052FF]"
                  />
                </label>
              </div>
            </div>

            {/* 4. Custom Receipt Notes & Policy */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      4. Custom Receipt Notes & Return Policy
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Greeting header, Sinhala footer blessing, and warranty terms
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receipt Header Note (Greeting / Sub-header)
                </label>
                <textarea
                  rows={2}
                  value={receiptHeaderNote}
                  onChange={(e) => {
                    setReceiptHeaderNote(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Welcome to Deegayu Weda Madura • Traditional Ayurvedic Dispensary"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Receipt Footer Message (Blessing / Thank You)
                </label>
                <textarea
                  rows={2}
                  value={receiptFooterNote}
                  onChange={(e) => {
                    setReceiptFooterNote(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. නිරෝගී සුවය පතමු! / Wishing you healthy living! Return within 7 days."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Return & Exchange Policy
                </label>
                <textarea
                  rows={2}
                  value={returnPolicy}
                  onChange={(e) => {
                    setReturnPolicy(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Authentic Ayurvedic preparations in unopened seal condition exchangeable within 7 days with original receipt."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#7052FF] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Toast / Notification */}
            {saveSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2.5 animate-in fade-in duration-150">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Store profile & receipt branding saved successfully! Changes are persisted and immediately active across all registers and customer receipts.
                </span>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Live Interactive Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center sticky top-6">
          <div className="w-full mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#7052FF]" />
              Live Receipt Preview ({paperWidth})
            </span>
            <button
              onClick={() => window.print()}
              className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Test thermal print output"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Test Print</span>
            </button>
          </div>

          {/* Live Preview Thermal Paper Card */}
          <div
            id="settings-receipt-live-preview"
            className={`bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-lg font-mono text-slate-900 transition-all duration-200 ${getPreviewWidthClass()}`}
          >
            {/* Header: Store Identity */}
            <div className="text-center space-y-1 pb-2">
              {showLogo && (
                <div className="flex justify-center mb-1.5">
                  {logoUrl && !receiptLogoFailed ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/80 p-0.5">
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        className="w-full h-full object-contain"
                        onError={() => setReceiptLogoFailed(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#7052FF] text-white flex items-center justify-center font-bold text-base shadow-xs">
                      {storeName.trim().charAt(0) || 'D'}
                    </div>
                  )}
                </div>
              )}

              <div className="text-sm font-black tracking-tight text-slate-950 uppercase leading-snug">
                {storeName || 'DEEGAYU WEDA MADURA'}
              </div>

              <div className="text-[11px] font-bold text-indigo-700">දීගායු වෙද මැදුර</div>

              <div className="text-[10px] text-slate-600 font-sans font-medium flex items-center justify-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>{branchName || 'Kalutara Flagship Dispensary'}</span>
              </div>

              {address && (
                <div className="text-[9px] text-slate-500 font-sans max-w-[260px] mx-auto leading-tight">
                  {address}
                </div>
              )}

              {phone && (
                <div className="text-[9px] text-slate-500 flex items-center justify-center gap-1">
                  <Phone className="w-2.5 h-2.5 text-slate-400" />
                  <span>{phone}</span>
                </div>
              )}

              {email && (
                <div className="text-[9px] text-slate-400 font-sans">
                  {email}
                </div>
              )}

              {showVat && vatNumber && (
                <div className="text-[9px] font-bold text-slate-700 pt-0.5">
                  VAT Reg: {vatNumber}
                </div>
              )}
            </div>

            {/* Custom Header Note */}
            {receiptHeaderNote && (
              <div className="py-1 text-center text-[9px] italic text-slate-600 border-t border-dotted border-slate-200">
                {receiptHeaderNote}
              </div>
            )}

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Transaction Metadata */}
            <div className="space-y-0.5 text-[9px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <span className="font-bold text-slate-900">INV-2026-00042</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>REG-01 (Dr. Deegayu)</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-slate-800">Walk-in Client (සාමාන්‍ය පාරිභෝගික)</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Authentic Sample Ayurvedic Items */}
            <div className="space-y-1.5 text-[10px]">
              <div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-900 truncate max-w-[200px]">
                    දසමූලාරිෂ්ටය (Dasamoolarishta 375ml)
                  </span>
                  <span className="font-bold">LKR 1,900.00</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>2 x LKR 950.00</span>
                  <span className="italic text-[#7052FF]">Ayurvedic Liquid</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-900 truncate max-w-[200px]">
                    සිද්ධාලේප බාම් (Siddhalepa Balm 50g)
                  </span>
                  <span className="font-bold">LKR 420.00</span>
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  <span>1 x LKR 420.00</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-900 truncate max-w-[200px]">
                    සුවධරණී තේ (Suwadharani 20 Bags)
                  </span>
                  <span className="font-bold">LKR 650.00</span>
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  <span>1 x LKR 650.00</span>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            {/* Financial Breakdown */}
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>LKR 2,970.00</span>
              </div>
              {showVat && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT (0% / Ex)</span>
                  <span>LKR 0.00</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-900 text-slate-950">
                <span>TOTAL DUE</span>
                <span>LKR 2,970.00</span>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 pt-1">
                <span>Paid (CASH)</span>
                <span>LKR 3,000.00</span>
              </div>
              <div className="flex justify-between text-[9px] text-emerald-700 font-bold">
                <span>Change Given</span>
                <span>LKR 30.00</span>
              </div>
            </div>

            {/* Authentic Code128 Barcode & Scannable QR Code */}
            <ReceiptBarcodeBlock
              invoiceNumber="INV-2026-00042"
              verificationUrl="https://pos.pixelcraftlk.com/receipt/INV-2026-00042"
              paperWidth={paperWidth}
              showBarcode={showBarcode}
              showQr={showQr}
              captionText="Scan to verify receipt online"
            />

            {/* Footer Notes & Return Policy */}
            <div className="pt-2 text-center space-y-0.5 border-t border-dotted border-slate-200 mt-2 font-sans">
              {receiptFooterNote && (
                <div className="text-[9px] font-bold text-slate-800">
                  {receiptFooterNote}
                </div>
              )}
              {returnPolicy && (
                <div className="text-[8px] text-slate-500 italic leading-tight">
                  {returnPolicy}
                </div>
              )}
              <div className="text-[7px] text-slate-400 uppercase tracking-wider pt-1 font-mono">
                Powered by PixelCraft POS • Deegayu Weda Madura
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom "Save Changes" Toast Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 z-40 shadow-2xl flex items-center justify-between max-w-7xl mx-auto rounded-t-3xl">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span>Tenant Configuration Engine</span>
              {isDirty && (
                <span className="text-[10px] px-2 py-0.2 rounded-md bg-amber-100 text-amber-800 font-semibold">
                  ● Unsaved Changes
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              Active Store: <span className="font-semibold text-slate-700">{storeName}</span> ({paperWidth} Thermal)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              type="button"
              onClick={loadSettings}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard Changes</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="py-2.5 px-6 rounded-xl bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-[#7052FF]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Store Settings...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Store Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
