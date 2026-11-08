import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@pixelcraft/database';
import { createTenantPrismaClient } from '@pixelcraft/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    super({
      datasources: databaseUrl
        ? {
            db: {
              url: databaseUrl,
            },
          }
        : undefined,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL Database engine.');
    } catch (error) {
      this.logger.warn(
        `Database connection deferred: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL Database engine.');
  }

  /**
   * Binds an interactive transaction to a specific tenant context.
   * Sets PostgreSQL session variable `app.current_tenant_id` locally for the transaction.
   * Row-Level Security (RLS) dynamically applies this context to enforce strict isolation.
   */
  async withTenantContext<T>(
    tenantId: string,
    callback: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Set PostgreSQL session setting for this local transaction boundary
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId.replace(/'/g, "''")}'`,
      );
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'false'`);

      return callback(tx as unknown as PrismaClient);
    });
  }

  /**
   * Binds an interactive transaction with Super Admin bypass privileges.
   * Sets PostgreSQL session variable `app.is_super_admin = 'true'`.
   */
  async withSuperAdminContext<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true'`);
      return callback(tx as unknown as PrismaClient);
    });
  }

  /**
   * Returns a tenant-isolated Prisma client wrapper.
   * Injects tenantId filters into queries (Defense-in-depth).
   */
  forTenant(tenantId: string) {
    return createTenantPrismaClient(this, { tenantId });
  }

  /**
   * Returns a Super Admin privileged Prisma client wrapper.
   */
  forSuperAdmin() {
    return createTenantPrismaClient(this, { isSuperAdmin: true });
  }
}
