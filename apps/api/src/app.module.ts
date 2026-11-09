import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PosModule } from './modules/pos/pos.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ProductsModule } from './modules/products/products.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    SuperAdminModule,
    OnboardingModule,
    DashboardModule,
    BusinessModule,
    ProductsModule,
    PosModule,
    InventoryModule,
    ProcurementModule,
    CustomersModule,
  ],
})
export class AppModule {}
