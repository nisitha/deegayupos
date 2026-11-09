-- =====================================================================
-- MULTI-BRANCH INVENTORY & STOCK MOVEMENT ENGINE SCHEMA & RLS POLICIES
-- =====================================================================

-- 1. Create Enums
CREATE TYPE "StockMovementType" AS ENUM (
    'SALE',
    'PURCHASE_RECEIPT',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIPT',
    'ADJUSTMENT_ADD',
    'ADJUSTMENT_SUB',
    'RETURN_RESTOCK',
    'DAMAGE_LOSS'
);

CREATE TYPE "StockAdjustmentReason" AS ENUM (
    'PHYSICAL_COUNT',
    'DAMAGED',
    'EXPIRED',
    'LOST_STOLEN',
    'CORRECTION'
);

CREATE TYPE "StockAdjustmentStatus" AS ENUM (
    'APPLIED',
    'REVERSED'
);

CREATE TYPE "StockTransferStatus" AS ENUM (
    'PENDING',
    'DISPATCHED',
    'RECEIVED',
    'CANCELLED'
);

-- 2. Alter business_settings to add allow_negative_stock
ALTER TABLE "business_settings"
    ADD COLUMN "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false;

-- 3. CreateTable stock_levels
CREATE TABLE "stock_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity_on_hand" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "quantity_reserved" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "reorder_point" DECIMAL(10,3) NOT NULL DEFAULT 5.000,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable stock_movements
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "balance_before" DECIMAL(10,3) NOT NULL,
    "balance_after" DECIMAL(10,3) NOT NULL,
    "reference_id" VARCHAR(128),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable stock_adjustments
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "adjusted_by_id" UUID NOT NULL,
    "reason" "StockAdjustmentReason" NOT NULL,
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- 6. CreateTable stock_adjustment_items
CREATE TABLE "stock_adjustment_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "adjustment_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "counted_quantity" DECIMAL(10,3) NOT NULL,
    "discrepancy_quantity" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- 7. CreateTable stock_transfers
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "source_warehouse_id" UUID NOT NULL,
    "target_warehouse_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_number" VARCHAR(64) NOT NULL,
    "notes" TEXT,
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- 8. CreateTable stock_transfer_items
CREATE TABLE "stock_transfer_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity_requested" DECIMAL(10,3) NOT NULL,
    "quantity_dispatched" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "quantity_received" DECIMAL(10,3) NOT NULL DEFAULT 0.000,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- 9. Constraints and Indexes
CREATE UNIQUE INDEX "stock_levels_tenant_warehouse_product_variant_key" ON "stock_levels"("tenant_id", "warehouse_id", "product_id", "variant_id");
CREATE INDEX "stock_levels_tenant_id_id_idx" ON "stock_levels"("tenant_id", "id");
CREATE INDEX "stock_levels_tenant_id_warehouse_id_idx" ON "stock_levels"("tenant_id", "warehouse_id");
CREATE INDEX "stock_levels_tenant_warehouse_product_idx" ON "stock_levels"("tenant_id", "warehouse_id", "product_id");

CREATE INDEX "stock_movements_tenant_id_id_idx" ON "stock_movements"("tenant_id", "id");
CREATE INDEX "stock_movements_tenant_warehouse_product_idx" ON "stock_movements"("tenant_id", "warehouse_id", "product_id");
CREATE INDEX "stock_movements_tenant_id_reference_id_idx" ON "stock_movements"("tenant_id", "reference_id");
CREATE INDEX "stock_movements_tenant_id_created_at_idx" ON "stock_movements"("tenant_id", "created_at");

CREATE INDEX "stock_adjustments_tenant_id_id_idx" ON "stock_adjustments"("tenant_id", "id");
CREATE INDEX "stock_adjustments_tenant_id_warehouse_id_idx" ON "stock_adjustments"("tenant_id", "warehouse_id");
CREATE INDEX "stock_adjustments_tenant_id_created_at_idx" ON "stock_adjustments"("tenant_id", "created_at");

CREATE INDEX "stock_adjustment_items_tenant_id_id_idx" ON "stock_adjustment_items"("tenant_id", "id");
CREATE INDEX "stock_adjustment_items_tenant_id_adjustment_id_idx" ON "stock_adjustment_items"("tenant_id", "adjustment_id");
CREATE INDEX "stock_adjustment_items_tenant_id_product_id_idx" ON "stock_adjustment_items"("tenant_id", "product_id");

CREATE UNIQUE INDEX "stock_transfers_tenant_id_tracking_number_key" ON "stock_transfers"("tenant_id", "tracking_number");
CREATE INDEX "stock_transfers_tenant_id_id_idx" ON "stock_transfers"("tenant_id", "id");
CREATE INDEX "stock_transfers_tenant_id_source_warehouse_id_idx" ON "stock_transfers"("tenant_id", "source_warehouse_id");
CREATE INDEX "stock_transfers_tenant_id_target_warehouse_id_idx" ON "stock_transfers"("tenant_id", "target_warehouse_id");
CREATE INDEX "stock_transfers_tenant_id_status_idx" ON "stock_transfers"("tenant_id", "status");
CREATE INDEX "stock_transfers_tenant_id_created_at_idx" ON "stock_transfers"("tenant_id", "created_at");

CREATE INDEX "stock_transfer_items_tenant_id_id_idx" ON "stock_transfer_items"("tenant_id", "id");
CREATE INDEX "stock_transfer_items_tenant_id_transfer_id_idx" ON "stock_transfer_items"("tenant_id", "transfer_id");
CREATE INDEX "stock_transfer_items_tenant_id_product_id_idx" ON "stock_transfer_items"("tenant_id", "product_id");

-- 10. Foreign Keys
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_adjusted_by_id_fkey" FOREIGN KEY ("adjusted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_target_warehouse_id_fkey" FOREIGN KEY ("target_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11. Enable and Force Row Level Security (RLS)
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_adjustments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_adjustment_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_adjustment_items" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfers" FORCE ROW LEVEL SECURITY;

ALTER TABLE "stock_transfer_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfer_items" FORCE ROW LEVEL SECURITY;

-- 12. Row Level Security Policies
DROP POLICY IF EXISTS "tenant_isolation_stock_levels_policy" ON "stock_levels";
CREATE POLICY "tenant_isolation_stock_levels_policy" ON "stock_levels"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_stock_movements_policy" ON "stock_movements";
CREATE POLICY "tenant_isolation_stock_movements_policy" ON "stock_movements"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_stock_adjustments_policy" ON "stock_adjustments";
CREATE POLICY "tenant_isolation_stock_adjustments_policy" ON "stock_adjustments"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_stock_adjustment_items_policy" ON "stock_adjustment_items";
CREATE POLICY "tenant_isolation_stock_adjustment_items_policy" ON "stock_adjustment_items"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_stock_transfers_policy" ON "stock_transfers";
CREATE POLICY "tenant_isolation_stock_transfers_policy" ON "stock_transfers"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_stock_transfer_items_policy" ON "stock_transfer_items";
CREATE POLICY "tenant_isolation_stock_transfer_items_policy" ON "stock_transfer_items"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

