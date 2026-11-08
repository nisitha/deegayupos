import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
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
  ],
})
export class AppModule {}
