import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_CUSTOMERS = [
  {
    name: 'Walk-in Customer',
    phone: '',
    email: null,
    nicNumber: null,
    address: 'Deegayu Retail Store',
    customerType: 'WALK_IN' as const,
    creditLimit: 0,
    currentBalance: 0,
    loyaltyPoints: 0,
  },
  {
    name: 'Dr. C. Senanayake',
    phone: '0771234567',
    email: 'dr.senanayake@ayurveda.lk',
    nicNumber: '681234567V',
    address: 'Ayurvedic Medical Center, Galle Road, Colombo 03',
    customerType: 'WHOLESALE' as const,
    creditLimit: 150000.0,
    currentBalance: 24500.0,
    loyaltyPoints: 1250,
  },
  {
    name: 'Mrs. Malini Perera',
    phone: '0719876543',
    email: 'malini.p@gmail.com',
    nicNumber: '758123456V',
    address: 'No. 45, Temple Road, Maharagama',
    customerType: 'RETAIL_CREDIT' as const,
    creditLimit: 25000.0,
    currentBalance: 4200.0,
    loyaltyPoints: 480,
  },
  {
    name: 'Mr. Kalinga Wickramasinghe',
    phone: '0765551212',
    email: 'kalinga.w@yahoo.com',
    nicNumber: '821992345V',
    address: 'No. 12, Station Road, Nugegoda',
    customerType: 'RETAIL_CREDIT' as const,
    creditLimit: 30000.0,
    currentBalance: 12500.0,
    loyaltyPoints: 210,
  },
  {
    name: 'Mrs. Sumana Ranasinghe',
    phone: '0703334444',
    email: null,
    nicNumber: '645123987V',
    address: 'No. 88, Highlevel Road, Pannipitiya',
    customerType: 'RETAIL_CREDIT' as const,
    creditLimit: 20000.0,
    currentBalance: 0.0,
    loyaltyPoints: 340,
  },
  {
    name: 'Dr. (Mrs) H. Jayawardena',
    phone: '0784448899',
    email: 'dr.hema@clinic.lk',
    nicNumber: '712345678V',
    address: 'Herbal Care Clinic, Kandy Road, Kiribathgoda',
    customerType: 'WHOLESALE' as const,
    creditLimit: 200000.0,
    currentBalance: 58000.0,
    loyaltyPoints: 890,
  },
  {
    name: 'Mr. Asanka Fernando',
    phone: '0778889911',
    email: 'asanka@fernando.lk',
    nicNumber: '891234567V',
    address: 'No. 5, Beach Road, Mount Lavinia',
    customerType: 'RETAIL_CREDIT' as const,
    creditLimit: 15000.0,
    currentBalance: 3100.0,
    loyaltyPoints: 150,
  },
  {
    name: 'Ven. Piyaratana Thero',
    phone: '0714445566',
    email: null,
    nicNumber: null,
    address: 'Sri Bodhirajarama Pirivena, Bellanwila',
    customerType: 'RETAIL_CREDIT' as const,
    creditLimit: 50000.0,
    currentBalance: 0.0,
    loyaltyPoints: 500,
  },
];

export async function seedCustomers() {
  console.log('\n========================================================================');
  console.log('👤 PIXELCRAFT POS - CUSTOMER CRM & CREDIT LEDGER SEEDING');
  console.log('   Target Tenant: Deegayu Weda Madura');
  console.log('========================================================================\n');

  const tenant = await prisma.business.findFirst({
    where: {
      OR: [
        { slug: 'deegayu' },
        { id: '0fef1423-5d89-4147-8af8-17c7e641c88a' },
      ],
    },
  });

  if (!tenant) {
    throw new Error('Tenant "deegayu" not found.');
  }

  console.log(`✓ Located Tenant: "${tenant.name}" (${tenant.id})`);

  for (const c of SEED_CUSTOMERS) {
    let customer = await prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        name: c.name,
        deletedAt: null,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: c.name,
          phone: c.phone || null,
          email: c.email,
          nicNumber: c.nicNumber,
          address: c.address,
          customerType: c.customerType,
          creditLimit: c.creditLimit,
          currentBalance: c.currentBalance,
          loyaltyPoints: c.loyaltyPoints,
          status: 'ACTIVE',
        },
      });
      console.log(`✓ Created Customer: ${customer.name} (Credit Limit: LKR ${c.creditLimit})`);

      // If customer has an initial balance, record opening ledger entry
      if (c.currentBalance > 0) {
        await prisma.customerLedger.create({
          data: {
            tenantId: tenant.id,
            customerId: customer.id,
            entryType: 'CREDIT_SALE',
            referenceId: `OPENING-BAL-${customer.id.slice(0, 8)}`,
            debitAmount: c.currentBalance,
            creditAmount: 0,
            runningBalance: c.currentBalance,
            notes: 'Opening credit ledger balance brought forward',
          },
        });
      }
    } else {
      console.log(`- Customer already exists: ${customer.name}`);
    }
  }

  console.log('\n========================================================================');
  console.log('✓ CUSTOMER CRM SEEDING COMPLETE!');
  console.log('========================================================================\n');
}

if (require.main === module) {
  seedCustomers()
    .catch((err) => {
      console.error('❌ Failed to seed customers:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

