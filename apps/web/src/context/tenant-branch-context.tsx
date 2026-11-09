'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  AuthTenant,
  AuthUser,
  BusinessProfileBranch,
  BusinessProfileData,
} from '@pixelcraft/types';
import { businessApi } from '../lib/api-client';

interface TenantBranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  business: BusinessProfileData | null;
  branches: BusinessProfileBranch[];
  user: AuthUser | null;
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
        if (storedUser) setUser(JSON.parse(storedUser));

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
      const res = await fetch('/api/branches?slug=deegayu');
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setBranches(json.data);
        // If no selected branch, pick the primary or first one
        setSelectedBranchIdState((prev) => {
          if (prev && json.data.some((b: BusinessProfileBranch) => b.id === prev)) {
            return prev;
          }
          const primary = json.data.find((b: BusinessProfileBranch) => b.isPrimary) || json.data[0];
          if (primary && typeof window !== 'undefined') {
            localStorage.setItem('pixelcraft_selected_branch', primary.id);
          }
          return primary ? primary.id : null;
        });
      }
    } catch (err) {
      console.warn('Could not fetch branches from API:', err);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await businessApi.getProfile();
      if (res.data) {
        setBusiness(res.data);
        if (res.data.branches && res.data.branches.length > 0) {
          setBranches(res.data.branches);
        }
      }
      await fetchBranches();
    } catch (err) {
      console.warn('Could not fetch tenant business profile:', err);
      // Fallback to fetch branches directly
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
