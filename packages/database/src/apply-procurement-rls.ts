import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rlsCommands = [
  'ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_suppliers_policy" ON "suppliers"',
  `CREATE POLICY "tenant_isolation_suppliers_policy" ON "suppliers"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,

  'ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "purchase_orders" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_purchase_orders_policy" ON "purchase_orders"',
  `CREATE POLICY "tenant_isolation_purchase_orders_policy" ON "purchase_orders"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,

  'ALTER TABLE "purchase_order_items" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "purchase_order_items" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_purchase_order_items_policy" ON "purchase_order_items"',
  `CREATE POLICY "tenant_isolation_purchase_order_items_policy" ON "purchase_order_items"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,

  'ALTER TABLE "goods_received_notes" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "goods_received_notes" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_goods_received_notes_policy" ON "goods_received_notes"',
  `CREATE POLICY "tenant_isolation_goods_received_notes_policy" ON "goods_received_notes"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,

  'ALTER TABLE "goods_received_note_items" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "goods_received_note_items" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_goods_received_note_items_policy" ON "goods_received_note_items"',
  `CREATE POLICY "tenant_isolation_goods_received_note_items_policy" ON "goods_received_note_items"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,
];

async function applyRls() {
  console.log('Applying Row Level Security to Procurement tables...');
  for (const cmd of rlsCommands) {
    await prisma.$executeRawUnsafe(cmd);
  }
  console.log('✓ Successfully enabled RLS on suppliers, purchase_orders, purchase_order_items, goods_received_notes, goods_received_note_items');
}

applyRls()
  .catch((err) => {
    console.error('Failed to apply RLS:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
