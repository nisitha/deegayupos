-- =====================================================================
-- POSTGRESQL ROW LEVEL SECURITY (RLS) POLICIES FOR CATALOGUE LAYER
-- =====================================================================

-- 1. Enable RLS on Catalogue Tables
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for all table owners and database connection roles
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "brands" FORCE ROW LEVEL SECURITY;
ALTER TABLE "units" FORCE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;

-- 3. Policy for categories
DROP POLICY IF EXISTS "tenant_isolation_categories_policy" ON "categories";
CREATE POLICY "tenant_isolation_categories_policy" ON "categories"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 4. Policy for brands
DROP POLICY IF EXISTS "tenant_isolation_brands_policy" ON "brands";
CREATE POLICY "tenant_isolation_brands_policy" ON "brands"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 5. Policy for units
DROP POLICY IF EXISTS "tenant_isolation_units_policy" ON "units";
CREATE POLICY "tenant_isolation_units_policy" ON "units"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 6. Policy for products
DROP POLICY IF EXISTS "tenant_isolation_products_policy" ON "products";
CREATE POLICY "tenant_isolation_products_policy" ON "products"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 7. Policy for product_variants
DROP POLICY IF EXISTS "tenant_isolation_product_variants_policy" ON "product_variants";
CREATE POLICY "tenant_isolation_product_variants_policy" ON "product_variants"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

