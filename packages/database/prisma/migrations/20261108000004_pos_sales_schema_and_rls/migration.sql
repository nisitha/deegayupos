-- =====================================================================
-- POS & SALES ENGINE SCHEMA AND ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- 1. Create Enums
CREATE TYPE "OrderType" AS ENUM ('RETAIL_WALKIN', 'DINE_IN', 'TAKEAWAY', 'DELIVERY');
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'HELD', 'VOIDED', 'REFUNDED');
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'CARD', 'QR_PAYMENT', 'BANK_TRANSFER', 'STORE_CREDIT');
CREATE TYPE "SalePaymentStatus" AS ENUM ('SUCCESS', 'PENDING', 'FAILED');

-- 2. CreateTable sales
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "register_id" UUID,
    "cashier_id" UUID NOT NULL,
    "customer_id" UUID,
    "customer_name" VARCHAR(255),
    "invoice_number" VARCHAR(64) NOT NULL,
    "order_type" "OrderType" NOT NULL DEFAULT 'RETAIL_WALKIN',
    "table_number" VARCHAR(32),
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "change_due" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "idempotency_key" VARCHAR(128),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- 3. CreateTable sale_items
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "product_name" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(128) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- 4. CreateTable sale_payments
CREATE TABLE "sale_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "payment_method" "SalePaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(128),
    "status" "SalePaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- 5. CreateTable held_carts
CREATE TABLE "held_carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "register_id" UUID,
    "cashier_id" UUID NOT NULL,
    "cart_reference" VARCHAR(128) NOT NULL,
    "cart_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "held_carts_pkey" PRIMARY KEY ("id")
);

-- 6. Indexes & Constraints
CREATE UNIQUE INDEX "sales_tenant_id_invoice_number_key" ON "sales"("tenant_id", "invoice_number");
CREATE INDEX "sales_tenant_id_id_idx" ON "sales"("tenant_id", "id");
CREATE INDEX "sales_tenant_id_branch_id_idx" ON "sales"("tenant_id", "branch_id");
CREATE INDEX "sales_tenant_id_cashier_id_idx" ON "sales"("tenant_id", "cashier_id");
CREATE INDEX "sales_tenant_id_idempotency_key_idx" ON "sales"("tenant_id", "idempotency_key");
CREATE INDEX "sales_tenant_id_created_at_idx" ON "sales"("tenant_id", "created_at");
CREATE INDEX "sales_tenant_id_status_idx" ON "sales"("tenant_id", "status");

CREATE INDEX "sale_items_tenant_id_id_idx" ON "sale_items"("tenant_id", "id");
CREATE INDEX "sale_items_tenant_id_sale_id_idx" ON "sale_items"("tenant_id", "sale_id");
CREATE INDEX "sale_items_tenant_id_product_id_idx" ON "sale_items"("tenant_id", "product_id");

CREATE INDEX "sale_payments_tenant_id_id_idx" ON "sale_payments"("tenant_id", "id");
CREATE INDEX "sale_payments_tenant_id_sale_id_idx" ON "sale_payments"("tenant_id", "sale_id");

CREATE INDEX "held_carts_tenant_id_id_idx" ON "held_carts"("tenant_id", "id");
CREATE INDEX "held_carts_tenant_id_branch_id_idx" ON "held_carts"("tenant_id", "branch_id");
CREATE INDEX "held_carts_tenant_id_cashier_id_idx" ON "held_carts"("tenant_id", "cashier_id");

-- 7. Foreign Keys
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "held_carts" ADD CONSTRAINT "held_carts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "held_carts" ADD CONSTRAINT "held_carts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "held_carts" ADD CONSTRAINT "held_carts_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "held_carts" ADD CONSTRAINT "held_carts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Enable and Force RLS
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sale_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "held_carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "held_carts" FORCE ROW LEVEL SECURITY;

-- 9. RLS Policies
DROP POLICY IF EXISTS "tenant_isolation_sales_policy" ON "sales";
CREATE POLICY "tenant_isolation_sales_policy" ON "sales"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_sale_items_policy" ON "sale_items";
CREATE POLICY "tenant_isolation_sale_items_policy" ON "sale_items"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_sale_payments_policy" ON "sale_payments";
CREATE POLICY "tenant_isolation_sale_payments_policy" ON "sale_payments"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

DROP POLICY IF EXISTS "tenant_isolation_held_carts_policy" ON "held_carts";
CREATE POLICY "tenant_isolation_held_carts_policy" ON "held_carts"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

