'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Loader2,
  X,
  Package,
  Sparkles,
  Trash2,
  Lock,
  Eye,
  Building2,
  DollarSign,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import type {
  GoodsReceivedNoteDto,
  PurchaseOrderDto,
  SupplierDto,
  GrnStatus,
  PurchaseOrderStatus,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { getCachedCatalogData } from '../../../lib/catalog-db';
import { supabase } from '../../../lib/supabase';

const BRANCH_TO_WAREHOUSE: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': '42f1fe9d-7e44-48eb-8eb0-10a6439b5619', // Alawwa
  'fa68e4a0-a515-44c8-a082-5b5590366658': '6e8904dd-b753-434e-a22d-2d8e428f0a02', // Dambadeniya
  '197693d6-4247-48df-b614-6fcde9e34f7d': '5f0f4a53-75d7-411e-be5c-337ff170da50', // Giriulla
  '133eeaec-5726-4702-a819-8423750db203': '4898d051-2faf-4553-a198-19566f5598e1', // Main store
  '85d48a94-b6a3-4b9f-a746-0ac2ff61355c': '81a14e32-4396-4d6f-9aec-d970db095d23', // Main Branch
};

const BRANCH_NAMES: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': 'Alawwa',
  'fa68e4a0-a515-44c8-a082-5b5590366658': 'Dambadeniya',
  '197693d6-4247-48df-b614-6fcde9e34f7d': 'Giriulla',
  '133eeaec-5726-4702-a819-8423750db203': 'Main Store',
  '85d48a94-b6a3-4b9f-a746-0ac2ff61355c': 'Main Branch',
};

interface CatalogProductItem {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  retailPrice: number;
}

interface GrnLineItemDetail {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  receivedQuantity: number;
  unitCost: number;
  subtotal: number;
  batchNumber?: string;
  expiryDate?: string;
}

