'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Boxes,
  Building2,
  Warehouse,
  Search,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  PackageX,
  TrendingUp,
  Banknote,
  Sparkles,
  Plus,
  Edit2,
  Sliders,
  X,
  FileSpreadsheet,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { supabase } from '../../../lib/supabase';
import { useRealtimePosSync } from '../../../hooks/use-realtime-pos-sync';
import {
  MotionPageShell,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '../../../components/ui/motion-primitives';

// ==========================================
// 1. DATA MODELS & INTERFACES
// ==========================================

export interface BranchSummary {
  branchId: string;
  branchName: string;
  branchCode: string;
  warehouseId: string;
  warehouseName: string;
  totalSkus: number;
  totalUnits: number;
  retailValuation: number;
  costValuation: number;
  healthyCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  specialStockUnits: number;
}

export interface InventoryItem {
  id: string; // product_id
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  categoryName: string;
  costPrice: number;
  retailPrice: number;
  alertQuantity: number;
  quantityOnHand: number;
  unit: string;
  isSpecialStock: boolean;
  specialRate?: number;
  soldLast30d: number;
  warehouseId: string;
  branchId: string;
  branchName: string;
  stockStatus: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SLOW_MOVING';
  suggestedReorderQty: number;
}

export interface SpecialStockItem {
  productId: string;
  sku: string;
  name: string;
  rate: number;
  sortOrder: number;
  unitsOnHand: number;
  totalValue: number;
  shiftInQty: number;
  shiftSoldQty: number;
  status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface CategoryValuation {
  name: string;
  skuCount: number;
  totalUnits: number;
  totalValue: number;
  percentage: number;
}

// 7 Known Core Special Stock (Rasayana) Items
const SPECIAL_STOCK_CATALOG = [
  { sku: 'SKU-1805', name: 'Kameshwari Rasayanaya Rawana 300', rate: 300, sortOrder: 1, productId: '40e939d6-e7eb-4bf6-8650-c5b22fcbf5ee' },
  { sku: 'SKU-108', name: 'Kameshwari Rasayanaya Rawana Rathu', rate: 250, sortOrder: 2, productId: 'a17f95d5-4932-480f-85d2-ff4704800cbb' },
  { sku: 'SKU-3268', name: 'Kameshwari Rasayanaya Sewanagala Gold 300', rate: 300, sortOrder: 3, productId: 'b12673e1-b24b-4c1c-92e9-673e0768e6d9' },
  { sku: 'SKU-105', name: 'Rawana Kaha 200', rate: 200, sortOrder: 4, productId: '0ce976cc-6660-41a6-b4fa-7b3c81283dbc' },
  { sku: 'SKU-3252', name: 'Kameshwari Rasayanaya Sewanagala Kaha 250', rate: 250, sortOrder: 5, productId: '05cca1b9-9f01-46de-ab63-74ee0909242e' },
  { sku: 'SKU-3325', name: 'Kameshwari Rasayanaya Chathuri Kola 250', rate: 250, sortOrder: 6, productId: '80f22f7b-eec9-49e3-9523-9781d5815b00' },
  { sku: 'SKU-3377', name: 'Kameshwari Rasayanaya Chathuri Rathu 300', rate: 300, sortOrder: 7, productId: '7b6d032c-dee9-424a-8889-934bcd305452' },
];

function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUnits(qty: number, unit?: string): string {
  const val = Number(qty || 0);
  const u = (unit || 'units').toLowerCase().trim();
  if (u === 'g' || u === 'grams') {
    if (Math.abs(val) >= 1000) {
      return `${(val / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg`;
    }
    return `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })} g`;
  }
  if (u === 'ml' || u === 'milliliters') {
    if (Math.abs(val) >= 1000) {
      return `${(val / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} L`;
    }
    return `${val.toLocaleString('en-US', { maximumFractionDigits: 1 })} ml`;
  }
  return `${val.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit || 'units'}`;
}

export default function BranchInventoryAnalyticsPage() {
  const { tenant } = useTenantBranch();

  // State: Data loading
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Branch Selection: 'all' or branchId
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Master Data
  const [rawBranches, setRawBranches] = useState<any[]>([]);
  const [rawWarehouses, setRawWarehouses] = useState<any[]>([]);
  const [rawCategories, setRawCategories] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [specialItems, setSpecialItems] = useState<SpecialStockItem[]>([]);

  // Explorer Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'low' | 'out' | 'slow'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState<'lowest_stock' | 'highest_stock' | 'highest_value' | 'name_asc'>('lowest_stock');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Quick Stock Adjustment Modal State
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustBranchId, setAdjustBranchId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT' | 'SET'>('ADD');
  const [adjustQtyInput, setAdjustQtyInput] = useState<string>('1');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustToast, setAdjustToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ==========================================
  // 2. MASTER DATA FETCHING
  // ==========================================

  const loadInventoryData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        // 1. Fetch Branches, Warehouses, Categories, Modaka Item Configs in parallel
        const [
          { data: bData },
          { data: wData },
          { data: cData },
          { data: micData },
        ] = await Promise.all([
          supabase.from('branches').select('id, name, code, is_active').order('name'),
          supabase.from('warehouses').select('id, branch_id, name, is_default').order('created_at'),
          supabase.from('categories').select('id, name, slug').order('name'),
          supabase.from('modaka_item_configs').select('id, product_id, sort_order, custom_rate, is_active, products(name, sku)'),
        ]);

        const branches = (bData || []).filter((b: any) => b.is_active !== false);
        const warehouses = wData || [];
        const categories = cData || [];

        setRawBranches(branches);
        setRawWarehouses(warehouses);
        setRawCategories(categories);

        // Branch-to-warehouse mapping
        const branchWhMap = new Map<string, string>();
        warehouses.forEach((w: any) => {
          if (!branchWhMap.has(w.branch_id) || w.is_default) {
            branchWhMap.set(w.branch_id, w.id);
          }
        });

        const warehouseToBranchMap = new Map<string, { branchId: string; branchName: string; branchCode: string }>();
        warehouses.forEach((w: any) => {
          const br = branches.find((b: any) => b.id === w.branch_id);
          warehouseToBranchMap.set(w.id, {
            branchId: w.branch_id,
            branchName: br?.name || 'Main store',
            branchCode: br?.code || 'BR',
          });
        });

        // 2. Fetch Active Products in 1,000-row chunks
        const allProds: any[] = [];
        let pPage = 0;
        const pChunk = 1000;
        let hasMoreP = true;
        while (hasMoreP) {
          const { data: pChunkData, error: pErr } = await supabase
            .from('products')
            .select('id, name, sku, barcode, cost_price, retail_price, alert_quantity, category_id, is_active')
            .eq('is_active', true)
            .order('name', { ascending: true })
            .range(pPage * pChunk, (pPage + 1) * pChunk - 1);

          if (pErr || !pChunkData || pChunkData.length === 0) {
            hasMoreP = false;
            break;
          }
          allProds.push(...pChunkData);
          if (pChunkData.length < pChunk) {
            hasMoreP = false;
          } else {
            pPage++;
          }
        }

        // Product map for quick reference
        const prodMap = new Map<string, any>();
        allProds.forEach((p) => prodMap.set(p.id, p));

        // 3. Fetch Stock Levels in 2,500-row chunks
        const allStockRows: any[] = [];
        let sPage = 0;
        const sChunk = 2500;
        let hasMoreS = true;
        while (hasMoreS) {
          const { data: sChunkData, error: sErr } = await supabase
            .from('stock_levels')
            .select('product_id, warehouse_id, quantity_on_hand, reorder_point')
            .range(sPage * sChunk, (sPage + 1) * sChunk - 1);

          if (sErr || !sChunkData || sChunkData.length === 0) {
            hasMoreS = false;
            break;
          }
          allStockRows.push(...sChunkData);
          if (sChunkData.length < sChunk) {
            hasMoreS = false;
          } else {
            sPage++;
          }
        }

        // 4. Fetch 30-day Sold Quantities
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentSales } = await supabase
          .from('sale_items')
          .select('product_id, quantity, created_at')
          .gte('created_at', thirtyDaysAgo);

        const soldLast30dMap = new Map<string, number>();
        (recentSales || []).forEach((si: any) => {
          if (si.product_id) {
            const cur = soldLast30dMap.get(si.product_id) || 0;
            soldLast30dMap.set(si.product_id, cur + Number(si.quantity || 0));
          }
        });

        // 5. Fetch Shift Modaka Entries (for Special Stock Tracker)
        const { data: shiftModaka } = await supabase
          .from('shift_modaka_entries')
          .select('product_id, in_qty, sold_qty');

        const modakaShiftInMap = new Map<string, number>();
        const modakaShiftSoldMap = new Map<string, number>();
        (shiftModaka || []).forEach((sme: any) => {
          if (sme.product_id) {
            modakaShiftInMap.set(sme.product_id, (modakaShiftInMap.get(sme.product_id) || 0) + Number(sme.in_qty || 0));
            modakaShiftSoldMap.set(sme.product_id, (modakaShiftSoldMap.get(sme.product_id) || 0) + Number(sme.sold_qty || 0));
          }
        });

        // 6. Aggregate Stock by (Warehouse, Product)
        const whProdStockMap = new Map<string, { qty: number; reorder: number }>();
        allStockRows.forEach((sl: any) => {
          if (sl.product_id && sl.warehouse_id) {
            const key = `${sl.warehouse_id}:${sl.product_id}`;
            const existing = whProdStockMap.get(key) || { qty: 0, reorder: 0 };
            whProdStockMap.set(key, {
              qty: existing.qty + Number(sl.quantity_on_hand || 0),
              reorder: Math.max(existing.reorder, Number(sl.reorder_point || 0)),
            });
          }
        });

        // 7. Special Stock Configurations Map
        const specialStockConfigMap = new Map<string, { rate: number; sortOrder: number }>();
        SPECIAL_STOCK_CATALOG.forEach((sc) => {
          specialStockConfigMap.set(sc.productId, { rate: sc.rate, sortOrder: sc.sortOrder });
        });
        (micData || []).forEach((m: any) => {
          if (m.product_id) {
            specialStockConfigMap.set(m.product_id, {
              rate: Number(m.custom_rate || 250),
              sortOrder: Number(m.sort_order || 99),
            });
          }
        });

        // Category Map
        const categoryMap = new Map<string, string>();
        categories.forEach((c: any) => categoryMap.set(c.id, c.name));

        // 8. Transform into Unified Inventory Items List
        const itemsList: InventoryItem[] = [];

        // For each active branch warehouse, map its stock
        for (const branch of branches) {
          const whId = branchWhMap.get(branch.id);
          if (!whId) continue;

          for (const prod of allProds) {
            const key = `${whId}:${prod.id}`;
            const stockData = whProdStockMap.get(key);
            const qty = stockData ? stockData.qty : 0;
            const reorderThreshold = stockData?.reorder && stockData.reorder > 0
              ? stockData.reorder
              : Number(prod.alert_quantity || 15);

            const isSpecial = specialStockConfigMap.has(prod.id);
            const specialCfg = specialStockConfigMap.get(prod.id);

            const sold30d = soldLast30dMap.get(prod.id) || 0;

            let status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SLOW_MOVING' = 'HEALTHY';
            if (qty <= 0) {
              status = 'OUT_OF_STOCK';
            } else if (qty <= reorderThreshold) {
              status = 'LOW_STOCK';
            } else if (qty > 30 && sold30d === 0) {
              status = 'SLOW_MOVING';
            }

            const suggestedReorder = Math.max(0, Math.ceil(reorderThreshold * 2.5 - qty));

            itemsList.push({
              id: prod.id,
              name: prod.name,
              sku: prod.sku || `SKU-${prod.id.slice(0, 6)}`,
              barcode: prod.barcode || '',
              categoryId: prod.category_id || '',
              categoryName: categoryMap.get(prod.category_id) || 'General Ayurvedic',
              costPrice: Number(prod.cost_price || 0),
              retailPrice: isSpecial && specialCfg?.rate ? specialCfg.rate : Number(prod.retail_price || 0),
              alertQuantity: reorderThreshold,
              quantityOnHand: qty,
              unit: 'units',
              isSpecialStock: isSpecial,
              specialRate: specialCfg?.rate,
              soldLast30d: sold30d,
              warehouseId: whId,
              branchId: branch.id,
              branchName: branch.name,
              stockStatus: status,
              suggestedReorderQty: suggestedReorder,
            });
          }
        }

        setAllItems(itemsList);

        // 9. Special Stock List (7 Rasayana Items)
        const specialStockRows: SpecialStockItem[] = SPECIAL_STOCK_CATALOG.map((sc) => {
          return {
            productId: sc.productId,
            sku: sc.sku,
            name: sc.name,
            rate: sc.rate,
            sortOrder: sc.sortOrder,
            unitsOnHand: 0, // calculated dynamically per selected branch
            totalValue: 0,
            shiftInQty: modakaShiftInMap.get(sc.productId) || 0,
            shiftSoldQty: modakaShiftSoldMap.get(sc.productId) || 0,
            status: 'OUT_OF_STOCK',
          };
        });
        setSpecialItems(specialStockRows);

        setLastRefreshedAt(new Date());
      } catch (err) {
        console.error('[BranchInventory] Data fetch error:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadInventoryData(false);
  }, [loadInventoryData]);

  // Silent Background Real-time Synchronization
  useRealtimePosSync(
    () => {
      loadInventoryData(true);
    },
    { showToast: false, intervalMs: 20000, channelName: 'inventory_live_telemetry' }
  );

  // ==========================================
  // 3. COMPUTED BRANCH SUMMARIES & KPIS
  // ==========================================

  // Filter items for the currently selected branch
  const branchFilteredItems = useMemo(() => {
    if (selectedBranchId === 'all') {
      return allItems;
    }
    return allItems.filter((item) => item.branchId === selectedBranchId);
  }, [allItems, selectedBranchId]);

  // Distinct branch cards data for top 5-card selector
  const branchSummaries = useMemo<BranchSummary[]>(() => {
    // 1. All Branches Enterprise Summary
    const allSkusSet = new Set<string>();
    let allUnits = 0;
    let allRetail = 0;
    let allCost = 0;
    let allHealthy = 0;
    let allLow = 0;
    let allOut = 0;
    let allSpecialUnits = 0;

    allItems.forEach((i) => {
      allSkusSet.add(i.id);
      allUnits += i.quantityOnHand;
      allRetail += i.quantityOnHand * i.retailPrice;
      allCost += i.quantityOnHand * i.costPrice;
      if (i.quantityOnHand <= 0) allOut++;
      else if (i.quantityOnHand <= i.alertQuantity) allLow++;
      else allHealthy++;

      if (i.isSpecialStock) {
        allSpecialUnits += i.quantityOnHand;
      }
    });

    const list: BranchSummary[] = [
      {
        branchId: 'all',
        branchName: 'All Branches',
        branchCode: 'GLOBAL',
        warehouseId: 'all',
        warehouseName: 'Enterprise Aggregation',
        totalSkus: allSkusSet.size,
        totalUnits: allUnits,
        retailValuation: allRetail,
        costValuation: allCost,
        healthyCount: allHealthy,
        lowStockCount: allLow,
        outOfStockCount: allOut,
        specialStockUnits: allSpecialUnits,
      },
    ];

    // 2. Individual Branches (Alawwa, Dambadeniya, Giriulla, Main Store)
    rawBranches.forEach((b) => {
      const bItems = allItems.filter((i) => i.branchId === b.id);
      let units = 0;
      let retail = 0;
      let cost = 0;
      let healthy = 0;
      let low = 0;
      let out = 0;
      let specialUnits = 0;

      bItems.forEach((i) => {
        units += i.quantityOnHand;
        retail += i.quantityOnHand * i.retailPrice;
        cost += i.quantityOnHand * i.costPrice;
        if (i.quantityOnHand <= 0) out++;
        else if (i.quantityOnHand <= i.alertQuantity) low++;
        else healthy++;

        if (i.isSpecialStock) {
          specialUnits += i.quantityOnHand;
        }
      });

      const wh = rawWarehouses.find((w: any) => w.branch_id === b.id);

      list.push({
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code || 'BR',
        warehouseId: wh?.id || '',
        warehouseName: wh?.name || `${b.name} Warehouse`,
        totalSkus: bItems.length,
        totalUnits: units,
        retailValuation: retail,
        costValuation: cost,
        healthyCount: healthy,
        lowStockCount: low,
        outOfStockCount: out,
        specialStockUnits: specialUnits,
      });
    });

    return list;
  }, [allItems, rawBranches, rawWarehouses]);

  const DEFAULT_BRANCH_SUMMARY: BranchSummary = {
    branchId: 'all',
    branchName: 'All Branches',
    branchCode: 'GLOBAL',
    warehouseId: 'all',
    warehouseName: 'Enterprise Aggregation',
    totalSkus: 0,
    totalUnits: 0,
    retailValuation: 0,
    costValuation: 0,
    healthyCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    specialStockUnits: 0,
  };

  // Selected branch summary object
  const currentBranchSummary: BranchSummary = useMemo(() => {
    return branchSummaries.find((s) => s.branchId === selectedBranchId) || branchSummaries[0] || DEFAULT_BRANCH_SUMMARY;
  }, [branchSummaries, selectedBranchId]);

  // Special Stock Dynamic Computation for Selected Branch
  const liveSpecialStockRows = useMemo<SpecialStockItem[]>(() => {
    return specialItems.map((si) => {
      let units = 0;
      if (selectedBranchId === 'all') {
        units = allItems
          .filter((i) => i.id === si.productId)
          .reduce((sum, item) => sum + item.quantityOnHand, 0);
      } else {
        const matching = allItems.find(
          (i) => i.id === si.productId && i.branchId === selectedBranchId
        );
        units = matching ? matching.quantityOnHand : 0;
      }

      let status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'HEALTHY';
      if (units <= 0) status = 'OUT_OF_STOCK';
      else if (units <= 15) status = 'LOW_STOCK';

      return {
        ...si,
        unitsOnHand: units,
        totalValue: units * si.rate,
        status,
      };
    });
  }, [specialItems, allItems, selectedBranchId]);

  // Special Stock Summary KPIs
  const specialStockKpis = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    let totalIn = 0;
    let totalSold = 0;

    liveSpecialStockRows.forEach((row) => {
      totalUnits += row.unitsOnHand;
      totalValue += row.totalValue;
      totalIn += row.shiftInQty;
      totalSold += row.shiftSoldQty;
    });

    return { totalUnits, totalValue, totalIn, totalSold };
  }, [liveSpecialStockRows]);

  // Top Category Valuations for Selected Branch
  const categoryValuations = useMemo<CategoryValuation[]>(() => {
    const catMap = new Map<string, { skus: number; units: number; val: number }>();
    let totalBranchVal = 0;

    branchFilteredItems.forEach((item) => {
      const cat = item.categoryName || 'Other Preparations';
      const itemVal = item.quantityOnHand * item.retailPrice;
      totalBranchVal += itemVal;

      const existing = catMap.get(cat) || { skus: 0, units: 0, val: 0 };
      catMap.set(cat, {
        skus: existing.skus + 1,
        units: existing.units + item.quantityOnHand,
        val: existing.val + itemVal,
      });
    });

    const list: CategoryValuation[] = [];
    catMap.forEach((v, name) => {
      list.push({
        name,
        skuCount: v.skus,
        totalUnits: v.units,
        totalValue: v.val,
        percentage: totalBranchVal > 0 ? (v.val / totalBranchVal) * 100 : 0,
      });
    });

    return list.sort((a, b) => b.totalValue - a.totalValue).slice(0, 6);
  }, [branchFilteredItems]);

  // ==========================================
  // 4. TAB FILTERING & SEARCHING
  // ==========================================

  const filteredItems = useMemo(() => {
    return branchFilteredItems.filter((item) => {
      // 1. Tab condition
      if (activeTab === 'low') {
        if (item.stockStatus !== 'LOW_STOCK') return false;
      } else if (activeTab === 'out') {
        if (item.stockStatus !== 'OUT_OF_STOCK') return false;
      } else if (activeTab === 'slow') {
        if (item.stockStatus !== 'SLOW_MOVING') return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'ALL' && item.categoryId !== categoryFilter) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSku = item.sku.toLowerCase().includes(q);
        const matchesBarcode = item.barcode.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode) {
          return false;
        }
      }

      return true;
    });
  }, [branchFilteredItems, activeTab, categoryFilter, searchQuery]);

  // Sorting
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      if (sortOption === 'lowest_stock') {
        return a.quantityOnHand - b.quantityOnHand;
      }
      if (sortOption === 'highest_stock') {
        return b.quantityOnHand - a.quantityOnHand;
      }
      if (sortOption === 'highest_value') {
        return b.quantityOnHand * b.retailPrice - a.quantityOnHand * a.retailPrice;
      }
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
    return list;
  }, [filteredItems, sortOption]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedItems.slice(startIndex, startIndex + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

  // Counts for tab badges
  const tabCounts = useMemo(() => {
    let all = 0;
    let low = 0;
    let out = 0;
    let slow = 0;

    branchFilteredItems.forEach((i) => {
      all++;
      if (i.stockStatus === 'LOW_STOCK') low++;
      else if (i.stockStatus === 'OUT_OF_STOCK') out++;
      else if (i.stockStatus === 'SLOW_MOVING') slow++;
    });

    return { all, low, out, slow };
  }, [branchFilteredItems]);

  // ==========================================
  // 5. QUICK STOCK ADJUSTMENT HANDLER
  // ==========================================

  const handleOpenAdjustment = (item?: InventoryItem, preselectedBranchId?: string) => {
    const targetBranch = preselectedBranchId || (selectedBranchId !== 'all' ? selectedBranchId : rawBranches[0]?.id || '');
    setAdjustBranchId(targetBranch);
    setAdjustItem(item || (branchFilteredItems[0] ?? null));
    setAdjustType('ADD');
    setAdjustQtyInput('1');
    setAdjustNotes('');
    setAdjustmentModalOpen(true);
  };

  const handleExecuteAdjustment = async () => {
    if (!adjustItem || !adjustBranchId) return;

    const qty = parseFloat(adjustQtyInput);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    setIsAdjusting(true);

    try {
      // Find warehouse for selected branch
      const wh = rawWarehouses.find((w: any) => w.branch_id === adjustBranchId);
      if (!wh) {
        throw new Error('Warehouse not configured for this branch.');
      }

      // Calculate new quantity on hand
      let newQtyOnHand = adjustItem.quantityOnHand;
      if (adjustType === 'ADD') {
        newQtyOnHand = adjustItem.quantityOnHand + qty;
      } else if (adjustType === 'DEDUCT') {
        newQtyOnHand = Math.max(0, adjustItem.quantityOnHand - qty);
      } else if (adjustType === 'SET') {
        newQtyOnHand = qty;
      }

      // 1. Check if stock_levels record exists
      const { data: existingSl } = await supabase
        .from('stock_levels')
        .select('id')
        .eq('product_id', adjustItem.id)
        .eq('warehouse_id', wh.id);

      if (existingSl && existingSl.length > 0) {
        const { error: upErr } = await supabase
          .from('stock_levels')
          .update({
            quantity_on_hand: newQtyOnHand,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', adjustItem.id)
          .eq('warehouse_id', wh.id);

        if (upErr) throw upErr;
      } else {
        const { error: inErr } = await supabase.from('stock_levels').insert({
          product_id: adjustItem.id,
          warehouse_id: wh.id,
          quantity_on_hand: newQtyOnHand,
          tenant_id: tenant?.id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
          updated_at: new Date().toISOString(),
        });
        if (inErr) throw inErr;
      }

      // 2. Immediate local UI state update
      setAllItems((prev) =>
        prev.map((i) => {
          if (i.id === adjustItem.id && i.branchId === adjustBranchId) {
            let nextStatus: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SLOW_MOVING' = 'HEALTHY';
            if (newQtyOnHand <= 0) nextStatus = 'OUT_OF_STOCK';
            else if (newQtyOnHand <= i.alertQuantity) nextStatus = 'LOW_STOCK';
            else if (newQtyOnHand > 30 && i.soldLast30d === 0) nextStatus = 'SLOW_MOVING';

            return {
              ...i,
              quantityOnHand: newQtyOnHand,
              stockStatus: nextStatus,
              suggestedReorderQty: Math.max(0, Math.ceil(i.alertQuantity * 2.5 - newQtyOnHand)),
            };
          }
          return i;
        })
      );

      setAdjustToast({
        message: `Successfully adjusted stock for ${adjustItem.name} to ${newQtyOnHand} units.`,
        type: 'success',
      });
      setTimeout(() => setAdjustToast(null), 3500);

      setAdjustmentModalOpen(false);
    } catch (err: any) {
      console.error('[Adjustment] Execution failed:', err);
      alert(`Adjustment failed: ${err.message || 'Database update error'}`);
    } finally {
      setIsAdjusting(false);
    }
  };

  // ==========================================
  // 6. CSV EXPORTS
  // ==========================================

  const handleDownloadReorderSheet = () => {
    const reorderItems = branchFilteredItems.filter(
      (i) => i.stockStatus === 'LOW_STOCK' || i.stockStatus === 'OUT_OF_STOCK'
    );

    if (reorderItems.length === 0) {
      alert('No low-stock or out-of-stock items found for this branch selection.');
      return;
    }

    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Branch',
      'Current Stock',
      'Reorder Alert Level',
      'Suggested Reorder Qty',
      'Cost Price (LKR)',
      'Estimated Reorder Cost (LKR)',
      'Status',
    ];

    const rows = reorderItems.map((item) => {
      const estCost = item.suggestedReorderQty * item.costPrice;
      return [
        `"${item.sku.replace(/"/g, '""')}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.categoryName.replace(/"/g, '""')}"`,
        `"${item.branchName.replace(/"/g, '""')}"`,
        item.quantityOnHand,
        item.alertQuantity,
        item.suggestedReorderQty,
        item.costPrice.toFixed(2),
        estCost.toFixed(2),
        item.stockStatus,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const branchLabel = currentBranchSummary.branchCode.toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `deegayu-reorder-sheet-${branchLabel}-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFullInventory = () => {
    if (branchFilteredItems.length === 0) {
      alert('No inventory data to export.');
      return;
    }

    const headers = [
      'SKU',
      'Barcode',
      'Product Name',
      'Category',
      'Branch',
      'Quantity On Hand',
      'Unit',
      'Cost Price (LKR)',
      'Retail Price (LKR)',
      'Total Retail Value (LKR)',
      'Total Cost Value (LKR)',
      'Stock Status',
      'Sold Last 30 Days',
    ];

    const rows = branchFilteredItems.map((item) => {
      const retailVal = item.quantityOnHand * item.retailPrice;
      const costVal = item.quantityOnHand * item.costPrice;
      return [
        `"${item.sku.replace(/"/g, '""')}"`,
        `"${item.barcode.replace(/"/g, '""')}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.categoryName.replace(/"/g, '""')}"`,
        `"${item.branchName.replace(/"/g, '""')}"`,
        item.quantityOnHand,
        item.unit,
        item.costPrice.toFixed(2),
        item.retailPrice.toFixed(2),
        retailVal.toFixed(2),
        costVal.toFixed(2),
        item.stockStatus,
        item.soldLast30d,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const branchLabel = currentBranchSummary.branchCode.toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `deegayu-full-inventory-${branchLabel}-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Gross Margin Calculation
  const estimatedGrossMargin = useMemo(() => {
    const retail = currentBranchSummary?.retailValuation || 0;
    const cost = currentBranchSummary?.costValuation || 0;
    const margin = retail - cost;
    const marginPct = retail > 0 ? (margin / retail) * 100 : 0;
    return { margin, marginPct };
  }, [currentBranchSummary]);

  // Donut chart angles
  const donutData = useMemo(() => {
    const circumference = 2 * Math.PI * 60; // r=60 => ~376.99
    const healthy = currentBranchSummary.healthyCount || 0;
    const low = currentBranchSummary.lowStockCount || 0;
    const out = currentBranchSummary.outOfStockCount || 0;
    const total = healthy + low + out;

    if (total === 0) {
      return {
        healthyPct: 100,
        lowPct: 0,
        outPct: 0,
        hDash: circumference,
        lDash: 0,
        oDash: 0,
        circumference,
      };
    }

    const hPct = (healthy / total) * 100;
    const lPct = (low / total) * 100;
    const oPct = (out / total) * 100;

    const hDash = (hPct / 100) * circumference;
    const lDash = (lPct / 100) * circumference;
    const oDash = (oPct / 100) * circumference;

    return {
      healthyPct: Math.round(hPct),
      lowPct: Math.round(lPct),
      outPct: Math.round(oPct),
      hDash,
      lDash,
      oDash,
      circumference,
    };
  }, [currentBranchSummary]);

  // ==========================================
  // 7. RENDER VIEW
  // ==========================================

  return (
    <MotionPageShell className="min-h-screen bg-[#EEF2F7] text-slate-900 pb-20">
      {/* Toast Notification */}
      {adjustToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-250">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{adjustToast.message}</span>
        </div>
      )}

      {/* Obsidian Executive Header Banner */}
      <div className="bg-[#0F172A] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Title & Brand Meta */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Deegayu Weda Madhura
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-400 text-xs font-medium">Enterprise Inventory & Stock Analytics Desk</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Boxes className="w-8 h-8 text-indigo-400" />
                Branch Inventory & Stock Analytics
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                Multi-branch stock telemetry, live inventory valuation, low-stock reorder triggers, and shift-controlled Special Stock ledger across all active dispensaries.
              </p>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Silent Sync Status Pill */}
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-lg text-xs font-medium text-slate-300 border border-slate-700/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Sync Active</span>
              </div>

              {/* Manual Refresh */}
              <button
                onClick={() => loadInventoryData(true)}
                disabled={isRefreshing}
                title="Refresh inventory from cloud"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Download Reorder Sheet */}
              <button
                onClick={handleDownloadReorderSheet}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold transition border border-amber-500/30 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Reorder Sheet</span>
              </button>

              {/* Export Full Inventory */}
              <button
                onClick={handleExportFullInventory}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-300" />
                <span>Export CSV</span>
              </button>

              {/* Pro Adjust Stock Action */}
              <button
                onClick={() => handleOpenAdjustment()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adjust Stock</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
        {/* ==========================================
            1. TOP INTERACTIVE BRANCH SELECTOR CARDS
        ========================================== */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Select Operating Branch or Global Enterprise
            </h2>
            <span className="text-xs text-slate-500">
              Active: <strong className="text-slate-800">{currentBranchSummary.branchName}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            {branchSummaries.map((summary) => {
              const isSelected = selectedBranchId === summary.branchId;
              const isGlobal = summary.branchId === 'all';

              return (
                <button
                  key={summary.branchId}
                  onClick={() => {
                    setSelectedBranchId(summary.branchId);
                    setCurrentPage(1);
                  }}
                  className={`text-left p-4 rounded-xl transition-all duration-200 cursor-pointer relative ${
                    isSelected
                      ? 'bg-white border-2 border-indigo-600 ring-4 ring-indigo-500/10 shadow-lg -translate-y-0.5'
                      : 'bg-white/80 hover:bg-white border border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Selected Indicator Pill */}
                  {isSelected && (
                    <span className="absolute top-3 right-3 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                    </span>
                  )}

                  <div className="flex items-center gap-2 mb-1.5">
                    {isGlobal ? (
                      <Warehouse className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <h3 className="font-bold text-sm text-slate-900 truncate">{summary.branchName}</h3>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
                    <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold">
                      {summary.branchCode}
                    </span>
                    <span className="font-semibold text-slate-700">{summary.totalSkus.toLocaleString()} SKUs</span>
                  </div>

                  {/* Retail Valuation */}
                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">Stock Valuation</p>
                    <p className="text-base font-extrabold text-slate-900 tracking-tight">
                      {formatCurrency(summary.retailValuation)}
                    </p>
                  </div>

                  {/* Compact Status Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px] font-semibold">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {summary.healthyCount} Good
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {summary.lowStockCount} Low
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      {summary.outOfStockCount} Out
                    </span>
                  </div>

                  {/* Special Stock Pill */}
                  <div className="mt-2 text-[10px] font-bold text-indigo-800 bg-indigo-50/80 px-2 py-0.8 rounded-md border border-indigo-100 flex items-center justify-between">
                    <span>Special Stock</span>
                    <span>{summary.specialStockUnits.toLocaleString()} units</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ==========================================
            2. EXECUTIVE BRANCH KPI STRIP (5 CARDS)
        ========================================== */}
        <MotionStaggerGrid className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Retail Valuation */}
          <MotionStaggerItem>
            <div className="bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white p-5 rounded-2xl shadow-lg shadow-blue-500/10 relative overflow-hidden flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Retail Stock Valuation</span>
                  <div className="w-9 h-9 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-md shrink-0">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {formatCurrency(currentBranchSummary.retailValuation)}
                </div>
                <p className="text-xs text-blue-100 mt-2 flex items-center gap-1 flex-wrap">
                  <span className="font-semibold">{currentBranchSummary.totalUnits.toLocaleString()} units</span>
                  <span>•</span>
                  <span>{currentBranchSummary.totalSkus.toLocaleString()} SKUs</span>
                </p>
              </div>
            </div>
          </MotionStaggerItem>

          {/* 2. Cost Valuation & Margin */}
          <MotionStaggerItem>
            <div className="bg-gradient-to-br from-[#10B981] to-[#059669] text-white p-5 rounded-2xl shadow-lg shadow-emerald-500/10 relative overflow-hidden flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Cost Valuation</span>
                  <div className="w-9 h-9 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-md shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {formatCurrency(currentBranchSummary.costValuation)}
                </div>
                <p className="text-xs text-emerald-100 font-semibold mt-2">
                  Margin: +{formatCurrency(estimatedGrossMargin.margin)} ({estimatedGrossMargin.marginPct.toFixed(1)}%)
                </p>
              </div>
            </div>
          </MotionStaggerItem>

          {/* 3. Healthy Stock Items */}
          <MotionStaggerItem>
            <div className="bg-gradient-to-br from-[#4F46E5] to-[#4338CA] text-white p-5 rounded-2xl shadow-lg shadow-indigo-500/10 relative overflow-hidden flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">Healthy Stock</span>
                  <div className="w-9 h-9 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-md shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {currentBranchSummary.healthyCount.toLocaleString()}
                </div>
                <p className="text-xs text-indigo-100 mt-2">
                  {currentBranchSummary.totalSkus > 0
                    ? `${((currentBranchSummary.healthyCount / currentBranchSummary.totalSkus) * 100).toFixed(1)}% of catalog stable`
                    : 'Optimal inventory levels'}
                </p>
              </div>
            </div>
          </MotionStaggerItem>

          {/* 4. Low Stock Alerts (Clickable to switch tab) */}
          <MotionStaggerItem>
            <button
              onClick={() => setActiveTab('low')}
              className={`text-left p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between shadow-lg shadow-amber-500/10 bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white w-full h-full ${
                activeTab === 'low' ? 'ring-4 ring-amber-300/40 -translate-y-0.5' : 'hover:opacity-95'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-100">Low Stock Alerts</span>
                  <div className="w-9 h-9 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-md shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {currentBranchSummary.lowStockCount.toLocaleString()}
                </div>
                <p className="text-xs text-amber-100 font-medium mt-2 flex items-center gap-1">
                  <span>Running out soon</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </button>
          </MotionStaggerItem>

          {/* 5. Out of Stock (Clickable to switch tab) */}
          <MotionStaggerItem>
            <button
              onClick={() => setActiveTab('out')}
              className={`text-left p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between shadow-lg shadow-rose-500/10 bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white w-full h-full ${
                activeTab === 'out' ? 'ring-4 ring-rose-300/40 -translate-y-0.5' : 'hover:opacity-95'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-100">Out of Stock</span>
                  <div className="w-9 h-9 rounded-full bg-white text-rose-600 flex items-center justify-center shadow-md shrink-0">
                    <PackageX className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {currentBranchSummary.outOfStockCount.toLocaleString()}
                </div>
                <p className="text-xs text-rose-100 font-medium mt-2 flex items-center gap-1">
                  <span>0 remaining on hand</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </button>
          </MotionStaggerItem>
        </MotionStaggerGrid>

        {/* ==========================================
            3. INTERACTIVE VISUAL GRAPHS & ANALYTICS
        ========================================== */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Chart 1: Stock Health & Multi-Branch Comparison */}
          <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    Stock Health Ratio — {currentBranchSummary.branchName}
                  </h3>
                  <p className="text-xs text-slate-500">Distribution of catalog health statuses</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {currentBranchSummary.totalSkus} SKUs
                </span>
              </div>

              {/* Segmented Donut Chart */}
              <div className="flex items-center justify-center py-2">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                    {/* Background Track */}
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="#E2E8F0"
                      strokeWidth="18"
                      fill="transparent"
                    />

                    {/* Healthy Segment (Emerald) */}
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="#10B981"
                      strokeWidth="18"
                      strokeDasharray={`${donutData.hDash} ${donutData.circumference}`}
                      strokeDashoffset="0"
                      fill="transparent"
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />

                    {/* Low Stock Segment (Amber) */}
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="#F59E0B"
                      strokeWidth="18"
                      strokeDasharray={`${donutData.lDash} ${donutData.circumference}`}
                      strokeDashoffset={`-${donutData.hDash}`}
                      fill="transparent"
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />

                    {/* Out of Stock Segment (Rose) */}
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      stroke="#EF4444"
                      strokeWidth="18"
                      strokeDasharray={`${donutData.oDash} ${donutData.circumference}`}
                      strokeDashoffset={`-${donutData.hDash + donutData.lDash}`}
                      fill="transparent"
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>

                  {/* Donut Center Legend */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {currentBranchSummary.totalSkus.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Catalog SKUs
                    </span>
                  </div>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Healthy</span>
                  </div>
                  <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                    {donutData.healthyPct}%
                  </div>
                  <div className="text-[10px] text-emerald-700">{currentBranchSummary.healthyCount} items</div>
                </div>

                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Low Stock</span>
                  </div>
                  <div className="text-base font-extrabold text-amber-900 mt-0.5">
                    {donutData.lowPct}%
                  </div>
                  <div className="text-[10px] text-amber-700">{currentBranchSummary.lowStockCount} items</div>
                </div>

                <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Out of Stock</span>
                  </div>
                  <div className="text-base font-extrabold text-rose-900 mt-0.5">
                    {donutData.outPct}%
                  </div>
                  <div className="text-[10px] text-rose-700">{currentBranchSummary.outOfStockCount} items</div>
                </div>
              </div>
            </div>

            {/* Multi-Branch Comparison Bar Mini-List */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center justify-between">
                <span>Branch Stock Level Comparison</span>
                <span className="text-[11px] font-normal text-slate-500">Healthy vs Low vs Out</span>
              </h4>
              <div className="space-y-2">
                {branchSummaries
                  .filter((b) => b.branchId !== 'all')
                  .map((b) => {
                    const total = b.healthyCount + b.lowStockCount + b.outOfStockCount || 1;
                    const hW = (b.healthyCount / total) * 100;
                    const lW = (b.lowStockCount / total) * 100;
                    const oW = (b.outOfStockCount / total) * 100;

                    return (
                      <div key={b.branchId} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-800">{b.branchName}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatCurrency(b.retailValuation)}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div style={{ width: `${hW}%` }} className="bg-emerald-500" title={`Healthy: ${b.healthyCount}`} />
                          <div style={{ width: `${lW}%` }} className="bg-amber-400" title={`Low Stock: ${b.lowStockCount}`} />
                          <div style={{ width: `${oW}%` }} className="bg-rose-500" title={`Out of Stock: ${b.outOfStockCount}`} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Chart 2: Category-Wise Stock Valuation & Unit Distribution */}
          <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Top Category Stock Valuation & Unit Distribution
                  </h3>
                  <p className="text-xs text-slate-500">Ranked by total retail valuation in selected branch</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {categoryValuations.length} Primary Categories
                </span>
              </div>

              {/* Ranked Category Bars */}
              <div className="space-y-4">
                {categoryValuations.map((cat, idx) => {
                  const maxVal = categoryValuations[0]?.totalValue || 1;
                  const barWidth = Math.min(100, Math.max(6, (cat.totalValue / maxVal) * 100));

                  return (
                    <div key={cat.name} className="group">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900">{cat.name}</span>
                          <span className="text-[11px] text-slate-600 font-medium">({cat.skuCount} SKUs)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {cat.totalUnits.toLocaleString()} units
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrency(cat.totalValue)}
                          </span>
                        </div>
                      </div>

                      {/* Visual Horizontal Progress Bar */}
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                        <div
                          style={{ width: `${barWidth}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 group-hover:from-indigo-600 group-hover:to-purple-600"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Valuation Footer Note */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Live valuation synchronized across POS cash registers
              </span>
              <span>Updated: {lastRefreshedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </section>

        {/* ==========================================
            4. DEDICATED SPECIAL STOCK (7 RASAYANA ITEMS) LIVE PANEL
        ========================================== */}
        <section className="bg-gradient-to-br from-indigo-900/95 via-slate-900 to-[#0F172A] rounded-2xl p-6 text-white shadow-xl border border-indigo-500/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 pb-5 border-b border-indigo-800/40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Shift Controlled (A–F)
                </span>
                <span className="text-slate-400 text-xs font-mono">•</span>
                <span className="text-slate-300 text-xs">Branch: <strong className="text-white">{currentBranchSummary.branchName}</strong></span>
              </div>
              <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Special Stock Live Tracker & Analytics (7 Rasayana Items)
              </h3>
              <p className="text-slate-300 text-xs mt-1">
                Strict audit items tracked per shift handover. Live units auto-verified against shift closing drawers and physical registers.
              </p>
            </div>

            {/* Quick Restock Action for Special Stock */}
            <div>
              <button
                onClick={() => handleOpenAdjustment()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adjust Special Stock</span>
              </button>
            </div>
          </div>

          {/* Special Stock 4 KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <span className="text-[11px] uppercase tracking-wider text-purple-300 font-semibold">Special Stock on Hand</span>
              <div className="text-2xl font-black text-white mt-1">
                {specialStockKpis.totalUnits.toLocaleString()} <span className="text-xs font-normal text-slate-300">units</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <span className="text-[11px] uppercase tracking-wider text-purple-300 font-semibold">Total Retail Value</span>
              <div className="text-2xl font-black text-white mt-1">
                {formatCurrency(specialStockKpis.totalValue)}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Recent Shift Inflow (B)</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                +{specialStockKpis.totalIn.toLocaleString()} <span className="text-xs font-normal text-emerald-300">units</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <span className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">Recent Shift Sold (D)</span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                -{specialStockKpis.totalSold.toLocaleString()} <span className="text-xs font-normal text-amber-300">units</span>
              </div>
            </div>
          </div>

          {/* 7-Row Special Stock Ledger Table */}
          <div className="bg-slate-950/60 rounded-xl border border-indigo-500/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0F172A] text-white uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Special Item Name</th>
                    <th className="px-4 py-3 text-right">Branch Stock</th>
                    <th className="px-4 py-3 text-right">Rate (LKR)</th>
                    <th className="px-4 py-3 text-right">Stock Valuation</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-900/30 text-slate-200">
                  {liveSpecialStockRows.map((item) => (
                    <tr key={item.sku} className="hover:bg-white/5 transition">
                      <td className="px-4 py-3 font-mono font-bold text-purple-300">{item.sku}</td>
                      <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                        {item.unitsOnHand.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        Rs. {item.rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-extrabold text-white">
                        {formatCurrency(item.totalValue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'HEALTHY' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Healthy
                          </span>
                        )}
                        {item.status === 'LOW_STOCK' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Low Stock
                          </span>
                        )}
                        {item.status === 'OUT_OF_STOCK' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Out of Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            const foundItem = allItems.find(
                              (i) => i.id === item.productId && (selectedBranchId === 'all' || i.branchId === selectedBranchId)
                            );
                            handleOpenAdjustment(foundItem, selectedBranchId !== 'all' ? selectedBranchId : undefined);
                          }}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                        >
                          + Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ==========================================
            5. TABBED ACTIONABLE INVENTORY EXPLORER
        ========================================== */}
        <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header & Tabs */}
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  Inventory Explorer & Reorder Control
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Browse catalog items with stock-level health alerts, category filters, and immediate adjustment tools.
                </p>
              </div>

              {/* Total Filtered Count */}
              <div className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-900">{filteredItems.length.toLocaleString()}</strong> matching items
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab('all');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>All Stock</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {tabCounts.all.toLocaleString()}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('low');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'low'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Alerts</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'low' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                  {tabCounts.low.toLocaleString()}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('out');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'out'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <PackageX className="w-3.5 h-3.5" />
                <span>Out of Stock</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'out' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'}`}>
                  {tabCounts.out.toLocaleString()}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('slow');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'slow'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Slow-Moving 30d</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'slow' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'}`}>
                  {tabCounts.slow.toLocaleString()}
                </span>
              </button>
            </div>

            {/* Search, Category Filter, and Sort Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              {/* Search Box */}
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by Product Name, SKU, or Barcode..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="sm:col-span-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition"
                >
                  <option value="ALL">All Categories</option>
                  {rawCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Selector */}
              <div className="sm:col-span-3">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition"
                >
                  <option value="lowest_stock">Lowest Stock First</option>
                  <option value="highest_stock">Highest Stock First</option>
                  <option value="highest_value">Highest Stock Value</option>
                  <option value="name_asc">Name (A–Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0F172A] text-white uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Product & SKU</th>
                  <th className="px-4 py-3.5">Branch / Warehouse</th>
                  <th className="px-4 py-3.5 text-right">Quantity on Hand</th>
                  <th className="px-4 py-3.5 text-right">Cost (LKR)</th>
                  <th className="px-4 py-3.5 text-right">Retail (LKR)</th>
                  <th className="px-4 py-3.5 text-right">Total Valuation</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  {(activeTab === 'low' || activeTab === 'out') && (
                    <th className="px-4 py-3.5 text-right text-amber-700">Suggested Reorder</th>
                  )}
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Loading live branch inventory data...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <PackageCheck className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No inventory items matched your criteria.</p>
                        <p className="text-xs text-slate-400">Try adjusting your search query, active tab, or category filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const retailVal = item.quantityOnHand * item.retailPrice;

                    return (
                      <tr key={`${item.warehouseId}-${item.id}`} className="hover:bg-slate-50/80 transition">
                        {/* Product & SKU */}
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 leading-tight">{item.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono font-medium text-slate-600">{item.sku}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium text-[10px]">
                              {item.categoryName}
                            </span>
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{item.branchName}</div>
                          <div className="text-[10px] text-slate-400">Active Stock Hub</div>
                        </td>

                        {/* Quantity on Hand */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          <div className="font-black text-sm text-slate-900">
                            {formatUnits(item.quantityOnHand, item.unit)}
                          </div>
                          {/* Enhanced Visual Stock Gauge Bar */}
                          <div className="w-24 ml-auto h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5 p-0.5 border border-slate-200/60 shadow-inner">
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(6, (item.quantityOnHand / Math.max(item.alertQuantity * 2, 20)) * 100))}%`,
                              }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.quantityOnHand <= 0
                                  ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                                  : item.quantityOnHand <= item.alertQuantity
                                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Cost Price */}
                        <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                          Rs. {item.costPrice.toFixed(2)}
                        </td>

                        {/* Retail Price */}
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-900">
                          Rs. {item.retailPrice.toFixed(2)}
                        </td>

                        {/* Total Valuation */}
                        <td className="px-4 py-3.5 text-right font-mono font-extrabold text-slate-900">
                          {formatCurrency(retailVal)}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3.5 text-center">
                          {item.stockStatus === 'HEALTHY' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Healthy
                            </span>
                          )}
                          {item.stockStatus === 'LOW_STOCK' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Low Stock
                            </span>
                          )}
                          {item.stockStatus === 'OUT_OF_STOCK' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          )}
                          {item.stockStatus === 'SLOW_MOVING' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Slow-Moving
                            </span>
                          )}
                        </td>

                        {/* Suggested Reorder Qty */}
                        {(activeTab === 'low' || activeTab === 'out') && (
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-800">
                            +{item.suggestedReorderQty} units
                          </td>
                        )}

                        {/* Inline Pro Adjustment Action */}
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleOpenAdjustment(item, item.branchId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100 text-slate-700 rounded text-xs font-semibold transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Adjust</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 border border-slate-200 rounded bg-slate-50 font-medium text-slate-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                Page <strong className="text-slate-800">{currentPage}</strong> of <strong className="text-slate-800">{totalPages}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ==========================================
          6. INLINE QUICK STOCK ADJUSTMENT MODAL
      ========================================== */}
      {adjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-[95vw] max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  Quick Stock Adjustment & Physical Audit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update inventory counts directly for active branches with immediate register synchronization.
                </p>
              </div>
              <button
                onClick={() => setAdjustmentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              {/* Product Info Display */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Item</p>
                <h4 className="font-extrabold text-sm text-slate-900 mt-0.5">{adjustItem?.name}</h4>
                <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-1 font-mono">
                  <span>SKU: {adjustItem?.sku}</span>
                  <span>•</span>
                  <span>Retail: Rs. {adjustItem?.retailPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Branch Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Operating Branch</label>
                <select
                  value={adjustBranchId}
                  onChange={(e) => setAdjustBranchId(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {rawBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || 'BR'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Adjustment Mode Segmented Control */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs transition border cursor-pointer ${
                      adjustType === 'ADD'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    + Restock / GRN
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('DEDUCT')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs transition border cursor-pointer ${
                      adjustType === 'DEDUCT'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    - Damaged / Expired
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('SET')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs transition border cursor-pointer ${
                      adjustType === 'SET'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    = Audit Count
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {adjustType === 'ADD' && 'Units to Add to Stock'}
                  {adjustType === 'DEDUCT' && 'Units to Deduct from Stock'}
                  {adjustType === 'SET' && 'Exact Physical Counted Units'}
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={adjustQtyInput}
                  onChange={(e) => setAdjustQtyInput(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Calculation Preview */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs font-semibold text-indigo-900">
                <div>
                  <span className="text-[11px] text-indigo-600 block">Current Stock</span>
                  <span className="font-mono text-sm font-black">{adjustItem?.quantityOnHand || 0}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-[11px] text-indigo-600 block">Adjustment</span>
                  <span className="font-mono text-sm font-black">
                    {adjustType === 'ADD' && `+${adjustQtyInput || 0}`}
                    {adjustType === 'DEDUCT' && `-${adjustQtyInput || 0}`}
                    {adjustType === 'SET' && `Set to ${adjustQtyInput || 0}`}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-[11px] text-indigo-600 block">New Resulting Stock</span>
                  <span className="font-mono text-sm font-black text-indigo-700">
                    {(() => {
                      const cur = adjustItem?.quantityOnHand || 0;
                      const q = parseFloat(adjustQtyInput) || 0;
                      if (adjustType === 'ADD') return cur + q;
                      if (adjustType === 'DEDUCT') return Math.max(0, cur - q);
                      if (adjustType === 'SET') return q;
                      return cur;
                    })()}
                  </span>
                </div>
              </div>

              {/* Audit Reason Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Audit Reason / Note (Optional)</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Supplier delivery, monthly physical count, damaged packaging..."
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="shrink-0 p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setAdjustmentModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteAdjustment}
                disabled={isAdjusting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isAdjusting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Stock Adjustment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MotionPageShell>
  );
}

// Inline Helper Component for Icons
function PieChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
