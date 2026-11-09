import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface LegacyCategory {
  legacy_id: string;
  name: string;
}

interface LegacyProduct {
  legacy_id: string;
  name: string;
  sku: string;
  barcode: string;
  category_name: string;
  cost_price: number | string;
  selling_price: number | string;
  current_stock: number | string;
  alert_quantity: number | string;
}

interface LegacySupplier {
  legacy_id: string;
  name: string;
  phone: string;
  opening_balance: number;
}

interface LegacyCustomer {
  legacy_id: string;
  name: string;
  phone: string;
  credit_balance: number;
}

// Utility: Generate URL-safe and unique slug
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function importDeegayuData() {
  console.log('\n========================================================================');
  console.log('🌿 PIXELCRAFT POS - COMMERCIAL TENANT PROVISIONING & DATA INGESTION');
  console.log('   Target Client: Deegayu Weda Madura (Ayurvedic Pharmacy & Store)');
  console.log('========================================================================\n');

  // Locate xPOS data directory
  const possiblePaths = [
    path.resolve(process.cwd(), 'xPOS'),
    path.resolve(__dirname, '../../../xPOS'),
    path.resolve(__dirname, '../../xPOS'),
  ];

  let xposDir = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      xposDir = p;
      break;
    }
  }

  if (!xposDir) {
    throw new Error(`Could not find xPOS data directory. Checked:\n${possiblePaths.join('\n')}`);
  }

  console.log(`📂 Located source dataset at: ${xposDir}`);

  // Load JSON source datasets
  const categoriesRaw: LegacyCategory[] = JSON.parse(
    fs.readFileSync(path.join(xposDir, 'categories.json'), 'utf-8'),
  );
  const productsRaw: LegacyProduct[] = JSON.parse(
    fs.readFileSync(path.join(xposDir, 'products.json'), 'utf-8'),
  );
  const suppliersRaw: LegacySupplier[] = JSON.parse(
    fs.readFileSync(path.join(xposDir, 'suppliers.json'), 'utf-8'),
  );
  const customersRaw: LegacyCustomer[] = JSON.parse(
    fs.readFileSync(path.join(xposDir, 'customers.json'), 'utf-8'),
  );

  console.log(`📊 Dataset Counts Loaded:`);
  console.log(`   - Categories: ${categoriesRaw.length}`);
  console.log(`   - Products:   ${productsRaw.length}`);
  console.log(`   - Suppliers:  ${suppliersRaw.length}`);
  console.log(`   - Customers:  ${customersRaw.length}\n`);

  // --------------------------------------------------------------------------
  // STEP 1: Provision Dedicated Tenant ("Deegayu Weda Madura")
  // --------------------------------------------------------------------------
  console.log('🏢 [Step 1/4] Provisioning Business Entity & Topology...');

  const tenantSlug = 'deegayu';
  const tenant = await prisma.business.upsert({
    where: { slug: tenantSlug },
    update: {
      name: 'Deegayu Weda Madura',
      legalName: 'Deegayu Weda Madura (Pvt) Ltd',
      businessType: 'PHARMACY',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      status: 'ACTIVE',
    },
    create: {
      name: 'Deegayu Weda Madura',
      slug: tenantSlug,
      legalName: 'Deegayu Weda Madura (Pvt) Ltd',
      businessType: 'PHARMACY',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      status: 'ACTIVE',
    },
  });

  console.log(`   ✓ Business provisioned: ${tenant.name} (${tenant.id})`);

  // Ensure Subscription to Enterprise Plan
  let enterprisePlan = await prisma.plan.findUnique({
    where: { code: 'ENTERPRISE' },
  });

  if (!enterprisePlan) {
    enterprisePlan = await prisma.plan.create({
      data: {
        code: 'ENTERPRISE',
        name: 'Enterprise Plan',
        description: 'Unlimited catalog scaling, multi-warehouse, and commercial retail.',
        monthlyPrice: 199.0,
        annualPrice: 1990.0,
        maxProducts: 50000,
        maxBranches: 20,
        maxUsers: 50,
        maxRegisters: 25,
        enabledModules: ['pos', 'inventory', 'reports', 'multi-branch'],
      },
    });
  }

  const existingSub = await prisma.subscription.findFirst({
    where: { businessId: tenant.id },
  });

  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        businessId: tenant.id,
        planId: enterprisePlan.id,
        status: 'ACTIVE',
        billingCycle: 'ANNUAL',
      },
    });
  }

  // Business Settings
  await prisma.businessSetting.upsert({
    where: { tenantId: tenant.id },
    update: {
      invoicePrefix: 'DGM-',
      taxRate: 0.0,
      isTaxInclusive: true,
      allowNegativeStock: true,
      negativeStockPolicy: 'ALLOW',
      receiptHeader: 'DEEGAYU WEDA MADURA\nAyurvedic Pharmacy & Healthcare Store\nColombo, Sri Lanka\nHotline: 077-2634497',
      receiptFooter: 'Ayubowan! Thank you for purchasing authentic ayurvedic healthcare products.',
      returnPolicyText: 'Medicines & opened herbal products once sold cannot be returned.',
    },
    create: {
      tenantId: tenant.id,
      invoicePrefix: 'DGM-',
      taxRate: 0.0,
      isTaxInclusive: true,
      allowNegativeStock: true,
      negativeStockPolicy: 'ALLOW',
      receiptHeader: 'DEEGAYU WEDA MADURA\nAyurvedic Pharmacy & Healthcare Store\nColombo, Sri Lanka\nHotline: 077-2634497',
      receiptFooter: 'Ayubowan! Thank you for purchasing authentic ayurvedic healthcare products.',
      returnPolicyText: 'Medicines & opened herbal products once sold cannot be returned.',
    },
  });

  // Primary Branch: "Main Branch" (code: MAIN-01)
  const branch = await prisma.branch.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'MAIN-01',
      },
    },
    update: {
      name: 'Main Branch',
      address: 'Deegayu Weda Madura, Colombo, Sri Lanka',
      phone: '0772634497',
      isPrimary: true,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      code: 'MAIN-01',
      name: 'Main Branch',
      address: 'Deegayu Weda Madura, Colombo, Sri Lanka',
      phone: '0772634497',
      isPrimary: true,
      isActive: true,
    },
  });
  console.log(`   ✓ Primary Branch provisioned: ${branch.name} (Code: ${branch.code})`);

  // Default Warehouse: "Main Pharmacy Store"
  let defaultWarehouse = await prisma.warehouse.findFirst({
    where: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Main Pharmacy Store',
    },
  });

  if (!defaultWarehouse) {
    defaultWarehouse = await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Main Pharmacy Store',
        isDefault: true,
        isActive: true,
      },
    });
  }
  console.log(`   ✓ Default Warehouse provisioned: ${defaultWarehouse.name}`);

  // Primary Register: "Cashier Counter 01" (code: REG-01)
  const register = await prisma.register.upsert({
    where: {
      tenantId_branchId_code: {
        tenantId: tenant.id,
        branchId: branch.id,
        code: 'REG-01',
      },
    },
    update: {
      name: 'Cashier Counter 01',
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      code: 'REG-01',
      name: 'Cashier Counter 01',
      isActive: true,
    },
  });
  console.log(`   ✓ Primary Register provisioned: ${register.name} (Code: ${register.code})`);

  // Owner Account: owner@deegayu.pixelcraftlk.com
  const ownerEmail = 'owner@deegayu.pixelcraftlk.com';
  const ownerPlainPassword = 'Deegayu@2026';
  const passwordHash = await bcrypt.hash(ownerPlainPassword, 10);

  const ownerUser = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      fullName: 'Dr. Deegayu (Owner)',
      phone: '0772634497',
      isActive: true,
      passwordHash,
    },
    create: {
      email: ownerEmail,
      fullName: 'Dr. Deegayu (Owner)',
      phone: '0772634497',
      passwordHash,
      isActive: true,
    },
  });

  // Tenant-scoped OWNER Role
  const ownerRole = await prisma.role.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'OWNER',
      },
    },
    update: { name: 'Business Owner' },
    create: {
      tenantId: tenant.id,
      code: 'OWNER',
      name: 'Business Owner',
      description: 'Full administrative and cashier access to Deegayu Weda Madura',
      isSystem: true,
    },
  });

  // Map all system permissions
  const defaultPermissions = [
    { code: 'pos:access', name: 'Access POS Terminal', module: 'pos' },
    { code: 'pos:checkout', name: 'Process Checkout Orders', module: 'pos' },
    { code: 'pos:discount', name: 'Apply Discounts', module: 'pos' },
    { code: 'pos:refund', name: 'Process Customer Refunds', module: 'pos' },
    { code: 'inventory:view', name: 'View Stock Balances', module: 'inventory' },
    { code: 'inventory:manage', name: 'Manage Products & Stock Adjustments', module: 'inventory' },
    { code: 'inventory:transfer', name: 'Initiate Stock Transfers', module: 'inventory' },
    { code: 'reports:view', name: 'View Analytics & Reports', module: 'reports' },
    { code: 'reports:export', name: 'Export Financial & Sales Reports', module: 'reports' },
    { code: 'settings:view', name: 'View Tenant Configuration', module: 'settings' },
    { code: 'settings:manage', name: 'Modify Tenant Preferences & Taxes', module: 'settings' },
    { code: 'users:manage', name: 'Manage Staff Accounts & Memberships', module: 'access' },
  ];

  for (const perm of defaultPermissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: ownerRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Business Membership
  await prisma.businessMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: ownerUser.id,
      },
    },
    update: {
      roleId: ownerRole.id,
      defaultBranchId: branch.id,
      status: 'ACTIVE',
    },
    create: {
      tenantId: tenant.id,
      userId: ownerUser.id,
      roleId: ownerRole.id,
      defaultBranchId: branch.id,
      status: 'ACTIVE',
    },
  });
  console.log(`   ✓ Owner provisioned: ${ownerUser.email} (Role: OWNER)`);

  // --------------------------------------------------------------------------
  // STEP 2: Ingest Categories & Build In-Memory Map
  // --------------------------------------------------------------------------
  console.log('\n🏷️  [Step 2/4] Ingesting Categories & Building Fast Lookups...');

  // Name / ID -> Category UUID map
  const categoryMapByName = new Map<string, string>();
  const categoryMapByLegacyId = new Map<string, string>();
  const seenCategorySlugs = new Set<string>();

  // Ensure default Uncategorized category
  const defaultCategory = await prisma.category.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: 'uncategorized',
      },
    },
    update: { name: 'Uncategorized' },
    create: {
      tenantId: tenant.id,
      name: 'Uncategorized',
      slug: 'uncategorized',
    },
  });
  categoryMapByName.set('uncategorized', defaultCategory.id);
  seenCategorySlugs.add('uncategorized');

  let importedCategoriesCount = 0;

  for (const cat of categoriesRaw) {
    const rawName = (cat.name || '').trim();
    if (!rawName) continue;

    let baseSlug = slugify(rawName) || `cat-${cat.legacy_id}`;
    if (seenCategorySlugs.has(baseSlug)) {
      baseSlug = `${baseSlug}-${cat.legacy_id}`;
    }
    seenCategorySlugs.add(baseSlug);

    const record = await prisma.category.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: baseSlug,
        },
      },
      update: { name: rawName },
      create: {
        tenantId: tenant.id,
        name: rawName,
        slug: baseSlug,
      },
    });

    categoryMapByName.set(rawName.toLowerCase(), record.id);
    categoryMapByLegacyId.set(cat.legacy_id, record.id);
    importedCategoriesCount++;
  }

  console.log(`   ✓ Successfully mapped ${importedCategoriesCount} categories into catalog.`);

  // --------------------------------------------------------------------------
  // STEP 3: Ingest Suppliers & Customers Metadata Backup
  // --------------------------------------------------------------------------
  console.log('\n👥 [Step 3/4] Recording Suppliers & Customers Directory...');

  const contactsSummary = {
    tenantId: tenant.id,
    businessName: tenant.name,
    importedAt: new Date().toISOString(),
    suppliersCount: suppliersRaw.length,
    customersCount: customersRaw.length,
    suppliers: suppliersRaw,
    customers: customersRaw,
  };

  const contactsFilePath = path.join(xposDir, 'imported-contacts-summary.json');
  fs.writeFileSync(contactsFilePath, JSON.stringify(contactsSummary, null, 2), 'utf-8');
  console.log(`   ✓ Preserved 94 suppliers & 1 customer profile in ${contactsFilePath}`);

  // --------------------------------------------------------------------------
  // STEP 4: Chunked Ingestion of Products & Initial Stock Levels
  // --------------------------------------------------------------------------
  console.log('\n📦 [Step 4/4] Ingesting Products & Stock Levels in Batches of 100...');

  // Track deduplicated SKUs and Barcodes across the entire tenant
  const seenSkus = new Set<string>();
  const seenBarcodes = new Set<string>();

  // Check if any products already exist for this tenant
  const existingProducts = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    select: { sku: true, barcode: true },
  });

  for (const ep of existingProducts) {
    if (ep.sku) seenSkus.add(ep.sku.toLowerCase());
    if (ep.barcode) seenBarcodes.add(ep.barcode.toLowerCase());
  }

  let totalProductsImported = 0;
  let totalStockUnitsInitialized = 0;
  let totalCostValuation = 0;
  let totalRetailValuation = 0;
  let skippedCount = 0;
  let deDupSkuCount = 0;
  let deDupBarcodeCount = 0;

  const CHUNK_SIZE = 100;

  for (let i = 0; i < productsRaw.length; i += CHUNK_SIZE) {
    const chunk = productsRaw.slice(i, i + CHUNK_SIZE);

    const preparedProducts: Array<{
      raw: LegacyProduct;
      productData: Prisma.ProductCreateManyInput;
    }> = [];

    for (const item of chunk) {
      const trimmedName = (item.name || '').trim();
      if (!trimmedName) {
        skippedCount++;
        continue;
      }

      // 1. SKU Sanitization & Deduplication
      let sku = (item.sku || '').trim();
      if (!sku) {
        sku = `DGM-${String(item.legacy_id || totalProductsImported + 1).padStart(5, '0')}`;
      }
      if (seenSkus.has(sku.toLowerCase())) {
        sku = `${sku}-${item.legacy_id}`;
        deDupSkuCount++;
      }
      seenSkus.add(sku.toLowerCase());

      // 2. Barcode Sanitization & Deduplication
      let barcode: string | null = (item.barcode || '').trim() || null;
      if (barcode) {
        if (seenBarcodes.has(barcode.toLowerCase())) {
          const uniqueBc = `${barcode}-${item.legacy_id}`;
          if (!seenBarcodes.has(uniqueBc.toLowerCase()) && uniqueBc.length <= 128) {
            barcode = uniqueBc;
            seenBarcodes.add(barcode.toLowerCase());
            deDupBarcodeCount++;
          } else {
            barcode = null;
          }
        } else {
          seenBarcodes.add(barcode.toLowerCase());
        }
      }

      // 3. Category Mapping
      const catKey = (item.category_name || '').trim().toLowerCase();
      const categoryId = categoryMapByName.get(catKey) || defaultCategory.id;

      // 4. Decimal Pricing
      const costNum = Math.max(0, Number(item.cost_price) || 0);
      const sellNum = Math.max(0, Number(item.selling_price) || 0);
      const alertNum = Math.max(0, parseInt(String(item.alert_quantity || 5), 10));

      const productSlug = `${slugify(trimmedName).slice(0, 160) || 'product'}-${item.legacy_id}`;

      preparedProducts.push({
        raw: item,
        productData: {
          tenantId: tenant.id,
          name: trimmedName.slice(0, 255),
          slug: productSlug,
          sku,
          barcode,
          categoryId,
          costPrice: new Prisma.Decimal(costNum.toFixed(2)),
          retailPrice: new Prisma.Decimal(sellNum.toFixed(2)),
          alertQuantity: alertNum,
          isTrackStock: true,
          isActive: true,
        },
      });
    }

    if (preparedProducts.length === 0) continue;

    // Execute chunk insertion inside transaction
    await prisma.$transaction(
      async (tx) => {
        // Insert products and return generated UUIDs
        const inserted = await tx.product.createManyAndReturn({
          data: preparedProducts.map((p) => p.productData),
          select: { id: true, sku: true },
        });

        const skuToInsertedId = new Map(inserted.map((p) => [p.sku, p.id]));

        const stockLevelsToCreate: Prisma.StockLevelCreateManyInput[] = [];
        const stockMovementsToCreate: Prisma.StockMovementCreateManyInput[] = [];

        for (const p of preparedProducts) {
          const productId = skuToInsertedId.get(p.productData.sku);
          if (!productId) continue;

          const qty = Number(p.raw.current_stock) || 0;
          const alertQty = Number(p.raw.alert_quantity) || 5;

          totalProductsImported++;
          totalStockUnitsInitialized += qty;
          totalCostValuation += qty * Number(p.productData.costPrice);
          totalRetailValuation += qty * Number(p.productData.retailPrice);

          stockLevelsToCreate.push({
            tenantId: tenant.id,
            warehouseId: defaultWarehouse.id,
            productId,
            quantityOnHand: new Prisma.Decimal(qty.toFixed(3)),
            quantityReserved: new Prisma.Decimal('0.000'),
            reorderPoint: new Prisma.Decimal(alertQty.toFixed(3)),
          });

          stockMovementsToCreate.push({
            tenantId: tenant.id,
            warehouseId: defaultWarehouse.id,
            productId,
            movementType: 'PURCHASE_RECEIPT',
            quantity: new Prisma.Decimal(qty.toFixed(3)),
            balanceBefore: new Prisma.Decimal('0.000'),
            balanceAfter: new Prisma.Decimal(qty.toFixed(3)),
            referenceId: `OPENING-${p.raw.legacy_id}`,
            notes: 'Initial opening stock migration from xPOS legacy POS',
          });
        }

        if (stockLevelsToCreate.length > 0) {
          await tx.stockLevel.createMany({
            data: stockLevelsToCreate,
          });
        }

        if (stockMovementsToCreate.length > 0) {
          await tx.stockMovement.createMany({
            data: stockMovementsToCreate,
          });
        }
      },
      { timeout: 30000 },
    );

    const progress = Math.min(100, Math.round(((i + chunk.length) / productsRaw.length) * 100));
    process.stdout.write(`   ↳ Imported ${totalProductsImported}/${productsRaw.length} products (${progress}%)\r`);
  }

  console.log(`\n\n========================================================================`);
  console.log('✅ INGESTION & PROVISIONING COMPLETED SUCCESSFULLY!');
  console.log('========================================================================');

  console.table({
    'Tenant Name': tenant.name,
    'Tenant Slug': tenant.slug,
    'Business Type': tenant.businessType,
    'Primary Branch': `${branch.name} (${branch.code})`,
    'Default Warehouse': defaultWarehouse.name,
    'Primary Register': `${register.name} (${register.code})`,
    'Categories Imported': importedCategoriesCount,
    'Products Imported': totalProductsImported,
    'Total Stock Units': totalStockUnitsInitialized.toLocaleString(),
    'Est. Cost Inventory': `LKR ${totalCostValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    'Est. Retail Inventory': `LKR ${totalRetailValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    'Deduplicated SKUs': deDupSkuCount,
    'Deduplicated Barcodes': deDupBarcodeCount,
    'Skipped Items': skippedCount,
  });

  console.log('\n🔑 DEEGAYU WEDA MADURA - LOGIN CREDENTIALS:');
  console.log(`   URL:      http://localhost:3000/dashboard/pos`);
  console.log(`   Email:    ${ownerEmail}`);
  console.log(`   Password: ${ownerPlainPassword}`);
  console.log(`   Role:     OWNER (Full System Privileges)`);
  console.log('========================================================================\n');
}

if (require.main === module) {
  importDeegayuData()
    .catch((err) => {
      console.error('\n❌ Ingestion Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

