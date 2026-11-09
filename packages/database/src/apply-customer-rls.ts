import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rlsCommands = [
  'ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "customers" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_customers_policy" ON "customers"',
  `CREATE POLICY "tenant_isolation_customers_policy" ON "customers"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,

  'ALTER TABLE "customer_ledgers" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "customer_ledgers" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_customer_ledgers_policy" ON "customer_ledgers"',
  `CREATE POLICY "tenant_isolation_customer_ledgers_policy" ON "customer_ledgers"
    AS PERMISSIVE FOR ALL
    USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR "tenant_id"::text = current_setting('app.current_tenant_id', true)
    )`,

  'ALTER TABLE "customer_payments" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "customer_payments" FORCE ROW LEVEL SECURITY',
  'DROP POLICY IF EXISTS "tenant_isolation_customer_payments_policy" ON "customer_payments"',
  `CREATE POLICY "tenant_isolation_customer_payments_policy" ON "customer_payments"
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

async function applyCustomerRls() {
  console.log('Applying Row Level Security to Customer & Credit Ledger tables...');
  for (const cmd of rlsCommands) {
    await prisma.$executeRawUnsafe(cmd);
  }
  console.log('✓ Successfully enabled RLS on customers, customer_ledgers, customer_payments');
}

applyCustomerRls()
  .catch((err) => {
    console.error('Failed to apply customer RLS:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
