import { supabase } from './supabase';

// ============================================================================
// CONSTANTS & 3 OPERATING BRANCHES (NO MAIN STORE)
// ============================================================================
export interface OperatingBranch {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
}

export const ACTIVE_BRANCHES: OperatingBranch[] = [
  {
    id: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
    name: 'Alawwa',
    code: 'ALW',
    warehouseId: '42f1fe9d-7e44-48eb-8eb0-10a6439b5619',
  },
  {
    id: 'fa68e4a0-a515-44c8-a082-5b5590366658',
    name: 'Dambadeniya',
    code: 'DAM',
    warehouseId: '6e8904dd-b753-434e-a22d-2d8e428f0a02',
  },
  {
    id: '197693d6-4247-48df-b614-6fcde9e34f7d',
    name: 'Giriulla',
    code: 'GIR',
    warehouseId: '5f0f4a53-75d7-411e-be5c-337ff170da50',
  },
];

export const ACTIVE_BRANCH_IDS = ACTIVE_BRANCHES.map((b) => b.id);
export const ACTIVE_WAREHOUSE_IDS = ACTIVE_BRANCHES.map((b) => b.warehouseId);

export const BRANCH_ID_TO_WAREHOUSE: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': '42f1fe9d-7e44-48eb-8eb0-10a6439b5619',
  'fa68e4a0-a515-44c8-a082-5b5590366658': '6e8904dd-b753-434e-a22d-2d8e428f0a02',
  '197693d6-4247-48df-b614-6fcde9e34f7d': '5f0f4a53-75d7-411e-be5c-337ff170da50',
};

export const WAREHOUSE_TO_BRANCH_ID: Record<string, string> = {
  '42f1fe9d-7e44-48eb-8eb0-10a6439b5619': '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54',
  '6e8904dd-b753-434e-a22d-2d8e428f0a02': 'fa68e4a0-a515-44c8-a082-5b5590366658',
  '5f0f4a53-75d7-411e-be5c-337ff170da50': '197693d6-4247-48df-b614-6fcde9e34f7d',
};

export const BRANCH_NAMES: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': 'Alawwa',
  'fa68e4a0-a515-44c8-a082-5b5590366658': 'Dambadeniya',
  '197693d6-4247-48df-b614-6fcde9e34f7d': 'Giriulla',
};

export const BRANCH_CODES: Record<string, string> = {
  '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': 'ALW',
  'fa68e4a0-a515-44c8-a082-5b5590366658': 'DAM',
  '197693d6-4247-48df-b614-6fcde9e34f7d': 'GIR',
};

export const DEFAULT_TENANT_ID = '0fef1423-5d89-4147-8af8-17c7e641c88a';
export const DEFAULT_OWNER_ID = '96b2747b-9d22-4266-94ce-b035fadef498';

// ============================================================================
// DATA TYPES
// ============================================================================
export type TransferStatus = 'PENDING' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
export type TransferDisplayStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type TransferPriority = 'NORMAL' | 'URGENT';

export function getDisplayStatus(status: TransferStatus): TransferDisplayStatus {
  if (status === 'PENDING') return 'PENDING_APPROVAL';
  if (status === 'RECEIVED' || status === 'DISPATCHED') return 'APPROVED';
  if (status === 'CANCELLED') return 'REJECTED';
  return 'PENDING_APPROVAL';
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  barcode?: string | null;
  unit_price: number;
  quantity_requested: number;
  quantity_dispatched: number;
  quantity_received: number;
  source_stock_on_hand: number;
  target_stock_on_hand: number;
  is_special_stock?: boolean;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  tracking_number: string;
  source_warehouse_id: string;
  target_warehouse_id: string;
  from_branch_id: string;
  from_branch_name: string;
  from_branch_code: string;
  to_branch_id: string;
  to_branch_name: string;
  to_branch_code: string;
  requested_by_id: string;
  requested_by_name: string;
  dispatched_by_name?: string;
  received_by_name?: string;
  rejected_by_name?: string;
  status: TransferStatus;
  display_status: TransferDisplayStatus;
  priority: TransferPriority;
  is_urgent: boolean;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  notes: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  items: StockTransferItem[];
}

export interface TransferProductSearchItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  retailPrice: number;
  costPrice: number;
  quantityOnHand: number;
  isSpecialStock?: boolean;
}

