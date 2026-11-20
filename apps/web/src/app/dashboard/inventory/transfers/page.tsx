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
  AlertTriangle,
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
  Sparkles,
} from 'lucide-react';
import { useTenantBranch } from '../../../../context/tenant-branch-context';
import {
  transfersApi,
  type StockTransfer,
  type TransferStatus,
  type TransferProductSearchItem,
  type CreateTransferItemPayload,
} from '../../../../lib/transfers-api';

export default function StockTransfersPage() {
  const { branches, selectedBranchId, user, isOwnerOrAdmin, activeCashier } = useTenantBranch();

  // Active cashier / user name
  const currentUserName = activeCashier?.fullName || user?.fullName || 'Staff Member';

  // Data state
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ALL' | TransferStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');

  // New Transfer Form state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [fromBranchId, setFromBranchId] = useState<string>('');
  const [toBranchId, setToBranchId] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferItems, setTransferItems] = useState<CreateTransferItemPayload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Product autocomplete state
  const [branchProducts, setBranchProducts] = useState<TransferProductSearchItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [productQuery, setProductQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);

  // Inspection modal state
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Rejection modal state
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const productSearchInputRef = useRef<HTMLInputElement>(null);

  // Initialize fromBranchId to current branch
  useEffect(() => {
    if (branches && branches.length > 0) {
      const defaultFrom = selectedBranchId || branches[0]?.id || '';
      setFromBranchId((prev) => prev || defaultFrom);
      // Pick first different branch for toBranchId
      const otherBranch = branches.find((b) => b.id !== defaultFrom);
      if (otherBranch) {
        setToBranchId((prev) => prev || otherBranch.id);
      }
    }
  }, [branches, selectedBranchId]);

  // Load transfers list
  const loadTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await transfersApi.getTransfers({
        branchId: filterBranchId !== 'all' ? filterBranchId : undefined,
      });
      if (res.success) {
        setTransfers(res.data);
      }
    } catch (err) {
      console.error('[StockTransfersPage] loadTransfers error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterBranchId]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Load products & live stock for selected fromBranchId
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

  // Add product to transfer list
  const handleAddProduct = (product: TransferProductSearchItem) => {
    setTransferItems((prev) => {
      const exists = prev.some((item) => item.product_id === product.id);
      if (exists) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
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
        },
      ];
    });

    setProductQuery('');
    setIsSearchDropdownOpen(false);
    productSearchInputRef.current?.focus();
  };

  // Barcode / Enter key search support
  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = productQuery.trim().toLowerCase();
      if (!q) return;

      // Exact barcode match first
      const exactBarcode = branchProducts.find((p) => p.barcode.toLowerCase() === q);
      if (exactBarcode) {
        handleAddProduct(exactBarcode);
        return;
      }

      // Exact SKU match
      const exactSku = branchProducts.find((p) => p.sku.toLowerCase() === q);
      if (exactSku) {
        handleAddProduct(exactSku);
        return;
      }

      // First partial match
      if (filteredProducts.length > 0 && filteredProducts[0]) {
        handleAddProduct(filteredProducts[0]);
      }
    }
  };

  // Update item quantity
  const handleQuantityChange = (productId: string, qtyStr: string) => {
    const qty = parseFloat(qtyStr);
    const validQty = !isNaN(qty) && qty > 0 ? Math.round(qty * 1000) / 1000 : 1;
    setTransferItems((prev) =>
      prev.map((it) => (it.product_id === productId ? { ...it, quantity: validQty } : it))
    );
  };

  // Remove item
  const handleRemoveItem = (productId: string) => {
    setTransferItems((prev) => prev.filter((it) => it.product_id !== productId));
  };

  // Totals for transfer form
  const formTotals = useMemo(() => {
    const totalItems = transferItems.length;
    const totalCount = transferItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const totalAmount = transferItems.reduce(
      (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );
    return { totalItems, totalCount, totalAmount };
  }, [transferItems]);

  // Stage ①: Create transfer (Dispatched)
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (fromBranchId === toBranchId) {
      setFormError('From Location and To Location must be different branches.');
      return;
    }

    if (transferItems.length === 0) {
      setFormError('Please add at least one item to the transfer list.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await transfersApi.createTransfer({
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        dispatched_by: currentUserName,
        notes: transferNotes.trim() || undefined,
        items: transferItems,
      });

      if (res.success && res.data) {
        setFormSuccess(`Transfer ${res.data.transfer_number} dispatched successfully.`);
        setTransferItems([]);
        setTransferNotes('');
        setIsFormOpen(false);
        loadTransfers();
      } else {
        setFormError(res.error || 'Failed to dispatch transfer.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage ②: Received Shop Approval
  const handleReceiveTransfer = async (transfer: StockTransfer) => {
    if (!confirm(`Confirm physical receipt of all items for ${transfer.transfer_number}?`)) {
      return;
    }

    try {
      const res = await transfersApi.receiveTransfer(transfer.id, currentUserName);
      if (res.success) {
        loadTransfers();
        if (selectedTransfer?.id === transfer.id) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'RECEIVED', received_by: currentUserName } : null));
        }
      } else {
        alert(res.error || 'Failed to confirm receipt.');
      }
    } catch (err: any) {
      alert(err.message || 'Error confirming receipt.');
    }
  };

  // Stage ③: Admin Final Approval (Atomic Stock Update)
  const handleApproveTransfer = async (transfer: StockTransfer) => {
    if (!isOwnerOrAdmin) {
      alert('Only Admin / Owner users can execute final stock approval.');
      return;
    }

    if (
      !confirm(
        `Execute final Admin Approval for ${transfer.transfer_number}?\n\nThis will atomically deduct ${transfer.total_quantity} units from ${transfer.from_branch_name} and add them to ${transfer.to_branch_name}.`
      )
    ) {
      return;
    }

    try {
      const res = await transfersApi.approveTransfer(transfer.id, currentUserName);
      if (res.success) {
        loadTransfers();
        if (selectedTransfer?.id === transfer.id) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'APPROVED', approved_by: currentUserName } : null));
        }
      } else {
        alert(res.error || 'Failed to approve transfer.');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing admin approval.');
    }
  };

  // Reject Transfer handler
  const handleRejectTransfer = async () => {
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
        loadTransfers();
        if (selectedTransfer?.id === rejectingTransferId) {
          setSelectedTransfer((prev) => (prev ? { ...prev, status: 'REJECTED' } : null));
        }
      } else {
        alert(res.error || 'Failed to reject transfer.');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting transfer.');
    } finally {
      setIsRejecting(false);
    }
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const total = transfers.length;
    const dispatched = transfers.filter((t) => t.status === 'DISPATCHED').length;
    const received = transfers.filter((t) => t.status === 'RECEIVED').length;
    const approved = transfers.filter((t) => t.status === 'APPROVED').length;
    const rejected = transfers.filter((t) => t.status === 'REJECTED').length;
    return { total, dispatched, received, approved, rejected };
  }, [transfers]);

  // Tab & search filtering
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // Tab filter
      if (activeTab !== 'ALL' && t.status !== activeTab) {
        return false;
      }

      // Search filter
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesNum = t.transfer_number.toLowerCase().includes(q);
        const matchesFrom = t.from_branch_name?.toLowerCase().includes(q);
        const matchesTo = t.to_branch_name?.toLowerCase().includes(q);
        const matchesDisp = t.dispatched_by?.toLowerCase().includes(q);
        const matchesItems = t.items?.some(
          (i) => i.product_name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)
        );
        if (!matchesNum && !matchesFrom && !matchesTo && !matchesDisp && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [transfers, activeTab, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg">
              <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Branch Stock Transfers
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Deegayu Weda Madhura • 3-Stage Inter-Branch Stock Movement & Audit Ledger
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadTransfers}
            disabled={isLoading}
            className="h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              setFormError(null);
              setFormSuccess(null);
            }}
            className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${
              isFormOpen
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            {isFormOpen ? (
              <>
                <X className="w-4 h-4" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>New Stock Transfer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Transfers</span>
            <Package className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-white">{kpis.total}</div>
          <p className="text-[11px] text-slate-500">All recorded movements</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/30 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center justify-between">
            <span>Stage 1: Dispatched</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{kpis.dispatched}</div>
          <p className="text-[11px] text-amber-200/60">Awaiting destination receipt</p>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center justify-between">
            <span>Stage 2: Received</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400">{kpis.received}</div>
          <p className="text-[11px] text-indigo-200/60">Awaiting Admin final approval</p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center justify-between">
            <span>Stage 3: Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{kpis.approved}</div>
          <p className="text-[11px] text-emerald-200/60">Completed & stock transferred</p>
        </div>
      </div>

      {/* NEW STOCK TRANSFER FORM (Collapsible) */}
      {isFormOpen && (
        <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl animate-scaleUp">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                New Inter-Branch Stock Transfer (Stage ① — Transfer Shop)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Dispatched by: <strong className="text-indigo-300">{currentUserName}</strong>
            </span>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateTransfer} className="space-y-5">
            {/* Branch Route Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  From Location (Origin Shop) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={fromBranchId}
                    onChange={(e) => {
                      const newFrom = e.target.value;
                      setFromBranchId(newFrom);
                      // Clear items if changing branch to prevent invalid stock
                      if (transferItems.length > 0) {
                        if (confirm('Changing origin branch will clear selected items. Proceed?')) {
                          setTransferItems([]);
                        }
                      }
                      if (toBranchId === newFrom) {
                        const alt = branches.find((b) => b.id !== newFrom);
                        if (alt) setToBranchId(alt.id);
                      }
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-1 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                </div>
              </div>

              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  To Location (Receiving Shop) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {branches
                      .filter((b) => b.id !== fromBranchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Product Search & Barcode Autocomplete */}
            <div className="relative space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Item Name / Barcode Search</span>
                {isLoadingProducts && (
                  <span className="text-indigo-400 font-normal flex items-center gap-1 text-[11px]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading available stock for origin shop...
                  </span>
                )}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Barcode className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  ref={productSearchInputRef}
                  type="text"
                  placeholder="Type product name, SKU, or scan barcode [Press Enter to add]..."
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onKeyDown={handleProductKeyDown}
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {isSearchDropdownOpen && filteredProducts.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl divide-y divide-slate-800">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.quantityOnHand <= 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-3 hover:bg-indigo-600/20 cursor-pointer flex items-center justify-between transition-colors text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-white text-sm">{p.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>SKU: {p.sku || 'N/A'}</span>
                            {p.barcode && <span>• Barcode: {p.barcode}</span>}
                          </div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <div className="font-mono font-bold text-indigo-300">
                            LKR {p.retailPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                              isOutOfStock
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            Available: {p.quantityOnHand} units
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4-Column Transfer Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold">
                      <th className="py-3 px-3.5 w-14 text-center">Number</th>
                      <th className="py-3 px-3.5">Item</th>
                      <th className="py-3 px-3.5 w-36 text-center">Count</th>
                      <th className="py-3 px-3.5 w-44 text-right">Amount (LKR)</th>
                      <th className="py-3 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {transferItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No items added yet. Search or scan barcode above to add items to this transfer.
                        </td>
                      </tr>
                    ) : (
                      transferItems.map((item, idx) => {
                        const lineAmount = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                        return (
                          <tr key={item.product_id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-white text-sm">{item.product_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                SKU: {item.sku || 'N/A'} • Unit Price: LKR{' '}
                                {item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.product_id, e.target.value)}
                                className="w-24 h-9 px-2 text-center font-mono font-bold text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                              />
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-sm text-indigo-300">
                              LKR {lineAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.product_id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Summary Footer */}
                  {transferItems.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-900 font-bold border-t-2 border-slate-700 text-slate-200">
                        <td className="py-3 px-3.5 text-center text-slate-400">Total</td>
                        <td className="py-3 px-3.5">{formTotals.totalItems} unique products</td>
                        <td className="py-3 px-3.5 text-center font-mono text-indigo-300">
                          {formTotals.totalCount} units
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-base text-emerald-400">
                          LKR {formTotals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Transfer Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Dispatch Remarks / Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Dispatched via Vehicle WP CA-1234, Driver: Jagath / Urgent Stock Request..."
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || transferItems.length === 0}
                className={`h-11 px-6 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                  transferItems.length > 0 && !isSubmitting
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Creating Dispatch Record...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Transfer Shop (Stage ① Dispatch)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER CONTROLS & TABS */}
      <div className="space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span>All Transfers</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-700 text-slate-300">
              {kpis.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DISPATCHED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'DISPATCHED'
                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending Receipt (Stage 2)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-amber-500/20 text-amber-300">
              {kpis.dispatched}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RECEIVED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'RECEIVED'
                ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pending Admin Approval (Stage 3)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-500/20 text-indigo-300">
              {kpis.received}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'APPROVED'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-emerald-500/20 text-emerald-300">
              {kpis.approved}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REJECTED')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'REJECTED'
                ? 'bg-rose-950/40 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-rose-300 hover:bg-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Rejected</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-rose-500/20 text-rose-300">
              {kpis.rejected}
            </span>
          </button>
        </div>

        {/* Search Bar & Branch Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by transfer #, route, product name, or dispatcher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="w-full sm:w-64">
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Branches (Global)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TRANSFER LEDGER LIST */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-3 bg-slate-900/50 rounded-2xl border border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
            <div className="text-sm font-semibold">Loading stock transfers ledger...</div>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            <ArrowLeftRight className="w-8 h-8 mx-auto text-slate-600" />
            <div className="text-sm font-bold text-slate-300">No Stock Transfers Found</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No transfer records match your current filter criteria. Click &quot;New Stock Transfer&quot; to initiate a movement between branches.
            </p>
          </div>
        ) : (
          filteredTransfers.map((t) => {
            const isDispatched = t.status === 'DISPATCHED';
            const isReceived = t.status === 'RECEIVED';
            const isApproved = t.status === 'APPROVED';
            const isRejected = t.status === 'REJECTED';

            return (
              <div
                key={t.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-all space-y-4 shadow-lg"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-indigo-400 font-mono font-bold text-xs flex items-center justify-center border border-slate-700">
                      {t.transfer_number.slice(-4)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-white">{t.transfer_number}</span>
                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isDispatched
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : isReceived
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              : isApproved
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {isDispatched && 'Stage 1: Dispatched'}
                          {isReceived && 'Stage 2: Received'}
                          {isApproved && 'Stage 3: Approved'}
                          {isRejected && 'Rejected'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(t.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Route Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                    <span className="text-slate-300 font-bold">{t.from_branch_name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-indigo-300 font-bold">{t.to_branch_name}</span>
                  </div>
                </div>

                {/* 3-Stage Stepper Bar */}
                <div className="grid grid-cols-3 gap-2 py-1 text-[11px]">
                  {/* Stage 1 */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                      isDispatched || isReceived || isApproved
                        ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0 truncate">
                      <div className="font-bold">① Transfer Shop</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        By {t.dispatched_by || 'Staff'}
                      </div>
                    </div>
                  </div>

                  {/* Stage 2 */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                      isReceived || isApproved
                        ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/40'
                        : isDispatched
                        ? 'bg-amber-950/20 text-amber-300 border-amber-900/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {isReceived || isApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div className="min-w-0 truncate">
                      <div className="font-bold">② Received Shop</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {t.received_by ? `By ${t.received_by}` : 'Pending Arrival'}
                      </div>
                    </div>
                  </div>

                  {/* Stage 3 */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                      isApproved
                        ? 'bg-emerald-950/20 text-emerald-300 border-emerald-900/40'
                        : isReceived
                        ? 'bg-indigo-950/20 text-indigo-300 border-indigo-900/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                    <div className="min-w-0 truncate">
                      <div className="font-bold">③ Admin Approval</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {t.approved_by ? `By ${t.approved_by}` : 'Pending Admin'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transfer Metrics & Remarks */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-4 text-slate-400">
                    <div>
                      <span>Items:</span> <strong className="text-white">{t.total_items}</strong>
                    </div>
                    <div>
                      <span>Total Units:</span>{' '}
                      <strong className="text-indigo-300 font-mono">{t.total_quantity}</strong>
                    </div>
                    <div>
                      <span>Valuation:</span>{' '}
                      <strong className="text-emerald-400 font-mono">
                        LKR {t.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTransfer(t)}
                      className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>View Items</span>
                    </button>

                    {/* Stage 2 Action: Received Shop Approval */}
                    {isDispatched && (
                      <button
                        type="button"
                        onClick={() => handleReceiveTransfer(t)}
                        className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Received Shop Approval</span>
                      </button>
                    )}

                    {/* Stage 3 Action: Admin Approval (Atomic Stock Update) */}
                    {isReceived && (
                      <>
                        {isOwnerOrAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingTransferId(t.id);
                                setRejectionReason('');
                              }}
                              className="h-8 px-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 text-xs font-bold transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveTransfer(t)}
                              className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Admin Approval (Execute Stock Movement)</span>
                            </button>
                          </>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Awaiting Admin Approval
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {t.notes && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80 italic">
                    <span className="text-slate-500 font-bold not-italic mr-1.5">Remarks:</span>
                    &ldquo;{t.notes}&rdquo;
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* DETAIL INSPECTION MODAL */}
      {selectedTransfer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-white">{selectedTransfer.transfer_number}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {selectedTransfer.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {selectedTransfer.from_branch_name} → {selectedTransfer.to_branch_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransfer(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Timeline Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Stage 1: Dispatched</span>
                  <strong className="text-white block mt-0.5">{selectedTransfer.dispatched_by || 'Staff'}</strong>
                  <span className="text-[11px] text-slate-400">
                    {selectedTransfer.dispatched_at
                      ? new Date(selectedTransfer.dispatched_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Stage 2: Received</span>
                  <strong className="text-white block mt-0.5">{selectedTransfer.received_by || 'Pending'}</strong>
                  <span className="text-[11px] text-slate-400">
                    {selectedTransfer.received_at
                      ? new Date(selectedTransfer.received_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Stage 3: Admin Approval</span>
                  <strong className="text-white block mt-0.5">{selectedTransfer.approved_by || 'Pending'}</strong>
                  <span className="text-[11px] text-slate-400">
                    {selectedTransfer.approved_at
                      ? new Date(selectedTransfer.approved_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-center">Transfer Qty</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {selectedTransfer.items && selectedTransfer.items.length > 0 ? (
                      selectedTransfer.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-900/50">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{item.product_name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{item.sku || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            LKR {item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-300">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            LKR {item.line_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">
                          No items recorded for this transfer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 font-bold border-t border-slate-700 text-white">
                      <td colSpan={4} className="py-3 px-3 text-right text-slate-400">
                        Total Units & Valuation:
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-300">
                        {selectedTransfer.total_quantity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-emerald-400">
                        LKR {selectedTransfer.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedTransfer.notes && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Transfer Remarks
                  </span>
                  <p className="italic">&ldquo;{selectedTransfer.notes}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Footer Actions in Modal */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Created on {new Date(selectedTransfer.created_at).toLocaleDateString()}
              </span>

              <div className="flex items-center gap-2">
                {selectedTransfer.status === 'DISPATCHED' && (
                  <button
                    type="button"
                    onClick={() => handleReceiveTransfer(selectedTransfer)}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Confirm Shop Receipt
                  </button>
                )}

                {selectedTransfer.status === 'RECEIVED' && isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => handleApproveTransfer(selectedTransfer)}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Execute Admin Approval
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedTransfer(null)}
                  className="h-9 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingTransferId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4 animate-scaleUp text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Reject Stock Transfer</h3>
                <p className="text-xs text-slate-400">Provide an optional reason for the audit ledger.</p>
              </div>
            </div>

            <textarea
              rows={3}
              placeholder="e.g., Damaged items during transit / Discrepancy in item counts..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingTransferId(null)}
                className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectTransfer}
                disabled={isRejecting}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
