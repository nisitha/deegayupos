import { supabase } from './supabase';

export type TransferStatus = 'DISPATCHED' | 'RECEIVED' | 'APPROVED' | 'REJECTED';

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_amount: number;
  created_at?: string;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  from_branch_id: string;
  from_branch_name?: string;
  to_branch_id: string;
  to_branch_name?: string;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  status: TransferStatus;
  dispatched_by: string | null;
  dispatched_at: string | null;
  received_by: string | null;
  received_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: StockTransferItem[];
}

export interface CreateTransferItemPayload {
  product_id: string;
  product_name: string;
  sku?: string | null;
  unit_price: number;
  quantity: number;
}

export interface CreateTransferPayload {
  from_branch_id: string;
  to_branch_id: string;
  dispatched_by: string;
  notes?: string;
  items: CreateTransferItemPayload[];
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

export const transfersApi = {
  getBranches: async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, code')
        .order('name', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      console.error('[transfersApi] getBranches error:', err);
      return { success: false, data: [] };
    }
  },

  getProductsForBranch: async (branchId: string): Promise<TransferProductSearchItem[]> => {
    try {
      const { data: wh } = await supabase
        .from('warehouses')
        .select('id')
        .eq('branch_id', branchId)
        .maybeSingle();

      const whId = wh?.id;

      let stockQuery = supabase.from('stock_levels').select('product_id, quantity_on_hand');
      if (whId) {
        stockQuery = stockQuery.or(`warehouse_id.eq.${whId},branch_id.eq.${branchId}`);
      } else {
        stockQuery = stockQuery.eq('branch_id', branchId);
      }

      const [{ data: products, error: pErr }, { data: stockLevels, error: sErr }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, barcode, retail_price, cost_price')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(1000),
        stockQuery,
      ]);

      if (pErr) console.warn('[transfersApi] products error:', pErr.message);
      if (sErr) console.warn('[transfersApi] stockLevels error:', sErr.message);

      const stockMap = new Map<string, number>();
      (stockLevels || []).forEach((sl: any) => {
        stockMap.set(sl.product_id, Number(sl.quantity_on_hand || 0));
      });

      return (products || []).map((p: any) => ({
        id: p.id,
        name: p.name || 'Unnamed Product',
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
      let query = supabase
        .from('stock_transfers')
        .select(`
          *,
          from_branch:branches!from_branch_id(id, name, code),
          to_branch:branches!to_branch_id(id, name, code),
          stock_transfer_items(*)
        `)
        .order('created_at', { ascending: false });

      if (filter?.status && filter.status !== 'ALL') {
        query = query.eq('status', filter.status);
      }

      if (filter?.branchId && filter.branchId !== 'all') {
        query = query.or(`from_branch_id.eq.${filter.branchId},to_branch_id.eq.${filter.branchId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: StockTransfer[] = (data || []).map((row: any) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        transfer_number: row.transfer_number,
        from_branch_id: row.from_branch_id,
        from_branch_name: row.from_branch?.name || 'Origin Branch',
        to_branch_id: row.to_branch_id,
        to_branch_name: row.to_branch?.name || 'Destination Branch',
        total_items: Number(row.total_items || 0),
        total_quantity: Number(row.total_quantity || 0),
        total_amount: Number(row.total_amount || 0),
        status: row.status as TransferStatus,
        dispatched_by: row.dispatched_by,
        dispatched_at: row.dispatched_at,
        received_by: row.received_by,
        received_at: row.received_at,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items: (row.stock_transfer_items || []).map((it: any) => ({
          id: it.id,
          transfer_id: it.transfer_id,
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          unit_price: Number(it.unit_price || 0),
          quantity: Number(it.quantity || 0),
          line_amount: Number(it.line_amount || 0),
          created_at: it.created_at,
        })),
      }));

      return { success: true, data: mapped };
    } catch (err: any) {
      console.error('[transfersApi] getTransfers error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  createTransfer: async (
    payload: CreateTransferPayload
  ): Promise<{ success: boolean; data?: StockTransfer; error?: string }> => {
    try {
      if (payload.from_branch_id === payload.to_branch_id) {
        throw new Error('From Location and To Location must be different branches.');
      }
      if (!payload.items || payload.items.length === 0) {
        throw new Error('Please add at least one product to transfer.');
      }

      // Generate clean unique transfer number: TRF-YYYY-XXXX
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('stock_transfers')
        .select('id', { count: 'exact', head: true });
      const nextNum = (count || 0) + 1;
      const transferNumber = `TRF-${year}-${String(nextNum).padStart(4, '0')}`;

      const totalItems = payload.items.length;
      const totalQuantity = payload.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
      const totalAmount = payload.items.reduce(
        (acc, it) => acc + Number(it.quantity || 0) * Number(it.unit_price || 0),
        0
      );

      // Stage ①: Create transfer in DISPATCHED status. Stock levels are NOT modified yet.
      const { data: transferRow, error: tErr } = await supabase
        .from('stock_transfers')
        .insert({
          transfer_number: transferNumber,
          from_branch_id: payload.from_branch_id,
          to_branch_id: payload.to_branch_id,
          total_items: totalItems,
          total_quantity: Math.round(totalQuantity * 1000) / 1000,
          total_amount: Math.round(totalAmount * 100) / 100,
          status: 'DISPATCHED',
          dispatched_by: payload.dispatched_by || 'Staff Cashier',
          dispatched_at: new Date().toISOString(),
          notes: payload.notes || null,
        })
        .select()
        .single();

      if (tErr || !transferRow) {
        throw new Error(tErr?.message || 'Failed to create transfer record');
      }

      // Insert line items
      const itemsToInsert = payload.items.map((it) => {
        const qty = Number(it.quantity || 0);
        const price = Number(it.unit_price || 0);
        return {
          transfer_id: transferRow.id,
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku || null,
          unit_price: price,
          quantity: qty,
          line_amount: Math.round(qty * price * 100) / 100,
        };
      });

      const { error: itemsErr } = await supabase
        .from('stock_transfer_items')
        .insert(itemsToInsert);

      if (itemsErr) {
        console.error('[transfersApi] stock_transfer_items insert error:', itemsErr);
        // Attempt rollback of parent
        await supabase.from('stock_transfers').delete().eq('id', transferRow.id);
        throw new Error(`Failed to save transfer items: ${itemsErr.message}`);
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

  // Stage ②: Destination branch confirmation
  receiveTransfer: async (
    transferId: string,
    receivedBy: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('stock_transfers')
        .select('id, status')
        .eq('id', transferId)
        .maybeSingle();

      if (fetchErr || !existing) throw new Error('Transfer record not found');
      if (existing.status !== 'DISPATCHED') {
        throw new Error(`Cannot receive transfer in '${existing.status}' status (must be 'DISPATCHED').`);
      }

      // Stock levels are still NOT modified yet in Stage 2
      const { error: updErr } = await supabase
        .from('stock_transfers')
        .update({
          status: 'RECEIVED',
          received_by: receivedBy || 'Staff Receiver',
          received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId);

      if (updErr) throw updErr;
      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] receiveTransfer error:', err);
      return { success: false, error: err.message };
    }
  },

  // Stage ③: Admin Final Stock Execution
  approveTransfer: async (
    transferId: string,
    approvedBy: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Fetch transfer and items
      const { data: transfer, error: tErr } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          stock_transfer_items(*)
        `)
        .eq('id', transferId)
        .maybeSingle();

      if (tErr || !transfer) throw new Error('Transfer record not found');
      if (transfer.status !== 'RECEIVED') {
        throw new Error(`Cannot approve transfer in '${transfer.status}' status. Transfer must first be marked 'RECEIVED' by the destination branch.`);
      }

      const items = transfer.stock_transfer_items || [];
      if (items.length === 0) {
        throw new Error('Transfer has no items to process.');
      }

      // 2. Resolve warehouses for origin and destination branches
      const [{ data: whFrom }, { data: whTo }] = await Promise.all([
        supabase.from('warehouses').select('id').eq('branch_id', transfer.from_branch_id).maybeSingle(),
        supabase.from('warehouses').select('id').eq('branch_id', transfer.to_branch_id).maybeSingle(),
      ]);

      const fromWhId = whFrom?.id;
      const toWhId = whTo?.id;

      // 3. Atomically update stock levels for each item
      for (const item of items) {
        const qtyToTransfer = Number(item.quantity || 0);
        if (qtyToTransfer <= 0) continue;

        // A. Deduct from origin branch (public.stock_levels)
        let fromStockQuery = supabase
          .from('stock_levels')
          .select('id, quantity_on_hand, warehouse_id')
          .eq('product_id', item.product_id);

        if (fromWhId) {
          fromStockQuery = fromStockQuery.or(`warehouse_id.eq.${fromWhId},branch_id.eq.${transfer.from_branch_id}`);
        } else {
          fromStockQuery = fromStockQuery.eq('branch_id', transfer.from_branch_id);
        }

        const { data: fromStockRow } = await fromStockQuery.limit(1).maybeSingle();

        const currentFromQty = Number(fromStockRow?.quantity_on_hand || 0);
        const newFromQty = Math.max(0, currentFromQty - qtyToTransfer);

        if (fromStockRow?.id) {
          await supabase
            .from('stock_levels')
            .update({
              quantity_on_hand: newFromQty,
              branch_id: transfer.from_branch_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', fromStockRow.id);
        } else if (fromWhId) {
          await supabase
            .from('stock_levels')
            .insert({
              tenant_id: transfer.tenant_id,
              warehouse_id: fromWhId,
              branch_id: transfer.from_branch_id,
              product_id: item.product_id,
              quantity_on_hand: 0,
              updated_at: new Date().toISOString(),
            });
        }

        // B. Add to destination branch (public.stock_levels)
        let toStockQuery = supabase
          .from('stock_levels')
          .select('id, quantity_on_hand, warehouse_id')
          .eq('product_id', item.product_id);

        if (toWhId) {
          toStockQuery = toStockQuery.or(`warehouse_id.eq.${toWhId},branch_id.eq.${transfer.to_branch_id}`);
        } else {
          toStockQuery = toStockQuery.eq('branch_id', transfer.to_branch_id);
        }

        const { data: toStockRow } = await toStockQuery.limit(1).maybeSingle();

        const currentToQty = Number(toStockRow?.quantity_on_hand || 0);
        const newToQty = currentToQty + qtyToTransfer;

        if (toStockRow?.id) {
          await supabase
            .from('stock_levels')
            .update({
              quantity_on_hand: newToQty,
              branch_id: transfer.to_branch_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', toStockRow.id);
        } else if (toWhId) {
          await supabase
            .from('stock_levels')
            .insert({
              tenant_id: transfer.tenant_id,
              warehouse_id: toWhId,
              branch_id: transfer.to_branch_id,
              product_id: item.product_id,
              quantity_on_hand: qtyToTransfer,
              updated_at: new Date().toISOString(),
            });
        }

        // C. Log stock movements for full audit trail
        try {
          const movements: any[] = [];
          if (fromWhId) {
            movements.push({
              tenant_id: transfer.tenant_id,
              warehouse_id: fromWhId,
              product_id: item.product_id,
              movement_type: 'TRANSFER_OUT',
              quantity: -qtyToTransfer,
              reference_type: 'STOCK_TRANSFER',
              reference_id: transfer.id,
              notes: `Stock Transfer ${transfer.transfer_number} to branch`,
            });
          }
          if (toWhId) {
            movements.push({
              tenant_id: transfer.tenant_id,
              warehouse_id: toWhId,
              product_id: item.product_id,
              movement_type: 'TRANSFER_IN',
              quantity: qtyToTransfer,
              reference_type: 'STOCK_TRANSFER',
              reference_id: transfer.id,
              notes: `Stock Transfer ${transfer.transfer_number} from branch`,
            });
          }
          if (movements.length > 0) {
            await supabase.from('stock_movements').insert(movements);
          }
        } catch (movErr) {
          console.warn('[transfersApi] stock_movements audit log warning:', movErr);
        }
      }

      // 4. Mark transfer as APPROVED
      const { error: approveErr } = await supabase
        .from('stock_transfers')
        .update({
          status: 'APPROVED',
          approved_by: approvedBy || 'Admin Owner',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId);

      if (approveErr) throw approveErr;
      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] approveTransfer fatal:', err);
      return { success: false, error: err.message };
    }
  },

  rejectTransfer: async (
    transferId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('stock_transfers')
        .update({
          status: 'REJECTED',
          notes: reason ? `[Rejected by ${rejectedBy}]: ${reason}` : `Rejected by ${rejectedBy}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('[transfersApi] rejectTransfer error:', err);
      return { success: false, error: err.message };
    }
  },
};
