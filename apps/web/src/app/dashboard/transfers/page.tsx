'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Package,
  ShieldCheck,
  Eye,
  Trash2,
  Printer,
  X,
  Check,
  Loader2,
  Barcode,
  User,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import {
  transfersApi,
  ACTIVE_BRANCHES,
  type StockTransfer,
  type TransferDisplayStatus,
  type TransferProductSearchItem,
  type CreateTransferItemPayload,
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

export default function StockTransfersPage() {
  const { user, isOwner, activeCashier, assignedBranchIds, selectedBranchId } = useTenantBranch();

  // Current active staff / owner name
  const currentUserName =
    activeCashier?.fullName || user?.fullName || (isOwner ? 'Dr. Deegayu (Owner)' : 'Staff Cashier');
  const currentUserId = activeCashier?.id || user?.id || '';

  // Data state
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ALL' | TransferDisplayStatus>('PENDING_APPROVAL');
  const [hasInitializedTab, setHasInitializedTab] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');

  // New Transfer Request Form Modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [fromBranchId, setFromBranchId] = useState<string>(() => {
    if (selectedBranchId && ACTIVE_BRANCHES.some((b) => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    if (assignedBranchIds && assignedBranchIds.length > 0) {
      const match = ACTIVE_BRANCHES.find((b) => assignedBranchIds.includes(b.id));
      if (match) return match.id;
    }
    return ACTIVE_BRANCHES[0]?.id || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54';
  });
  const [toBranchId, setToBranchId] = useState<string>(() => {
    return (
      ACTIVE_BRANCHES.find((b) => b.id !== fromBranchId)?.id ||
      ACTIVE_BRANCHES[1]?.id ||
      'fa68e4a0-a515-44c8-a082-5b5590366658'
    );
  });
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferItems, setTransferItems] = useState<
    (CreateTransferItemPayload & { sourceStock: number })[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Live Sending Branch Product Search state
  const [branchProducts, setBranchProducts] = useState<TransferProductSearchItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [productQuery, setProductQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);

  // Review & Confirmation Modal state
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Rejection Modal state
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Printable Dispatch Voucher state
  const [printingTransfer, setPrintingTransfer] = useState<StockTransfer | null>(null);

  const productSearchInputRef = useRef<HTMLInputElement>(null);

  // Ensure To Branch differs from From Branch whenever From Branch changes
  const handleFromBranchChange = (newFromId: string) => {
    setFromBranchId(newFromId);
    if (newFromId === toBranchId) {
      const alt = ACTIVE_BRANCHES.find((b) => b.id !== newFromId);
      if (alt) setToBranchId(alt.id);
    }
    // Clear items when source branch changes since stock changes
    setTransferItems([]);
  };

  // 1. Load Transfers
  const loadTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await transfersApi.getTransfers({
        branchId: filterBranchId !== 'all' ? filterBranchId : undefined,
      });
      if (res.success) {
        setTransfers(res.data);

        // Auto-default tab to Pending Owner Approval if there are pending items on first load
        if (!hasInitializedTab) {
          const pendingCount = res.data.filter((t) => t.display_status === 'PENDING_APPROVAL').length;
          if (pendingCount > 0) {
            setActiveTab('PENDING_APPROVAL');
          } else {
            setActiveTab('ALL');
          }
          setHasInitializedTab(true);
        }
      }
    } catch (err) {
      console.error('[StockTransfersPage] loadTransfers error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterBranchId, hasInitializedTab]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // 2. Fetch live stock for selected fromBranchId
  useEffect(() => {
    if (!fromBranchId) return;
    let isCancelled = false;

    const fetchBranchCatalog = async () => {
      setIsLoadingProducts(true);
      try {
        const items = await transfersApi.getProductsForBranch(fromBranchId);
        if (!isCancelled) {
          setBranchProducts(items);
        }
      } catch (err) {
        console.error('[StockTransfersPage] fetchBranchCatalog error:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    fetchBranchCatalog();

    return () => {
      isCancelled = true;
    };
  }, [fromBranchId]);

  // Sending branch name
  const fromBranchName = useMemo(() => {
    return ACTIVE_BRANCHES.find((b) => b.id === fromBranchId)?.name || 'Sending Branch';
  }, [fromBranchId]);

  const toBranchName = useMemo(() => {
    return ACTIVE_BRANCHES.find((b) => b.id === toBranchId)?.name || 'Receiving Branch';
  }, [toBranchId]);

  // Filtered product suggestions
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return branchProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [productQuery, branchProducts]);

  // Add product to transfer list with live stock validation
  const handleAddProduct = (product: TransferProductSearchItem) => {
    if (product.quantityOnHand <= 0) {
      alert(`${product.name} is currently out of stock at ${fromBranchName} (Available: 0 units). Cannot add to transfer.`);
      return;
    }

    setTransferItems((prev) => {
      const exists = prev.find((item) => item.product_id === product.id);
      if (exists) {
        const nextQty = Math.min(product.quantityOnHand, exists.quantity + 1);
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          unit_price: product.retailPrice,
          quantity: 1,
          sourceStock: product.quantityOnHand,
        },
      ];
    });

    setProductQuery('');
    setIsSearchDropdownOpen(false);
    productSearchInputRef.current?.focus();
  };

  // Keyboard barcode / Enter listener
  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = productQuery.trim().toLowerCase();
      if (!q) return;

      const exact = branchProducts.find(
        (p) => p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q
      );
      if (exact) {
        handleAddProduct(exact);
        return;
      }

      if (filteredProducts.length > 0 && filteredProducts[0]) {
        handleAddProduct(filteredProducts[0]);
      }
    }
  };

  // Update item quantity with live stock bounds
  const handleQuantityChange = (productId: string, qtyStr: string, maxStock: number) => {
    const qty = parseFloat(qtyStr);
    let validQty = !isNaN(qty) && qty > 0 ? Math.round(qty * 1000) / 1000 : 1;
    if (validQty > maxStock) {
      validQty = maxStock;
    }
    setTransferItems((prev) =>
      prev.map((it) => (it.product_id === productId ? { ...it, quantity: validQty } : it))
    );
  };

  // Remove item from draft
  const handleRemoveItem = (productId: string) => {
    setTransferItems((prev) => prev.filter((it) => it.product_id !== productId));
  };

  // Form total summary
  const formTotals = useMemo(() => {
    const totalItems = transferItems.length;
    const totalCount = transferItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const hasExceeded = transferItems.some((it) => it.quantity > it.sourceStock);
    return { totalItems, totalCount, hasExceeded };
  }, [transferItems]);

  // Submit Transfer (Pending or Immediate based on action)
  const handleSubmitTransfer = async (immediateApproval = false) => {
    setFormError(null);
    setFormSuccess(null);

    if (fromBranchId === toBranchId) {
      setFormError('From Branch and To Branch must be different locations.');
      return;
    }

    if (transferItems.length === 0) {
      setFormError('Please add at least one item to the transfer list.');
      return;
    }

    const invalidItem = transferItems.find((it) => it.quantity > it.sourceStock);
    if (invalidItem) {
      setFormError(
        `Quantity for ${invalidItem.product_name} exceeds available stock at ${fromBranchName} (Requested: ${invalidItem.quantity}, Available: ${invalidItem.sourceStock}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await transfersApi.createTransfer({
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        requested_by_id: currentUserId,
        requested_by_name: currentUserName,
        notes: transferNotes.trim() || undefined,
        items: transferItems.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          unit_price: it.unit_price,
          quantity: it.quantity,
        })),
        immediateApproval,
      });

      if (res.success && res.data) {
        setFormSuccess(
          immediateApproval
            ? `Transfer ${res.data.tracking_number} created and approved immediately. Stock updated!`
            : `Transfer ${res.data.tracking_number} submitted successfully for Owner Approval.`
        );
        setTransferItems([]);
        setTransferNotes('');
        setIsFormOpen(false);
        loadTransfers();
      } else {
        setFormError(res.error || 'Failed to submit transfer request.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Inspection & Confirmation Modal
  const handleOpenTransferDetails = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    // Initialize editable quantities map for Owner
    const qtyMap: Record<string, number> = {};
    transfer.items.forEach((it) => {
      qtyMap[it.id] = it.quantity_requested;
    });
    setEditedQuantities(qtyMap);
  };

  // Owner Confirm & Approve Transfer Handler
  const handleConfirmApproval = async () => {
    if (!selectedTransfer) return;
    if (!isOwner) {
      alert('Only the Owner can confirm and execute stock transfers.');
      return;
    }

    setIsApproving(true);
    try {
      const res = await transfersApi.approveTransfer(
        selectedTransfer.id,
        currentUserId,
        currentUserName,
        editedQuantities
      );

      if (res.success) {
        alert(`Transfer ${selectedTransfer.tracking_number} has been approved. Stock has been transferred from ${selectedTransfer.from_branch_name} to ${selectedTransfer.to_branch_name}.`);
        setSelectedTransfer(null);
        loadTransfers();
      } else {
        alert(res.error || 'Failed to approve transfer.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing transfer approval.');
    } finally {
      setIsApproving(false);
    }
  };

  // Reject Transfer Handler
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

  // Summary Metrics
  const metrics = useMemo(() => {
    const pending = transfers.filter((t) => t.display_status === 'PENDING_APPROVAL').length;
    const approved = transfers.filter((t) => t.display_status === 'APPROVED').length;
    const rejected = transfers.filter((t) => t.display_status === 'REJECTED').length;
    const totalUnits = transfers
      .filter((t) => t.display_status === 'APPROVED')
      .reduce((sum, t) => sum + t.total_quantity, 0);

    return { pending, approved, rejected, totalUnits, total: transfers.length };
  }, [transfers]);

  // Filtered transfers table
  const displayedTransfers = useMemo(() => {
    let list = transfers;

    if (activeTab !== 'ALL') {
      list = list.filter((t) => t.display_status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.tracking_number.toLowerCase().includes(q) ||
          t.from_branch_name.toLowerCase().includes(q) ||
          t.to_branch_name.toLowerCase().includes(q) ||
          t.requested_by_name.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [transfers, activeTab, searchQuery]);

  // Format Colombo Date/Time
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stock Transfers</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Branch Reallocation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inter-branch stock transfers across <strong>Alawwa</strong>, <strong>Dambadeniya</strong>, and{' '}
            <strong>Giriulla</strong> with mandatory Owner verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadTransfers}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-pos-btn transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Request Stock Transfer</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {formSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{formSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          PART 4: TOP KPI SUMMARY CARDS (ELECTRIC INDIGO & VIOLET LOGISTICS)
      ===================================================================== */}
      <MotionStaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pending Owner Approval */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('PENDING_APPROVAL')}
            className={`p-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-amber-500/10 flex flex-col justify-between bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white h-full ${
              activeTab === 'PENDING_APPROVAL' ? 'ring-4 ring-amber-300/40 -translate-y-0.5' : 'hover:opacity-95'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider">
                  Pending Owner Approval
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-md shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{metrics.pending}</span>
                  {metrics.pending > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  )}
                </div>
                <div className="mt-2 text-xs text-amber-100">
                  {metrics.pending > 0
                    ? 'Requests awaiting Owner confirmation'
                    : 'Zero pending requests in queue'}
                </div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* KPI 2: Approved & Completed */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('APPROVED')}
            className={`p-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10 flex flex-col justify-between bg-gradient-to-br from-[#10B981] to-[#059669] text-white h-full ${
              activeTab === 'APPROVED' ? 'ring-4 ring-emerald-300/40 -translate-y-0.5' : 'hover:opacity-95'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                  Approved & Completed
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-md shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">{metrics.approved}</div>
                <div className="mt-2 text-xs text-emerald-100">Successfully executed stock reallocations</div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* KPI 3: Total Units Transferred */}
        <MotionStaggerItem>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#4338CA] text-white shadow-lg shadow-indigo-500/10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">
                  Total Units Transferred
                </span>
                <div className="w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-md shrink-0">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {metrics.totalUnits.toLocaleString('en-US')}
                </div>
                <div className="mt-2 text-xs text-indigo-100">Inventory volume relocated across branches</div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>

        {/* KPI 4: Total Requests (Electric Violet) */}
        <MotionStaggerItem>
          <div
            onClick={() => setActiveTab('ALL')}
            className={`p-5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-purple-500/10 flex flex-col justify-between bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] text-white h-full ${
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
                  {metrics.rejected > 0 ? `${metrics.rejected} rejected / cancelled` : 'All registered records'}
                </div>
              </div>
            </div>
          </div>
        </MotionStaggerItem>
      </MotionStaggerGrid>

      {/* =====================================================================
          FILTER TABS & SEARCH BAR
      ===================================================================== */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'PENDING_APPROVAL', label: 'Pending Owner Approval', count: metrics.pending },
            { id: 'APPROVED', label: 'Approved / Completed', count: metrics.approved },
            { id: 'REJECTED', label: 'Rejected', count: metrics.rejected },
            { id: 'ALL', label: 'All Transfers', count: metrics.total },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Branch Filter */}
        <div className="flex items-center gap-2">
          {/* Branch filter */}
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Operating Branches</option>
            {ACTIVE_BRANCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference #, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN REGISTER TABLE
      ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0F172A] text-white font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Reference #</th>
                <th className="py-3 px-4">Date / Time (Colombo)</th>
                <th className="py-3 px-4">Transfer Route</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4 text-center">Items & Qty</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransfers.length > 0 ? (
                displayedTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Reference # */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.tracking_number}</span>
                      </div>
                    </td>

                    {/* Date / Time */}
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {formatColomboDate(t.created_at)}
                    </td>

                    {/* Route: From -> To */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs font-mono text-[11px]">
                        <span className={`font-bold px-1.5 py-0.5 rounded-md ${getBranchChipClass(t.from_branch_name)}`}>
                          {t.from_branch_name}
                        </span>
                        <span className="text-indigo-600 font-bold px-0.5 flex items-center">
                          <ArrowRight className="w-3.5 h-3.5 animate-pulse text-[#4F46E5]" />
                        </span>
                        <span className={`font-bold px-1.5 py-0.5 rounded-md ${getBranchChipClass(t.to_branch_name)}`}>
                          {t.to_branch_name}
                        </span>
                      </div>
                    </td>

                    {/* Requested By */}
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.requested_by_name}</span>
                      </div>
                    </td>

                    {/* Items & Qty */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="font-bold text-slate-900">{t.total_quantity}</span>
                      <span className="text-slate-400 text-[10px] ml-1">
                        ({t.total_items} {t.total_items === 1 ? 'item' : 'items'})
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {t.display_status === 'PENDING_APPROVAL' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Owner Approval
                        </span>
                      ) : t.display_status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Approved & Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Owner Confirmation button */}
                        {t.display_status === 'PENDING_APPROVAL' && isOwner && (
                          <button
                            type="button"
                            onClick={() => handleOpenTransferDetails(t)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Review & Confirm</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenTransferDetails(t)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrintingTransfer(t)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Print Transfer Note"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading stock transfers...</span>
                      </div>
                    ) : (
                      'No stock transfers found matching the selected filter'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          PART 3: NEW TRANSFER REQUEST MODAL
      ===================================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#005BD3] flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Request Branch Stock Transfer</h3>
                  <p className="text-[11px] text-slate-500">
                    Inter-branch inventory movement from <strong>{fromBranchName}</strong> to <strong>{toBranchName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Branch Selectors (Alawwa, Dambadeniya, Giriulla only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                {/* From Branch */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    From Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={fromBranchId}
                    onChange={(e) => handleFromBranchChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {ACTIVE_BRANCHES.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Source warehouse stock will be checked live
                  </span>
                </div>

                {/* To Branch */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    To Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {ACTIVE_BRANCHES.filter((b) => b.id !== fromBranchId).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Destination branch to receive inventory
                  </span>
                </div>
              </div>

              {/* 2. Product Search & Add Bar with Live Stock Badge */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700 block">
                  Search & Add Products from {fromBranchName}
                </label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={productSearchInputRef}
                    type="text"
                    placeholder={`Scan barcode or type name / SKU at ${fromBranchName}...`}
                    value={productQuery}
                    onChange={(e) => {
                      setProductQuery(e.target.value);
                      setIsSearchDropdownOpen(true);
                    }}
                    onFocus={() => setIsSearchDropdownOpen(true)}
                    onKeyDown={handleProductKeyDown}
                    className="w-full pl-9 pr-24 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  {isLoadingProducts && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Stock sync...</span>
                    </div>
                  )}
                </div>

                {/* Autocomplete Dropdown with Live Stock Display */}
                {isSearchDropdownOpen && productQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => {
                        const isOutOfStock = p.quantityOnHand <= 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleAddProduct(p)}
                            className={`p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                              isOutOfStock ? 'bg-slate-50 opacity-60' : 'hover:bg-blue-50/70'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 truncate">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                SKU: {p.sku || 'N/A'} • Barcode: {p.barcode || 'N/A'}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              {isOutOfStock ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Out of Stock (0)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Available ({fromBranchName}): {p.quantityOnHand} units
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No matching products found at {fromBranchName}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Itemized Transfer Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Selected Line Items ({transferItems.length})
                  </span>
                  {formTotals.totalCount > 0 && (
                    <span className="text-xs font-mono font-bold text-slate-900">
                      Total: {formTotals.totalCount} units
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                  {transferItems.length > 0 ? (
                    transferItems.map((item) => {
                      const isOver = item.quantity > item.sourceStock;
                      return (
                        <div
                          key={item.product_id}
                          className={`p-3 flex items-center justify-between gap-3 bg-white ${
                            isOver ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 truncate">{item.product_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>SKU: {item.sku || 'N/A'}</span>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">
                                Available ({fromBranchName}): {item.sourceStock} units
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                max={item.sourceStock}
                                step={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(item.product_id, e.target.value, item.sourceStock)
                                }
                                className={`w-16 px-2 py-1 text-xs text-center font-mono font-bold rounded-lg border focus:outline-none ${
                                  isOver
                                    ? 'border-rose-500 text-rose-700 bg-rose-50'
                                    : 'border-slate-200 text-slate-900 focus:border-blue-500'
                                }`}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.product_id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                      No items added yet. Search or scan products above to build your transfer list.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Notes input */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Transfer Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for transfer, urgent stockout note, driver / delivery details..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Footer / Role Action Controls */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                Requested by: <strong className="text-slate-800">{currentUserName}</strong>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  Cancel
                </button>

                {/* For OWNER: Can either Approve Immediately or Save as Pending */}
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSubmitTransfer(false)}
                      disabled={isSubmitting || transferItems.length === 0 || formTotals.hasExceeded}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Save as Pending</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSubmitTransfer(true)}
                      disabled={isSubmitting || transferItems.length === 0 || formTotals.hasExceeded}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-pos-btn cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Create & Approve Immediately</span>
                    </button>
                  </>
                ) : (
                  /* For NON-OWNER Staff: Submits to Owner Approval Queue */
                  <button
                    type="button"
                    onClick={() => handleSubmitTransfer(false)}
                    disabled={isSubmitting || transferItems.length === 0 || formTotals.hasExceeded}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#005BD3] hover:bg-[#004bb5] shadow-pos-btn cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>Submit for Owner Approval</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PART 4: OWNER REVIEW & CONFIRMATION MODAL
      ===================================================================== */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Transfer #{selectedTransfer.tracking_number}
                    </h3>
                    {selectedTransfer.display_status === 'PENDING_APPROVAL' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Pending Owner Approval
                      </span>
                    ) : selectedTransfer.display_status === 'APPROVED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Approved & Completed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Rejected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Requested on {formatColomboDate(selectedTransfer.created_at)} by{' '}
                    <strong>{selectedTransfer.requested_by_name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Route Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Origin Branch
                  </span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedTransfer.from_branch_name} ({selectedTransfer.from_branch_code})
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-8 h-px bg-slate-300" />
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                  <div className="w-8 h-px bg-slate-300" />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Destination Branch
                  </span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedTransfer.to_branch_name} ({selectedTransfer.to_branch_code})
                  </div>
                </div>
              </div>

              {/* Non-owner staff notice banner */}
              {!isOwner && selectedTransfer.display_status === 'PENDING_APPROVAL' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Awaiting Owner Confirmation:</strong> This transfer request was submitted and is
                    currently in the Owner approval queue. Stock will be transferred upon Owner confirmation.
                  </span>
                </div>
              )}

              {/* Itemized Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Transfer Items & Stock Check
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Total Requested: {selectedTransfer.total_quantity} units
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-50/80 font-bold text-slate-500 text-[10px] uppercase">
                    <div className="col-span-6">Product & SKU</div>
                    <div className="col-span-2 text-center">{selectedTransfer.from_branch_name} Stock</div>
                    <div className="col-span-2 text-center">{selectedTransfer.to_branch_name} Stock</div>
                    <div className="col-span-2 text-right">Transfer Qty</div>
                  </div>

                  {selectedTransfer.items.map((it) => {
                    const currentQty = editedQuantities[it.id] ?? it.quantity_requested;
                    const isPending = selectedTransfer.display_status === 'PENDING_APPROVAL';

                    return (
                      <div
                        key={it.id}
                        className="grid grid-cols-12 gap-2 p-3 items-center bg-white hover:bg-slate-50 transition-colors"
                      >
                        <div className="col-span-6 min-w-0">
                          <div className="font-bold text-slate-900 truncate">{it.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SKU: {it.sku || 'N/A'}
                          </div>
                        </div>

                        {/* From Branch Current Stock */}
                        <div className="col-span-2 text-center font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              it.source_stock_on_hand < currentQty
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {it.source_stock_on_hand}
                          </span>
                        </div>

                        {/* To Branch Current Stock */}
                        <div className="col-span-2 text-center font-mono">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            {it.target_stock_on_hand}
                          </span>
                        </div>

                        {/* Transfer Qty (Editable by Owner on Pending status) */}
                        <div className="col-span-2 text-right font-mono font-bold">
                          {isPending && isOwner ? (
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={currentQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditedQuantities((prev) => ({ ...prev, [it.id]: val }));
                              }}
                              className="w-16 px-2 py-1 text-xs text-right font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span className="text-slate-900 text-xs">{currentQty} units</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes & Audit Trail */}
              {selectedTransfer.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Notes & Log</span>
                  <p className="text-slate-700 whitespace-pre-wrap font-mono text-[11px]">
                    {selectedTransfer.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrintingTransfer(selectedTransfer)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Transfer Note</span>
              </button>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTransfer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  Close
                </button>

                {/* OWNER-ONLY ACTIONS ON PENDING TRANSFERS */}
                {isOwner && selectedTransfer.display_status === 'PENDING_APPROVAL' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRejectingTransferId(selectedTransfer.id)}
                      disabled={isApproving}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-colors"
                    >
                      Reject Transfer
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmApproval}
                      disabled={isApproving}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-pos-btn cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      {isApproving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm & Approve Transfer</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          REJECTION REASON MODAL
      ===================================================================== */}
      {rejectingTransferId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reject Stock Transfer</h3>
                <p className="text-[11px] text-slate-500">Provide an optional reason for rejecting this request</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Rejection Reason (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Origin branch has impending clinic orders; insufficient inventory reserves..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingTransferId(null)}
                disabled={isRejecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReject}
                disabled={isRejecting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PRINTABLE DISPATCH NOTE VOUCHER MODAL
      ===================================================================== */}
      {printingTransfer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
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

            {/* Printable Paper Surface */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs bg-white text-slate-900 font-sans">
              {/* Brand Header */}
              <div className="text-center pb-4 border-b border-slate-200 space-y-1">
                <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  Deegayu Weda Madhura
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Internal Branch-to-Branch Inventory Dispatch Note
                </p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Alawwa • Dambadeniya • Giriulla
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Transfer Reference #
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {printingTransfer.tracking_number}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Dispatch Date & Time
                  </span>
                  <span className="text-xs font-mono text-slate-800">
                    {formatColomboDate(printingTransfer.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">From Branch</span>
                  <span className="text-xs font-bold text-slate-900">
                    {printingTransfer.from_branch_name} ({printingTransfer.from_branch_code})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">To Branch</span>
                  <span className="text-xs font-bold text-slate-900">
                    {printingTransfer.to_branch_name} ({printingTransfer.to_branch_code})
                  </span>
                </div>
              </div>

              {/* Items Table */}
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
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {it.quantity_requested}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 text-right uppercase text-[10px]">
                        Total Quantity Transferred:
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        {printingTransfer.total_quantity} units
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[11px]">
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-800">{printingTransfer.requested_by_name}</div>
                  <div className="text-[10px] text-slate-400">Dispatched By / Cashier</div>
                </div>
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-800">
                    {printingTransfer.display_status === 'APPROVED'
                      ? 'Approved by Owner'
                      : 'Pending Approval'}
                  </div>
                  <div className="text-[10px] text-slate-400">Owner Verification</div>
                </div>
                <div className="border-t border-slate-300 pt-2 space-y-1">
                  <div className="font-bold text-slate-800">
                    {printingTransfer.to_branch_name} Staff
                  </div>
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
