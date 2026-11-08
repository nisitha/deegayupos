'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Store,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { onboardingApi } from '@/lib/api-client';
import type {
  OnboardingPayload,
  PublicPlanDto,
} from '@pixelcraft/types';

const BUSINESS_TYPES = [
  { value: 'RETAIL', label: 'General Retail', desc: 'Boutiques, department stores, gift shops' },
  { value: 'SUPERMARKET', label: 'Supermarket & Grocery', desc: 'FMCG, weighing scale, barcodes' },
  { value: 'RESTAURANT', label: 'Restaurant & Cafe', desc: 'Dine-in, takeaway, table orders' },
  { value: 'FASHION', label: 'Fashion & Apparel', desc: 'Size/color variants, seasonal stock' },
  { value: 'ELECTRONICS', label: 'Consumer Electronics', desc: 'IMEI, serial tracking, warranty' },
  { value: 'PHARMACY', label: 'Pharmacy & Wellness', desc: 'Batch numbers, expiry tracking' },
];

const CURRENCIES = [
  { code: 'LKR', label: 'LKR (Sri Lankan Rupee)' },
  { code: 'USD', label: 'USD (US Dollar)' },
  { code: 'EUR', label: 'EUR (Euro)' },
  { code: 'GBP', label: 'GBP (British Pound)' },
];

const TIMEZONES = [
  { value: 'Asia/Colombo', label: 'Asia/Colombo (UTC +05:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC +04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC +08:00)' },
  { value: 'Europe/London', label: 'Europe/London (UTC +00:00)' },
  { value: 'America/New_York', label: 'America/New York (UTC -05:00)' },
];

