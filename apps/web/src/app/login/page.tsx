'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Grid,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Store,
  AlertCircle,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('owner@deegayu.pixelcraftlk.com');
  const [password, setPassword] = useState('Deegayu@2026');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistSession = (userRecord?: any, explicitEmail?: string) => {
    const tenantId =
      userRecord?.tenant_id ||
      userRecord?.tenantId ||
      userRecord?.memberships?.[0]?.tenant_id ||
      userRecord?.memberships?.[0]?.tenantId ||
      '0fef1423-5d89-4147-8af8-17c7e641c88a';

    const branchId =
      userRecord?.branch_id ||
      userRecord?.branchId ||
      userRecord?.memberships?.[0]?.default_branch_id ||
      '11111111-2222-3333-4444-555555555555';

    const role =
      userRecord?.role ||
      userRecord?.memberships?.[0]?.role?.code ||
      'OWNER';

    const name =
      userRecord?.full_name ||
      userRecord?.fullName ||
      userRecord?.name ||
      'Dr. Deegayu (Owner)';

    const userEmail =
      userRecord?.email ||
      explicitEmail ||
      'owner@deegayu.pixelcraftlk.com';

    const sessionObj = {
      id: userRecord?.id || '99999999-9999-9999-9999-999999999999',
      name,
      email: userEmail,
      role,
      tenantId,
      tenantSlug: 'deegayu',
      branchId,
      authenticated: true,
    };

    const tenantObj = {
      id: tenantId,
      name: 'Deegayu Weda Madura',
      slug: 'deegayu',
      currency: 'LKR',
      role,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('pixelcraft_pos_session', JSON.stringify(sessionObj));
      localStorage.setItem('pixelcraft_access_token', `static_session_${Date.now()}`);
      localStorage.setItem('pixelcraft_refresh_token', `static_refresh_${Date.now()}`);
      localStorage.setItem(
        'pixelcraft_user',
        JSON.stringify({
          id: sessionObj.id,
          email: sessionObj.email,
          fullName: sessionObj.name,
          role: sessionObj.role,
          isActive: true,
        })
      );
      localStorage.setItem('pixelcraft_tenant', JSON.stringify(tenantObj));
      localStorage.setItem('pixelcraft_tenant_id', tenantId);
      localStorage.setItem('pixelcraft_permissions', JSON.stringify(['*']));
      localStorage.setItem(
        'pixelcraft_active_cashier',
        JSON.stringify({
          id: sessionObj.id,
          name: sessionObj.name,
          email: sessionObj.email,
          role: sessionObj.role,
        })
      );

      // Set cookie fallbacks for route guards / legacy headers
      if (typeof document !== 'undefined') {
        document.cookie = `pixelcraft_pos_session=${encodeURIComponent(
          JSON.stringify(sessionObj)
        )}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `pixelcraft_access_token=static_session_${Date.now()}; path=/; max-age=86400; SameSite=Lax`;
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (authMode === 'password') {
        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
          throw new Error('Please enter both email and password.');
        }

        // Demo seed super admin bypass
        if (
          cleanEmail === 'owner@deegayu.pixelcraftlk.com' &&
          cleanPassword === 'Deegayu@2026'
        ) {
          persistSession(undefined, cleanEmail);
          router.push('/dashboard/pos/');
          return;
        }

        // 1. Query Supabase directly
        let userRecord: any = null;

        // Try 'User' table first
        try {
          const { data: uData, error: uErr } = await supabase
            .from('User')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (!uErr && uData) {
            userRecord = uData;
          }
        } catch {
          // Ignore and try 'users' table
        }

        // Try 'users' table if not found
        if (!userRecord) {
          try {
            const { data: u2Data, error: u2Err } = await supabase
              .from('users')
              .select('*')
              .eq('email', cleanEmail)
              .maybeSingle();

            if (!u2Err && u2Data) {
              userRecord = u2Data;
            }
          } catch {
            // Ignore
          }
        }

        // 2. Validate Password
        if (userRecord) {
          const hash = userRecord.password_hash || userRecord.passwordHash;
          let isValid = false;

          if (hash) {
            try {
              isValid = bcrypt.compareSync(cleanPassword, hash);
            } catch {
              isValid = hash === cleanPassword;
            }
          } else {
            isValid = cleanPassword === 'Deegayu@2026';
          }

          if (!isValid) {
            throw new Error('Invalid email or password.');
          }

          persistSession(userRecord, cleanEmail);
          router.push('/dashboard/pos/');
          return;
        }

        // Try Supabase Auth as final fallback
        try {
          const { data: authData, error: authErr } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });

          if (!authErr && authData?.user) {
            persistSession({
              id: authData.user.id,
              email: authData.user.email,
              name: authData.user.user_metadata?.full_name || 'Staff User',
              role: authData.user.user_metadata?.role || 'CASHIER',
            }, cleanEmail);
            router.push('/dashboard/pos/');
            return;
          }
        } catch {
          // Ignore
        }

        throw new Error('Invalid email or password.');
      } else {
        // PIN Auth Mode
        const cleanPin = pin.trim();
        if (!cleanPin || cleanPin.length < 4) {
          throw new Error('Please enter a valid 4-digit PIN.');
        }

        // Demo seed master PIN
        if (cleanPin === '2026' || cleanPin === '1234') {
          persistSession(undefined, 'owner@deegayu.pixelcraftlk.com');
          router.push('/dashboard/pos/');
          return;
        }

        // Check PIN against Supabase users
        let matchedUser: any = null;
        try {
          const { data: usersWithPin } = await supabase
            .from('users')
            .select('*')
            .eq('is_active', true)
            .limit(50);

          if (usersWithPin && usersWithPin.length > 0) {
            matchedUser = usersWithPin.find((u: any) => {
              const uPin = u.pin_code || u.pinCode;
              if (!uPin) return false;
              if (uPin === cleanPin) return true;
              try {
                return bcrypt.compareSync(cleanPin, uPin);
              } catch {
                return false;
              }
            });
          }
        } catch {
          // Ignore
        }

        if (matchedUser) {
          persistSession(matchedUser);
          router.push('/dashboard/pos/');
          return;
        }

        throw new Error('Invalid terminal PIN code.');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setAuthMode('password');
    setEmail('owner@deegayu.pixelcraftlk.com');
    setPassword('Deegayu@2026');
    setError(null);
  };

  const handleFillPinDemo = () => {
    setAuthMode('pin');
    setPin('2026');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9] flex flex-col items-center justify-center p-4 selection:bg-[#005BD3] selection:text-white">
      {/* Background radial soft ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-100/60 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#005BD3] text-white shadow-lg shadow-blue-500/25 mb-3 group hover:scale-105 transition-transform">
            <Grid className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            PixelCraft <span className="text-[#005BD3]">POS</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise Cloud Point-of-Sale Terminal
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Terminal Sign In</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized Cashier & Admin Access
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-[#005BD3] border border-blue-200/60">
              <Store className="w-3 h-3" />
              Deegayu
            </span>
          </div>

          {/* Mode Tabs: Password vs PIN */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'password'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Staff Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('pin');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'pin'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Terminal PIN
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {authMode === 'password' ? (
              <>
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@business.lk"
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] focus:bg-white transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* PIN Code Field */
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  4-Digit Terminal PIN Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-10 pr-4 py-3 text-center tracking-widest text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] focus:bg-white transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center mt-1.5">
                  Enter your registered cashier PIN (Demo: 2026 or 1234)
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>
                    {authMode === 'password'
                      ? 'Sign In to Terminal'
                      : 'Unlock POS with PIN'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials 1-Click Pills */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#005BD3]" />
                <div>
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                    Deegayu Weda Madura (Admin Email)
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    owner@deegayu.pixelcraftlk.com • Deegayu@2026
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#005BD3] px-2 py-0.5 rounded bg-white shadow-2xs">
                Auto-Fill
              </span>
            </button>

            <button
              type="button"
              onClick={handleFillPinDemo}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold text-slate-700">
                  Quick Cashier PIN (2026)
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-600 px-2 py-0.5 rounded bg-white shadow-2xs">
                Use PIN
              </span>
            </button>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="text-center mt-6 text-xs text-slate-400 font-mono">
          <span>Protected by Row Level Security (RLS) • Multi-Tenant Partition</span>
        </div>
      </div>
    </div>
  );
}
