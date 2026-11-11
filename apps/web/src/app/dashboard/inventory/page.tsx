'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  PackageCheck,
  TrendingUp,
  Search,
  Filter,
  ArrowRightLeft,
  Sliders,
  History,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
  Clock,
  Send,
  Download,
  Building2,
  ChevronRight,
  Warehouse,
} from 'lucide-react';
import type {
  StockLevelDto,
  StockMovementDto,
  StockTransferDto,
  InventoryTelemetryDto,
  StockAdjustmentReason,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { inventoryApi } from '../../../lib/api-client';

// Mock sample inventory items for offline preview or immediate presentation
const SAMPLE_STOCK_LEVELS: StockLevelDto[] = [
  {
    id: 'sl-1',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-main',
    warehouseName: 'Central Logistics Hub',
    branchId: 'br-colombo',
    branchName: 'Colombo Flagship Store',
    productId: 'p-1',
    productName: 'Organic Basmati Rice (5kg Bag)',
    sku: 'GRO-RIC-001',
    barcode: '8901234567890',
    categoryName: 'Groceries',
    unit: 'bags',
    quantityOnHand: 48,
    quantityReserved: 4,
    reorderPoint: 15,
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sl-2',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-main',
    warehouseName: 'Central Logistics Hub',
    branchId: 'br-colombo',
    branchName: 'Colombo Flagship Store',
    productId: 'p-2',
    productName: 'Ceylon Pure Cinnamon Quills (100g)',
    sku: 'GRO-SP-002',
    barcode: '8901234567891',
    categoryName: 'Groceries',
    unit: 'packs',
    quantityOnHand: 8,
    quantityReserved: 0,
    reorderPoint: 10,
    status: 'LOW_STOCK',
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'sl-3',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-kandy',
    warehouseName: 'Kandy Express Storage',
    branchId: 'br-kandy',
    branchName: 'Kandy Branch',
    productId: 'p-3',
    productName: 'Wireless Bluetooth Earbuds Pro',
    sku: 'ELE-EAR-003',
    barcode: '8901234567892',
    categoryName: 'Electronics',
    unit: 'pcs',
    quantityOnHand: 0,
    quantityReserved: 0,
    reorderPoint: 5,
    status: 'OUT_OF_STOCK',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'sl-4',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-main',
    warehouseName: 'Central Logistics Hub',
    branchId: 'br-colombo',
    branchName: 'Colombo Flagship Store',
    productId: 'p-4',
    productName: 'Heavy Duty Cordless Drill 20V',
    sku: 'HDW-DRL-005',
    barcode: '8901234567894',
    categoryName: 'Hardware',
    unit: 'kits',
    quantityOnHand: 14,
    quantityReserved: 2,
    reorderPoint: 4,
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sl-5',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-kandy',
    warehouseName: 'Kandy Express Storage',
    branchId: 'br-kandy',
    branchName: 'Kandy Branch',
    productId: 'p-5',
    productName: 'Paracetamol Tablets 500mg (10x10)',
    sku: 'PHM-MED-007',
    barcode: '8901234567896',
    categoryName: 'Pharmacy',
    unit: 'boxes',
    quantityOnHand: 85,
    quantityReserved: 0,
    reorderPoint: 20,
    status: 'IN_STOCK',
    updatedAt: new Date().toISOString(),
  },
];

const SAMPLE_MOVEMENTS: StockMovementDto[] = [
  {
    id: 'sm-1',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-main',
    warehouseName: 'Central Logistics Hub',
    productId: 'p-1',
    productName: 'Organic Basmati Rice (5kg Bag)',
    sku: 'GRO-RIC-001',
    movementType: 'SALE',
    quantity: -2,
    balanceBefore: 50,
    balanceAfter: 48,
    referenceId: 'INV-2026-00042',
    notes: 'POS Checkout Sale',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sm-2',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-main',
    warehouseName: 'Central Logistics Hub',
    productId: 'p-4',
    productName: 'Heavy Duty Cordless Drill 20V',
    sku: 'HDW-DRL-005',
    movementType: 'TRANSFER_DISPATCH',
    quantity: -5,
    balanceBefore: 19,
    balanceAfter: 14,
    referenceId: 'TRF-20261109-A92B',
    notes: 'Dispatched to Kandy Express Storage',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'sm-3',
    tenantId: 'demo-tenant',
    warehouseId: 'wh-main',
    warehouseName: 'Central Logistics Hub',
    productId: 'p-2',
    productName: 'Ceylon Pure Cinnamon Quills (100g)',
    sku: 'GRO-SP-002',
    movementType: 'DAMAGE_LOSS',
    quantity: -2,
    balanceBefore: 10,
    balanceAfter: 8,
    referenceId: 'ADJ-WATER-LEAK',
    notes: 'Damaged by humidity moisture',
    createdAt: new Date(Date.now() - 28800000).toISOString(),
  },
];

export default function InventoryPage() {
  const { hasPermission } = useTenantBranch();

  // Active View Tabs: 'levels' | 'transfers'
  const [activeTab, setActiveTab] = useState<'levels' | 'transfers'>('levels');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Data States
  const [stockLevels, setStockLevels] = useState<StockLevelDto[]>(SAMPLE_STOCK_LEVELS);
  const [movements, setMovements] = useState<StockMovementDto[]>(SAMPLE_MOVEMENTS);
  const [transfers, setTransfers] = useState<StockTransferDto[]>([]);
  const [telemetry, setTelemetry] = useState<InventoryTelemetryDto>({
    totalItemsTracked: 5,
    lowStockAlertsCount: 1,
    outOfStockCount: 1,
    totalStockUnits: 155,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals / Drawers
  const [adjustModalItem, setAdjustModalItem] = useState<StockLevelDto | null>(null);
  const [adjustCountedQty, setAdjustCountedQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<StockAdjustmentReason>('PHYSICAL_COUNT');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceWh, setTransferSourceWh] = useState('wh-main');
  const [transferTargetWh, setTransferTargetWh] = useState('wh-kandy');
  const [transferProductId, setTransferProductId] = useState('p-1');
  const [transferQty, setTransferQty] = useState(5);
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Movement Ledger Drawer
  const [ledgerItem, setLedgerItem] = useState<StockLevelDto | null>(null);

  // Fetch Inventory Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [levelsRes, telemRes, movRes] = await Promise.all([
        inventoryApi.getStockLevels(),
        inventoryApi.getTelemetry(),
        inventoryApi.getMovements({ limit: 50 }),
      ]);

      if (levelsRes.data?.items && levelsRes.data.items.length > 0) {
        setStockLevels(levelsRes.data.items);
      }
      if (telemRes.data) {
        setTelemetry(telemRes.data);
      }
      if (movRes.data?.items && movRes.data.items.length > 0) {
        setMovements(movRes.data.items);
      }
    } catch {
      // Retain sample data on fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockLevels.forEach((item) => {
      if (item.categoryName) set.add(item.categoryName);
    });
    return Array.from(set);
  }, [stockLevels]);

  // Warehouses list
  const warehouses = useMemo(() => {
    const map = new Map<string, string>();
    stockLevels.forEach((item) => {
      map.set(item.warehouseId, item.warehouseName || 'Main Storage');
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [stockLevels]);

  // Filtered Stock Levels
  const filteredLevels = useMemo(() => {
    return stockLevels.filter((item) => {
      if (selectedWarehouse !== 'ALL' && item.warehouseId !== selectedWarehouse) return false;
      if (selectedCategory !== 'ALL' && item.categoryName !== selectedCategory) return false;
      if (lowStockOnly && item.status === 'IN_STOCK') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.productName.toLowerCase().includes(q);
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchBarcode = item.barcode ? item.barcode.includes(q) : false;
        return matchName || matchSku || matchBarcode;
      }
      return true;
    });
  }, [stockLevels, selectedWarehouse, selectedCategory, lowStockOnly, searchQuery]);

  // Handle Quick Adjustment
  const handleOpenAdjustment = (item: StockLevelDto) => {
    setAdjustModalItem(item);
    setAdjustCountedQty(item.quantityOnHand);
    setAdjustReason('PHYSICAL_COUNT');
    setAdjustNotes('');
  };

  const submitAdjustment = async () => {
    if (!adjustModalItem) return;
    setIsSubmittingAdjust(true);

    try {
      await inventoryApi.createAdjustment({
        warehouseId: adjustModalItem.warehouseId,
        reason: adjustReason,
        notes: adjustNotes || `Quick adjusted to ${adjustCountedQty} ${adjustModalItem.unit || 'units'}`,
        items: [
          {
            productId: adjustModalItem.productId,
            variantId: adjustModalItem.variantId,
            countedQuantity: Number(adjustCountedQty),
          },
        ],
      });

      setFeedback({
        type: 'success',
        message: `Updated ${adjustModalItem.productName} stock to ${adjustCountedQty} ${adjustModalItem.unit || 'units'}.`,
      });

      // Optimistic update
      setStockLevels((prev) =>
        prev.map((s) =>
          s.id === adjustModalItem.id
            ? {
                ...s,
                quantityOnHand: Number(adjustCountedQty),
                status:
                  Number(adjustCountedQty) <= 0
                    ? 'OUT_OF_STOCK'
                    : Number(adjustCountedQty) <= s.reorderPoint
                      ? 'LOW_STOCK'
                      : 'IN_STOCK',
              }
            : s,
        ),
      );

      setAdjustModalItem(null);
      loadData();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to record stock adjustment';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmittingAdjust(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Handle Inter-Branch Transfer Submit
  const submitTransfer = async () => {
    if (transferSourceWh === transferTargetWh) {
      setFeedback({ type: 'error', message: 'Source and target warehouses must be different.' });
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const res = await inventoryApi.createTransfer({
        sourceWarehouseId: transferSourceWh,
        targetWarehouseId: transferTargetWh,
        notes: transferNotes || 'Inter-branch stock transfer',
        items: [
          {
            productId: transferProductId,
            quantity: Number(transferQty),
          },
        ],
      });

      const newTrf = res.data;
      if (newTrf) {
        setTransfers((prev) => [newTrf, ...prev]);
      }

      setFeedback({
        type: 'success',
        message: `Transfer #${newTrf?.trackingNumber || 'Created'} initiated in PENDING status.`,
      });
      setShowTransferModal(false);
      setActiveTab('transfers');
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to initiate transfer';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmittingTransfer(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Dispatch Transfer
  const handleDispatch = async (transferId: string) => {
    try {
      const res = await inventoryApi.dispatchTransfer(transferId);
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? res.data || { ...t, status: 'DISPATCHED' } : t)),
      );
      setFeedback({ type: 'success', message: 'Transfer dispatched. Source inventory decremented.' });
      loadData();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to dispatch transfer';
      setFeedback({ type: 'error', message: errorMsg });
    }
  };

  // Receive Transfer
  const handleReceive = async (transferId: string) => {
    try {
      const res = await inventoryApi.receiveTransfer(transferId);
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? res.data || { ...t, status: 'RECEIVED' } : t)),
      );
      setFeedback({ type: 'success', message: 'Transfer received. Destination inventory updated.' });
      loadData();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to receive transfer';
      setFeedback({ type: 'error', message: errorMsg });
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-[#F4F6F9] text-slate-900 pb-12">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Multi-Branch Inventory & Stock Engine
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Decimal-safe real-time stock balances, branch transfers, and immutable audit movements
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync
            </button>

            {hasPermission('inventory:manage') && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Inter-Branch Transfer
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* 1. Telemetry KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Items Tracked */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Items Tracked</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{telemetry.totalItemsTracked}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Across all branches & warehouses</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <PackageCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Total Stock Units */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stock Units</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{telemetry.totalStockUnits.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Decimal-safe active inventory</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{telemetry.lowStockAlertsCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">At or below reorder threshold</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          {/* Out of Stock */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Out of Stock</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{telemetry.outOfStockCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Depleted inventory</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <X className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('levels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'levels'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Boxes className="w-4 h-4" />
            Stock On Hand ({filteredLevels.length})
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'transfers'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Branch Transfers ({transfers.length})
          </button>
        </div>

        {/* Tab 1: Stock On Hand Table */}
        {activeTab === 'levels' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by product name, SKU, or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Warehouse Filter */}
                <div className="flex items-center gap-1.5">
                  <Warehouse className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Warehouses</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Low Stock Filter Pill */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    lowStockOnly
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Low Stock Only
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Product & SKU</th>
                    <th className="py-3.5 px-4">Warehouse & Branch</th>
                    <th className="py-3.5 px-4 text-right">Stock On Hand</th>
                    <th className="py-3.5 px-4 text-right">Reserved</th>
                    <th className="py-3.5 px-4 text-right">Reorder Pt</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLevels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No inventory records matching your query criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLevels.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="text-sm font-semibold text-slate-900 leading-snug">{item.productName}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                            <span>SKU: {item.sku}</span>
                            {item.barcode && <span>• {item.barcode}</span>}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700">
                          <div className="font-medium text-slate-900 flex items-center gap-1.5 text-sm">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {item.warehouseName || 'Main Storage'}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {item.branchName || 'Primary Branch'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-slate-950 text-sm md:text-base font-mono">
                          {item.quantityOnHand} <span className="text-xs font-normal text-slate-500 font-sans">{item.unit || 'pcs'}</span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-600 font-mono text-sm">
                          {item.quantityReserved} <span className="text-xs font-normal text-slate-500 font-sans">{item.unit || 'pcs'}</span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 font-medium text-sm">
                          {item.reorderPoint}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {item.status === 'IN_STOCK' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              In Stock
                            </span>
                          )}
                          {item.status === 'LOW_STOCK' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Low Stock
                            </span>
                          )}
                          {item.status === 'OUT_OF_STOCK' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setLedgerItem(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
                            title="View Stock Movement Audit History"
                          >
                            <History className="w-3.5 h-3.5 text-slate-500" />
                            Ledger
                          </button>

                          {hasPermission('inventory:manage') && (
                            <button
                              onClick={() => handleOpenAdjustment(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all border border-blue-200"
                              title="Apply physical count adjustment or damage deduction"
                            >
                              <Sliders className="w-3.5 h-3.5 text-blue-600" />
                              Adjust
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Branch Transfers Table */}
        {activeTab === 'transfers' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Inter-Branch Stock Transfers</h3>
                <p className="text-xs text-slate-500">Track pending, dispatched, and received stock consignments</p>
              </div>

              {hasPermission('inventory:manage') && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Transfer
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Tracking #</th>
                    <th className="py-3.5 px-4">Source Warehouse</th>
                    <th className="py-3.5 px-4">Destination Warehouse</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No active branch transfers recorded. Click &quot;New Transfer&quot; to initiate stock movement.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((trf) => (
                      <tr key={trf.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 text-sm">
                          {trf.trackingNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 text-sm">
                          {trf.sourceWarehouseName || 'Source Storage'}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 text-sm">
                          {trf.targetWarehouseName || 'Destination Storage'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              trf.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : trf.status === 'DISPATCHED'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : trf.status === 'RECEIVED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {trf.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">
                          {new Date(trf.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {trf.status === 'PENDING' && hasPermission('inventory:manage') && (
                            <button
                              onClick={() => handleDispatch(trf.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Dispatch
                            </button>
                          )}
                          {trf.status === 'DISPATCHED' && hasPermission('inventory:manage') && (
                            <button
                              onClick={() => handleReceive(trf.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Receive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Quick Stock Adjustment */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Stock Adjustment</h3>
                  <p className="text-xs text-slate-500">Update on-hand count with immutable ledger tracking</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalItem(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Item Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
              <div className="text-xs font-bold text-slate-500 uppercase">Selected Item</div>
              <div className="text-sm font-bold text-slate-800">{adjustModalItem.productName}</div>
              <div className="text-xs text-slate-500 font-mono">
                SKU: {adjustModalItem.sku} • Warehouse: {adjustModalItem.warehouseName}
              </div>
              <div className="text-xs text-slate-600 pt-1">
                Current On-Hand Balance:{' '}
                <span className="font-bold text-slate-900">
                  {adjustModalItem.quantityOnHand} {adjustModalItem.unit || 'units'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Adjustment Reason
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as StockAdjustmentReason)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="PHYSICAL_COUNT">Physical Count / Stocktaking Discrepancy</option>
                  <option value="DAMAGED">Damaged Goods (Damage Loss)</option>
                  <option value="EXPIRED">Expired Inventory</option>
                  <option value="LOST_STOLEN">Lost or Stolen Item</option>
                  <option value="CORRECTION">Manual Inventory Correction</option>
                </select>
              </div>

              {/* Counted Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  New Actual Counted Quantity
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={adjustCountedQty}
                    onChange={(e) => setAdjustCountedQty(Number(e.target.value))}
                    className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-500">{adjustModalItem.unit || 'pcs'}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Delta Discrepancy:{' '}
                  <span
                    className={`font-bold ${
                      adjustCountedQty - adjustModalItem.quantityOnHand >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {adjustCountedQty - adjustModalItem.quantityOnHand >= 0 ? '+' : ''}
                    {(adjustCountedQty - adjustModalItem.quantityOnHand).toFixed(3)}{' '}
                    {adjustModalItem.unit || 'units'}
                  </span>
                </p>
              </div>

              {/* Mandatory Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Audit Notes / Reason Description
                </label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Enter audit explanation (e.g. Month-end count, damaged water box)..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustModalItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdjustment}
                disabled={isSubmittingAdjust}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                {isSubmittingAdjust ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Adjustment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Inter-Branch Stock Transfer */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Inter-Branch Transfer</h3>
                  <p className="text-xs text-slate-500">Consign inventory between branches with verified receipts</p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Source Warehouse */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Source Warehouse (Dispatch From)
                </label>
                <select
                  value={transferSourceWh}
                  onChange={(e) => setTransferSourceWh(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Warehouse */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Destination Warehouse (Consign To)
                </label>
                <select
                  value={transferTargetWh}
                  onChange={(e) => setTransferTargetWh(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Select Product to Transfer
                </label>
                <select
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                >
                  {stockLevels.map((item) => (
                    <option key={item.productId} value={item.productId}>
                      {item.productName} ({item.sku}) - SOH: {item.quantityOnHand}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Transfer Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Notes
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Replenishment consignment..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTransfer}
                disabled={isSubmittingTransfer}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                {isSubmittingTransfer ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Create Transfer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: Immutable Stock Movement Ledger */}
      {ledgerItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Stock Movement Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium">Immutable audit trail of stock increases & decreases</p>
                </div>
              </div>
              <button
                onClick={() => setLedgerItem(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Summary */}
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Information</div>
              <div className="text-base font-bold text-slate-900 mt-1">{ledgerItem.productName}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-mono">
                <span>SKU: {ledgerItem.sku}</span>
                <span>• Warehouse: {ledgerItem.warehouseName}</span>
                <span className="font-bold text-slate-800">SOH: {ledgerItem.quantityOnHand} {ledgerItem.unit || 'pcs'}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {movements
                .filter((m) => m.productId === ledgerItem.productId || !ledgerItem.productId)
                .map((mov) => (
                  <div
                    key={mov.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:shadow-sm transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            mov.movementType === 'SALE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : mov.movementType === 'TRANSFER_DISPATCH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : mov.movementType === 'TRANSFER_RECEIPT'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : mov.movementType === 'DAMAGE_LOSS'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {mov.movementType}
                        </span>
                        {mov.referenceId && (
                          <span className="text-[11px] font-mono font-semibold text-slate-600">
                            #{mov.referenceId}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-sm font-black ${
                          mov.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">{mov.notes || 'No description provided'}</div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1 font-mono">
                        <span>Balance: {mov.balanceBefore}</span>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="font-bold text-slate-700">{mov.balanceAfter}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(mov.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

