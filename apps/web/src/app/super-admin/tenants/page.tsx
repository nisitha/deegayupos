'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Search,
  CheckCircle2,
  AlertOctagon,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react';
import { superAdminApi } from '@/lib/api-client';
import type { TenantStatus, TenantSummary } from '@pixelcraft/types';

const STATUS_FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: 'All Organizations', value: undefined },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Trial', value: 'TRIAL' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Expired', value: 'EXPIRED' },
];

export default function TenantsManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [inspectTenantId, setInspectTenantId] = useState<string | null>(null);
  const [statusActionTarget, setStatusActionTarget] = useState<TenantSummary | null>(null);
  const [statusReason, setStatusReason] = useState('');

  // Fetch tenants
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['super-admin-tenants', page, search, selectedStatus],
    queryFn: async () => {
      try {
        const res = await superAdminApi.getTenants({
          page,
          limit: 10,
          search: search || undefined,
          status: selectedStatus,
        });
        return res.data;
      } catch {
        // Fallback demo data
        const fallbackItems: TenantSummary[] = [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'PixelCraft LK Flagship Store',
            slug: 'alpha',
            legalName: 'PixelCraft LK Retail Pvt Ltd',
            businessType: 'RETAIL',
            status: 'ACTIVE',
            currency: 'LKR',
            timezone: 'Asia/Colombo',
            createdAt: '2026-01-15T00:00:00Z',
            userCount: 3,
            branchCount: 1,
            registerCount: 1,
            plan: { code: 'PROFESSIONAL', name: 'Professional Plan', monthlyPrice: 79 },
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            name: 'Colombo Bistro & Cafe',
            slug: 'beta',
            legalName: 'Colombo Bistro Cafe Ltd',
            businessType: 'RESTAURANT',
            status: 'ACTIVE',
            currency: 'LKR',
            timezone: 'Asia/Colombo',
            createdAt: '2026-02-10T00:00:00Z',
            userCount: 2,
            branchCount: 1,
            registerCount: 1,
            plan: { code: 'STARTER', name: 'Starter Plan', monthlyPrice: 29 },
          },
        ];

        return {
          items: fallbackItems.filter((i) => {
            if (selectedStatus && i.status !== selectedStatus) return false;
            if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.slug.toLowerCase().includes(search.toLowerCase()))
              return false;
            return true;
          }),
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        };
      }
    },
  });

  // Fetch inspected tenant details
  const { data: inspectedDetail, isLoading: isInspectingLoading } = useQuery({
    queryKey: ['super-admin-tenant-detail', inspectTenantId],
    queryFn: async () => {
      if (!inspectTenantId) return null;
      try {
        const res = await superAdminApi.getTenantDetail(inspectTenantId);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!inspectTenantId,
  });

  // Mutation to update tenant status
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
      reason,
    }: {
      id: string;
      newStatus: TenantStatus;
      reason?: string;
    }) => {
      return superAdminApi.updateTenantStatus(id, {
        status: newStatus,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] });
      setStatusActionTarget(null);
      setStatusReason('');
    },
  });

  const handleToggleStatus = (tenant: TenantSummary) => {
    setStatusActionTarget(tenant);
    setStatusReason('');
  };

  const confirmStatusChange = () => {
    if (!statusActionTarget) return;
    const nextStatus: TenantStatus =
      statusActionTarget.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    updateStatusMutation.mutate({
      id: statusActionTarget.id,
      newStatus: nextStatus,
      reason: statusReason || undefined,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            Tenant Organizations
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
              Multi-Tenant Registry
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Global lifecycle control, isolation oversight, and administrative suspension.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-mono transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-cyan-400' : ''}`}
          />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by business name, slug, or legal name..."
            className="w-full bg-[#0B0E17]/80 border border-zinc-800 text-xs rounded-lg pl-9 pr-4 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map((filter) => {
            const isSelected = selectedStatus === filter.value;
            return (
              <button
                key={filter.label}
                onClick={() => {
                  setSelectedStatus(filter.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60'
                    : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-xl bg-[#0B0E17]/80 border border-zinc-800/80 overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800/60">
              <tr>
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Type</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Subscribed Plan</th>
                <th className="py-3.5 px-5">Scale</th>
                <th className="py-3.5 px-5">Enrolled</th>
                <th className="py-3.5 px-5 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading tenant directory...</span>
                    </div>
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="py-4 px-5">
                      <div className="font-sans font-medium text-white text-sm">
                        {tenant.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-cyan-400 text-xs font-mono">
                          @{tenant.slug}
                        </span>
                        {tenant.legalName && (
                          <span className="text-zinc-500 font-sans text-[11px] truncate max-w-[200px]">
                            • {tenant.legalName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                        {tenant.businessType}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                          tenant.status === 'ACTIVE'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                            : tenant.status === 'SUSPENDED'
                            ? 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                            : 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            tenant.status === 'ACTIVE'
                              ? 'bg-emerald-400'
                              : tenant.status === 'SUSPENDED'
                              ? 'bg-rose-400'
                              : 'bg-amber-400'
                          }`}
                        />
                        {tenant.status}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-zinc-200">
                        {tenant.plan?.name || 'No Plan'}
                      </div>
                      {tenant.plan && (
                        <div className="text-[11px] text-zinc-500">
                          ${tenant.plan.monthlyPrice}/mo
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-zinc-300">
                      <div>{tenant.branchCount} Branch(es)</div>
                      <div className="text-[11px] text-zinc-500">
                        {tenant.registerCount} Terminals • {tenant.userCount} Users
                      </div>
                    </td>
                    <td className="py-4 px-5 text-zinc-400 text-[11px]">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Inspect Details Button */}
                        <button
                          onClick={() => setInspectTenantId(tenant.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors"
                          title="Inspect Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Inspect</span>
                        </button>

                        {/* Suspend / Activate Toggle */}
                        <button
                          onClick={() => handleToggleStatus(tenant)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                            tenant.status === 'SUSPENDED'
                              ? 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50'
                              : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50'
                          }`}
                        >
                          {tenant.status === 'SUSPENDED' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Reactivate</span>
                            </>
                          ) : (
                            <>
                              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                              <span>Suspend</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No tenant organizations match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Tenant Modal */}
      {inspectTenantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-[#0B0E17] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {inspectedDetail?.name || 'Tenant Organization Inspection'}
                  </h3>
                  <p className="text-xs font-mono text-zinc-400">
                    UUID: {inspectTenantId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectTenantId(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
              {isInspectingLoading ? (
                <div className="py-12 text-center text-zinc-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                  <span>Loading deep tenant profile...</span>
                </div>
              ) : inspectedDetail ? (
                <>
                  {/* Grid Specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase">Status</span>
                      <div className="text-sm font-semibold text-white mt-1">
                        {inspectedDetail.status}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase">Slug</span>
                      <div className="text-sm font-semibold text-cyan-400 mt-1">
                        @{inspectedDetail.slug}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase">Currency</span>
                      <div className="text-sm font-semibold text-white mt-1">
                        {inspectedDetail.currency} ({inspectedDetail.timezone})
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase">Active Plan</span>
                      <div className="text-sm font-semibold text-emerald-400 mt-1">
                        {inspectedDetail.subscription?.plan.code || 'None'}
                      </div>
                    </div>
                  </div>

                  {/* Branches & Registers */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                      Branches ({inspectedDetail.branches.length})
                    </h4>
                    <div className="space-y-2">
                      {inspectedDetail.branches.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-white">{b.name}</span>
                            <span className="text-zinc-500 ml-2">[{b.code}]</span>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {b.address || 'No physical address'}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[10px]">
                            {b.registerCount} Register(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Staff Memberships */}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-2">
                      Staff Memberships ({inspectedDetail.memberships.length})
                    </h4>
                    <div className="space-y-1.5">
                      {inspectedDetail.memberships.map((m) => (
                        <div
                          key={m.id}
                          className="px-3 py-2 rounded bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white">{m.fullName}</span>
                            <span className="text-zinc-500">({m.email})</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-[10px]">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-zinc-500">
                  Failed to load details for this tenant organization.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                onClick={() => setInspectTenantId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-white transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend / Reactivate Confirmation Dialog */}
      {statusActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0B0E17] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl p-6">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <AlertOctagon className="w-6 h-6" />
              <h3 className="text-base font-semibold text-white">
                {statusActionTarget.status === 'SUSPENDED'
                  ? 'Reactivate Tenant Organization?'
                  : 'Confirm Tenant Suspension'}
              </h3>
            </div>

            <p className="text-xs text-zinc-300 font-sans leading-relaxed mb-4">
              {statusActionTarget.status === 'SUSPENDED'
                ? `Reactivating "${statusActionTarget.name}" (@${statusActionTarget.slug}) will immediately restore API access, POS terminal checkout, and tenant staff logins.`
                : `Suspending "${statusActionTarget.name}" (@${statusActionTarget.slug}) will immediately lock out all staff members and POS registers with 403 Forbidden.`}
            </p>

            <div className="space-y-2 mb-5">
              <label className="text-[11px] font-mono text-zinc-400 uppercase">
                Administrative Reason (Recorded in Immutable Audit Log):
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Delinquent invoice payment, terms violation, or customer request..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setStatusActionTarget(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-300 border border-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updateStatusMutation.isPending}
                className={`px-4 py-1.5 rounded-lg text-xs font-mono font-medium text-white transition-all ${
                  statusActionTarget.status === 'SUSPENDED'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {updateStatusMutation.isPending
                  ? 'Executing...'
                  : statusActionTarget.status === 'SUSPENDED'
                  ? 'Confirm Reactivation'
                  : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
