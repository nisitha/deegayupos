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
  status: TransferStatus;
  display_status: TransferDisplayStatus;
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
}

export interface CreateTransferItemPayload {
  product_id: string;
  product_name?: string;
  sku?: string | null;
  unit_price?: number;
  quantity: number;
}

export interface CreateTransferPayload {
  from_branch_id: string;
  to_branch_id: string;
  requested_by_id?: string;
  requested_by_name?: string;
  notes?: string;
  items: CreateTransferItemPayload[];
  immediateApproval?: boolean;
}

// ============================================================================
// TRANSFERS API IMPLEMENTATION
// ============================================================================
export const transfersApi = {
  getBranches: (): OperatingBranch[] => {
    return ACTIVE_BRANCHES;
  },

  getProductsForBranch: async (branchId: string): Promise<TransferProductSearchItem[]> => {
    try {
      const warehouseId = BRANCH_ID_TO_WAREHOUSE[branchId];
      if (!warehouseId) {
        console.warn('[transfersApi] Unknown branchId for warehouse mapping:', branchId);
        return [];
      }

      // Fetch active catalog products and current branch stock concurrently
      const [prodRes0, prodRes1, prodRes2, prodRes3, stockRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price, is_active')
          .eq('is_active', true)
          .range(0, 999),
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price, is_active')
          .eq('is_active', true)
          .range(1000, 1999),
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price, is_active')
          .eq('is_active', true)
          .range(2000, 2999),
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price, is_active')
          .eq('is_active', true)
          .range(3000, 3999),
        supabase
          .from('stock_levels')
          .select('product_id, quantity_on_hand')
          .eq('warehouse_id', warehouseId)
          .limit(10000),
      ]);

      const allProducts: any[] = [];
      [prodRes0.data, prodRes1.data, prodRes2.data, prodRes3.data].forEach((chunk) => {
        if (chunk) allProducts.push(...chunk);
      });

      const stockMap = new Map<string, number>();
      (stockRes.data || []).forEach((sl: any) => {
        stockMap.set(sl.product_id, Number(sl.quantity_on_hand || 0));
      });

      return allProducts.map((p) => ({
        id: p.id,
        name: p.name || 'Ayurvedic Product',
        sku: p.sku || '',
        barcode: p.barcode || '',
        retailPrice: Number(p.retail_price || 0),
        costPrice: Number(p.cost_price || 0),
        quantityOnHand: stockMap.get(p.id) || 0,
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
      // 1. Concurrently fetch transfers, items, products, users, and stock levels
      const [transfersRes, usersRes, stockRes, prodRes0, prodRes1, prodRes2] = await Promise.all([
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
          .range(0, 999),
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price')
          .range(1000, 1999),
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price')
          .range(2000, 2999),
      ]);

      if (transfersRes.error) {
        throw new Error(transfersRes.error.message);
      }

      const rawTransfers = transfersRes.data || [];
      if (rawTransfers.length === 0) {
        return { success: true, data: [] };
      }

      // 2. Fetch items for these transfers in chunks of 500
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
      [prodRes0.data, prodRes1.data, prodRes2.data].forEach((chunk) => {
        if (chunk) {
          chunk.forEach((p: any) => productMap.set(p.id, p));
        }
      });

      // warehouse_id + product_id -> quantity_on_hand
      const stockLookup = new Map<string, number>();
      (stockRes.data || []).forEach((sl: any) => {
        stockLookup.set(`${sl.warehouse_id}_${sl.product_id}`, Number(sl.quantity_on_hand || 0));
      });

      // Group items by transfer_id
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

        const transferItemsRaw = itemsByTransfer.get(row.id) || [];
        let totalQty = 0;
        let totalAmt = 0;

        const items: StockTransferItem[] = transferItemsRaw.map((it: any) => {
          const prod = productMap.get(it.product_id);
          const reqQty = Number(it.quantity_requested || 0);
          const dispQty = Number(it.quantity_dispatched || reqQty);
          const recQty = Number(it.quantity_received || dispQty);
          const price = Number(prod?.retail_price || 0);

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
          status,
          display_status: displayStatus,
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

      // Filter by status if requested
      let filtered = mapped;
      if (filter?.status && filter.status !== 'ALL') {
        filtered = filtered.filter((t) => t.display_status === filter.status || t.status === filter.status);
      }

      // Filter by branch if requested
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

  createTransfer: async (
    payload: CreateTransferPayload
  ): Promise<{ success: boolean; data?: StockTransfer; error?: string }> => {
    try {
      if (payload.from_branch_id === payload.to_branch_id) {
        throw new Error('From Branch and To Branch must be different locations.');
      }
      if (!payload.items || payload.items.length === 0) {
        throw new Error('Please add at least one product to the transfer.');
      }

      const sourceWarehouseId = BRANCH_ID_TO_WAREHOUSE[payload.from_branch_id];
      const targetWarehouseId = BRANCH_ID_TO_WAREHOUSE[payload.to_branch_id];

      if (!sourceWarehouseId || !targetWarehouseId) {
        throw new Error('Invalid operating branch selected. Only Alawwa, Dambadeniya, and Giriulla are permitted.');
      }

      // Generate unique sequential tracking number: TRF-YYYY-XXXX
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('stock_transfers')
        .select('id', { count: 'exact', head: true });
      const nextNum = (count || 0) + 1;
      const trackingNumber = `TRF-${year}-${String(nextNum).padStart(4, '0')}`;

      const requestedById = payload.requested_by_id || DEFAULT_OWNER_ID;
      const initialStatus: TransferStatus = payload.immediateApproval ? 'RECEIVED' : 'PENDING';
      const nowIso = new Date().toISOString();

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
          notes: payload.notes || null,
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
        // Rollback parent record
        await supabase.from('stock_transfers').delete().eq('id', transferRow.id);
        throw new Error(`Failed to save transfer line items: ${itemsErr.message}`);
      }

      // 3. If Immediate Owner Approval was selected, execute atomic stock movements right now
      if (payload.immediateApproval) {
        await executeAtomicStockMovement(
          sourceWarehouseId,
          targetWarehouseId,
          payload.from_branch_id,
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

  approveTransfer: async (
    transferId: string,
    approvedById: string,
    approvedByName: string,
    editedQuantities?: Record<string, number>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Fetch existing transfer with items
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .select('*')
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) throw new Error('Transfer record not found.');
      if (transfer.status === 'RECEIVED') {
        throw new Error('This transfer has already been approved and completed.');
      }
      if (transfer.status === 'CANCELLED') {
        throw new Error('Cannot approve a cancelled or rejected transfer.');
      }

      const { data: items, error: iErr } = await supabase
        .from('stock_transfer_items')
        .select('*')
        .eq('transfer_id', transferId);

      if (iErr || !items || items.length === 0) {
        throw new Error('Transfer has no line items to process.');
      }

      const sourceWarehouseId = transfer.source_warehouse_id;
      const targetWarehouseId = transfer.target_warehouse_id;
      const fromBranchId = WAREHOUSE_TO_BRANCH_ID[sourceWarehouseId] || '';
      const toBranchId = WAREHOUSE_TO_BRANCH_ID[targetWarehouseId] || '';

      // 2. Prepare approved quantities & update line items if adjusted by Owner
      const stockMovementList: { product_id: string; quantity: number }[] = [];

      for (const item of items) {
        let finalQty = Number(item.quantity_requested || 0);
        if (editedQuantities && editedQuantities[item.id] !== undefined) {
          finalQty = Math.max(0, Number(editedQuantities[item.id]));
        }

        if (finalQty > 0) {
          stockMovementList.push({ product_id: item.product_id, quantity: finalQty });
        }

        // Update item line dispatched & received
        await supabase
          .from('stock_transfer_items')
          .update({
            quantity_requested: finalQty,
            quantity_dispatched: finalQty,
            quantity_received: finalQty,
          })
          .eq('id', item.id);
      }

      // 3. Atomically transfer inventory between branch warehouses
      await executeAtomicStockMovement(
        sourceWarehouseId,
        targetWarehouseId,
        fromBranchId,
        toBranchId,
        stockMovementList
      );

      // 4. Update parent transfer status to RECEIVED (Approved & Completed)
      const nowIso = new Date().toISOString();
      const colomboFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const approvalAuditNote = `[Approved by ${approvedByName || 'Owner'}${approvedById ? ` (ID: ${approvedById})` : ''} on ${colomboFormatter.format(new Date())}]`;
      const updatedNotes = transfer.notes
        ? `${transfer.notes}\n${approvalAuditNote}`
        : approvalAuditNote;

      const { error: updErr } = await supabase
        .from('stock_transfers')
        .update({
          status: 'RECEIVED',
          dispatched_at: transfer.dispatched_at || nowIso,
          received_at: nowIso,
          notes: updatedNotes,
          updated_at: nowIso,
        })
        .eq('id', transferId);

      if (updErr) throw updErr;

      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] approveTransfer fatal:', err);
      return { success: false, error: err.message };
    }
  },

  rejectTransfer: async (
    transferId: string,
    rejectedByName: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .select('id, notes, status')
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) throw new Error('Transfer record not found.');
      if (transfer.status === 'RECEIVED') {
        throw new Error('Cannot reject a transfer that has already been approved and executed.');
      }

      const nowIso = new Date().toISOString();
      const colomboFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const rejectionNote = `[Rejected by ${rejectedByName || 'Owner'} on ${colomboFormatter.format(new Date())}]: ${reason || 'Rejected by Owner'}`;
      const updatedNotes = transfer.notes
        ? `${transfer.notes}\n${rejectionNote}`
        : rejectionNote;

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

// ============================================================================
// ATOMIC STOCK MOVEMENT HELPER (SAFE DEDUCT & ADD)
// ============================================================================
async function executeAtomicStockMovement(
  sourceWarehouseId: string,
  targetWarehouseId: string,
  fromBranchId: string,
  toBranchId: string,
  items: { product_id: string; quantity: number }[]
): Promise<void> {
  const nowIso = new Date().toISOString();

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    // A. Deduct from source warehouse
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
    } else {
      // Source row didn't exist yet, insert with 0
      await supabase.from('stock_levels').insert({
        tenant_id: DEFAULT_TENANT_ID,
        warehouse_id: sourceWarehouseId,
        branch_id: fromBranchId || null,
        product_id: item.product_id,
        quantity_on_hand: 0,
        quantity_reserved: 0,
        reorder_point: 5,
        updated_at: nowIso,
      });
    }

    // B. Add to target warehouse
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
      // Target row didn't exist yet, insert with transferred quantity
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
  }
}
