'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type {
  AuthTenant,
  AuthUser,
  BusinessProfileBranch,
  BusinessProfileData,
} from '@pixelcraft/types';
import { supabase } from '../lib/supabase';

export interface ActiveCashier {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  assignedBranchIds?: string[];
  grnBranchIds?: string[];
}

interface TenantBranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  business: BusinessProfileData | null;
  branches: BusinessProfileBranch[];
  allowedBranches: BusinessProfileBranch[];
  assignedBranchIds: string[];
  grnBranchIds: string[];
  user: AuthUser | null;
  activeCashier: ActiveCashier | null;
  setActiveCashier: (cashier: ActiveCashier | null) => void;
  tenant: AuthTenant | null;
  permissions: string[];
  currency: string;
  isLoading: boolean;
  isOwnerOrAdmin: boolean;
  isOwner: boolean;
  canCreateGrn: boolean;
  posMode: 'retail' | 'restaurant';
  setPosMode: (mode: 'retail' | 'restaurant') => void;
  orderType: string;
  setOrderType: (type: string) => void;
  refreshProfile: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
}

const TenantBranchContext = createContext<TenantBranchContextType | undefined>(undefined);

export function TenantBranchProvider({ children }: { children: React.ReactNode }) {
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessProfileData | null>(null);
  const [branches, setBranches] = useState<BusinessProfileBranch[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeCashier, setActiveCashierState] = useState<ActiveCashier | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [posMode, setPosMode] = useState<'retail' | 'restaurant'>('retail');
  const [orderType, setOrderType] = useState<string>('Walk-In');

  // Load user session & saved branch selection details from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('pixelcraft_user');
        let isOwnerSession = false;
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          const r = String(parsed?.role || '').toUpperCase();
          const fn = String(parsed?.fullName || '');
          const em = String(parsed?.email || '');
          if (r === 'OWNER' || r === 'ADMIN' || fn.includes('Owner') || em.includes('owner') || parsed?.isSuperAdmin) {
            isOwnerSession = true;
          }
        }

        const storedCashier = localStorage.getItem('pixelcraft_active_cashier');
        if (storedCashier && !isOwnerSession) {
          setActiveCashierState(JSON.parse(storedCashier));
        } else if (isOwnerSession) {
          setActiveCashierState(null);
          localStorage.removeItem('pixelcraft_active_cashier');
        }

        const storedTenant = localStorage.getItem('pixelcraft_tenant');
        if (storedTenant) setTenant(JSON.parse(storedTenant));

        const storedPerms = localStorage.getItem('pixelcraft_permissions');
        if (storedPerms) setPermissions(JSON.parse(storedPerms));

        const storedBranch = localStorage.getItem('pixelcraft_selected_branch');
        if (storedBranch) setSelectedBranchIdState(storedBranch);
      } catch (err) {
        console.error('Failed to parse local authentication cache:', err);
      }
    }
  }, []);

  const setActiveCashier = useCallback((cashier: ActiveCashier | null) => {
    setActiveCashierState(cashier);
    if (typeof window !== 'undefined') {
      if (cashier) {
        localStorage.setItem('pixelcraft_active_cashier', JSON.stringify(cashier));
      } else {
        localStorage.removeItem('pixelcraft_active_cashier');
      }
    }
  }, []);

  const isOwnerRef = useRef(false);

  const setSelectedBranchId = useCallback((id: string | null) => {
    const normalizedId = !id || id === 'ALL' ? null : id;
    // If not owner and already has a selected branch, lock branch switching during active session
    if (!isOwnerRef.current && selectedBranchId && normalizedId && normalizedId !== selectedBranchId) {
      console.warn('Branch switching is locked for staff sessions. Please logout to switch shop.');
      return;
    }
    // If Owner is switching branches, 1-click immediate switch with activeCashier staying null (Owner Direct Mode)
    if (isOwnerRef.current) {
      setActiveCashierState(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pixelcraft_active_cashier');
      }
    }
    setSelectedBranchIdState(normalizedId);
    if (typeof window !== 'undefined') {
      if (normalizedId) {
        localStorage.setItem('pixelcraft_selected_branch', normalizedId);
        localStorage.setItem('pixelcraft_active_branch_id', normalizedId);
        try {
          const sess = localStorage.getItem('pixelcraft_pos_session');
          if (sess) {
            const parsed = JSON.parse(sess);
            parsed.activeBranchId = normalizedId;
            parsed.branchId = normalizedId;
            localStorage.setItem('pixelcraft_pos_session', JSON.stringify(parsed));
          }
        } catch { }
      } else {
        localStorage.removeItem('pixelcraft_selected_branch');
        localStorage.removeItem('pixelcraft_active_branch_id');
      }
    }
  }, [selectedBranchId]);

  const fetchBranches = useCallback(async () => {
    try {
      let branchList: BusinessProfileBranch[] = [];

      try {
        const { data: sbBranches, error: bErr } = await supabase
          .from('branches')
          .select('*')
          .order('name', { ascending: true });

        if (!bErr && sbBranches && sbBranches.length > 0) {
          branchList = sbBranches.map((b: any) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            address: b.address,
            phone: b.phone,
            isPrimary: b.is_primary ?? b.isPrimary ?? false,
            isActive: b.is_active ?? b.isActive ?? true,
          }));
        }
      } catch (sbErr) {
        console.warn('Could not query Supabase branches:', sbErr);
      }

      const OPERATING_BRANCH_IDS = new Set([
        '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54', // Alawwa
        'fa68e4a0-a515-44c8-a082-5b5590366658', // Dambadeniya
        '197693d6-4247-48df-b614-6fcde9e34f7d', // Giriulla
      ]);

      if (branchList.length > 0) {
        // Strictly filter to the 3 operating branches (remove Main Branch / Main store)
        branchList = branchList.filter((b) => {
          if (OPERATING_BRANCH_IDS.has(b.id)) return true;
          const nameLower = (b.name || '').toLowerCase();
          const codeUpper = (b.code || '').toUpperCase();
          if (nameLower.includes('main') || codeUpper.includes('MAIN')) return false;
          return codeUpper.includes('ALW') || codeUpper.includes('DAB') || codeUpper.includes('GIR');
        });
      }

      if (branchList.length === 0) {
        branchList = [
          {
            id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
            name: 'Alawwa',
            code: 'BR-ALW',
            address: 'Deegayu Weda Madhura, Alawwa Road, Alawwa',
            phone: '0372077180',
            isPrimary: true,
            isActive: true,
          },
          {
            id: 'fa68e4a0-a515-44c8-a082-5b5590366658',
            name: 'Dambadeniya',
            code: 'BR-DAB',
            address: 'Deegayu Weda Madhura, Kurunegala Road, Dambadeniya',
            phone: '0372266444',
            isPrimary: false,
            isActive: true,
          },
          {
            id: '197693d6-4247-48df-b614-6fcde9e34f7d',
            name: 'Giriulla',
            code: 'BR-GIR',
            address: 'Deegayu Weda Madhura, Negombo Road, Giriulla',
            phone: '0372289339',
            isPrimary: false,
            isActive: true,
          },
        ];
      }

      setBranches(branchList);
      setSelectedBranchIdState((prev) => {
        if (prev && prev !== 'ALL' && branchList.some((b) => b.id === prev)) {
          return prev;
        }
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('pixelcraft_selected_branch');
          if (stored && stored !== 'ALL' && branchList.some((b) => b.id === stored)) {
            return stored;
          }
        }
        // Default to null ("All Branches") for Owner/General view
        return null;
      });
    } catch (err) {
      console.warn('Could not fetch branches:', err);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check localStorage cached settings first
      let localLogo: string | null = null;
      let localName = 'Deegayu Weda Madhura';
      let localPhone = '0772634497';
      let localAddress = 'Deegayu Weda Madhura, Colombo, Sri Lanka';

      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('pixelcraft_store_settings');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.logoUrl) localLogo = parsed.logoUrl;
            if (parsed.storeName) localName = parsed.storeName;
            if (parsed.phone) localPhone = parsed.phone;
            if (parsed.address) localAddress = parsed.address;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Query Supabase directly
      let bizData: any = null;
      try {
        const { data: sbBiz, error: bizErr } = await supabase
          .from('businesses')
          .select('*, settings:business_settings(*)')
          .eq('slug', 'deegayu')
          .maybeSingle();

        if (!bizErr && sbBiz) {
          bizData = sbBiz;
        }
      } catch (sbErr) {
        console.warn('Could not query Supabase businesses:', sbErr);
      }

      const activeBiz: BusinessProfileData = {
        id: bizData?.id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
        name: bizData?.name || localName,
        slug: 'deegayu',
        legalName: bizData?.legal_name || bizData?.legalName || 'Deegayu Weda Madhura (Pvt) Ltd',
        logoUrl: localLogo || bizData?.logo_url || bizData?.logoUrl || null,
        phone: bizData?.phone || localPhone,
        email: bizData?.email || 'info@deegayu.pixelcraftlk.com',
        address: bizData?.address || localAddress,
        businessType: bizData?.business_type || bizData?.businessType || 'PHARMACY',
        currency: bizData?.currency || 'LKR',
        timezone: bizData?.timezone || 'Asia/Colombo',
        status: bizData?.status || 'ACTIVE',
        branches: [],
      };

      setBusiness(activeBiz);
      await fetchBranches();
    } catch (err) {
      console.warn('Could not fetch tenant business profile:', err);
      await fetchBranches();
    } finally {
      setIsLoading(false);
    }
  }, [fetchBranches]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const effectiveRole = activeCashier?.role || user?.role || tenant?.role || 'STAFF';
  const isOwner =
    effectiveRole === 'OWNER' ||
    effectiveRole === 'ADMIN' ||
    user?.isSuperAdmin === true ||
    permissions.includes('*');

  isOwnerRef.current = isOwner;

  const isOwnerOrAdmin = isOwner;

  const assignedBranchIds: string[] = React.useMemo(() => {
    if (isOwner) {
      return branches.map((b) => b.id);
    }
    const fromCashier = activeCashier?.assignedBranchIds;
    if (Array.isArray(fromCashier) && fromCashier.length > 0) return fromCashier;
    const fromUser = user?.assignedBranchIds;
    if (Array.isArray(fromUser) && fromUser.length > 0) return fromUser;
    if (typeof window !== 'undefined') {
      try {
        const sess = localStorage.getItem('pixelcraft_pos_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (Array.isArray(parsed.assignedBranchIds) && parsed.assignedBranchIds.length > 0) {
            return parsed.assignedBranchIds;
          }
        }
      } catch { }
    }
    return [];
  }, [isOwner, branches, activeCashier?.assignedBranchIds, user?.assignedBranchIds]);

  const grnBranchIds: string[] = React.useMemo(() => {
    if (isOwner) {
      return branches.map((b) => b.id);
    }
    const fromCashier = activeCashier?.grnBranchIds;
    if (Array.isArray(fromCashier)) return fromCashier;
    const fromUser = user?.grnBranchIds;
    if (Array.isArray(fromUser)) return fromUser;
    if (typeof window !== 'undefined') {
      try {
        const sess = localStorage.getItem('pixelcraft_pos_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (Array.isArray(parsed.grnBranchIds)) {
            return parsed.grnBranchIds;
          }
        }
      } catch { }
    }
    return [];
  }, [isOwner, branches, activeCashier?.grnBranchIds, user?.grnBranchIds]);

  const allowedBranches: BusinessProfileBranch[] = React.useMemo(() => {
    if (isOwner) return branches;

    // Check if staff has an approved cross-branch override for this session
    let approvedCrossBranchId: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        approvedCrossBranchId = localStorage.getItem('pixelcraft_approved_cross_branch_id');
      } catch {}
    }

    if (assignedBranchIds.length === 0 && !approvedCrossBranchId) return branches;

    return branches.filter(
      (b) => assignedBranchIds.includes(b.id) || (approvedCrossBranchId && b.id === approvedCrossBranchId)
    );
  }, [isOwner, branches, assignedBranchIds]);

  // Guard selectedBranchId against out-of-scope branch selection for staff
  useEffect(() => {
    if (!isLoading && branches.length > 0 && !isOwner) {
      if (allowedBranches.length > 0) {
        if (!selectedBranchId || !allowedBranches.some((b) => b.id === selectedBranchId)) {
          const fallback = allowedBranches[0]?.id || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';
          setSelectedBranchIdState(fallback);
          if (fallback && typeof window !== 'undefined') {
            localStorage.setItem('pixelcraft_selected_branch', fallback);
            localStorage.setItem('pixelcraft_active_branch_id', fallback);
          }
        }
      }
    }
  }, [isOwner, isLoading, branches.length, allowedBranches, selectedBranchId]);

  const canCreateGrn = React.useMemo(() => {
    if (isOwner) return true;
    if (!selectedBranchId) return false;
    return grnBranchIds.includes(selectedBranchId);
  }, [isOwner, selectedBranchId, grnBranchIds]);

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (isOwnerOrAdmin) return true;
      if (permissions.includes('*')) return true;
      return permissions.includes(code);
    },
    [isOwnerOrAdmin, permissions],
  );

  return (
    <TenantBranchContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId,
        business,
        branches,
        allowedBranches,
        assignedBranchIds,
        grnBranchIds,
        user,
        activeCashier,
        setActiveCashier,
        tenant,
        permissions,
        currency: business?.currency || 'LKR',
        isLoading,
        isOwnerOrAdmin,
        isOwner,
        canCreateGrn,
        posMode,
        setPosMode,
        orderType,
        setOrderType,
        refreshProfile: fetchProfile,
        refreshBranches: fetchBranches,
        hasPermission,
      }}
    >
      {children}
    </TenantBranchContext.Provider>
  );
}

export function useTenantBranch() {
  const context = useContext(TenantBranchContext);
  if (!context) {
    throw new Error('useTenantBranch must be used within a TenantBranchProvider');
  }
  return context;
}
