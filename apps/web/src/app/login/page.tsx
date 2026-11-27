'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
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
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { branchAccessApi, type BranchAccessRequestDto } from '@/lib/api-client';

const ALL_BRANCH_IDS = [
  '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
  '133eeaec-5726-4702-a819-8423750db203',
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
  'fa68e4a0-a515-44c8-a082-5b5590366658',
  '197693d6-4247-48df-b614-6fcde9e34f7d',
];

interface OperatingBranchConfig {
  id: string;
  name: string;
  fullName: string;
  code: string;
  address: string;
  phone: string;
  colorScheme: string;
  badgeClass: string;
}

const OPERATING_BRANCHES: OperatingBranchConfig[] = [
  {
    id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
    name: 'Alawwa',
    fullName: 'Alawwa Branch',
    code: 'ALW-01',
    address: 'Deegayu Weda Madhura, Alawwa Road, Alawwa',
    phone: '037-2241088',
    colorScheme: 'from-blue-600 to-indigo-700',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'fa68e4a0-a515-44c8-a082-5b5590366658',
    name: 'Dambadeniya',
    fullName: 'Dambadeniya Branch',
    code: 'DMB-01',
    address: 'Deegayu Weda Madhura, Kurunegala Road, Dambadeniya',
    phone: '037-2287411',
    colorScheme: 'from-emerald-600 to-teal-700',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: '197693d6-4247-48df-b614-6fcde9e34f7d',
    name: 'Giriulla',
    fullName: 'Giriulla Branch',
    code: 'GIR-01',
    address: 'Deegayu Weda Madhura, Negombo Road, Giriulla',
    phone: '037-2289339',
    colorScheme: 'from-purple-600 to-violet-700',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
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

export default function LoginPage() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingGateUser, setPendingGateUser] = useState<PendingGateUser | null>(null);
  const [selectedTargetBranch, setSelectedTargetBranch] = useState<OperatingBranchConfig | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);

  // Approval Waiting Screen States
  const [waitingRequest, setWaitingRequest] = useState<BranchAccessRequestDto | null>(null);
  const [waitingState, setWaitingState] = useState<'IDLE' | 'WAITING' | 'APPROVED' | 'REJECTED'>('IDLE');
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [ownerPinError, setOwnerPinError] = useState<string | null>(null);
  const [isAuthorizingPin, setIsAuthorizingPin] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
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

  // Real-Time and Polling Synchronization for Owner Approval
  useEffect(() => {
    if (waitingState !== 'WAITING' || !waitingRequest || !selectedTargetBranch || !pendingGateUser) {
      return;
    }

    let isMounted = true;

    const proceedWithApproval = () => {
      if (!isMounted) return;
      setWaitingState('APPROVED');
      if (typeof window !== 'undefined') {
        localStorage.setItem('pixelcraft_approved_cross_branch_id', selectedTargetBranch.id);
      }
      persistSession(
        pendingGateUser.userRecord,
        pendingGateUser.email,
        selectedTargetBranch.id,
        selectedTargetBranch.name
      );
      setTimeout(() => {
        router.push('/dashboard/pos/');
      }, 1000);
    };

    const handleRejection = () => {
      if (!isMounted) return;
      setWaitingState('REJECTED');
    };

    // 1. Supabase Realtime channel subscription
    const channel = supabase
      .channel(`branch-req-${waitingRequest.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'branch_access_requests',
          filter: `id=eq.${waitingRequest.id}`,
        },
        (payload: any) => {
          if (!isMounted) return;
          const newStatus = payload.new?.status;
          if (newStatus === 'APPROVED') {
            proceedWithApproval();
          } else if (newStatus === 'REJECTED') {
            handleRejection();
          }
        }
      )
      .subscribe();

    // 2. High-reliability fallback polling every 3 seconds
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const { data } = await supabase
          .from('branch_access_requests')
          .select('status')
          .eq('id', waitingRequest.id)
          .maybeSingle();

        if (data?.status === 'APPROVED') {
          proceedWithApproval();
        } else if (data?.status === 'REJECTED') {
          handleRejection();
        }
      } catch {}
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [waitingState, waitingRequest, selectedTargetBranch, pendingGateUser, router]);

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
        'fa68e4a0-a515-44c8-a082-5b5590366658',
        '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
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
      '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';

    const branchName =
      explicitBranchName ||
      (branchId === '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'
        ? 'Alawwa'
        : branchId === 'fa68e4a0-a515-44c8-a082-5b5590366658'
        ? 'Dambadeniya'
        : branchId === '197693d6-4247-48df-b614-6fcde9e34f7d'
        ? 'Giriulla'
        : 'Alawwa');

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
        'fa68e4a0-a515-44c8-a082-5b5590366658',
        '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
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

    // Owner Account: Direct access without branch lock
    if (isOwner) {
      persistSession(userRecord, userEmail);
      router.push('/dashboard/');
      return;
    }

    // Branch Staff: Always present the operating branch selector
    setPendingGateUser({
      userRecord,
      email: userEmail,
      name,
      role,
      assignedBranchIds,
      grnBranchIds,
      tenantId,
    });
  };

  const handleBranchSelect = async (targetBranch: OperatingBranchConfig) => {
    if (!pendingGateUser) return;
    const isAssigned = pendingGateUser.assignedBranchIds.includes(targetBranch.id);

    // If cashier is assigned to this branch, grant immediate access!
    if (isAssigned) {
      setLoading(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pixelcraft_approved_cross_branch_id');
      }
      persistSession(
        pendingGateUser.userRecord,
        pendingGateUser.email,
        targetBranch.id,
        targetBranch.name
      );
      router.push('/dashboard/pos/');
      return;
    }

    // Unassigned branch: check existing approval or request new authorization
    setCheckingApproval(true);
    setSelectedTargetBranch(targetBranch);
    setError(null);
    setOwnerPinError(null);
    setOwnerPinInput('');

    try {
      const staffUserId =
        pendingGateUser.userRecord?.id || '0f1d46e2-e943-4f24-b69e-f1ba5278a750';

      // 1. Check if an active APPROVED request already exists for today
      const existingApproval = await branchAccessApi.getActiveApproval(
        staffUserId,
        targetBranch.id
      );

      if (existingApproval) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pixelcraft_approved_cross_branch_id', targetBranch.id);
        }
        persistSession(
          pendingGateUser.userRecord,
          pendingGateUser.email,
          targetBranch.id,
          targetBranch.name
        );
        router.push('/dashboard/pos/');
        return;
      }

      // 2. Otherwise create/fetch PENDING request
      const primaryAssignedId =
        pendingGateUser.assignedBranchIds[0] || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';

      const request = await branchAccessApi.createRequest({
        staffUserId,
        staffName: pendingGateUser.name,
        staffEmail: pendingGateUser.email,
        assignedBranchId: primaryAssignedId,
        requestedBranchId: targetBranch.id,
      });

      setWaitingRequest(request);
      setWaitingState('WAITING');
    } catch (err: any) {
      setError(err?.message || 'Failed to request cross-branch access.');
    } finally {
      setCheckingApproval(false);
    }
  };

  const handleMasterPinAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitingRequest || !selectedTargetBranch || !pendingGateUser) return;

    const cleanPin = ownerPinInput.trim();
    if (!cleanPin) {
      setOwnerPinError('Please enter the Owner Master PIN.');
      return;
    }

    setIsAuthorizingPin(true);
    setOwnerPinError(null);

    try {
      const isValid = await branchAccessApi.verifyOwnerPin(cleanPin);
      if (!isValid) {
        setOwnerPinError('Incorrect Owner Master PIN. Please check the code or wait for dashboard approval.');
        setIsAuthorizingPin(false);
        return;
      }

      // Approve request via MASTER_PIN
      await branchAccessApi.approveRequest(
        waitingRequest.id,
        'Owner Master PIN',
        'MASTER_PIN'
      );

      setWaitingState('APPROVED');
      if (typeof window !== 'undefined') {
        localStorage.setItem('pixelcraft_approved_cross_branch_id', selectedTargetBranch.id);
      }
      persistSession(
        pendingGateUser.userRecord,
        pendingGateUser.email,
        selectedTargetBranch.id,
        selectedTargetBranch.name
      );
      setTimeout(() => {
        router.push('/dashboard/pos/');
      }, 900);
    } catch (err: any) {
      setOwnerPinError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsAuthorizingPin(false);
    }
  };

  const handleCancelAndSignInToAssigned = () => {
    if (!pendingGateUser) return;
    const primaryAssignedId =
      pendingGateUser.assignedBranchIds[0] || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';
    const assignedBranch =
      OPERATING_BRANCHES.find((b) => b.id === primaryAssignedId) || OPERATING_BRANCHES[0]!;
    if (!assignedBranch) return;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('pixelcraft_approved_cross_branch_id');
    }
    persistSession(
      pendingGateUser.userRecord,
      pendingGateUser.email,
      assignedBranch.id,
      assignedBranch.name
    );
    router.push('/dashboard/pos/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (lockoutTimer > 0) {
      setError(`Terminal is temporarily locked due to multiple failed attempts. Please wait ${lockoutTimer}s.`);
      setLoading(false);
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

        // 1. Primary: Authenticate with Auth GoTrue
        const { data: authData, error: authErr } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

        if (!authErr && authData?.user) {
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
          // If GoTrue returned invalid credentials
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
              throw new Error('Authentication gateway error: Invalid or missing API key.');
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

  const assignedBranchNames = pendingGateUser
    ? pendingGateUser.assignedBranchIds
        .map((id) => OPERATING_BRANCHES.find((b) => b.id === id)?.name)
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 px-4 py-8 selection:bg-indigo-600 selection:text-white">
      {/* Background ambient decorative glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[380px] bg-indigo-100/50 blur-[110px] rounded-full" />
      </div>

      {/* VIEW 1: WAITING FOR OWNER APPROVAL SCREEN */}
      {waitingState !== 'IDLE' && waitingRequest && selectedTargetBranch && pendingGateUser ? (
        <div className="w-full max-w-xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl shadow-md border border-slate-200/80 bg-white p-1.5 flex items-center justify-center overflow-hidden">
                <img
                  src="/deegayu-dp.png"
                  alt="Deegayu Weda Madhura"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Deegayu Weda Madhura
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Cross-Branch Cashier Authorization Gate
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/70 p-6 sm:p-8">
            {waitingState === 'APPROVED' ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Access Approved by Owner!
                </h2>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Authorization granted for <strong className="text-slate-900">{selectedTargetBranch.name}</strong> today. Opening your POS terminal...
                </p>
                <div className="flex justify-center pt-2">
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                </div>
              </div>
            ) : waitingState === 'REJECTED' ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-9 h-9" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Access Request Declined
                </h2>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  The Owner has declined cross-branch access for {selectedTargetBranch.name}. You may operate at your permanently assigned shop ({assignedBranchNames || 'Alawwa'}).
                </p>
                <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    onClick={handleCancelAndSignInToAssigned}
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    Enter Assigned Branch Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingState('IDLE');
                      setWaitingRequest(null);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Select Another Shop
                  </button>
                </div>
              </div>
            ) : (
              /* WAITING STATE */
              <div className="space-y-6">
                {/* Header status */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Owner Approval Required</span>
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                    Awaiting Dr. Deegayu's Approval
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Live approval request sent to the Owner Dashboard for today's shift at <strong className="text-slate-900">{selectedTargetBranch.name}</strong>.
                  </p>
                </div>

                {/* Request Details Card */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Cashier:</span>
                    <strong className="text-slate-900 font-semibold">{pendingGateUser.name}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Staff Email:</span>
                    <span className="text-slate-700 font-mono text-[11px]">{pendingGateUser.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Permanent Shop:</span>
                    <span className="font-semibold text-slate-700">{assignedBranchNames || 'Alawwa'}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Requested Shop:</span>
                    <strong className="font-bold text-indigo-700">{selectedTargetBranch.name} ({selectedTargetBranch.code})</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/70">
                    <span>Request Status:</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-800">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                      Pending Owner Approval
                    </span>
                  </div>
                </div>

                {/* Dual Option: Instant Master PIN Authorization */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-indigo-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Instant Approval with Owner Master PIN
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        If Dr. Deegayu is present or provides the authorization PIN via phone:
                      </p>
                    </div>
                  </div>

                  {ownerPinError && (
                    <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{ownerPinError}</span>
                    </div>
                  )}

                  <form onSubmit={handleMasterPinAuthorize} className="flex gap-2 mt-3">
                    <input
                      type="password"
                      maxLength={8}
                      value={ownerPinInput}
                      onChange={(e) => setOwnerPinInput(e.target.value)}
                      placeholder="Enter Owner PIN"
                      className="flex-1 px-3 py-2 text-center text-sm font-bold tracking-widest bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                    <button
                      type="submit"
                      disabled={isAuthorizingPin || !ownerPinInput.trim()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isAuthorizingPin ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <span>Authorize</span>
                      )}
                    </button>
                  </form>
                </div>

                {/* Cancel and return options */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={handleCancelAndSignInToAssigned}
                    className="w-full sm:w-auto font-bold text-indigo-600 hover:text-indigo-800 transition-colors py-2 px-3 rounded-lg hover:bg-indigo-50 cursor-pointer text-center"
                  >
                    Cancel & Sign In to {assignedBranchNames || 'Assigned Branch'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingState('IDLE');
                      setWaitingRequest(null);
                    }}
                    className="w-full sm:w-auto font-semibold text-slate-400 hover:text-slate-600 transition-colors py-2 px-3 rounded-lg hover:bg-slate-100 cursor-pointer text-center"
                  >
                    Back to Shop Selector
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : pendingGateUser ? (
        /* VIEW 2: 3-BRANCH OPERATING SELECTOR SCREEN */
        <div className="w-full max-w-3xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-2xl shadow-md border border-slate-200/80 bg-white p-1.5 flex items-center justify-center overflow-hidden">
                <img
                  src="/deegayu-dp.png"
                  alt="Deegayu Weda Madhura"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Deegayu Weda Madhura
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Terminal Operating Branch Selection Gate
            </p>
          </div>

          {/* Decision Gate Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/70 p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-2">
                <Store className="w-3.5 h-3.5" />
                <span>Operating Branch Selector</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Select Operating Shop for Today
              </h2>
              <p className="text-xs text-slate-600 mt-2 max-w-lg mx-auto leading-relaxed">
                Welcome, <strong className="text-slate-900 font-bold">{pendingGateUser.name}</strong>. Please select the shop you are operating today. Unassigned shops require Owner approval before opening shift.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* 3 OPERATING BRANCHES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {OPERATING_BRANCHES.map((b) => {
                const isAssigned = pendingGateUser.assignedBranchIds.includes(b.id);
                const isTargeting = checkingApproval && selectedTargetBranch?.id === b.id;

                return (
                  <div
                    key={b.id}
                    onClick={() => !checkingApproval && handleBranchSelect(b)}
                    className={`group relative flex flex-col justify-between p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer text-left ${
                      isAssigned
                        ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-600 hover:bg-emerald-50/40 hover:shadow-lg'
                        : 'border-slate-200 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/30 hover:shadow-lg'
                    }`}
                  >
                    <div>
                      {/* Top Row: Code & Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
                          {b.code}
                        </span>
                        {isAssigned ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                            <Check className="w-3 h-3 text-emerald-700" />
                            Assigned Branch
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <Lock className="w-3 h-3 text-amber-700" />
                            Owner Approval
                          </span>
                        )}
                      </div>

                      {/* Branch Title */}
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {b.fullName}
                      </h3>

                      {/* Address */}
                      <div className="mt-2 text-[11px] text-slate-500 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{b.address}</span>
                      </div>

                      {/* Phone */}
                      <div className="mt-1 text-[11px] text-slate-400 font-mono pl-5">
                        {b.phone}
                      </div>

                      {/* Access Status Summary */}
                      <div className="mt-4 pt-3 border-t border-slate-200/70">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Access Authorization:
                        </div>
                        <div className="text-xs font-semibold">
                          {isAssigned ? (
                            <span className="text-emerald-700">Direct Terminal Access</span>
                          ) : (
                            <span className="text-amber-700">Dual Approval (Dashboard / PIN)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action CTA Button */}
                    <div className="mt-5">
                      <button
                        type="button"
                        disabled={checkingApproval}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                          isAssigned
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            : 'bg-slate-900 hover:bg-amber-600 text-white'
                        }`}
                      >
                        {isTargeting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking...</span>
                          </>
                        ) : isAssigned ? (
                          <>
                            <span>Open {b.name} Terminal</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Request {b.name}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Back to Login / Change User */}
            <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPendingGateUser(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-100"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Switch User / Re-login</span>
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                Permanent Branch: {assignedBranchNames || 'Alawwa'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 3: STANDARD LOGIN CREDENTIALS FORM */
        <div className="w-full max-w-md relative z-10">
          {/* Brand Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-2xl shadow-md border border-slate-200/80 bg-white p-1.5 flex items-center justify-center overflow-hidden">
                <img
                  src="/deegayu-dp.png"
                  alt="Deegayu Weda Madhura"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Deegayu Weda Madhura
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Ayurvedic Pharmacy & Retail Management System
            </p>
          </div>

          {/* Main Login Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/70 p-7 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Terminal Sign In</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorized Staff & Admin Access
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                <Store className="w-3.5 h-3.5" />
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
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                        autoComplete="off"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your staff email"
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all font-medium"
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
                        autoComplete="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
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
                      autoComplete="off"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••"
                      className="w-full pl-10 pr-4 py-3 text-center tracking-widest text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
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
                className="w-full mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
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
          </div>

          {/* Clean Corporate Footer Notice */}
          <div className="text-center mt-6 text-xs text-slate-500 font-medium">
            <span>© 2026 Deegayu Weda Madhura • Authorized Staff Portal</span>
          </div>
        </div>
      )}
    </div>
  );
}
