-- ==============================================================================
-- Migration: Branch-to-Branch Stock Transfers with 3-Stage Approval
-- Tables: public.stock_transfers, public.stock_transfer_items
-- ==============================================================================

-- 1. stock_transfers table
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT '0fef1423-5d89-4147-8af8-17c7e641c88a',
  transfer_number VARCHAR(64) UNIQUE NOT NULL,
  from_branch_id UUID NOT NULL REFERENCES public.branches(id),
  to_branch_id UUID NOT NULL REFERENCES public.branches(id),
  total_items INT DEFAULT 0,
  total_quantity NUMERIC(12,3) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'DISPATCHED',
  dispatched_by TEXT,
  dispatched_at TIMESTAMPTZ DEFAULT now(),
  received_by TEXT,
  received_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_different_branches CHECK (from_branch_id <> to_branch_id)
);

-- 2. stock_transfer_items table
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(12,3) NOT NULL,
  line_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ensure branch_id exists on stock_levels for direct branch queries
ALTER TABLE public.stock_levels ADD COLUMN IF NOT EXISTS branch_id UUID;
UPDATE public.stock_levels s
SET branch_id = w.branch_id
FROM public.warehouses w
WHERE s.warehouse_id = w.id AND s.branch_id IS NULL;

-- 4. Enable RLS and permissive policies for POS operations
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_transfers_all" ON public.stock_transfers;
CREATE POLICY "stock_transfers_all" ON public.stock_transfers
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "stock_transfer_items_all" ON public.stock_transfer_items;
CREATE POLICY "stock_transfer_items_all" ON public.stock_transfer_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Helpful Indexes
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON public.stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON public.stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_at ON public.stock_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product ON public.stock_transfer_items(product_id);
