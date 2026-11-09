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
  hasPermission: (permissionCode: string) => boolean;
}

const TenantBranchContext = createContext<TenantBranchContextType | undefined>(undefined);

export function TenantBranchProvider({ children }: { children: React.ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessProfileData | null>(null);
  const [branches, setBranches] = useState<BusinessProfileBranch[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [posMode, setPosMode] = useState<'retail' | 'restaurant'>('restaurant');
  const [orderType, setOrderType] = useState<string>('Dine-In');

  // Load user session details from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('pixelcraft_user');
        if (storedUser) setUser(JSON.parse(storedUser));

        const storedTenant = localStorage.getItem('pixelcraft_tenant');
        if (storedTenant) setTenant(JSON.parse(storedTenant));

        const storedPerms = localStorage.getItem('pixelcraft_permissions');
        if (storedPerms) setPermissions(JSON.parse(storedPerms));
      } catch (err) {
        console.error('Failed to parse local authentication cache:', err);
      }
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await businessApi.getProfile();
      if (res.data) {
        setBusiness(res.data);
        setBranches(res.data.branches || []);
        // If user is restricted to a branch, default to their primary branch
        if (res.data.primaryBranch && !selectedBranchId) {
          // If the user's role is not owner/admin and has assigned branch, auto-select it
        }
      }
    } catch (err) {
      console.warn('Could not fetch tenant business profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

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

