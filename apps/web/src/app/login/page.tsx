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
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('owner@deegayu.pixelcraftlk.com');
  const [password, setPassword] = useState('Deegayu@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Attempt login via internal route handler
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials.');
      }

      const authData = data.data;

      // 2. Persist session data to localStorage
      localStorage.setItem('pixelcraft_access_token', authData.accessToken);
      localStorage.setItem('pixelcraft_refresh_token', authData.refreshToken);
      localStorage.setItem('pixelcraft_user', JSON.stringify(authData.user));
      localStorage.setItem('pixelcraft_tenant', JSON.stringify(authData.activeTenant));
      localStorage.setItem(
        'pixelcraft_tenant_id',
        authData.activeTenant?.id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
      );
      localStorage.setItem(
        'pixelcraft_permissions',
        JSON.stringify(authData.permissions || ['*']),
      );

      // 3. Redirect to POS Terminal
      router.push('/dashboard/pos');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('owner@deegayu.pixelcraftlk.com');
    setPassword('Deegayu@2026');
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
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Terminal Sign In</h2>
              <p className="text-xs text-slate-500 mt-0.5">Authorized Cashier & Admin Access</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-[#005BD3] border border-blue-200/60">
              <Store className="w-3 h-3" />
              Deegayu
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-[#005BD3] font-medium cursor-pointer hover:underline">
                  Terminal PIN
                </span>
              </div>
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials 1-Click Pill */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#005BD3]" />
                <div>
                  <div className="text-[11px] font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                    Deegayu Weda Madura (Admin)
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