export interface CrossBranchProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  retailPrice: number;
  costPrice: number;
  isSpecialStock: boolean;
  appliedRate?: number;
  availability: {
    '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': number; // Alawwa
    'fa68e4a0-a515-44c8-a082-5b5590366658': number; // Dambadeniya
    '197693d6-4247-48df-b614-6fcde9e34f7d': number; // Giriulla
  };
}

export interface CreateTransferItemPayload {
  product_id: string;
  product_name?: string;
  sku?: string | null;
  unit_price?: number;
  quantity: number;
  is_special_stock?: boolean;
}

export interface CreateTransferPayload {
  from_branch_id: string;
  to_branch_id: string;
  requested_by_id?: string;
  requested_by_name?: string;
  priority?: TransferPriority;
  notes?: string;
  items: CreateTransferItemPayload[];
  immediateApproval?: boolean;
}

// Special Modaka SKUs Set for fast detection
const SPECIAL_MODAKA_SKUS = new Set([
  'SKU-1805',
  'SKU-108',
  'SKU-3268',
  'SKU-105',
  'SKU-3252',
  'SKU-3325',
  'SKU-3377',
]);

// ============================================================================
// TRANSFERS API IMPLEMENTATION
// ============================================================================
export const transfersApi = {
  getBranches: (): OperatingBranch[] => {
    return ACTIVE_BRANCHES;
  },

  /**
   * Live 3-Branch Stock Finder: Searches both regular catalog items and the 7 Special Stock items
   * across Alawwa, Dambadeniya, and Giriulla simultaneously.
   */
  searchCrossBranchInventory: async (query?: string): Promise<CrossBranchProductItem[]> => {
    try {
      const q = (query || '').trim().toLowerCase();

      // 1. Fetch active products, modaka configs, active shifts, and stock levels concurrently
      const [prodRes, modakaRes, stockRes, shiftsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price, is_active')
          .eq('is_active', true)
          .limit(3000),
        supabase
          .from('modaka_item_configs')
          .select('id, product_id, custom_rate, is_active, products(id, name, sku)')
          .eq('is_active', true),
        supabase
          .from('stock_levels')
          .select('product_id, warehouse_id, quantity_on_hand')
          .in('warehouse_id', ACTIVE_WAREHOUSE_IDS)
          .limit(10000),
        supabase
          .from('cashier_shifts')
          .select('id, branch_id, status')
          .eq('status', 'open')
          .order('started_at', { ascending: false }),
      ]);

      const specialProductIds = new Set<string>();
      const specialRateMap = new Map<string, number>();
      (modakaRes.data || []).forEach((m: any) => {
        if (m.product_id) {
          specialProductIds.add(m.product_id);
          specialRateMap.set(m.product_id, Number(m.custom_rate || 250));
        }
      });

      // Map stock_levels by `${warehouseId}_${productId}`
      const stockMap = new Map<string, number>();
      (stockRes.data || []).forEach((sl: any) => {
        stockMap.set(`${sl.warehouse_id}_${sl.product_id}`, Number(sl.quantity_on_hand || 0));
      });

      // For special stock items, check live active shifts' shift_modaka_entries
      const branchShiftSpecialStock = new Map<string, number>(); // `${branchId}_${productId}` -> closing_qty
      const openShiftIds = (shiftsRes.data || []).map((s: any) => s.id);

      if (openShiftIds.length > 0) {
        const { data: smeData } = await supabase
          .from('shift_modaka_entries')
          .select('shift_id, branch_id, product_id, closing_qty')
          .in('shift_id', openShiftIds);

        (smeData || []).forEach((entry: any) => {
          branchShiftSpecialStock.set(
            `${entry.branch_id}_${entry.product_id}`,
            Number(entry.closing_qty || 0)
          );
        });
      }

      const alawwaWh = BRANCH_ID_TO_WAREHOUSE['00f4cdcb-7d1c-4026-b57a-6e66c33b0c54'];
      const damWh = BRANCH_ID_TO_WAREHOUSE['fa68e4a0-a515-44c8-a082-5b5590366658'];
      const girWh = BRANCH_ID_TO_WAREHOUSE['197693d6-4247-48df-b614-6fcde9e34f7d'];

      const allProducts = (prodRes.data || []).filter((p: any) => {
        if (!q) return true;
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        return name.includes(q) || sku.includes(q) || barcode.includes(q);
      });

      return allProducts.map((p: any) => {
        const isSpecial =
          specialProductIds.has(p.id) ||
          SPECIAL_MODAKA_SKUS.has(p.sku) ||
          (p.name || '').toLowerCase().includes('modaka');

        // Check if active shift has live special stock for each branch, otherwise fallback to warehouse stock
        const alawwaShift = branchShiftSpecialStock.get(`00f4cdcb-7d1c-4026-b57a-6e66c33b0c54_${p.id}`);
        const damShift = branchShiftSpecialStock.get(`fa68e4a0-a515-44c8-a082-5b5590366658_${p.id}`);
        const girShift = branchShiftSpecialStock.get(`197693d6-4247-48df-b614-6fcde9e34f7d_${p.id}`);

        const alawwaStock = isSpecial && alawwaShift !== undefined
          ? alawwaShift
          : (stockMap.get(`${alawwaWh}_${p.id}`) || 0);

        const damStock = isSpecial && damShift !== undefined
          ? damShift
          : (stockMap.get(`${damWh}_${p.id}`) || 0);

        const girStock = isSpecial && girShift !== undefined
          ? girShift
          : (stockMap.get(`${girWh}_${p.id}`) || 0);

        return {
          id: p.id,
          name: p.name || 'Ayurvedic Medicine',
          sku: p.sku || '',
          barcode: p.barcode || '',
          retailPrice: Number(p.retail_price || 0),
          costPrice: Number(p.cost_price || 0),
          isSpecialStock: isSpecial,
          appliedRate: specialRateMap.get(p.id) || (isSpecial ? 250 : undefined),
          availability: {
            '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54': Math.max(0, alawwaStock),
            'fa68e4a0-a515-44c8-a082-5b5590366658': Math.max(0, damStock),
            '197693d6-4247-48df-b614-6fcde9e34f7d': Math.max(0, girStock),
          },
        };
      });
    } catch (err: any) {
      console.error('[transfersApi] searchCrossBranchInventory fatal:', err);
      return [];
    }
  },

  getProductsForBranch: async (branchId: string): Promise<TransferProductSearchItem[]> => {
    try {
      const warehouseId = BRANCH_ID_TO_WAREHOUSE[branchId];
      if (!warehouseId) return [];

      const [prodRes, stockRes, modakaRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price, is_active')
          .eq('is_active', true)
          .limit(3000),
        supabase
          .from('stock_levels')
          .select('product_id, quantity_on_hand')
          .eq('warehouse_id', warehouseId)
          .limit(10000),
        supabase
          .from('modaka_item_configs')
          .select('product_id')
          .eq('is_active', true),
      ]);

      const specialProductIds = new Set<string>();
      (modakaRes.data || []).forEach((m: any) => {
        if (m.product_id) specialProductIds.add(m.product_id);
      });

      const stockMap = new Map<string, number>();
      (stockRes.data || []).forEach((sl: any) => {
        stockMap.set(sl.product_id, Number(sl.quantity_on_hand || 0));
      });

      return (prodRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'Ayurvedic Product',
        sku: p.sku || '',
        barcode: p.barcode || '',
        retailPrice: Number(p.retail_price || 0),
        costPrice: Number(p.cost_price || 0),
        quantityOnHand: stockMap.get(p.id) || 0,
        isSpecialStock: specialProductIds.has(p.id) || SPECIAL_MODAKA_SKUS.has(p.sku),
      }));
    } catch (err: any) {
      console.error('[transfersApi] getProductsForBranch fatal:', err);
      return [];
    }
  },

  getTransfers: async (filter?: {
    status?: string;
    branchId?: string;
  }): Promise<{ success: boolean; data: StockTransfer[]; error?: string }> => {
    try {
      // 1. Fetch transfers, users, stock levels, and products concurrently
      const [transfersRes, usersRes, stockRes, prodRes] = await Promise.all([
        supabase
          .from('stock_transfers')
          .select('id, tenant_id, source_warehouse_id, target_warehouse_id, requested_by_id, status, tracking_number, notes, dispatched_at, received_at, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('users').select('id, full_name, role'),
        supabase
          .from('stock_levels')
          .select('product_id, warehouse_id, quantity_on_hand')
          .in('warehouse_id', ACTIVE_WAREHOUSE_IDS)
          .limit(10000),
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price')
          .limit(3000),
      ]);

      if (transfersRes.error) {
        throw new Error(transfersRes.error.message);
      }

      const rawTransfers = transfersRes.data || [];
      if (rawTransfers.length === 0) {
        return { success: true, data: [] };
      }

      // 2. Fetch items for these transfers
      const transferIds = rawTransfers.map((t) => t.id);
      const itemPromises: Promise<any>[] = [];
      for (let i = 0; i < transferIds.length; i += 500) {
        const chunk = transferIds.slice(i, i + 500);
        itemPromises.push(
          Promise.resolve(
            supabase
              .from('stock_transfer_items')
              .select('id, transfer_id, product_id, quantity_requested, quantity_dispatched, quantity_received')
              .in('transfer_id', chunk)
          )
        );
      }
      const itemResponses = await Promise.all(itemPromises);
      const rawItems: any[] = [];
      itemResponses.forEach((res) => {
        if (res.data) rawItems.push(...res.data);
      });

      // 3. Build lookups
      const userMap = new Map<string, string>();
      (usersRes.data || []).forEach((u: any) => {
        userMap.set(u.id, u.full_name || 'Staff Member');
      });

      const productMap = new Map<string, any>();
      (prodRes.data || []).forEach((p: any) => productMap.set(p.id, p));

      const stockLookup = new Map<string, number>();
      (stockRes.data || []).forEach((sl: any) => {
        stockLookup.set(`${sl.warehouse_id}_${sl.product_id}`, Number(sl.quantity_on_hand || 0));
      });

      const itemsByTransfer = new Map<string, any[]>();
      rawItems.forEach((it) => {
        const list = itemsByTransfer.get(it.transfer_id) || [];
        list.push(it);
        itemsByTransfer.set(it.transfer_id, list);
      });

      // 4. Map into rich StockTransfer models
      const mapped: StockTransfer[] = rawTransfers.map((row: any) => {
        const fromBranchId = WAREHOUSE_TO_BRANCH_ID[row.source_warehouse_id] || '';
        const toBranchId = WAREHOUSE_TO_BRANCH_ID[row.target_warehouse_id] || '';
        const fromName = BRANCH_NAMES[fromBranchId] || 'Branch';
        const toName = BRANCH_NAMES[toBranchId] || 'Branch';
        const fromCode = BRANCH_CODES[fromBranchId] || 'BR';
        const toCode = BRANCH_CODES[toBranchId] || 'BR';

        const rawNotes = row.notes || '';
        const isUrgent = rawNotes.includes('[PRIORITY: URGENT]');
        const priority: TransferPriority = isUrgent ? 'URGENT' : 'NORMAL';

        // Extract audit names from notes if present
        let dispatchedByName: string | undefined;
        let receivedByName: string | undefined;
        let rejectedByName: string | undefined;

        const dispMatch = rawNotes.match(/\[Dispatched by ([^\]]+) on/);
        if (dispMatch && dispMatch[1]) dispatchedByName = dispMatch[1].trim();

        const recMatch = rawNotes.match(/\[Received by ([^\]]+) on/);
        if (recMatch && recMatch[1]) receivedByName = recMatch[1].trim();

        const rejMatch = rawNotes.match(/\[Rejected by ([^\]]+) on/);
        if (rejMatch && rejMatch[1]) rejectedByName = rejMatch[1].trim();

        const transferItemsRaw = itemsByTransfer.get(row.id) || [];
        let totalQty = 0;
        let totalAmt = 0;

        const items: StockTransferItem[] = transferItemsRaw.map((it: any) => {
          const prod = productMap.get(it.product_id);
          const reqQty = Number(it.quantity_requested || 0);
          const dispQty = Number(it.quantity_dispatched || reqQty);
          const recQty = Number(it.quantity_received || dispQty);
          const price = Number(prod?.retail_price || 0);
          const isSpecial = SPECIAL_MODAKA_SKUS.has(prod?.sku) || (prod?.name || '').toLowerCase().includes('modaka');

          totalQty += reqQty;
          totalAmt += reqQty * price;

          const sourceStock = stockLookup.get(`${row.source_warehouse_id}_${it.product_id}`) || 0;
          const targetStock = stockLookup.get(`${row.target_warehouse_id}_${it.product_id}`) || 0;

          return {
            id: it.id,
            transfer_id: it.transfer_id,
            product_id: it.product_id,
            product_name: prod?.name || 'Ayurvedic Medicine',
            sku: prod?.sku || null,
            barcode: prod?.barcode || null,
            unit_price: price,
            quantity_requested: reqQty,
            quantity_dispatched: dispQty,
            quantity_received: recQty,
            source_stock_on_hand: sourceStock,
            target_stock_on_hand: targetStock,
            is_special_stock: isSpecial,
          };
        });

        const status = row.status as TransferStatus;
        const displayStatus = getDisplayStatus(status);

        return {
          id: row.id,
          tenant_id: row.tenant_id,
          tracking_number: row.tracking_number,
          source_warehouse_id: row.source_warehouse_id,
          target_warehouse_id: row.target_warehouse_id,
          from_branch_id: fromBranchId,
          from_branch_name: fromName,
          from_branch_code: fromCode,
          to_branch_id: toBranchId,
          to_branch_name: toName,
          to_branch_code: toCode,
          requested_by_id: row.requested_by_id,
          requested_by_name: userMap.get(row.requested_by_id) || 'Staff Cashier',
          dispatched_by_name: dispatchedByName,
          received_by_name: receivedByName,
          rejected_by_name: rejectedByName,
          status,
          display_status: displayStatus,
          priority,
          is_urgent: isUrgent,
          total_items: items.length,
          total_quantity: Math.round(totalQty * 1000) / 1000,
          total_amount: Math.round(totalAmt * 100) / 100,
          notes: row.notes,
          dispatched_at: row.dispatched_at,
          received_at: row.received_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items,
        };
      });

      let filtered = mapped;
      if (filter?.status && filter.status !== 'ALL') {
        filtered = filtered.filter((t) => t.display_status === filter.status || t.status === filter.status);
      }
      if (filter?.branchId && filter.branchId !== 'all') {
        filtered = filtered.filter(
          (t) => t.from_branch_id === filter.branchId || t.to_branch_id === filter.branchId
        );
      }

      return { success: true, data: filtered };
    } catch (err: any) {
      console.error('[transfersApi] getTransfers fatal error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Step 1: Create Transfer Request.
   * Status is PENDING. ZERO stock deduction or addition happens yet.
   */
  createTransfer: async (
    payload: CreateTransferPayload
  ): Promise<{ success: boolean; data?: StockTransfer; error?: string }> => {
    try {
      if (payload.from_branch_id === payload.to_branch_id) {
        throw new Error('From Branch and To Branch must be different locations.');
      }
      if (!payload.items || payload.items.length === 0) {
        throw new Error('Please add at least one product to the transfer request.');
      }

      const sourceWarehouseId = BRANCH_ID_TO_WAREHOUSE[payload.from_branch_id];
      const targetWarehouseId = BRANCH_ID_TO_WAREHOUSE[payload.to_branch_id];

      if (!sourceWarehouseId || !targetWarehouseId) {
        throw new Error('Invalid operating branch selected. Only Alawwa, Dambadeniya, and Giriulla are permitted.');
      }

      // Generate tracking number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('stock_transfers')
        .select('id', { count: 'exact', head: true });
      const nextNum = (count || 0) + 1;
      const trackingNumber = `TRF-${year}-${String(nextNum).padStart(4, '0')}`;

      const requestedById = payload.requested_by_id || DEFAULT_OWNER_ID;
      const initialStatus: TransferStatus = payload.immediateApproval ? 'RECEIVED' : 'PENDING';
      const nowIso = new Date().toISOString();

      let notesWithPriority = payload.notes?.trim() || '';
      if (payload.priority === 'URGENT') {
        notesWithPriority = `[PRIORITY: URGENT] ${notesWithPriority}`.trim();
      }

      // 1. Insert parent StockTransfer record
      const { data: transferRow, error: tErr } = await supabase
        .from('stock_transfers')
        .insert({
          tenant_id: DEFAULT_TENANT_ID,
          source_warehouse_id: sourceWarehouseId,
          target_warehouse_id: targetWarehouseId,
          requested_by_id: requestedById,
          status: initialStatus,
          tracking_number: trackingNumber,
          notes: notesWithPriority || null,
          dispatched_at: payload.immediateApproval ? nowIso : null,
          received_at: payload.immediateApproval ? nowIso : null,
        })
        .select()
        .single();

      if (tErr || !transferRow) {
        throw new Error(tErr?.message || 'Failed to create stock transfer record in database.');
      }

      // 2. Insert line items
      const itemsToInsert = payload.items.map((it) => {
        const qty = Number(it.quantity || 0);
        return {
          tenant_id: DEFAULT_TENANT_ID,
          transfer_id: transferRow.id,
          product_id: it.product_id,
          quantity_requested: qty,
          quantity_dispatched: payload.immediateApproval ? qty : 0,
          quantity_received: payload.immediateApproval ? qty : 0,
        };
      });

      const { error: itemsErr } = await supabase
        .from('stock_transfer_items')
        .insert(itemsToInsert);

      if (itemsErr) {
        console.error('[transfersApi] stock_transfer_items error:', itemsErr);
        await supabase.from('stock_transfers').delete().eq('id', transferRow.id);
        throw new Error(`Failed to save transfer line items: ${itemsErr.message}`);
      }

      // 3. If Immediate Approval requested, execute stock movements
      if (payload.immediateApproval) {
        await executeDeductionFromSource(
          sourceWarehouseId,
          payload.from_branch_id,
          payload.items.map((it) => ({
            product_id: it.product_id,
            quantity: Number(it.quantity || 0),
          }))
        );
        await executeAdditionToTarget(
          targetWarehouseId,
          payload.to_branch_id,
          payload.items.map((it) => ({
            product_id: it.product_id,
            quantity: Number(it.quantity || 0),
          }))
        );
      }

      return {
        success: true,
        data: {
          ...transferRow,
          items: itemsToInsert as any,
        },
      };
    } catch (err: any) {
      console.error('[transfersApi] createTransfer fatal:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Step 2: Approve & Dispatch.
   * Sending Branch staff or Owner confirms. Atomically deducts from Sending Branch stock.
   */
  dispatchTransfer: async (
    transferId: string,
    dispatchedById: string,
    dispatchedByName: string,
    approvedQuantities?: Record<string, number>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .select('*')
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) throw new Error('Transfer record not found.');
      if (transfer.status === 'DISPATCHED' || transfer.status === 'RECEIVED') {
        throw new Error('This transfer has already been dispatched.');
      }
      if (transfer.status === 'CANCELLED') {
        throw new Error('Cannot dispatch a cancelled or rejected transfer.');
      }

      const { data: items, error: iErr } = await supabase
        .from('stock_transfer_items')
        .select('*')
        .eq('transfer_id', transferId);

      if (iErr || !items || items.length === 0) {
        throw new Error('Transfer has no line items to dispatch.');
      }

      const sourceWarehouseId = transfer.source_warehouse_id;
      const fromBranchId = WAREHOUSE_TO_BRANCH_ID[sourceWarehouseId] || '';

      const deductionList: { product_id: string; quantity: number }[] = [];

      for (const item of items) {
        let finalQty = Number(item.quantity_requested || 0);
        if (editedQuantitiesSafe(approvedQuantities, item.id)) {
          finalQty = Math.max(0, Number(approvedQuantities![item.id]));
        }

        if (finalQty > 0) {
          deductionList.push({ product_id: item.product_id, quantity: finalQty });
        }

        await supabase
          .from('stock_transfer_items')
          .update({
            quantity_requested: finalQty,
            quantity_dispatched: finalQty,
          })
          .eq('id', item.id);
      }

      // Atomically deduct stock from Sending Branch
      await executeDeductionFromSource(sourceWarehouseId, fromBranchId, deductionList);

      const nowIso = new Date().toISOString();
      const colomboFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const dispatchNote = `[Dispatched by ${dispatchedByName || 'Staff'}${dispatchedById ? ` (ID: ${dispatchedById})` : ''} on ${colomboFormatter.format(new Date())}]`;
      const updatedNotes = transfer.notes ? `${transfer.notes}\n${dispatchNote}` : dispatchNote;

      const { error: updErr } = await supabase
        .from('stock_transfers')
        .update({
          status: 'DISPATCHED',
          dispatched_at: nowIso,
          notes: updatedNotes,
          updated_at: nowIso,
        })
        .eq('id', transferId);

      if (updErr) throw updErr;

      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] dispatchTransfer fatal:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Step 3: Confirm Stock Received.
   * Requesting Branch staff or Owner confirms receipt. Atomically adds to Receiving Branch stock.
   */
  receiveTransfer: async (
    transferId: string,
    receivedById: string,
    receivedByName: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .select('*')
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) throw new Error('Transfer record not found.');
      if (transfer.status === 'RECEIVED') {
        throw new Error('This transfer has already been completed.');
      }
      if (transfer.status === 'CANCELLED') {
        throw new Error('Cannot receive a cancelled or rejected transfer.');
      }
      if (transfer.status === 'PENDING') {
        throw new Error('Transfer must be dispatched by the sending branch before receipt can be confirmed.');
      }

      const { data: items, error: iErr } = await supabase
        .from('stock_transfer_items')
        .select('*')
        .eq('transfer_id', transferId);

      if (iErr || !items || items.length === 0) {
        throw new Error('Transfer has no line items.');
      }

      const targetWarehouseId = transfer.target_warehouse_id;
      const toBranchId = WAREHOUSE_TO_BRANCH_ID[targetWarehouseId] || '';

      const additionList: { product_id: string; quantity: number }[] = [];

      for (const item of items) {
        const qty = Number(item.quantity_dispatched || item.quantity_requested || 0);
        if (qty > 0) {
          additionList.push({ product_id: item.product_id, quantity: qty });
        }
        await supabase
          .from('stock_transfer_items')
          .update({
            quantity_received: qty,
          })
          .eq('id', item.id);
      }

      // Atomically add stock to Receiving Branch
      await executeAdditionToTarget(targetWarehouseId, toBranchId, additionList);

      const nowIso = new Date().toISOString();
      const colomboFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const receiveNote = `[Received by ${receivedByName || 'Staff'}${receivedById ? ` (ID: ${receivedById})` : ''} on ${colomboFormatter.format(new Date())}]`;
      const updatedNotes = transfer.notes ? `${transfer.notes}\n${receiveNote}` : receiveNote;

      const { error: updErr } = await supabase
        .from('stock_transfers')
        .update({
          status: 'RECEIVED',
          received_at: nowIso,
          notes: updatedNotes,
          updated_at: nowIso,
        })
        .eq('id', transferId);

      if (updErr) throw updErr;

      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] receiveTransfer fatal:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Backward compatible alias for approveTransfer: dispatches if PENDING
   */
  approveTransfer: async (
    transferId: string,
    approvedById: string,
    approvedByName: string,
    editedQuantities?: Record<string, number>
  ): Promise<{ success: boolean; error?: string }> => {
    return transfersApi.dispatchTransfer(transferId, approvedById, approvedByName, editedQuantities);
  },

  /**
   * Reject or Cancel Transfer.
   * If PENDING: zero stock change.
   * If DISPATCHED: restore deducted stock back to Sending Branch.
   */
  rejectTransfer: async (
    transferId: string,
    rejectedByName: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .select('*')
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) throw new Error('Transfer record not found.');
      if (transfer.status === 'RECEIVED') {
        throw new Error('Cannot reject a transfer that has already been completed.');
      }

      // If already dispatched, restore deducted stock back to source branch
      if (transfer.status === 'DISPATCHED') {
        const { data: items } = await supabase
          .from('stock_transfer_items')
          .select('*')
          .eq('transfer_id', transferId);

        if (items && items.length > 0) {
          const fromBranchId = WAREHOUSE_TO_BRANCH_ID[transfer.source_warehouse_id] || '';
          await executeAdditionToTarget(
            transfer.source_warehouse_id,
            fromBranchId,
            items.map((it: any) => ({
              product_id: it.product_id,
              quantity: Number(it.quantity_dispatched || it.quantity_requested || 0),
            }))
          );
        }
      }

      const nowIso = new Date().toISOString();
      const colomboFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const rejectionNote = `[Rejected by ${rejectedByName || 'Staff'} on ${colomboFormatter.format(new Date())}]: ${reason || 'Cancelled'}`;
      const updatedNotes = transfer.notes ? `${transfer.notes}\n${rejectionNote}` : rejectionNote;

      const { error: updErr } = await supabase
        .from('stock_transfers')
        .update({
          status: 'CANCELLED',
          notes: updatedNotes,
          updated_at: nowIso,
        })
        .eq('id', transferId);

      if (updErr) throw updErr;
      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] rejectTransfer fatal:', err);
      return { success: false, error: err.message };
    }
  },
};

function editedQuantitiesSafe(dict: Record<string, number> | undefined, key: string): boolean {
  return dict !== undefined && dict[key] !== undefined && !isNaN(dict[key]);
}

// ============================================================================
// ATOMIC STOCK MOVEMENT HELPERS
// ============================================================================

/**
 * Deducts stock from source warehouse and updates active shift shift_modaka_entries if special item.
 */
async function executeDeductionFromSource(
  sourceWarehouseId: string,
  fromBranchId: string,
  items: { product_id: string; quantity: number }[]
): Promise<void> {
  const nowIso = new Date().toISOString();

  // Find active open shift for sending branch (if any) to sync Modaka closing balance
  const { data: sourceShift } = await supabase
    .from('cashier_shifts')
    .select('id')
    .eq('branch_id', fromBranchId)
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    // 1. Deduct from stock_levels
    const { data: sourceStockRow } = await supabase
      .from('stock_levels')
      .select('id, quantity_on_hand')
      .eq('warehouse_id', sourceWarehouseId)
      .eq('product_id', item.product_id)
      .maybeSingle();

    if (sourceStockRow?.id) {
      const currentSourceQty = Number(sourceStockRow.quantity_on_hand || 0);
      const newSourceQty = Math.max(0, currentSourceQty - qty);

      await supabase
        .from('stock_levels')
        .update({
          quantity_on_hand: newSourceQty,
          branch_id: fromBranchId || null,
          updated_at: nowIso,
        })
        .eq('id', sourceStockRow.id);
    }

    // 2. If special item and sending branch has active shift, sync shift_modaka_entries
    if (sourceShift?.id) {
      const { data: smeRow } = await supabase
        .from('shift_modaka_entries')
        .select('id, closing_qty, in_qty, opening_qty, sold_qty')
        .eq('shift_id', sourceShift.id)
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (smeRow?.id) {
        const nextClosing = Math.max(0, Number(smeRow.closing_qty || 0) - qty);
        await supabase
          .from('shift_modaka_entries')
          .update({
            closing_qty: nextClosing,
            updated_at: nowIso,
          })
          .eq('id', smeRow.id);
      }
    }
  }
}

