'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  ShieldCheck,
  Eye,
  Trash2,
  Printer,
  X,
  Check,
  Loader2,
  FileText,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import {
  transfersApi,
  ACTIVE_BRANCHES,
  matchesCatalogSearch,
  type StockTransfer,
  type CrossBranchProductItem,
  type CreateTransferItemPayload,
  type TransferPriority,
} from '../../../lib/transfers-api';
import {
  MotionPageShell,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '../../../components/ui/motion-primitives';

function getBranchChipClass(nameOrId?: string) {
  const str = (nameOrId || '').toLowerCase();
  if (str.includes('alawwa') || str === '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54') {
    return 'bg-blue-50 text-blue-700 border border-blue-200/80 font-bold';
  }
  if (str.includes('dambadeniya') || str === 'fa68e4a0-a515-44c8-a082-5b5590366658') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold';
  }
  if (str.includes('giriulla') || str === '197693d6-4247-48df-b614-6fcde9e34f7d') {
    return 'bg-amber-50 text-amber-700 border border-amber-200/80 font-bold';
  }
  return 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold';
}

type MainTabType = 'INCOMING' | 'MY_REQUESTS' | 'ALL';

export default function StockTransfersPage() {
  const { user, isOwner, activeCashier, assignedBranchIds, selectedBranchId } = useTenantBranch();

  // Current active staff / owner name
  const currentUserName =
    activeCashier?.fullName || user?.fullName || (isOwner ? 'Dr. Deegayu (Owner)' : 'Staff Cashier');
  const currentUserId = activeCashier?.id || user?.id || '';

  // Determine user's active branch
  const myBranchId = useMemo(() => {
    if (selectedBranchId && ACTIVE_BRANCHES.some((b) => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    if (assignedBranchIds && assignedBranchIds.length > 0) {
      const match = ACTIVE_BRANCHES.find((b) => assignedBranchIds.includes(b.id));
      if (match) return match.id;
    }
    return ACTIVE_BRANCHES[0]?.id || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';
  }, [selectedBranchId, assignedBranchIds]);

  const myBranchName = useMemo(() => {
    return ACTIVE_BRANCHES.find((b) => b.id === myBranchId)?.name || 'My Branch';
  }, [myBranchId]);

  // Data state
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<MainTabType>('INCOMING');
  const [hasInitializedTab, setHasInitializedTab] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');

  // Request Stock Modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [sourceBranchId, setSourceBranchId] = useState<string>(() => {
    const alt = ACTIVE_BRANCHES.find((b) => b.id !== myBranchId);
    return alt?.id || ACTIVE_BRANCHES[0]?.id || '';
  });
  const [targetBranchId, setTargetBranchId] = useState<string>(myBranchId);
  const [requestPriority, setRequestPriority] = useState<TransferPriority>('NORMAL');
  const [requestNotes, setRequestNotes] = useState<string>('');
  const [requestedItems, setRequestedItems] = useState<
    (CreateTransferItemPayload & { sourceStock: number; isSpecialStock?: boolean })[]
  >([]);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Cross-Branch Search state
  const [crossBranchResults, setCrossBranchResults] = useState<CrossBranchProductItem[]>([]);
  const [isSearchingCrossBranch, setIsSearchingCrossBranch] = useState<boolean>(false);
  const [crossSearchQuery, setCrossSearchQuery] = useState<string>('');

  // Dispatch Confirmation Modal state
  const [dispatchingTransfer, setDispatchingTransfer] = useState<StockTransfer | null>(null);
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Receive Confirmation state
  const [receivingTransferId, setReceivingTransferId] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState<boolean>(false);

  // Rejection Modal state
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Details Modal state
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Printable Dispatch Voucher state
  const [printingTransfer, setPrintingTransfer] = useState<StockTransfer | null>(null);

  // Check URL query parameters for search pre-fill (from POS "Check Other Branches" quick-link)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get('search');
      if (searchParam) {
        setCrossSearchQuery(searchParam);
        setIsRequestModalOpen(true);
      }
    }
  }, []);

  // Sync targetBranchId with myBranchId
  useEffect(() => {
    setTargetBranchId(myBranchId);
    if (sourceBranchId === myBranchId) {
      const alt = ACTIVE_BRANCHES.find((b) => b.id !== myBranchId);
      if (alt) setSourceBranchId(alt.id);
    }
  }, [myBranchId]);

  // Load Transfers
  const loadTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await transfersApi.getTransfers({
        branchId: filterBranchId !== 'all' ? filterBranchId : undefined,
      });
      if (res.success) {
        setTransfers(res.data);

        // Auto-default tab on first load
        if (!hasInitializedTab) {
          const incomingPending = res.data.filter(
            (t) => t.from_branch_id === myBranchId && t.status === 'PENDING'
          ).length;
          if (incomingPending > 0) {
            setActiveTab('INCOMING');
          } else {
            setActiveTab(isOwner ? 'ALL' : 'MY_REQUESTS');
          }
          setHasInitializedTab(true);
        }
      }
    } catch (err) {
      console.error('[StockTransfersPage] loadTransfers error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterBranchId, myBranchId, isOwner, hasInitializedTab]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Live Cross-Branch Search execution
  const executeCrossBranchSearch = useCallback(async (q: string) => {
    setIsSearchingCrossBranch(true);
    try {
      const results = await transfersApi.searchCrossBranchInventory(q);
      setCrossBranchResults(results);
    } catch (err) {
      console.error('[StockTransfersPage] cross branch search error:', err);
    } finally {
      setIsSearchingCrossBranch(false);
    }
  }, []);

  useEffect(() => {
    if (!isRequestModalOpen) return;
    const timer = setTimeout(() => {
      executeCrossBranchSearch(crossSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [isRequestModalOpen, crossSearchQuery, executeCrossBranchSearch]);

  // Source and Target Branch Names
  const sourceBranchName = useMemo(() => {
    return ACTIVE_BRANCHES.find((b) => b.id === sourceBranchId)?.name || 'Source Branch';
  }, [sourceBranchId]);

  const targetBranchName = useMemo(() => {
    return ACTIVE_BRANCHES.find((b) => b.id === targetBranchId)?.name || 'My Branch';
  }, [targetBranchId]);

  // Add Item to Transfer Request List (Supports Physical Stock Override when Source System Stock is 0 u)
  const handleAddItemToRequest = (item: CrossBranchProductItem, selectedFromBranchId?: string) => {
    const fromId = selectedFromBranchId || sourceBranchId;
    if (fromId !== sourceBranchId) {
      setSourceBranchId(fromId);
    }

    const availableAtSource = Number((item.availability as any)[fromId] || 0);

    setRequestedItems((prev) => {
      const existing = prev.find((it) => it.product_id === item.id);
      if (existing) {
        return prev.map((it) =>
          it.product_id === item.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          product_id: item.id,
          product_name: item.name,
          sku: item.sku,
          unit_price: item.retailPrice,
          quantity: 1,
          sourceStock: availableAtSource,
          is_special_stock: item.isSpecialStock,
        },
      ];
    });
  };

  // Update item quantity in request builder (allows physical stock override)
  const handleRequestQuantityChange = (productId: string, valStr: string) => {
    const val = parseInt(valStr, 10);
    const validQty = isNaN(val) || val <= 0 ? 1 : val;

    setRequestedItems((prev) =>
      prev.map((it) => (it.product_id === productId ? { ...it, quantity: validQty } : it))
    );
  };

  const handleRemoveRequestedItem = (productId: string) => {
    setRequestedItems((prev) => prev.filter((it) => it.product_id !== productId));
  };

  // Submit Stock Request (Step 1: PENDING, Zero Stock Movement)
  const handleSubmitStockRequest = async () => {
    setRequestError(null);

    if (sourceBranchId === targetBranchId) {
      setRequestError('Source Branch and Destination Branch must be different locations.');
      return;
    }
    if (requestedItems.length === 0) {
      setRequestError('Please select at least one item to request.');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await transfersApi.createTransfer({
        from_branch_id: sourceBranchId,
        to_branch_id: targetBranchId,
        requested_by_id: currentUserId,
        requested_by_name: currentUserName,
        priority: requestPriority,
        notes: requestNotes.trim() || undefined,
        items: requestedItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          unit_price: it.unit_price,
          quantity: it.quantity,
          is_special_stock: it.is_special_stock,
        })),
        immediateApproval: false, // Strictly PENDING
      });

      if (res.success && res.data) {
        setIsRequestModalOpen(false);
        setRequestedItems([]);
        setRequestNotes('');
        setRequestPriority('NORMAL');
        setActiveTab('MY_REQUESTS');
        loadTransfers();
      } else {
        setRequestError(res.error || 'Failed to submit transfer request.');
      }
    } catch (err: any) {
      setRequestError(err.message || 'Error submitting transfer request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Step 2: Approve & Dispatch Handler (Atomically Deducts from Sending Branch)
  const handleOpenDispatchModal = (t: StockTransfer) => {
    setDispatchingTransfer(t);
    const initialQtys: Record<string, number> = {};
    t.items.forEach((it) => {
      initialQtys[it.id] = it.quantity_requested;
    });
    setApprovedQuantities(initialQtys);
  };

  const handleExecuteDispatch = async () => {
    if (!dispatchingTransfer) return;
    setIsDispatching(true);
    try {
      const res = await transfersApi.dispatchTransfer(
        dispatchingTransfer.id,
        currentUserId,
        currentUserName,
        approvedQuantities
      );

      if (res.success) {
        setDispatchingTransfer(null);
        setSelectedTransfer(null);
        loadTransfers();
      } else {
        alert(res.error || 'Failed to dispatch transfer.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing transfer dispatch.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Step 3: Confirm Stock Received Handler (Atomically Adds to Receiving Branch)
  const handleExecuteReceive = async (transferId: string) => {
    if (!confirm('Confirm that all items in this transfer have been physically received and verified? Stock will be added to your branch inventory.')) {
      return;
    }

    setReceivingTransferId(transferId);
    setIsReceiving(true);
    try {
      const res = await transfersApi.receiveTransfer(
        transferId,
        currentUserId,
        currentUserName
      );

      if (res.success) {
        setSelectedTransfer(null);
        loadTransfers();
      } else {
        alert(res.error || 'Failed to confirm receipt.');
      }
    } catch (err: any) {
      alert(err.message || 'Error confirming stock receipt.');
    } finally {
      setReceivingTransferId(null);
      setIsReceiving(false);
    }
  };

  // Reject / Cancel Handler
  const handleExecuteReject = async () => {
    if (!rejectingTransferId) return;
    setIsRejecting(true);
    try {
      const res = await transfersApi.rejectTransfer(
        rejectingTransferId,
        currentUserName,
        rejectionReason.trim() || undefined
      );

      if (res.success) {
        setRejectingTransferId(null);
        setRejectionReason('');
        setSelectedTransfer(null);
        loadTransfers();
      } else {
        alert(res.error || 'Failed to reject transfer.');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting transfer.');
    } finally {
      setIsRejecting(false);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const incomingToFulfill = transfers.filter(
      (t) => (t.from_branch_id === myBranchId || isOwner) && t.status === 'PENDING'
    ).length;

    const myRequests = transfers.filter(
      (t) => (t.to_branch_id === myBranchId || isOwner) && t.status === 'PENDING'
    ).length;

    const inTransit = transfers.filter(
      (t) => t.status === 'DISPATCHED' && (isOwner || t.from_branch_id === myBranchId || t.to_branch_id === myBranchId)
    ).length;

    const completedUnits = transfers
      .filter((t) => t.status === 'RECEIVED')
      .reduce((sum, t) => sum + t.total_quantity, 0);

    return { incomingToFulfill, myRequests, inTransit, completedUnits, total: transfers.length };
  }, [transfers, myBranchId, isOwner]);

  // Tab filtering
  const displayedTransfers = useMemo(() => {
    let list = transfers;

    if (activeTab === 'INCOMING') {
      list = isOwner
        ? list.filter((t) => t.status === 'PENDING' || t.status === 'DISPATCHED')
        : list.filter((t) => t.from_branch_id === myBranchId);
    } else if (activeTab === 'MY_REQUESTS') {
      list = isOwner
        ? list
        : list.filter((t) => t.to_branch_id === myBranchId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.tracking_number.toLowerCase().includes(q) ||
          t.from_branch_name.toLowerCase().includes(q) ||
          t.to_branch_name.toLowerCase().includes(q) ||
          t.requested_by_name.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          t.items.some(
            (it) =>
              it.product_name.toLowerCase().includes(q) ||
              (it.sku && it.sku.toLowerCase().includes(q)) ||
              matchesCatalogSearch(it.product_name, q)
          )
      );
    }

    return list;
  }, [transfers, activeTab, myBranchId, isOwner, searchQuery]);

  // Date Formatter (Asia/Colombo)
  const formatColomboDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <MotionPageShell className="space-y-6">
      {/* =====================================================================
          HEADER SECTION
      ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Inter-Branch Stock Transfer Hub
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getBranchChipClass(myBranchId)}`}>
              {myBranchName}
            </span>
            {isOwner && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                Owner Administrator
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time stock request, dispatch, and receipt across Alawwa, Dambadeniya, and Giriulla
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={loadTransfers}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Transfers"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRequestModalOpen(true);
              setCrossSearchQuery('');
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Request Stock from Another Branch</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          KPI HERO CARDS
      ===================================================================== */}
      <MotionStaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Incoming to Fulfill */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('INCOMING')}
            className={`p-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-amber-500/10 flex flex-col justify-between bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white h-full ${
              activeTab === 'INCOMING' ? 'ring-4 ring-amber-300/40 -translate-y-0.5' : 'hover:opacity-95'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider">
                  Incoming to Fulfill
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-md shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{metrics.incomingToFulfill}</span>
                  {metrics.incomingToFulfill > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div className="mt-2 text-xs text-amber-100">
                  {metrics.incomingToFulfill > 0
                    ? 'Pending requests awaiting dispatch from your branch'
                    : 'Zero incoming requests awaiting dispatch'}
                </div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* KPI 2: In Transit */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('MY_REQUESTS')}
            className="p-5 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white shadow-lg shadow-blue-500/10 flex flex-col justify-between h-full cursor-pointer hover:opacity-95 transition-all"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider">
                  In Transit (Dispatched)
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-md shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{metrics.inTransit}</span>
                  {metrics.inTransit > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div className="mt-2 text-xs text-blue-100">
                  Stock dispatched and on the road awaiting receipt
                </div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* KPI 3: Total Completed Units */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('ALL')}
            className="p-5 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-lg shadow-emerald-500/10 flex flex-col justify-between h-full cursor-pointer hover:opacity-95 transition-all"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                  Total Units Reallocated
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-md shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {metrics.completedUnits.toLocaleString('en-US')}
                </div>
                <div className="mt-2 text-xs text-emerald-100">
                  Successfully transferred and received across branches
                </div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* KPI 4: Total Transfer Records */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('ALL')}
            className={`p-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-purple-500/10 flex flex-col justify-between bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white h-full ${
              activeTab === 'ALL' ? 'ring-4 ring-purple-300/40 -translate-y-0.5' : 'hover:opacity-95'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-100 uppercase tracking-wider">
                  Total Transfer Requests
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-purple-600 flex items-center justify-center shadow-md shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">{metrics.total}</div>
                <div className="mt-2 text-xs text-purple-100">
                  Cross-branch transfer audit records
                </div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>
      </MotionStaggerGrid>

      {/* =====================================================================
          ACTION TABS & FILTER BAR
      ===================================================================== */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* 3 Intuitive Action Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            {
              id: 'INCOMING',
              label: 'Incoming Requests (To Fulfill)',
              count: transfers.filter((t) => (t.from_branch_id === myBranchId || isOwner) && t.status === 'PENDING').length,
              badgeCls: 'bg-amber-100 text-amber-800',
            },
            {
              id: 'MY_REQUESTS',
              label: 'My Branch Requests',
              count: transfers.filter((t) => t.to_branch_id === myBranchId || isOwner).length,
              badgeCls: 'bg-blue-100 text-blue-800',
            },
            {
              id: 'ALL',
              label: 'All Transfers (Owner Audit View)',
              count: transfers.length,
              badgeCls: 'bg-purple-100 text-purple-800',
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as MainTabType)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : tab.badgeCls
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Branch Filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="all">All 3 Branches</option>
            {ACTIVE_BRANCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN TRANSFERS TABLE
      ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0F172A] text-white text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">REFERENCE #</th>
                <th className="py-3 px-3">DATE &amp; TIME</th>
                <th className="py-3 px-3">ROUTE</th>
                <th className="py-3 px-3">ITEMS</th>
                <th className="py-3 px-3 text-center">PRIORITY</th>
                <th className="py-3 px-3 text-center">STATUS</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedTransfers.length > 0 ? (
                displayedTransfers.map((t) => {
                  const isIncomingToMe = t.from_branch_id === myBranchId;
                  const isMyOutgoing = t.to_branch_id === myBranchId;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Reference # */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{t.tracking_number}</span>
                          {t.is_urgent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1 animate-pulse">
                              <Zap className="w-2.5 h-2.5" />
                              Urgent
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          Req: {t.requested_by_name}
                        </span>
                      </td>

                      {/* Date & Time (Asia/Colombo) */}
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        <div>{formatColomboDate(t.created_at)}</div>
                      </td>

                      {/* Route (From -> To) */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] ${getBranchChipClass(t.from_branch_id)}`}>
                            {t.from_branch_name}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className={`px-2 py-0.5 rounded-md text-[11px] ${getBranchChipClass(t.to_branch_id)}`}>
                            {t.to_branch_name}
                          </span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {t.items.map((i) => i.product_name).join(', ') || 'Inventory items'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {t.total_items} SKU{t.total_items > 1 ? 's' : ''} • {t.total_quantity} units
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-3 text-center">
                        {t.is_urgent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Urgent Waiting
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {t.status === 'PENDING' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Pending Dispatch
                          </span>
                        ) : t.status === 'DISPATCHED' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                            <Truck className="w-3 h-3 text-blue-500 animate-bounce" />
                            In Transit
                          </span>
                        ) : t.status === 'RECEIVED' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Received &amp; Stocked
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            Cancelled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1-Click Approve & Dispatch for Sending Branch staff or Owner */}
                          {t.status === 'PENDING' && (isIncomingToMe || isOwner) && (
                            <button
                              type="button"
                              onClick={() => handleOpenDispatchModal(t)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Approve &amp; Dispatch</span>
                            </button>
                          )}

                          {/* 1-Click Confirm Stock Received for Receiving Branch staff or Owner */}
                          {t.status === 'DISPATCHED' && (isMyOutgoing || isOwner) && (
                            <button
                              type="button"
                              onClick={() => handleExecuteReceive(t.id)}
                              disabled={isReceiving && receivingTransferId === t.id}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {isReceiving && receivingTransferId === t.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Confirm Received</span>
                            </button>
                          )}

                          {/* Reject / Cancel button */}
                          {t.status === 'PENDING' && (isIncomingToMe || isMyOutgoing || isOwner) && (
                            <button
                              type="button"
                              onClick={() => setRejectingTransferId(t.id)}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Reject or Cancel Request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => setSelectedTransfer(t)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Transfer Note */}
                          <button
                            type="button"
                            onClick={() => setPrintingTransfer(t)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Print Transfer Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400 text-xs">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading transfer records...</span>
                      </div>
                    ) : (
                      'No stock transfers found matching the selected tab or search'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          REQUEST STOCK FROM ANOTHER BRANCH MODAL (LIVE 3-BRANCH FINDER)
      ===================================================================== */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="max-w-4xl w-full bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-indigo-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center font-bold">
                  <ArrowLeftRight className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Request Stock from Another Branch
                  </h3>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Live 3-Branch Availability Finder • Destination: <strong className="text-white">{targetBranchName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#F8FAFC]">
              {requestError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{requestError}</span>
                </div>
              )}

              {/* 1. Branch Routing & Priority Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                {/* Source Branch */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Request Stock From:
                  </label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => setSourceBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {ACTIVE_BRANCHES.filter((b) => b.id !== targetBranchId).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Branch */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Receiving Branch:
                  </label>
                  <div className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 border border-slate-200 text-slate-800">
                    {targetBranchName}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Transfer Priority:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRequestPriority('NORMAL')}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        requestPriority === 'NORMAL'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestPriority('URGENT')}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        requestPriority === 'URGENT'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-400/30'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Urgent</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Live 3-Branch Stock Finder Search Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Live 3-Branch Inventory Search
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Supports regular catalog products &amp; 7 Special Stock items
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by medicine name, barcode, SKU (e.g. SKU-1805, Arishta)..."
                    value={crossSearchQuery}
                    onChange={(e) => setCrossSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-24 py-2.5 text-xs sm:text-sm rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs"
                  />
                  {isSearchingCrossBranch && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Checking branches...</span>
                    </div>
                  )}
                </div>

                {/* 3-Branch Availability Results Matrix */}
                {crossBranchResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs">
                    {crossBranchResults.slice(0, 15).map((item) => {
                      const alawwaStock = item.availability['00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'] || 0;
                      const damStock = item.availability['fa68e4a0-a515-44c8-a082-5b5590366658'] || 0;
                      const girStock = item.availability['197693d6-4247-48df-b614-6fcde9e34f7d'] || 0;

                      return (
                        <div key={item.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {item.name}
                              </span>
                              {item.isSpecialStock && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  Special Stock
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                              SKU: {item.sku || 'N/A'} • LKR {item.retailPrice.toLocaleString()}
                            </span>
                          </div>

                          {/* 3-Branch Matrix Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Alawwa */}
                            <button
                              type="button"
                              onClick={() => handleAddItemToRequest(item, '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54')}
                              title="Click to request from Alawwa"
                              className="text-center p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 min-w-[76px] transition-colors cursor-pointer"
                            >
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Alawwa</span>
                              <span className={`text-xs font-mono font-bold ${alawwaStock > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                                {alawwaStock} u
                              </span>
                            </button>

                            {/* Dambadeniya */}
                            <button
                              type="button"
                              onClick={() => handleAddItemToRequest(item, 'fa68e4a0-a515-44c8-a082-5b5590366658')}
                              title="Click to request from Dambadeniya"
                              className="text-center p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 min-w-[76px] transition-colors cursor-pointer"
                            >
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Dambadeniya</span>
                              <span className={`text-xs font-mono font-bold ${damStock > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {damStock} u
                              </span>
                            </button>

                            {/* Giriulla */}
                            <button
                              type="button"
                              onClick={() => handleAddItemToRequest(item, '197693d6-4247-48df-b614-6fcde9e34f7d')}
                              title="Click to request from Giriulla"
                              className="text-center p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 min-w-[76px] transition-colors cursor-pointer"
                            >
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Giriulla</span>
                              <span className={`text-xs font-mono font-bold ${girStock > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                {girStock} u
                              </span>
                            </button>

                            {/* 1-Click Request Action Button */}
                            <button
                              type="button"
                              onClick={() => handleAddItemToRequest(item)}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer ml-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add to Request</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Transfer Request Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Transfer Items List ({requestedItems.length} items)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Source: <strong className="text-slate-800">{sourceBranchName}</strong>
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {requestedItems.length > 0 ? (
                    requestedItems.map((item) => {
                      const isOverride = item.sourceStock <= 0 || item.quantity > item.sourceStock;
                      return (
                        <div key={item.product_id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {item.product_name}
                              </span>
                              {item.is_special_stock && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  Special Item
                                </span>
                              )}
                              {isOverride && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>System stock: {item.sourceStock} u (Physical stock override)</span>
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                              SKU: {item.sku || 'N/A'} • Available at {sourceBranchName}:{' '}
                              <strong className={item.sourceStock > 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                {item.sourceStock} units
                              </strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-500">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleRequestQuantityChange(item.product_id, e.target.value)
                                }
                                className="w-16 h-8 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600"
                              />
                              <span className="text-xs text-slate-400 font-mono">
                                / {item.sourceStock > 0 ? `${item.sourceStock} u` : '0 u'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveRequestedItem(item.product_id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Search and click &ldquo;Add to Request&rdquo; above to add products to your transfer list.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Notes input */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Request Notes / Reason
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer waiting at counter, weekly branch stock replenishment..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200/90 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                Requested by: <strong className="text-slate-800 font-semibold">{currentUserName}</strong>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  disabled={isSubmittingRequest}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmitStockRequest}
                  disabled={isSubmittingRequest || requestedItems.length === 0}
                  className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmittingRequest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Submit Request to {sourceBranchName}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DISPATCH CONFIRMATION MODAL (STEP 2: APPROVE & DISPATCH)
      ===================================================================== */}
      {dispatchingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="max-w-2xl w-full bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-indigo-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Approve &amp; Dispatch Stock — #{dispatchingTransfer.tracking_number}
                  </h3>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Stock will be atomically deducted from <strong>{dispatchingTransfer.from_branch_name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchingTransfer(null)}
                className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs bg-[#F8FAFC]">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Atomic Stock Deduction Notice</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Approving will mark this transfer as <strong>DISPATCHED (In Transit)</strong> and immediately deduct the confirmed quantities from {dispatchingTransfer.from_branch_name}&apos;s warehouse inventory and active shift special stock.
                </p>
              </div>

              {/* Items check list */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Confirm Approved Quantities
                </span>
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                  {dispatchingTransfer.items.map((it) => {
                    const currentApproved = approvedQuantities[it.id] ?? it.quantity_requested;
                    const isOverride = it.source_stock_on_hand <= 0 || currentApproved > it.source_stock_on_hand;
                    return (
                      <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 block truncate">{it.product_name}</span>
                            {isOverride && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>System stock: {it.source_stock_on_hand} u (Physical stock override)</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SKU: {it.sku || 'N/A'} • Available: {it.source_stock_on_hand} units
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-slate-500">Dispatch:</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={currentApproved}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setApprovedQuantities((prev) => ({ ...prev, [it.id]: val }));
                            }}
                            className="w-16 h-8 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-600"
                          />
                          <span className="text-xs text-slate-400 font-mono">units</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDispatchingTransfer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteDispatch}
                disabled={isDispatching}
                className="min-h-[44px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deducting &amp; Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Approve &amp; Dispatch Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TRANSFER DETAILS MODAL
      ===================================================================== */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="max-w-3xl w-full bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Transfer #{selectedTransfer.tracking_number}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedTransfer.from_branch_name} ➔ {selectedTransfer.to_branch_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs bg-[#F8FAFC]">
              {/* Route banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">From Branch</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedTransfer.from_branch_name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">To Branch</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedTransfer.to_branch_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <span className="font-bold font-mono text-sm uppercase text-indigo-700">{selectedTransfer.status}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">Transfer Items</span>
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                  {selectedTransfer.items.map((it) => (
                    <div key={it.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{it.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {it.sku || 'N/A'}</span>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-900">
                        {it.quantity_dispatched || it.quantity_requested} units
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedTransfer.notes && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Audit &amp; Handover Log</span>
                  <p className="text-slate-800 whitespace-pre-wrap font-mono text-[11px]">
                    {selectedTransfer.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPrintingTransfer(selectedTransfer)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          REJECTION MODAL
      ===================================================================== */}
      {rejectingTransferId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Cancel or Reject Stock Transfer</h3>
            </div>

            <p className="text-xs text-slate-500">
              Enter reason for rejection or cancellation. If stock was already dispatched, it will be automatically returned to the sending branch.
            </p>

            <textarea
              rows={3}
              placeholder="Reason for cancellation..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingTransferId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteReject}
                disabled={isRejecting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                {isRejecting ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PRINTABLE DISPATCH VOUCHER MODAL
      ===================================================================== */}
      {printingTransfer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-900">
                  Transfer Voucher #{printingTransfer.tracking_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingTransfer(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-xs bg-white text-slate-900 font-sans">
              <div className="text-center pb-4 border-b border-slate-200 space-y-1">
                <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  Deegayu Weda Madhura
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Internal Branch-to-Branch Inventory Dispatch Voucher
                </p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Giriulla (0372289339) • Dambadeniya (0372266444) • Alawwa (0372077180) • WhatsApp: +94772634497
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Transfer Reference #</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{printingTransfer.tracking_number}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispatch Date &amp; Time</span>
                  <span className="text-xs font-mono text-slate-800">{formatColomboDate(printingTransfer.created_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">From Branch</span>
                  <span className="text-xs font-bold text-slate-900">{printingTransfer.from_branch_name} ({printingTransfer.from_branch_code})</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">To Branch</span>
                  <span className="text-xs font-bold text-slate-900">{printingTransfer.to_branch_name} ({printingTransfer.to_branch_code})</span>
                </div>
              </div>

              <div>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 font-bold text-slate-600 text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3 text-right">Transfer Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printingTransfer.items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{it.product_name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{it.sku || 'N/A'}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{it.quantity_requested}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 text-right uppercase text-[10px]">Total Quantity:</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{printingTransfer.total_quantity} units</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[11px]">
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-800">{printingTransfer.requested_by_name}</div>
                  <div className="text-[10px] text-slate-400">Dispatched By / Cashier</div>
                </div>
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-800">
                    {printingTransfer.dispatched_by_name || 'Authorized'}
                  </div>
                  <div className="text-[10px] text-slate-400">Driver / Logistics Agent</div>
                </div>
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-800">{printingTransfer.to_branch_name} Staff</div>
                  <div className="text-[10px] text-slate-400">Received By / Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </MotionPageShell>
  );
}
