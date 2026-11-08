import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Starting PixelCraft POS Database Seeding...');

  // 1. Seed SaaS Subscription Plans
  console.log('📦 Seeding Subscription Plans...');
  const plans = [
    {
      code: 'STARTER',
      name: 'Starter Plan',
      description: 'Ideal for single-outlet retail boutiques and start-ups.',
      monthlyPrice: 29.0,
      annualPrice: 290.0,
      maxProducts: 500,
      maxBranches: 1,
      maxUsers: 2,
      maxRegisters: 1,
      enabledModules: ['pos', 'inventory'],
    },
    {
      code: 'PROFESSIONAL',
      name: 'Professional Plan',
      description: 'Engineered for growing multi-outlet retailers and restaurants.',
      monthlyPrice: 79.0,
      annualPrice: 790.0,
      maxProducts: 5000,
      maxBranches: 3,
      maxUsers: 10,
      maxRegisters: 5,
      enabledModules: ['pos', 'inventory', 'reports', 'multi-branch'],
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise Plan',
      description:
        'Unlimited scalability, multi-warehouse support, API access, and enterprise SLAs.',
      monthlyPrice: 199.0,
      annualPrice: 1990.0,
      maxProducts: 50000,
      maxBranches: 20,
      maxUsers: 50,
      maxRegisters: 25,
      enabledModules: [
        'pos',
        'inventory',
        'reports',
        'multi-branch',
        'loyalty',
        'api-access',
        'custom-roles',
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  // 2. Seed Granular Permissions Matrix
  console.log('🔐 Seeding System Permissions...');
  const permissions = [
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

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    });
  }

  // 3. Seed Platform Super Admin
  console.log('👑 Seeding Platform Super Admin...');
  const passwordHash = await bcrypt.hash('SuperSecret123!', 10);

  await prisma.platformUser.upsert({
    where: { email: 'admin@pixelcraftlk.com' },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email: 'admin@pixelcraftlk.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // 4. Seed Isolated Test Tenants (Alpha & Beta)
  console.log('🏢 Seeding Isolated Test Tenants...');

  // --- TENANT ALPHA ---
  const tenantAlpha = await prisma.business.upsert({
    where: { slug: 'alpha' },
    update: {
      name: 'PixelCraft LK Flagship Store',
      legalName: 'PixelCraft LK Retail Pvt Ltd',
      businessType: 'RETAIL',
      status: 'ACTIVE',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    },
    create: {
      name: 'PixelCraft LK Flagship Store',
      slug: 'alpha',
      legalName: 'PixelCraft LK Retail Pvt Ltd',
      businessType: 'RETAIL',
      status: 'ACTIVE',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    },
  });

  const professionalPlan = await prisma.plan.findUniqueOrThrow({
    where: { code: 'PROFESSIONAL' },
  });

  await prisma.subscription
    .upsert({
      where: { id: tenantAlpha.id }, // dummy fallback for lookup
      update: {},
      create: {
        businessId: tenantAlpha.id,
        planId: professionalPlan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      },
    })
    .catch(async () => {
      const existing = await prisma.subscription.findFirst({
        where: { businessId: tenantAlpha.id },
      });
      if (!existing) {
        await prisma.subscription.create({
          data: {
            businessId: tenantAlpha.id,
            planId: professionalPlan.id,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
          },
        });
      }
    });

  await prisma.businessSetting.upsert({
    where: { tenantId: tenantAlpha.id },
    update: {
      invoicePrefix: 'ALPHA-',
      taxRate: 15.0,
      isTaxInclusive: true,
    },
    create: {
      tenantId: tenantAlpha.id,
      invoicePrefix: 'ALPHA-',
      taxRate: 15.0,
      isTaxInclusive: true,
    },
  });

  const branchAlpha = await prisma.branch.upsert({
    where: {
      tenantId_code: {
        tenantId: tenantAlpha.id,
        code: 'ALPHA-HQ',
      },
    },
    update: {
      name: 'Main Flagship Branch Colombo',
      address: '100 Galle Road, Colombo 03, Sri Lanka',
      phone: '+94 11 234 5678',
      isPrimary: true,
      isActive: true,
    },
    create: {
      tenantId: tenantAlpha.id,
      code: 'ALPHA-HQ',
      name: 'Main Flagship Branch Colombo',
      address: '100 Galle Road, Colombo 03, Sri Lanka',
      phone: '+94 11 234 5678',
      isPrimary: true,
      isActive: true,
    },
  });

  await prisma.register.upsert({
    where: {
      tenantId_branchId_code: {
        tenantId: tenantAlpha.id,
        branchId: branchAlpha.id,
        code: 'REG-A1',
      },
    },
    update: {
      name: 'Alpha POS Register 01',
      isActive: true,
    },
    create: {
      tenantId: tenantAlpha.id,
      branchId: branchAlpha.id,
      name: 'Alpha POS Register 01',
      code: 'REG-A1',
      isActive: true,
    },
  });

  await prisma.warehouse
    .upsert({
      where: { id: tenantAlpha.id }, // dummy fallback for upsert matching by branch
      update: {},
      create: {
        tenantId: tenantAlpha.id,
        branchId: branchAlpha.id,
        name: 'Central Warehouse Alpha',
        isDefault: true,
      },
    })
    .catch(async () => {
      // If id does not match, ensure warehouse exists
      const existing = await prisma.warehouse.findFirst({
        where: { tenantId: tenantAlpha.id, branchId: branchAlpha.id },
      });
      if (!existing) {
        await prisma.warehouse.create({
          data: {
            tenantId: tenantAlpha.id,
            branchId: branchAlpha.id,
            name: 'Central Warehouse Alpha',
            isDefault: true,
          },
        });
      }
    });

  const userAlpha = await prisma.user.upsert({
    where: { email: 'owner.alpha@pixelcraftlk.com' },
    update: {
      fullName: 'Kasun Perera',
      isActive: true,
    },
    create: {
      email: 'owner.alpha@pixelcraftlk.com',
      passwordHash,
      fullName: 'Kasun Perera',
      phone: '+94 77 123 4567',
      isActive: true,
    },
  });

  const roleOwnerAlpha = await prisma.role.upsert({
    where: {
      tenantId_code: {
        tenantId: tenantAlpha.id,
        code: 'OWNER',
      },
    },
    update: { name: 'Business Owner' },
    create: {
      tenantId: tenantAlpha.id,
      code: 'OWNER',
      name: 'Business Owner',
      isSystem: true,
    },
  });

  await prisma.businessMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenantAlpha.id,
        userId: userAlpha.id,
      },
    },
    update: {
      status: 'ACTIVE',
      defaultBranchId: branchAlpha.id,
    },
    create: {
      tenantId: tenantAlpha.id,
      userId: userAlpha.id,
      roleId: roleOwnerAlpha.id,
      defaultBranchId: branchAlpha.id,
      status: 'ACTIVE',
    },
  });

  // --- TENANT BETA ---
  const tenantBeta = await prisma.business.upsert({
    where: { slug: 'beta' },
    update: {
      name: 'Colombo Bistro & Cafe',
      legalName: 'Colombo Bistro Cafe Ltd',
      businessType: 'RESTAURANT',
      status: 'ACTIVE',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    },
    create: {
      name: 'Colombo Bistro & Cafe',
      slug: 'beta',
      legalName: 'Colombo Bistro Cafe Ltd',
      businessType: 'RESTAURANT',
      status: 'ACTIVE',
      currency: 'LKR',
      timezone: 'Asia/Colombo',
    },
  });

  const starterPlan = await prisma.plan.findUniqueOrThrow({
    where: { code: 'STARTER' },
  });

  await prisma.subscription
    .upsert({
      where: { id: tenantBeta.id },
      update: {},
      create: {
        businessId: tenantBeta.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
      },
    })
    .catch(async () => {
      const existing = await prisma.subscription.findFirst({
        where: { businessId: tenantBeta.id },
      });
      if (!existing) {
        await prisma.subscription.create({
          data: {
            businessId: tenantBeta.id,
            planId: starterPlan.id,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
          },
        });
      }
    });

  await prisma.businessSetting.upsert({
    where: { tenantId: tenantBeta.id },
    update: {
      invoicePrefix: 'BETA-',
      taxRate: 10.0,
      isTaxInclusive: false,
    },
    create: {
      tenantId: tenantBeta.id,
      invoicePrefix: 'BETA-',
      taxRate: 10.0,
      isTaxInclusive: false,
    },
  });

  const branchBeta = await prisma.branch.upsert({
    where: {
      tenantId_code: {
        tenantId: tenantBeta.id,
        code: 'BETA-01',
      },
    },
    update: {
      name: 'Bistro Central Branch',
      address: '45 Duplication Road, Colombo 04, Sri Lanka',
      phone: '+94 11 987 6543',
      isPrimary: true,
      isActive: true,
    },
    create: {
      tenantId: tenantBeta.id,
      code: 'BETA-01',
      name: 'Bistro Central Branch',
      address: '45 Duplication Road, Colombo 04, Sri Lanka',
      phone: '+94 11 987 6543',
      isPrimary: true,
      isActive: true,
    },
  });

  await prisma.register.upsert({
    where: {
      tenantId_branchId_code: {
        tenantId: tenantBeta.id,
        branchId: branchBeta.id,
        code: 'REG-B1',
      },
    },
    update: {
      name: 'Bar Counter Register Beta',
      isActive: true,
    },
    create: {
      tenantId: tenantBeta.id,
      branchId: branchBeta.id,
      name: 'Bar Counter Register Beta',
      code: 'REG-B1',
      isActive: true,
    },
  });

  const userBeta = await prisma.user.upsert({
    where: { email: 'owner.beta@pixelcraftlk.com' },
    update: {
      fullName: 'Nimal Silva',
      isActive: true,
    },
    create: {
      email: 'owner.beta@pixelcraftlk.com',
      passwordHash,
      fullName: 'Nimal Silva',
      phone: '+94 71 999 8888',
      isActive: true,
    },
  });

  const roleOwnerBeta = await prisma.role.upsert({
    where: {
      tenantId_code: {
        tenantId: tenantBeta.id,
        code: 'OWNER',
      },
    },
    update: { name: 'Restaurant Owner' },
    create: {
      tenantId: tenantBeta.id,
      code: 'OWNER',
      name: 'Restaurant Owner',
      isSystem: true,
    },
  });

  await prisma.businessMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenantBeta.id,
        userId: userBeta.id,
      },
    },
    update: {
      status: 'ACTIVE',
      defaultBranchId: branchBeta.id,
    },
    create: {
      tenantId: tenantBeta.id,
      userId: userBeta.id,
      roleId: roleOwnerBeta.id,
      defaultBranchId: branchBeta.id,
      status: 'ACTIVE',
    },
  });

  console.log('✅ PixelCraft POS Database Seeding Completed Successfully!');
  console.log(`   - Super Admin: admin@pixelcraftlk.com`);
  console.log(`   - Tenant Alpha: id=${tenantAlpha.id}, slug=alpha`);
  console.log(`   - Tenant Beta:  id=${tenantBeta.id}, slug=beta`);
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('❌ Seeding failed with error:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
