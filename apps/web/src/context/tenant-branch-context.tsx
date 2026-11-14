'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
}

interface TenantBranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  business: BusinessProfileData | null;
  branches: BusinessProfileBranch[];
  user: AuthUser | null;
  activeCashier: ActiveCashier | null;
  setActiveCashier: (cashier: ActiveCashier | null) => void;
  tenant: AuthTenant | null;
  permissions: string[];
  currency: string;
  isLoading: boolean;
  isOwnerOrAdmin: boolean;
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
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
        }

        const storedCashier = localStorage.getItem('pixelcraft_active_cashier');
        if (storedCashier) {
          setActiveCashierState(JSON.parse(storedCashier));
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

  const setSelectedBranchId = useCallback((id: string | null) => {
    setSelectedBranchIdState(id);
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('pixelcraft_selected_branch', id);
      } else {
        localStorage.removeItem('pixelcraft_selected_branch');
      }
    }
  }, []);

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

      if (branchList.length === 0) {
        branchList = [
          {
            id: '11111111-2222-3333-4444-555555555555',
            name: 'Main Branch',
            code: 'MAIN-01',
            address: 'Deegayu Weda Madura, Colombo, Sri Lanka',
            phone: '0772634497',
            isPrimary: true,
            isActive: true,
          },
        ];
      }

      setBranches(branchList);
      setSelectedBranchIdState((prev) => {
        if (prev && branchList.some((b) => b.id === prev)) {
          return prev;
        }
        const primary = branchList.find((b) => b.isPrimary) || branchList[0];
        if (primary && typeof window !== 'undefined') {
          localStorage.setItem('pixelcraft_selected_branch', primary.id);
        }
        return primary ? primary.id : null;
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
      let localName = 'Deegayu Weda Madura';
      let localPhone = '0772634497';
      let localAddress = 'Deegayu Weda Madura, Colombo, Sri Lanka';

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
        legalName: bizData?.legal_name || bizData?.legalName || 'Deegayu Weda Madura (Pvt) Ltd',
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

  const isOwnerOrAdmin =
    tenant?.role === 'OWNER' ||
    tenant?.role === 'ADMIN' ||
    user?.role === 'OWNER' ||
    user?.role === 'ADMIN' ||
    permissions.includes('*') ||
    user?.isSuperAdmin === true;

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
        user,
        activeCashier,
        setActiveCashier,
        tenant,
        permissions,
        currency: business?.currency || 'LKR',
        isLoading,
        isOwnerOrAdmin,
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
