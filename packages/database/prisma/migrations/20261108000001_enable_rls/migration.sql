-- =====================================================================
-- POSTGRESQL ROW LEVEL SECURITY (RLS) POLICIES FOR PIXELCRAFT POS
-- =====================================================================

-- 1. Enable RLS on Tenant-Owned Tables
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS for all table owners and database connection roles
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "business_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "registers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "business_memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;

-- 3. Policy for businesses table (id matches current_setting)
DROP POLICY IF EXISTS "tenant_isolation_businesses_policy" ON "businesses";
CREATE POLICY "tenant_isolation_businesses_policy" ON "businesses"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "id"::text = current_setting('app.current_tenant_id', true)
    );

-- 4. Policy for business_settings
DROP POLICY IF EXISTS "tenant_isolation_business_settings_policy" ON "business_settings";
CREATE POLICY "tenant_isolation_business_settings_policy" ON "business_settings"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 5. Policy for branches
DROP POLICY IF EXISTS "tenant_isolation_branches_policy" ON "branches";
CREATE POLICY "tenant_isolation_branches_policy" ON "branches"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 6. Policy for warehouses
DROP POLICY IF EXISTS "tenant_isolation_warehouses_policy" ON "warehouses";
CREATE POLICY "tenant_isolation_warehouses_policy" ON "warehouses"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 7. Policy for registers
DROP POLICY IF EXISTS "tenant_isolation_registers_policy" ON "registers";
CREATE POLICY "tenant_isolation_registers_policy" ON "registers"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 8. Policy for business_memberships
DROP POLICY IF EXISTS "tenant_isolation_memberships_policy" ON "business_memberships";
CREATE POLICY "tenant_isolation_memberships_policy" ON "business_memberships"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 9. Policy for audit_logs
DROP POLICY IF EXISTS "tenant_isolation_audit_logs_policy" ON "audit_logs";
CREATE POLICY "tenant_isolation_audit_logs_policy" ON "audit_logs"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );

-- 10. Policy for idempotency_keys
DROP POLICY IF EXISTS "tenant_isolation_idempotency_keys_policy" ON "idempotency_keys";
CREATE POLICY "tenant_isolation_idempotency_keys_policy" ON "idempotency_keys"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    );
