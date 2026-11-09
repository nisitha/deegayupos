import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LegacySupplier {
  legacy_id: string;
  name: string;
  phone?: string;
  opening_balance?: number;
}

export async function seedSuppliers() {
  console.log('\n========================================================================');
  console.log('📦 PIXELCRAFT POS - DEEGAYU SUPPLIERS SEEDING ENGINE');
  console.log('   Target Tenant: Deegayu Weda Madura (94 Legacy Suppliers)');
  console.log('========================================================================\n');

  // 1. Resolve tenant
  const tenant = await prisma.business.findFirst({
    where: {
      OR: [
        { slug: 'deegayu' },
        { id: '0fef1423-5d89-4147-8af8-17c7e641c88a' },
      ],
    },
  });

  if (!tenant) {
    throw new Error('Tenant "deegayu" not found in the database. Run import-deegayu first.');
  }

  console.log(`✓ Located Tenant: "${tenant.name}" (${tenant.id})`);

  // 2. Locate suppliers JSON file
  const candidatePaths = [
    path.resolve(process.cwd(), 'xPOS/imported-contacts-summary.json'),
    path.resolve(process.cwd(), 'xPOS/suppliers.json'),
    path.resolve(__dirname, '../../../xPOS/imported-contacts-summary.json'),
    path.resolve(__dirname, '../../../xPOS/suppliers.json'),
    path.resolve(__dirname, '../../xPOS/imported-contacts-summary.json'),
    path.resolve(__dirname, '../../xPOS/suppliers.json'),
  ];

  let rawSuppliers: LegacySupplier[] = [];
  let foundPath = '';

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      foundPath = p;
      const content = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        rawSuppliers = parsed;
      } else if (parsed && Array.isArray(parsed.suppliers)) {
        rawSuppliers = parsed.suppliers;
      }
      break;
    }
  }

  if (rawSuppliers.length === 0) {
    throw new Error(`Could not find supplier data in any candidate path: ${candidatePaths.join(', ')}`);
  }

  console.log(`✓ Loaded ${rawSuppliers.length} raw suppliers from: ${foundPath}`);

  // Deduplicate by name if needed
  const uniqueSuppliersMap = new Map<string, LegacySupplier>();
  for (const s of rawSuppliers) {
    const trimmed = (s.name || '').trim();
    if (trimmed && !uniqueSuppliersMap.has(trimmed.toLowerCase())) {
      uniqueSuppliersMap.set(trimmed.toLowerCase(), s);
    }
  }

  const supplierList = Array.from(uniqueSuppliersMap.values());
  console.log(`✓ Processing ${supplierList.length} unique suppliers...`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < supplierList.length; i++) {
    const s = supplierList[i];
    if (!s) continue;
    const code = `SUP-${String(i + 1).padStart(3, '0')}`;
    const name = s.name.trim();
    const phone = s.phone && s.phone.trim() ? s.phone.trim() : null;

    const existing = await prisma.supplier.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ code }, { name }],
      },
    });

    if (existing) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          name,
          phone: phone || existing.phone,
          status: 'ACTIVE',
        },
      });
      updatedCount++;
    } else {
      await prisma.supplier.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          phone,
          contactPerson: `${name} Rep`,
          email: `${code.toLowerCase()}@suppliers.deegayu.pixelcraftlk.com`,
          address: 'Sri Lanka',
          paymentTerms: 'NET_30',
          status: 'ACTIVE',
        },
      });
      insertedCount++;
    }

    if ((i + 1) % 20 === 0 || i === supplierList.length - 1) {
      console.log(`  Processed ${i + 1}/${supplierList.length} suppliers...`);
    }
  }

  console.log('\n========================================================================');
  console.log(`✓ SUPPLIERS SEEDING COMPLETE!`);
  console.log(`  Created: ${insertedCount}`);
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Total Active Suppliers: ${insertedCount + updatedCount}`);
  console.log('========================================================================\n');
}

if (require.main === module) {
  seedSuppliers()
    .catch((err) => {
      console.error('❌ Failed to seed suppliers:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