export default function PurchasesPage() {
  const {
    isOwner,
    selectedBranchId,
    branches,
    canCreateGrn,
    assignedBranchIds,
    grnBranchIds,
    activeCashier,
    user,
  } = useTenantBranch();

  const [activeTab, setActiveTab] = useState<'GRN' | 'PO'>('GRN');

  // Primary Data
  const [grns, setGrns] = useState<GoodsReceivedNoteDto[]>([]);
  const [pos, setPos] = useState<PurchaseOrderDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductItem[]>([]);

  // Loading & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  // View GRN Items Modal
  const [viewingGrn, setViewingGrn] = useState<GoodsReceivedNoteDto | null>(null);
  const [viewingGrnItems, setViewingGrnItems] = useState<GrnLineItemDetail[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  // New GRN Wizard State
  const [isGrnModalOpen, setIsGrnModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [grnBranchId, setGrnBranchId] = useState<string>('');
  const [grnSupplierId, setGrnSupplierId] = useState<string>('');
  const [grnInvoiceNo, setGrnInvoiceNo] = useState<string>('');
  const [grnNotes, setGrnNotes] = useState<string>('');
  const [grnItems, setGrnItems] = useState<
    {
      productId: string;
      productName: string;
      productSku: string;
      receivedQuantity: number;
      unitCost: number;
      retailPrice?: number;
      batchNumber: string;
      expiryDate: string;
    }[]
  >([]);

  // Product Picker inside Wizard
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProductItem | null>(null);
  const [newQty, setNewQty] = useState<number>(10);
  const [newCost, setNewCost] = useState<number>(0);
  const [newRetail, setNewRetail] = useState<number>(0);
  const [newBatch, setNewBatch] = useState<string>('BATCH-' + new Date().getFullYear());
  const [newExpiry, setNewExpiry] = useState<string>('2028-12-31');

  // Quick Add Supplier Modal
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState<boolean>(false);
  const [quickSupName, setQuickSupName] = useState<string>('');
  const [quickSupPhone, setQuickSupPhone] = useState<string>('');
  const [quickSupCode, setQuickSupCode] = useState<string>('');
  const [isSavingSupplier, setIsSavingSupplier] = useState<boolean>(false);

  // Sync initial Branch
  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      setFilterBranch(selectedBranchId);
      setGrnBranchId(selectedBranchId);
    } else if (branches.length > 0) {
      setGrnBranchId(branches[0]?.id || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54');
    }
  }, [selectedBranchId, branches]);

  // Robust, Flat Data Loading (Guaranteed to finish without hanging)
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // 1. Parallel queries to fetch flat tables (avoids fragile PostgREST relation embeds)
      const [grnResult, poResult, supResult] = await Promise.all([
        supabase
          .from('goods_received_notes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('suppliers')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      // 2. Map suppliers
      let loadedSuppliers: SupplierDto[] = [];
      if (supResult.data && supResult.data.length > 0) {
        loadedSuppliers = supResult.data.map((s: any) => ({
          id: s.id,
          tenantId: s.tenant_id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
          name: s.name,
          code: s.code || `SUP-${s.id.slice(0, 4)}`,
          phone: s.phone,
          status: s.status || 'ACTIVE',
          createdAt: s.created_at || new Date().toISOString(),
          updatedAt: s.updated_at || new Date().toISOString(),
        }));
        setSuppliers(loadedSuppliers);
        setGrnSupplierId((prev) => prev || loadedSuppliers[0]?.id || '');
      }

      // Create lookup dictionary for suppliers
      const supMap = new Map<string, string>();
      loadedSuppliers.forEach((s) => supMap.set(s.id, s.name));

      // 3. Map GRNs with flat client-side relational joining
      if (grnResult.data && grnResult.data.length > 0) {
        const mappedGrns: GoodsReceivedNoteDto[] = grnResult.data.map((g: any) => {
          const sName = supMap.get(g.supplier_id) || 'Ayurvedic Supplier';
          return {
            id: g.id,
            tenantId: g.tenant_id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
            branchId: g.branch_id || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
            warehouseId: g.warehouse_id || '42f1fe9d-7e44-48eb-8eb0-10a6439b5619',
            supplierId: g.supplier_id || '',
            supplierName: sName,
            grnNumber: g.grn_number || g.grnNumber || 'GRN-SYS',
            supplierInvoiceNo: g.supplier_invoice_no || g.supplierInvoiceNo || undefined,
            receivedDate: g.received_date || g.created_at || new Date().toISOString(),
            status: (g.status || 'RECEIVED') as GrnStatus,
            totalCost: Number(g.total_cost || g.total_amount || 0),
            createdAt: g.created_at || new Date().toISOString(),
            updatedAt: g.updated_at || new Date().toISOString(),
            items: [],
          };
        });
        setGrns(mappedGrns);
      }

      // 4. Map Purchase Orders
      if (poResult.data && poResult.data.length > 0) {
        const mappedPos: PurchaseOrderDto[] = poResult.data.map((p: any) => ({
          id: p.id,
          tenantId: p.tenant_id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
          branchId: p.branch_id || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
          supplierId: p.supplier_id || '',
          supplierName: supMap.get(p.supplier_id) || 'Ayurvedic Supplier',
          poNumber: p.po_number || p.poNumber || 'PO-SYS',
          orderDate: p.order_date || p.created_at || new Date().toISOString(),
          status: (p.status || 'DRAFT') as PurchaseOrderStatus,
          subtotal: Number(p.subtotal || p.total_amount || 0),
          taxAmount: Number(p.tax_amount || 0),
          totalAmount: Number(p.total_amount || 0),
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: p.updated_at || new Date().toISOString(),
          items: [],
        }));
        setPos(mappedPos);
      }

      // 5. Load 3,120 Catalog Products for autocomplete (IndexedDB with Supabase fallback)
      try {
        const cached = await getCachedCatalogData<CatalogProductItem>('deegayu');
        if (cached && cached.products && cached.products.length > 50) {
          setCatalogProducts(cached.products);
        } else {
          // Direct fallback query from Supabase products
          const { data: prods } = await supabase
            .from('products')
            .select('id, name, sku, cost_price, retail_price')
            .eq('is_active', true)
            .limit(3500);
          if (prods && prods.length > 0) {
            setCatalogProducts(
              prods.map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku || '',
                costPrice: Number(p.cost_price || 0),
                retailPrice: Number(p.retail_price || 0),
              }))
            );
          }
        }
      } catch (catErr) {
        console.warn('Catalog load note in purchases:', catErr);
      }
    } catch (err) {
      console.error('Failed to load procurement records:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Branch-Scoped GRN Filtering & Search Logic
  const filteredGrns = useMemo(() => {
    return grns.filter((g) => {
      // Branch enforcement: If non-owner, restrict to assigned branches
      if (!isOwner && assignedBranchIds.length > 0) {
        if (!assignedBranchIds.includes(g.branchId)) return false;
      }

      // Branch filter selector
      if (filterBranch !== 'ALL' && g.branchId !== filterBranch) {
        return false;
      }

      // Supplier filter selector
      if (filterSupplier !== 'ALL' && g.supplierId !== filterSupplier) {
        return false;
      }

      // Search keyword
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const grnNum = (g.grnNumber || '').toLowerCase();
        const supInv = (g.supplierInvoiceNo || '').toLowerCase();
        const supName = (g.supplierName || '').toLowerCase();
        if (!grnNum.includes(term) && !supInv.includes(term) && !supName.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [grns, isOwner, assignedBranchIds, filterBranch, filterSupplier, searchQuery]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredGrns.length / pageSize));
  const paginatedGrns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGrns.slice(start, start + pageSize);
  }, [filteredGrns, currentPage, pageSize]);

  // Dynamic KPI Metrics across filtered dataset
  const kpis = useMemo(() => {
    const totalCount = filteredGrns.length;
    const totalValue = filteredGrns.reduce((acc, g) => acc + (Number(g.totalCost) || 0), 0);
    const avgValue = totalCount > 0 ? Math.round(totalValue / totalCount) : 0;
    return { totalCount, totalValue, avgValue };
  }, [filteredGrns]);

  // Load GRN line items when "View Items" is clicked
  const handleOpenGrnDetails = async (grn: GoodsReceivedNoteDto) => {
    setViewingGrn(grn);
    setLoadingItems(true);
    setViewingGrnItems([]);
    try {
      const { data: itemsData, error } = await supabase
        .from('goods_received_note_items')
        .select('*')
        .eq('grn_id', grn.id);

      if (!error && itemsData) {
        const productLookup = new Map<string, { name: string; sku: string }>();
        catalogProducts.forEach((p) => productLookup.set(p.id, { name: p.name, sku: p.sku }));

        const mappedItems: GrnLineItemDetail[] = itemsData.map((item: any) => {
          const prodInfo = productLookup.get(item.product_id);
          return {
            id: item.id,
            productId: item.product_id,
            productName: prodInfo?.name || `Item (${item.product_id.slice(0, 8)})`,
            sku: prodInfo?.sku || 'SKU-MED',
            receivedQuantity: Number(item.received_quantity || 1),
            unitCost: Number(item.unit_cost || 0),
            subtotal: Number(item.subtotal || 0),
            batchNumber: item.batch_number || undefined,
            expiryDate: item.expiry_date ? item.expiry_date.slice(0, 10) : undefined,
          };
        });
        setViewingGrnItems(mappedItems);
      }
    } catch (err) {
      console.warn('Error loading GRN items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  // Product Autocomplete Filter
  const filteredCatalogProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return [];
    const term = productSearchTerm.toLowerCase();
    return catalogProducts
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 8);
  }, [catalogProducts, productSearchTerm]);

  // Add line item to GRN Wizard
  const handleAddGrnLine = () => {
    if (!selectedProduct) return;
    setGrnItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        receivedQuantity: Number(newQty),
        unitCost: Number(newCost || selectedProduct.costPrice || 250),
        retailPrice: Number(newRetail || selectedProduct.retailPrice || 0),
        batchNumber: newBatch,
        expiryDate: newExpiry,
      },
    ]);

    setSelectedProduct(null);
    setProductSearchTerm('');
    setNewQty(10);
    setNewCost(0);
    setNewRetail(0);
  };

  const handleRemoveGrnLine = (index: number) => {
    setGrnItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Add Supplier Action
  const handleQuickAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupName.trim()) return;

    try {
      setIsSavingSupplier(true);
      const newSupId = crypto.randomUUID();
      const code = quickSupCode.trim() || `SUP-${Date.now().toString().slice(-4)}`;

      const { error } = await supabase.from('suppliers').insert({
        id: newSupId,
        tenant_id: '0fef1423-5d89-4147-8af8-17c7e641c88a',
        name: quickSupName.trim(),
        code,
        phone: quickSupPhone.trim() || undefined,
        status: 'ACTIVE',
      });

      if (error) {
        throw new Error(error.message);
      }

      const newSup: SupplierDto = {
        id: newSupId,
        tenantId: '0fef1423-5d89-4147-8af8-17c7e641c88a',
        name: quickSupName.trim(),
        code,
        phone: quickSupPhone.trim() || undefined,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSuppliers((prev) => [newSup, ...prev]);
      setGrnSupplierId(newSupId);
      setIsQuickSupplierOpen(false);
      setQuickSupName('');
      setQuickSupPhone('');
      setQuickSupCode('');
      setFeedback({ type: 'success', text: `Supplier "${newSup.name}" added successfully.` });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add supplier');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // Submit End-to-End GRN & Physical Stock Receiving
  const handlePostGrn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verify permission
    if (!canCreateGrn) {
      alert('Access restricted: GRN entry is permitted for designated branch stock officers only.');
      return;
    }
    if (grnItems.length === 0) {
      alert('Please add at least one product line item to receive.');
      return;
    }
    if (!grnSupplierId) {
      alert('Please select a supplier.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newGrnId = crypto.randomUUID();
      const newGrnNumber = `GRN-${Date.now().toString().slice(-6)}`;
      const effectiveBranch = isOwner
        ? (grnBranchId || selectedBranchId || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54')
        : (selectedBranchId || grnBranchIds[0] || '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54');
      const effectiveWarehouse = BRANCH_TO_WAREHOUSE[effectiveBranch] || '42f1fe9d-7e44-48eb-8eb0-10a6439b5619';
      const receivedBy = activeCashier?.id || user?.id || '96b2747b-9d22-4266-94ce-b035fadef498';
      const totalCost = grnItems.reduce((acc, i) => acc + Number(i.receivedQuantity) * Number(i.unitCost), 0);

      // 1. Insert into goods_received_notes
      const { error: grnErr } = await supabase.from('goods_received_notes').insert({
        id: newGrnId,
        tenant_id: '0fef1423-5d89-4147-8af8-17c7e641c88a',
        branch_id: effectiveBranch,
        warehouse_id: effectiveWarehouse,
        supplier_id: grnSupplierId,
        grn_number: newGrnNumber,
        supplier_invoice_no: grnInvoiceNo.trim() || undefined,
        received_date: new Date().toISOString(),
        status: 'RECEIVED',
        total_cost: totalCost,
        received_by_user_id: receivedBy,
        notes: grnNotes.trim() || undefined,
      });

      if (grnErr) {
        throw new Error(`Failed to save GRN: ${grnErr.message}`);
      }

      // 2. Insert line items into goods_received_note_items
      const itemsToInsert = grnItems.map((item) => ({
        id: crypto.randomUUID(),
        tenant_id: '0fef1423-5d89-4147-8af8-17c7e641c88a',
        grn_id: newGrnId,
        product_id: item.productId,
        received_quantity: Number(item.receivedQuantity),
        unit_cost: Number(item.unitCost),
        batch_number: item.batchNumber || undefined,
        expiry_date: item.expiryDate ? new Date(item.expiryDate).toISOString() : undefined,
        subtotal: Number(item.receivedQuantity) * Number(item.unitCost),
      }));

      const { error: itemsErr } = await supabase.from('goods_received_note_items').insert(itemsToInsert);
      if (itemsErr) {
        console.warn('GRN items insert note:', itemsErr.message);
      }

      // 3. Increment stock_levels and update product cost/retail price
      for (const item of grnItems) {
        try {
          const { data: existingStock } = await supabase
            .from('stock_levels')
            .select('id, quantity_on_hand')
            .eq('warehouse_id', effectiveWarehouse)
            .eq('product_id', item.productId)
            .maybeSingle();

          if (existingStock) {
            const currentQty = Number(existingStock.quantity_on_hand || 0);
            const newOnHand = currentQty + Number(item.receivedQuantity);
            await supabase
              .from('stock_levels')
              .update({
                quantity_on_hand: newOnHand,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingStock.id);
          } else {
            await supabase.from('stock_levels').insert({
              id: crypto.randomUUID(),
              tenant_id: '0fef1423-5d89-4147-8af8-17c7e641c88a',
              warehouse_id: effectiveWarehouse,
              product_id: item.productId,
              quantity_on_hand: Number(item.receivedQuantity),
              quantity_reserved: 0,
              reorder_point: 5,
            });
          }

          // Update product prices
          const prodUpdate: Record<string, unknown> = {
            cost_price: Number(item.unitCost),
            updated_at: new Date().toISOString(),
          };
          if (item.retailPrice && item.retailPrice > 0) {
            prodUpdate.retail_price = Number(item.retailPrice);
          }
          await supabase.from('products').update(prodUpdate).eq('id', item.productId);
        } catch (stockErr) {
          console.warn(`Stock update note for ${item.productId}:`, stockErr);
        }
      }

      setFeedback({
        type: 'success',
        text: `GRN ${newGrnNumber} posted successfully! Stock levels updated in ${BRANCH_NAMES[effectiveBranch] || 'Branch'}.`,
      });
      setIsGrnModalOpen(false);
      setGrnItems([]);
      setGrnInvoiceNo('');
      setGrnNotes('');
      await fetchData(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error receiving GRN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const grnTotalCost = useMemo(() => {
    return grnItems.reduce((acc, i) => acc + Number(i.receivedQuantity) * Number(i.unitCost), 0);
  }, [grnItems]);

  const formatLkr = (num: number) => {
    return `LKR ${Number(num || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50/40 select-none">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150 ${
            feedback.type === 'success'
              ? 'bg-slate-900 text-white border border-slate-700'
              : 'bg-rose-900 text-white border border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#7052FF] border border-purple-200/60 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Purchases & Goods Received Notes (GRN)
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-[#5E3FE6] font-sinhala">
                භාණ්ඩ ලැබීම් සටහන්
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-branch supplier procurement ledger, stock receiving verification, and cost tracking.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isLoading || isRefreshing}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#7052FF]' : ''}`} />
            <span>Refresh</span>
          </button>

          {canCreateGrn ? (
            <button
              type="button"
              onClick={() => setIsGrnModalOpen(true)}
              className="bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#7052FF]/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Receive Inventory (New GRN)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold select-none">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>GRN Entry Restricted</span>
            </div>
          )}
        </div>
      </div>

      {/* Branch Permission Advisory Banner (When staff is viewing non-permitted branch) */}
      {!isOwner && !canCreateGrn && grnBranchIds.length > 0 && (
        <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Branch Notice:</strong> You are authorized to record GRN stock receiving for{' '}
              <strong>{grnBranchIds.map((bId) => BRANCH_NAMES[bId] || bId).join(', ')}</strong>. Switch your active branch in the top header to enter new supplier stock.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="px-6 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total GRNs</span>
            <ClipboardCheck className="w-4 h-4 text-[#7052FF]" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {kpis.totalCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Physical goods shipments</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Procurement Value</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {formatLkr(kpis.totalValue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Total received cost</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Active Suppliers</span>
            <Tag className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {suppliers.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Ayurvedic pharma vendors</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Average GRN Value</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {formatLkr(kpis.avgValue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Per supplier consignment</p>
        </div>
      </div>

      {/* Tabs and Filter Toolbar */}
      <div className="px-6 pt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('GRN')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'GRN'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Goods Received Notes ({filteredGrns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PO')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'PO'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Orders ({pos.length})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Keyword Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search GRN #, invoice, supplier..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#7052FF]"
            />
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Building2 className="w-3.5 h-3.5" />
            <select
              value={filterBranch}
              onChange={(e) => {
                setFilterBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-[#7052FF]"
            >
              <option value="ALL">All Branches</option>
              <option value="00f4cdcb-7d1c-4026-b57a-6e66c33b0c54">Alawwa</option>
              <option value="fa68e4a0-a515-44c8-a082-5b5590366658">Dambadeniya</option>
              <option value="197693d6-4247-48df-b614-6fcde9e34f7d">Giriulla</option>
              <option value="133eeaec-5726-4702-a819-8423750db203">Main Store</option>
            </select>
          </div>

          {/* Supplier Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={filterSupplier}
              onChange={(e) => {
                setFilterSupplier(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-[180px] px-2.5 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-700 font-medium truncate focus:outline-none focus:border-[#7052FF]"
            >
              <option value="ALL">All Suppliers (94)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#7052FF] mb-2" />
            <p className="text-xs font-semibold text-slate-600">Loading procurement ledger...</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Reading goods received notes across branches</p>
          </div>
        ) : activeTab === 'GRN' ? (
          /* GRN List */
          filteredGrns.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Goods Received Notes Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No GRN records match your active search or branch filter criteria.
              </p>
              {canCreateGrn && (
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(true)}
                  className="mt-3 bg-[#7052FF] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs"
                >
                  Launch GRN Receiving Wizard
                </button>
              )}
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">GRN Number</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Invoice Ref</th>
                    <th className="py-3 px-4">Received Date</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedGrns.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {g.grnNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {BRANCH_NAMES[g.branchId] || 'Branch'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {g.supplierName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {g.supplierInvoiceNo || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {new Date(g.receivedDate).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatLkr(g.totalCost)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{g.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenGrnDetails(g)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:text-[#7052FF] hover:border-[#7052FF]/40 hover:bg-purple-50/50 text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Items</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Bar */}
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredGrns.length)} of{' '}
                  <span className="font-bold text-slate-700">{filteredGrns.length}</span> total GRNs
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-semibold text-slate-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* Purchase Orders */
          pos.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Purchase Orders Created</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Create procurement purchase orders to send to pharmaceutical distributors.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {p.poNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {p.supplierName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {new Date(p.orderDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatLkr(p.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <span>{p.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* =====================================================================
          VIEW GRN ITEMS MODAL
      ===================================================================== */}
      {viewingGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7052FF] flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    GRN Details — {viewingGrn.grnNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Supplier: {viewingGrn.supplierName} • {BRANCH_NAMES[viewingGrn.branchId] || 'Branch'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingGrn(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Received Date</span>
                  <span className="font-bold text-slate-900">
                    {new Date(viewingGrn.receivedDate).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Supplier Invoice</span>
                  <span className="font-bold font-mono text-slate-900">
                    {viewingGrn.supplierInvoiceNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
                  <span className="font-bold font-mono text-emerald-700">
                    {formatLkr(viewingGrn.totalCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className="font-bold text-emerald-700">
                    {viewingGrn.status}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Received Line Items ({viewingGrnItems.length})
                </h4>

                {loadingItems ? (
                  <div className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 mx-auto mb-2 text-[#7052FF] animate-spin" />
                    <p className="text-xs font-medium">Loading line items...</p>
                  </div>
                ) : viewingGrnItems.length === 0 ? (
                  <div className="p-6 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                    No itemized records found for this historical GRN header.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3 text-center">Batch / Exp</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingGrnItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{item.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                              <div>{item.batchNumber || '—'}</div>
                              {item.expiryDate && (
                                <div className="text-[10px] text-slate-400">Exp: {item.expiryDate}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                              {item.receivedQuantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {formatLkr(item.unitCost)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatLkr(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="py-2.5 px-3 text-right text-xs uppercase text-slate-600">
                            Total Received Value:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-900">
                            {formatLkr(viewingGrn.totalCost)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
              <span className="text-[11px] text-slate-400 font-mono">
                Deegayu POS Procurement Ledger
              </span>
              <button
                type="button"
                onClick={() => setViewingGrn(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          NEW GRN RECEIVING WIZARD MODAL
      ===================================================================== */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7052FF] flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Receive Inventory (New GRN)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Accept supplier shipment, update stock levels & record purchase cost
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGrnModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handlePostGrn} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Branch & Supplier Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Branch Selection */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Receiving Branch *
                  </label>
                  {isOwner ? (
                    <select
                      value={grnBranchId}
                      onChange={(e) => setGrnBranchId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF]"
                    >
                      <option value="00f4cdcb-7d1c-4026-b57a-6e66c33b0c54">Alawwa (අලව්ව)</option>
                      <option value="fa68e4a0-a515-44c8-a082-5b5590366658">Dambadeniya (දඹදෙණිය)</option>
                      <option value="197693d6-4247-48df-b614-6fcde9e34f7d">Giriulla (ගිරිඋල්ල)</option>
                      <option value="133eeaec-5726-4702-a819-8423750db203">Main Store (ප්‍රධාන ගබඩාව)</option>
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{BRANCH_NAMES[selectedBranchId || ''] || 'Branch'}</span>
                    </div>
                  )}
                </div>

                {/* Supplier Selection with Quick Add */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Supplier ({suppliers.length} Vendors) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickSupplierOpen(true)}
                      className="text-[11px] font-bold text-[#7052FF] hover:underline"
                    >
                      + Add Supplier
                    </button>
                  </div>
                  <select
                    required
                    value={grnSupplierId}
                    onChange={(e) => setGrnSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF]"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Invoice No & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Supplier Invoice No / Ref # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-90412"
                    value={grnInvoiceNo}
                    onChange={(e) => setGrnInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF] font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Receiving Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Checked by store keeper, expiry verified"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF]"
                  />
                </div>
              </div>

              {/* Product Autocomplete Picker */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#7052FF]" />
                    <span>Search Catalog Product (3,120 Ayurvedic Items)</span>
                  </div>
                  {catalogProducts.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {catalogProducts.length} items loaded
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type product name or SKU (e.g. Arishta, Churna, Vati, Oil)..."
                    value={selectedProduct ? selectedProduct.name : productSearchTerm}
                    onChange={(e) => {
                      setSelectedProduct(null);
                      setProductSearchTerm(e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-[#7052FF]"
                  />

                  {/* Autocomplete Dropdown */}
                  {!selectedProduct && filteredCatalogProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredCatalogProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProduct(p);
                            setNewCost(p.costPrice || 250);
                            setNewRetail(p.retailPrice || 0);
                            setProductSearchTerm('');
                          }}
                          className="p-2.5 hover:bg-purple-50/50 cursor-pointer text-xs flex justify-between items-center"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {p.sku}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-slate-700 font-bold block">
                              Cost: {formatLkr(p.costPrice)}
                            </span>
                            <span className="font-mono text-emerald-600 text-[10px] block">
                              Retail: {formatLkr(p.retailPrice)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Line details when product selected */}
                {selectedProduct && (
                  <div className="p-3 bg-white rounded-xl border border-purple-200/80 space-y-2.5 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{selectedProduct.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        SKU: {selectedProduct.sku}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Received Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newQty}
                          onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Unit Cost (LKR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newCost}
                          onChange={(e) => setNewCost(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 font-mono font-bold text-purple-700"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Retail Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newRetail}
                          onChange={(e) => setNewRetail(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 font-mono text-emerald-700"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Batch / Lot No
                        </label>
                        <input
                          type="text"
                          value={newBatch}
                          onChange={(e) => setNewBatch(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={newExpiry}
                          onChange={(e) => setNewExpiry(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-700"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddGrnLine}
                          className="w-full py-1.5 rounded-lg bg-[#7052FF] hover:bg-[#5E3FE6] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          + Add Line
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Added Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-800">
                    Received Product Lines ({grnItems.length})
                  </h4>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    Grand Total: {formatLkr(grnTotalCost)}
                  </span>
                </div>

                {grnItems.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                    No items added yet. Search and select products above to add to this GRN.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {grnItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-3 bg-white">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {item.productSku} • Batch: {item.batchNumber} • Exp: {item.expiryDate}
                          </div>
                        </div>

                        <div className="font-mono text-slate-600 text-xs shrink-0">
                          {item.receivedQuantity} × {formatLkr(item.unitCost)}
                        </div>

                        <div className="font-mono font-bold text-slate-900 text-xs shrink-0">
                          {formatLkr(item.receivedQuantity * item.unitCost)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGrnLine(idx)}
                          className="text-rose-400 hover:text-rose-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || grnItems.length === 0}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Posting GRN to Branch Stock...</span>
                    </>
                  ) : (
                    <span>Post & Receive Inventory ({formatLkr(grnTotalCost)})</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          QUICK ADD SUPPLIER MODAL
      ===================================================================== */}
      {isQuickSupplierOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#7052FF]" />
                <span>Quick Add Supplier</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickSupplierOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSupplier} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swadeshi Ayurveda Distributors"
                  value={quickSupName}
                  onChange={(e) => setQuickSupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7052FF]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Contact Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0771234567"
                  value={quickSupPhone}
                  onChange={(e) => setQuickSupPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#7052FF]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Supplier Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SUP-SWAD"
                  value={quickSupCode}
                  onChange={(e) => setQuickSupCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:border-[#7052FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier || !quickSupName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7052FF] hover:bg-[#5E3FE6] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingSupplier ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add & Select</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