export default function OnboardingWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<OnboardingPayload>({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    businessName: '',
    businessSlug: '',
    legalName: '',
    businessType: 'RETAIL',
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    branchName: 'Main Flagship Branch',
    branchAddress: '',
    branchPhone: '',
    warehouseName: 'Central Warehouse',
    registerName: 'Counter 01 POS',
    planCode: 'PROFESSIONAL',
  });

  // Slug check state
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  // Fetch Public Plans
  const { data: plansData, isLoading: isPlansLoading } = useQuery({
    queryKey: ['onboarding-plans'],
    queryFn: async () => {
      try {
        const res = await onboardingApi.getPlans();
        return res.data;
      } catch {
        // Fallback plans if API is not running
        return [
          {
            id: 'plan-starter',
            code: 'STARTER',
            name: 'Starter Plan',
            description: 'Ideal for single-outlet retail boutiques and start-ups.',
            monthlyPrice: 29.0,
            annualPrice: 290.0,
            maxProducts: 500,
            maxBranches: 1,
            maxUsers: 2,
            maxRegisters: 1,
            enabledModules: ['pos', 'inventory'],
            trialDays: 14,
          },
          {
            id: 'plan-pro',
            code: 'PROFESSIONAL',
            name: 'Professional Plan',
            description: 'Engineered for growing multi-outlet retailers and restaurants.',
            monthlyPrice: 79.0,
            annualPrice: 790.0,
            maxProducts: 5000,
            maxBranches: 3,
            maxUsers: 10,
            maxRegisters: 5,
            enabledModules: ['pos', 'inventory', 'reports', 'multi-branch'],
            trialDays: 14,
          },
          {
            id: 'plan-ent',
            code: 'ENTERPRISE',
            name: 'Enterprise Plan',
            description: 'Unlimited scalability, multi-warehouse support, API access, and enterprise SLAs.',
            monthlyPrice: 199.0,
            annualPrice: 1990.0,
            maxProducts: 50000,
            maxBranches: 20,
            maxUsers: 50,
            maxRegisters: 25,
            enabledModules: ['pos', 'inventory', 'reports', 'multi-branch', 'loyalty', 'api'],
            trialDays: 14,
          },
        ] as PublicPlanDto[];
      }
    },
  });

  // Automatically generate slug from businessName
  const handleBusinessNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData((prev) => ({
      ...prev,
      businessName: name,
      businessSlug: autoSlug,
    }));
  };

  // Debounced live slug check
  useEffect(() => {
    if (!formData.businessSlug || formData.businessSlug.length < 2) {
      setSlugStatus({ checking: false });
      return;
    }

    setSlugStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await onboardingApi.checkSlug(formData.businessSlug);
        const isAvailable = res.data?.available ?? true;
        setSlugStatus({
          checking: false,
          available: isAvailable,
          message: isAvailable
            ? `${formData.businessSlug}.pos.pixelcraftlk.com is available`
            : res.data?.reason || 'Slug is unavailable',
        });
      } catch {
        // Fallback for offline demo
        setSlugStatus({
          checking: false,
          available: true,
          message: `${formData.businessSlug}.pos.pixelcraftlk.com is available`,
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.businessSlug]);

  // Submit Mutation
  const registerMutation = useMutation({
    mutationFn: async (payload: OnboardingPayload) => {
      return onboardingApi.register(payload);
    },
    onSuccess: (res) => {
      // Store session tokens
      if (res.data && typeof window !== 'undefined') {
        localStorage.setItem('pixelcraft_access_token', res.data.accessToken);
        localStorage.setItem('pixelcraft_refresh_token', res.data.refreshToken);
        localStorage.setItem(
          'pixelcraft_active_tenant',
          JSON.stringify(res.data.activeTenant),
        );
      }
      // Move to complete screen
      setCurrentStep(5);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { message?: string; error?: { message?: string } })?.error
          ?.message ||
        (err as { message?: string })?.message ||
        'Failed to provision tenant organization. Please review your details.';
      setErrorMessage(msg);
    },
  });

  // Step Validation
  const canProceedStep1 =
    formData.fullName.trim().length >= 2 &&
    formData.email.includes('@') &&
    formData.password.length >= 8 &&
    formData.businessName.trim().length >= 2 &&
    slugStatus.available === true;

  const canProceedStep2 =
    !!formData.businessType && !!formData.currency && !!formData.timezone;

  const canProceedStep3 =
    (formData.branchName?.trim().length || 0) >= 2 &&
    (formData.warehouseName?.trim().length || 0) >= 2 &&
    (formData.registerName?.trim().length || 0) >= 2;

  const handleNext = () => {
    setErrorMessage(null);
    if (currentStep === 1 && !canProceedStep1) {
      setErrorMessage('Please complete all required fields and ensure slug is available.');
      return;
    }
    if (currentStep === 2 && !canProceedStep2) {
      setErrorMessage('Please select business type, currency, and timezone.');
      return;
    }
    if (currentStep === 3 && !canProceedStep3) {
      setErrorMessage('Please verify your primary branch and register details.');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Final submission
      registerMutation.mutate(formData);
    }
  };

  const handlePrev = () => {
    setErrorMessage(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-zinc-100 flex flex-col justify-between antialiased selection:bg-cyan-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-[#0B0E17]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-400 p-[1px]">
            <div className="w-full h-full bg-[#07090E] rounded-[7px] flex items-center justify-center">
              <Terminal className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              PixelCraft POS
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                14-Day Free Trial
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Enterprise Multi-Tenant Onboarding
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Exit Setup
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col justify-center">
        {/* Step Indicator Header */}
        {currentStep <= 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-zinc-400">
              <span className="text-cyan-400">Step 0{currentStep} of 04</span>
              <span>
                {currentStep === 1 && 'Account & Business Basics'}
                {currentStep === 2 && 'Industry & Localization'}
                {currentStep === 3 && 'Primary Location Setup'}
                {currentStep === 4 && 'Subscription Tier Selection'}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Registration Attention Required:</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Wizard Card Body */}
        <div className="rounded-2xl bg-[#0B0E17]/90 border border-zinc-800/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* STEP 1: Account & Business Basics */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Account & Organization Credentials
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Create your administrator identity and reserve your organization subdomain.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Kasun Perera"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Administrator Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="owner@myboutique.lk"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Secure Password (min 8 chars) *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••••••"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {/* Contact Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+94 77 123 4567"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/60 space-y-4">
                {/* Business Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Official Business Name *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    placeholder="PixelCraft LK Flagship Store"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                {/* Tenant Subdomain Slug */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300 flex items-center justify-between">
                    <span>Tenant Subdomain Slug *</span>
                    {slugStatus.checking && (
                      <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        Validating availability...
                      </span>
                    )}
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={formData.businessSlug}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessSlug: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_-]/g, ''),
                        })
                      }
                      placeholder="flagship"
                      className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-l-lg px-3.5 py-2.5 text-xs text-cyan-400 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                    />
                    <div className="bg-zinc-900 border-y border-r border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-zinc-400 rounded-r-lg">
                      .pos.pixelcraftlk.com
                    </div>
                  </div>

                  {/* Slug validation pill */}
                  {slugStatus.message && (
                    <div
                      className={`text-[11px] font-mono flex items-center gap-1.5 mt-1.5 ${
                        slugStatus.available ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {slugStatus.available ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{slugStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Industry & Localization */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Industry & Localization
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Tailor tax profiles, currencies, and register modules for your retail segment.
                </p>
              </div>

              {/* Industry Grid */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-300">
                  Select Business Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {BUSINESS_TYPES.map((type) => {
                    const isSelected = formData.businessType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, businessType: type.value })
                        }
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/20'
                            : 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-cyan-300' : 'text-zinc-200'
                            }`}
                          >
                            {type.label}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center text-black">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 font-sans leading-snug">
                          {type.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/60">
                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Primary Operational Currency *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timezone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Business Timezone *
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) =>
                      setFormData({ ...formData, timezone: e.target.value })
                    }
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {TIMEZONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Primary Branch & Register Setup */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Primary Location Setup
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  We automatically provision your initial retail outlet, inventory warehouse, and checkout register.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Branch Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Primary Branch Outlet Name *
                  </label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(e) =>
                      setFormData({ ...formData, branchName: e.target.value })
                    }
                    placeholder="Colombo Main Store"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                {/* Physical Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Physical Store Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.branchAddress || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, branchAddress: e.target.value })
                    }
                    placeholder="100 Galle Road, Colombo 03, Sri Lanka"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                {/* Warehouse Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Default Inventory Warehouse *
                  </label>
                  <input
                    type="text"
                    value={formData.warehouseName}
                    onChange={(e) =>
                      setFormData({ ...formData, warehouseName: e.target.value })
                    }
                    placeholder="Central Warehouse"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>

                {/* Register Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    POS Terminal / Cash Register 01 *
                  </label>
                  <input
                    type="text"
                    value={formData.registerName}
                    onChange={(e) =>
                      setFormData({ ...formData, registerName: e.target.value })
                    }
                    placeholder="POS Counter 1"
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300/90 font-mono flex items-center gap-3">
                <Store className="w-5 h-5 text-cyan-400 shrink-0" />
                <span>
                  You will be configured as the <strong>OWNER</strong> linked to this primary branch with full checkout, catalog, and reporting permissions.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: Plan Selection */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Select Your SaaS Subscription Tier
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  All plans include an immediate <strong>14-Day Free Trial</strong>. No payment card required today.
                </p>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isPlansLoading ? (
                  <div className="col-span-3 py-12 text-center text-zinc-500 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                    <span>Loading available plans...</span>
                  </div>
                ) : (
                  plansData?.map((plan) => {
                    const isSelected = formData.planCode === plan.code;
                    return (
                      <div
                        key={plan.code}
                        onClick={() =>
                          setFormData({ ...formData, planCode: plan.code })
                        }
                        className={`p-5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all relative ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500'
                            : 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        {/* Trial Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-wider text-white">
                            {plan.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                            14-Day Free Trial
                          </span>
                        </div>

                        {/* Pricing */}
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1 text-white font-mono">
                            <span className="text-3xl font-semibold">
                              ${plan.monthlyPrice}
                            </span>
                            <span className="text-xs text-zinc-400">/mo</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 font-sans mt-1">
                            {plan.description}
                          </p>
                        </div>

                        {/* Entitlements */}
                        <div className="space-y-2 py-3 border-y border-zinc-800/60 text-[11px] font-mono text-zinc-300">
                          <div>✓ Up to {plan.maxProducts.toLocaleString()} Products</div>
                          <div>✓ {plan.maxBranches} Branch Outlet(s)</div>
                          <div>✓ {plan.maxRegisters} POS Counter(s)</div>
                          <div>✓ {plan.maxUsers} Staff User(s)</div>
                        </div>

                        {/* Selection status */}
                        <div className="mt-4 flex items-center justify-center">
                          <span
                            className={`w-full py-1.5 rounded-lg text-center text-xs font-mono transition-colors ${
                              isSelected
                                ? 'bg-cyan-500 text-black font-semibold'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {isSelected ? 'Selected Tier' : 'Select Plan'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Success & Instant Redirection */}
          {currentStep === 5 && (
            <div className="text-center py-8 space-y-5 animate-in zoom-in-95 duration-400">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-950/50">
                <Sparkles className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Tenant Organization Provisioned!
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  14-Day Full Access Trial Activated for @{formData.businessSlug}
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-left text-xs font-mono space-y-2">
                <div className="flex justify-between text-zinc-400">
                  <span>Organization Name:</span>
                  <span className="text-white">{formData.businessName}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Domain Subdomain:</span>
                  <span className="text-cyan-400">
                    {formData.businessSlug}.pos.pixelcraftlk.com
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Assigned Role:</span>
                  <span className="text-emerald-400">OWNER (Full Permissions)</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Trial Period:</span>
                  <span className="text-amber-400">14 Days Free Access</span>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-4">
                <Link
                  href="/super-admin"
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-medium font-mono shadow-lg shadow-cyan-950/40 transition-all flex items-center gap-2"
                >
                  <span>Launch Platform Console</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Wizard Footer Controls */}
          {currentStep <= 4 && (
            <div className="mt-8 pt-5 border-t border-zinc-800/60 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={
                  registerMutation.isPending ||
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 2 && !canProceedStep2) ||
                  (currentStep === 3 && !canProceedStep3)
                }
                className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black text-xs font-semibold font-mono shadow-md shadow-cyan-950/40 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {registerMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>Provisioning Store...</span>
                  </>
                ) : currentStep === 4 ? (
                  <>
                    <span>Complete 14-Day Free Trial</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] font-mono text-zinc-600 border-t border-zinc-900">
        PixelCraft POS LK SaaS Engine • Protected by Row Level Security (RLS) & ISO Financial Precision
      </footer>
    </div>
  );
}