/**
 * Adds stock to target warehouse and updates active shift shift_modaka_entries if special item.
 */
async function executeAdditionToTarget(
  targetWarehouseId: string,
  toBranchId: string,
  items: { product_id: string; quantity: number }[]
): Promise<void> {
  const nowIso = new Date().toISOString();

  // Find active open shift for receiving branch (if any) to sync Modaka closing balance
  const { data: targetShift } = await supabase
    .from('cashier_shifts')
    .select('id')
    .eq('branch_id', toBranchId)
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    // 1. Add to stock_levels
    const { data: targetStockRow } = await supabase
      .from('stock_levels')
      .select('id, quantity_on_hand')
      .eq('warehouse_id', targetWarehouseId)
      .eq('product_id', item.product_id)
      .maybeSingle();

    if (targetStockRow?.id) {
      const currentTargetQty = Number(targetStockRow.quantity_on_hand || 0);
      const newTargetQty = currentTargetQty + qty;

      await supabase
        .from('stock_levels')
        .update({
          quantity_on_hand: newTargetQty,
          branch_id: toBranchId || null,
          updated_at: nowIso,
        })
        .eq('id', targetStockRow.id);
    } else {
      await supabase.from('stock_levels').insert({
        tenant_id: DEFAULT_TENANT_ID,
        warehouse_id: targetWarehouseId,
        branch_id: toBranchId || null,
        product_id: item.product_id,
        quantity_on_hand: qty,
        quantity_reserved: 0,
        reorder_point: 5,
        updated_at: nowIso,
      });
    }

    // 2. If special item and receiving branch has active shift, sync shift_modaka_entries
    if (targetShift?.id) {
      const { data: smeRow } = await supabase
        .from('shift_modaka_entries')
        .select('id, opening_qty, in_qty, sold_qty, closing_qty')
        .eq('shift_id', targetShift.id)
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (smeRow?.id) {
        const nextIn = Number(smeRow.in_qty || 0) + qty;
        const nextClosing = (Number(smeRow.opening_qty || 0) + nextIn) - Number(smeRow.sold_qty || 0);
        await supabase
          .from('shift_modaka_entries')
          .update({
            in_qty: nextIn,
            total_available_qty: Number(smeRow.opening_qty || 0) + nextIn,
            closing_qty: Math.max(0, nextClosing),
            updated_at: nowIso,
          })
          .eq('id', smeRow.id);
      }
    }
  }
}
