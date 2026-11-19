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
  KeyRound,
  MapPin,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ALL_BRANCH_IDS = [
  '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
  '133eeaec-5726-4702-a819-8423750db203',
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
  'fa68e4a0-a515-44c8-a082-5b5590366658',
  '197693d6-4247-48df-b614-6fcde9e34f7d',
];

const PRESET_STAFF = [
  {
    name: 'Dr. Deegayu (Owner)',
    email: 'owner@deegayu.pixelcraftlk.com',
    role: 'OWNER',
    branchLabel: 'All Branches • Full Admin',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    name: 'Shashini',
    email: 'shashini@deegayu.pixelcraftlk.com',
    role: 'STAFF',
    branchLabel: 'Alawwa (Stock & GRN Officer)',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    name: 'Tharindu',
    email: 'tharindu@deegayu.pixelcraftlk.com',
    role: 'STAFF',
    branchLabel: 'Alawwa & Dambadeniya (GRN Dambadeniya)',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    name: 'Anusha',
    email: 'anusha@deegayu.pixelcraftlk.com',
    role: 'STAFF',
    branchLabel: 'Dambadeniya (Staff Cashier)',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  {
    name: 'Kumari',
    email: 'kumari@deegayu.pixelcraftlk.com',
    role: 'STAFF',
    branchLabel: 'Giriulla (Stock & GRN Officer)',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    name: 'Gindika',
    email: 'gindika@deegayu.pixelcraftlk.com',
    role: 'STAFF',
    branchLabel: 'Giriulla (Staff Cashier)',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

interface PendingGateUser {
  userRecord?: any;
  email: string;
  name: string;
  role: string;
  assignedBranchIds: string[];
  grnBranchIds: string[];
  tenantId: string;
}

const MULTI_BRANCH_OPTIONS = [
  {
    id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
    name: 'Alawwa Branch',
    nameSi: 'ඇලව්ව ශාඛාව',
    code: 'ALW-01',
    address: 'Deegayu Weda Madhura, Alawwa Road, Alawwa',
    phone: '037-2241088',
    rolesBadge: 'POS Billing & Daily Cash Reconciliation',
    rolesBadgeSi: 'POS බිල්පත් සහ දෛනික මුදල් සමථකරණය',
    canGrn: false,
    colorScheme: 'from-blue-600 to-indigo-700',
    borderHover: 'hover:border-blue-500 hover:ring-2 hover:ring-blue-500/20',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'fa68e4a0-a515-44c8-a082-5b5590366658',
    name: 'Dambadeniya Branch',
    nameSi: 'දඹදෙණිය ශාඛාව',
    code: 'DMB-01',
    address: 'Deegayu Weda Madhura, Kurunegala Road, Dambadeniya',
    phone: '037-2287411',
    rolesBadge: 'POS Billing, Cash Reconciliation & Supplier GRN Officer',
    rolesBadgeSi: 'POS බිල්පත්, දෛනික මුදල් සමථකරණය සහ සැපයුම්කරු GRN නිලධාරී',
    canGrn: true,
    colorScheme: 'from-emerald-600 to-teal-700',
    borderHover: 'hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
];

export default function LoginPage() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('owner@deegayu.pixelcraftlk.com');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGateUser, setPendingGateUser] = useState<PendingGateUser | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  React.useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const persistSession = (
    userRecord?: any,
    explicitEmail?: string,
    explicitBranchId?: string,
    explicitBranchName?: string
  ) => {
    const tenantId =
      userRecord?.tenant_id ||
      userRecord?.tenantId ||
      userRecord?.memberships?.[0]?.tenant_id ||
      userRecord?.memberships?.[0]?.tenantId ||
      '0fef1423-5d89-4147-8af8-17c7e641c88a';

    const role =
      userRecord?.role ||
      userRecord?.memberships?.[0]?.role?.code ||
      (explicitEmail === 'owner@deegayu.pixelcraftlk.com' ? 'OWNER' : 'STAFF');

    const name =
      userRecord?.full_name ||
      userRecord?.fullName ||
      userRecord?.name ||
      (role === 'OWNER' ? 'Dr. Deegayu (Owner)' : 'Staff User');

    const userEmail =
      userRecord?.email ||
      explicitEmail ||
      'owner@deegayu.pixelcraftlk.com';

    const isOwner = role === 'OWNER' || role === 'ADMIN';

    let assignedBranchIds: string[] = Array.isArray(userRecord?.assigned_branches)
      ? userRecord.assigned_branches
      : Array.isArray(userRecord?.assignedBranches)
      ? userRecord.assignedBranches
      : isOwner
      ? ALL_BRANCH_IDS
      : [];

    let grnBranchIds: string[] = Array.isArray(userRecord?.grn_branches)
      ? userRecord.grn_branches
      : Array.isArray(userRecord?.grnBranches)
      ? userRecord.grnBranches
      : isOwner
      ? ALL_BRANCH_IDS
      : [];

    const lowerEmail = userEmail.toLowerCase();
    const lowerName = name.toLowerCase();

    if (lowerEmail.includes('tharindu') || lowerName.includes('tharindu')) {
      assignedBranchIds = [
        '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
        'fa68e4a0-a515-44c8-a082-5b5590366658',
      ];
      grnBranchIds = ['fa68e4a0-a515-44c8-a082-5b5590366658'];
    } else if (lowerEmail.includes('shashini') || lowerName.includes('shashini')) {
      assignedBranchIds = ['00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'];
      grnBranchIds = ['00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'];
    } else if (lowerEmail.includes('anusha') || lowerName.includes('anusha')) {
      assignedBranchIds = ['fa68e4a0-a515-44c8-a082-5b5590366658'];
      grnBranchIds = [];
    } else if (lowerEmail.includes('kumari') || lowerName.includes('kumari')) {
      assignedBranchIds = ['197693d6-4247-48df-b614-6fcde9e34f7d'];
      grnBranchIds = ['197693d6-4247-48df-b614-6fcde9e34f7d'];
    } else if (lowerEmail.includes('gindika') || lowerName.includes('gindika')) {
      assignedBranchIds = ['197693d6-4247-48df-b614-6fcde9e34f7d'];
      grnBranchIds = [];
    }

    const branchId =
      explicitBranchId ||
      (assignedBranchIds.length > 0 ? assignedBranchIds[0] : null) ||
      userRecord?.branch_id ||
      userRecord?.branchId ||
      userRecord?.memberships?.[0]?.default_branch_id ||
      '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';

    const branchName =
      explicitBranchName ||
      (branchId === '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'
        ? 'Alawwa'
        : branchId === 'fa68e4a0-a515-44c8-a082-5b5590366658'
        ? 'Dambadeniya'
        : branchId === '197693d6-4247-48df-b614-6fcde9e34f7d'
        ? 'Giriulla'
        : 'Main Branch');

    const canCreateGrn = isOwner || grnBranchIds.includes(branchId);

    const sessionObj = {
      id: userRecord?.id || (isOwner ? '96b2747b-9d22-4266-94ce-b035fadef498' : '0f1d46e2-e943-4f24-b69e-f1ba5278a750'),
      name,
      email: userEmail,
      role,
      tenantId,
      tenantSlug: 'deegayu',
      branchId,
      activeBranchId: branchId,
      activeBranchName: branchName,
      isBranchLocked: !isOwner,
      assignedBranchIds,
      grnBranchIds,
      authenticated: true,
    };

    const tenantObj = {
      id: tenantId,
      name: 'Deegayu Weda Madhura',
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
          assignedBranchIds,
          grnBranchIds,
          isActive: true,
        })
      );
      localStorage.setItem('pixelcraft_tenant', JSON.stringify(tenantObj));
      localStorage.setItem('pixelcraft_tenant_id', tenantId);
      localStorage.setItem('pixelcraft_selected_branch', branchId);
      localStorage.setItem('pixelcraft_active_branch_id', branchId);
      localStorage.setItem('pixelcraft_active_branch_name', branchName);
      localStorage.setItem(
        'pixelcraft_permissions',
        JSON.stringify(isOwner ? ['*'] : ['pos:*', 'cashier:*', ...(canCreateGrn ? ['grn:*'] : [])])
      );
      localStorage.setItem(
        'pixelcraft_active_cashier',
        JSON.stringify({
          id: sessionObj.id,
          fullName: sessionObj.name,
          email: sessionObj.email,
          role: sessionObj.role,
          assignedBranchIds,
          grnBranchIds,
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

  const selectBranchAndProceed = (branchId: string, branchName: string) => {
    if (!pendingGateUser) return;
    setLoading(true);

    persistSession(
      pendingGateUser.userRecord,
      pendingGateUser.email,
      branchId,
      branchName
    );
    router.push('/dashboard/pos/');
  };

  const evaluateLoginAndRoute = (userRecord?: any, explicitEmail?: string) => {
    const tenantId =
      userRecord?.tenant_id ||
      userRecord?.tenantId ||
      userRecord?.memberships?.[0]?.tenant_id ||
      userRecord?.memberships?.[0]?.tenantId ||
      '0fef1423-5d89-4147-8af8-17c7e641c88a';

    const role =
      userRecord?.role ||
      userRecord?.memberships?.[0]?.role?.code ||
      (explicitEmail === 'owner@deegayu.pixelcraftlk.com' ? 'OWNER' : 'STAFF');

    const name =
      userRecord?.full_name ||
      userRecord?.fullName ||
      userRecord?.name ||
      (role === 'OWNER' ? 'Dr. Deegayu (Owner)' : 'Staff User');

    const userEmail =
      userRecord?.email ||
      explicitEmail ||
      'owner@deegayu.pixelcraftlk.com';

    const isOwner = role === 'OWNER' || role === 'ADMIN';

    let assignedBranchIds: string[] = Array.isArray(userRecord?.assigned_branches)
      ? userRecord.assigned_branches
      : Array.isArray(userRecord?.assignedBranches)
      ? userRecord.assignedBranches
      : isOwner
      ? ALL_BRANCH_IDS
      : [];

    let grnBranchIds: string[] = Array.isArray(userRecord?.grn_branches)
      ? userRecord.grn_branches
      : Array.isArray(userRecord?.grnBranches)
      ? userRecord.grnBranches
      : isOwner
      ? ALL_BRANCH_IDS
      : [];

    const lowerEmail = userEmail.toLowerCase();
    const lowerName = name.toLowerCase();

    if (lowerEmail.includes('tharindu') || lowerName.includes('tharindu')) {
      assignedBranchIds = [
        '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
        'fa68e4a0-a515-44c8-a082-5b5590366658',
      ];
      grnBranchIds = ['fa68e4a0-a515-44c8-a082-5b5590366658'];
    } else if (lowerEmail.includes('shashini') || lowerName.includes('shashini')) {
      assignedBranchIds = ['00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'];
      grnBranchIds = ['00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'];
    } else if (lowerEmail.includes('anusha') || lowerName.includes('anusha')) {
      assignedBranchIds = ['fa68e4a0-a515-44c8-a082-5b5590366658'];
      grnBranchIds = [];
    } else if (lowerEmail.includes('kumari') || lowerName.includes('kumari')) {
      assignedBranchIds = ['197693d6-4247-48df-b614-6fcde9e34f7d'];
      grnBranchIds = ['197693d6-4247-48df-b614-6fcde9e34f7d'];
    } else if (lowerEmail.includes('gindika') || lowerName.includes('gindika')) {
      assignedBranchIds = ['197693d6-4247-48df-b614-6fcde9e34f7d'];
      grnBranchIds = [];
    }

    // Mandatory Branch Selection Gate for Multi-Branch Staff (Tharindu)
    if (!isOwner && assignedBranchIds.length > 1) {
      setPendingGateUser({
        userRecord,
        email: userEmail,
        name,
        role,
        assignedBranchIds,
        grnBranchIds,
        tenantId,
      });
      return;
    }

    // Single branch staff or Owner: proceed directly to POS
    persistSession(userRecord, userEmail);
    router.push('/dashboard/pos/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (lockoutTimer > 0) {
      setError(`Terminal is temporarily locked due to multiple failed attempts. Please wait ${lockoutTimer}s.`);
      return;
    }

    try {
      if (authMode === 'password') {
        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
          throw new Error('Please enter both email and password.');
        }

        let authUserRecord: any = null;

        // 1. Primary: Authenticate with Supabase Auth GoTrue
        const { data: authData, error: authErr } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

        if (!authErr && authData?.user) {
          // Fetch user profile with RLS active
          try {
            const { data: uData } = await supabase
              .from('users')
              .select('id, full_name, email, role, assigned_branches, grn_branches, is_active')
              .eq('id', authData.user.id)
              .maybeSingle();
            if (uData) authUserRecord = uData;
          } catch {}

          if (!authUserRecord) {
            authUserRecord = {
              id: authData.user.id,
              email: authData.user.email,
              full_name: authData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              role: authData.user.user_metadata?.role || (cleanEmail.includes('owner') ? 'OWNER' : 'STAFF'),
            };
          }
        } else {
          // If GoTrue returned genuine invalid credentials
          if (authErr && authErr.message === 'Invalid login credentials') {
            const nextFailed = failedAttempts + 1;
            setFailedAttempts(nextFailed);
            if (nextFailed >= 5) {
              setLockoutTimer(30);
              throw new Error('Too many failed login attempts. Terminal locked for 30 seconds.');
            }
            throw new Error('Invalid email or password.');
          }

          // Resilient Fallback: Verify via secure PostgreSQL RPC verify_staff_password
          try {
            const { data: rpcUsers, error: rpcErr } = await supabase.rpc('verify_staff_password', {
              p_email: cleanEmail,
              p_password: cleanPassword,
            });

            if (!rpcErr && rpcUsers && rpcUsers.length > 0) {
              authUserRecord = rpcUsers[0];
            }
          } catch {}

          if (!authUserRecord) {
            const nextFailed = failedAttempts + 1;
            setFailedAttempts(nextFailed);
            if (nextFailed >= 5) {
              setLockoutTimer(30);
              throw new Error('Too many failed login attempts. Terminal locked for 30 seconds.');
            }
            if (authErr?.message?.toLowerCase().includes('api key')) {
              throw new Error('Authentication gateway error: Invalid or missing Supabase API key.');
            }
            throw new Error('Invalid email or password.');
          }
        }

        setFailedAttempts(0);
        evaluateLoginAndRoute(authUserRecord, cleanEmail);
        return;
      } else {
        // PIN Auth Mode
        const cleanPin = pin.trim();
        if (!cleanPin || cleanPin.length < 4) {
          throw new Error('Please enter a valid 4-digit PIN.');
        }

        // Call secure PostgreSQL RPC verify_staff_pin (SECURITY DEFINER in DB)
        const { data: rpcUsers, error: rpcErr } = await supabase.rpc('verify_staff_pin', {
          p_pin: cleanPin,
        });

        if (rpcErr || !rpcUsers || rpcUsers.length === 0) {
          const nextFailed = failedAttempts + 1;
          setFailedAttempts(nextFailed);
          if (nextFailed >= 5) {
            setLockoutTimer(30);
            throw new Error('Too many failed PIN attempts. Terminal locked for 30 seconds.');
          }
          throw new Error('Invalid terminal PIN code.');
        }

        setFailedAttempts(0);
        const verifiedUser = rpcUsers[0];

        evaluateLoginAndRoute(verifiedUser, verifiedUser.email);
        return;
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

  const handleFillPreset = (staff: typeof PRESET_STAFF[0]) => {
    setEmail(staff.email);
    setPassword('');
    setPin('');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9] flex flex-col items-center justify-center p-4 selection:bg-[#005BD3] selection:text-white">
      {/* Background radial soft ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-100/60 blur-[100px] rounded-full" />
      </div>

      {pendingGateUser ? (
        <div className="w-full max-w-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#005BD3] text-white shadow-lg shadow-blue-500/25 mb-3 group hover:scale-105 transition-transform">
              <Grid className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              PixelCraft <span className="text-[#005BD3]">POS</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Multi-Branch Cashier Decision Terminal
            </p>
          </div>

          {/* Decision Gate Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.08)] p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#005BD3] border border-blue-200/60 mb-2">
                <Store className="w-3.5 h-3.5" />
                <span>Multi-Branch Authorization Gate</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Select Active Shop / Branch
              </h2>
              <p className="text-sm font-bold text-[#005BD3] mt-0.5">
                ක්‍රියාකාරී ශාඛාව තෝරන්න
              </p>
              <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                Welcome back, <strong className="text-slate-900 font-bold">{pendingGateUser.name}</strong>. You are authorized to operate at 2 branches. Please select the shop you are operating today:
              </p>
            </div>

            {/* 2 Interactive Branch Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {MULTI_BRANCH_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => selectBranchAndProceed(opt.id, opt.name)}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border-2 border-slate-200 hover:border-[#005BD3] bg-slate-50/60 hover:bg-white hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left"
                >
                  <div>
                    {/* Top row: badge & code */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
                        {opt.code}
                      </span>
                      {opt.canGrn ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          GRN Officer
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Billing Cashier
                        </span>
                      )}
                    </div>

                    {/* Branch Title & Sinhala */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                      {opt.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {opt.nameSi}
                    </p>

                    {/* Address */}
                    <div className="mt-3 text-[11px] text-slate-500 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{opt.address}</span>
                    </div>

                    {/* Roles Badge */}
                    <div className="mt-4 pt-3 border-t border-slate-200/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Assigned Authorizations:
                      </div>
                      <div className="text-xs font-semibold text-slate-700 leading-snug">
                        {opt.rolesBadge}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {opt.rolesBadgeSi}
                      </div>
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <div className="mt-5">
                    <button
                      type="button"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-900 group-hover:bg-[#005BD3] text-white shadow-sm transition-all"
                    >
                      <span>Enter {opt.name.replace(' Branch', '')}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Back to Login / Change User */}
            <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPendingGateUser(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-100"
              >
                <span>&larr; Switch User / Re-login</span>
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                Session locked upon selection
              </span>
            </div>
          </div>
        </div>
      ) : (
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

            {lockoutTimer > 0 && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Terminal locked due to excessive failed attempts. Please try again in <strong>{lockoutTimer}s</strong>.
                </span>
              </div>
            )}

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
                    Enter your registered 4-digit terminal PIN code
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || lockoutTimer > 0}
                className="w-full mt-2 py-3 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {lockoutTimer > 0 ? (
                  <span>Terminal Locked ({lockoutTimer}s)</span>
                ) : loading ? (
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

            {/* Quick Staff Team 1-Click Selectors */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Authorized Branch Team
                </span>
                <span className="text-[10px] text-slate-400">
                  Select staff account
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {PRESET_STAFF.map((staff) => (
                  <button
                    key={staff.email}
                    type="button"
                    onClick={() => handleFillPreset(staff)}
                    className="w-full py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 group-hover:border-blue-400">
                        {staff.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors truncate">
                          {staff.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {staff.branchLabel}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                        {staff.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center mt-6 text-xs text-slate-400 font-mono">
            <span>Protected by Row Level Security (RLS) • Multi-Tenant Partition</span>
          </div>
        </div>
      )}
    </div>
  );
}
