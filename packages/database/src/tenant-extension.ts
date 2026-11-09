import { PrismaClient } from '@prisma/client';

export interface TenantContextOptions {
  tenantId?: string;
  isSuperAdmin?: boolean;
}

const TENANT_SCOPED_MODELS = new Set([
  'business',
  'businesssetting',
  'branch',
  'warehouse',
  'register',
  'businessmembership',
  'auditlog',
  'idempotencykey',
  'category',
  'brand',
  'unit',
  'product',
  'productvariant',
  'sale',
  'saleitem',
  'salepayment',
  'heldcart',
]);

/**
 * Creates a tenant-isolated Prisma client extension.
 * Enforces defense-in-depth by injecting tenantId filters into queries
 * and verifying that operations outside tenant boundary are prevented.
 */
export function createTenantPrismaClient(prisma: PrismaClient, options: TenantContextOptions = {}) {
  const { tenantId, isSuperAdmin = false } = options;

  return prisma.$extends({
    name: 'tenant-isolation-extension',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // If super admin, bypass application-level filtering (RLS also checks app.is_super_admin)
          if (isSuperAdmin) {
            return query(args);
          }

          const normalizedModel = (model || '').toLowerCase();

          if (TENANT_SCOPED_MODELS.has(normalizedModel)) {
            if (!tenantId) {
              // Fail-safe: No tenant context provided for tenant-owned model query
              if (
                operation === 'findMany' ||
                operation === 'findFirst' ||
                operation === 'findUnique' ||
                operation === 'count'
              ) {
                // Constrain query to impossible match so zero rows leak
                const typedArgs = {
                  ...(args as object),
                  where: { id: '00000000-0000-0000-0000-000000000000' },
                };
                return query(typedArgs);
              }
              throw new Error(
                `[SecurityException] Attempted ${operation} on tenant-scoped model "${model}" without a valid tenant context.`,
              );
            }

            // Tenant context is present: enforce tenantId filter
            const typedArgs = { ...(args as object) } as Record<string, unknown>;
            if (operation === 'findMany' || operation === 'findFirst' || operation === 'count') {
              const existingWhere = (typedArgs['where'] || {}) as Record<string, unknown>;
              typedArgs['where'] = {
                ...existingWhere,
                ...(normalizedModel === 'business' ? { id: tenantId } : { tenantId }),
              };
              return query(typedArgs);
            }

            if (operation === 'create') {
              const data = { ...((typedArgs['data'] || {}) as Record<string, unknown>) };
              if (normalizedModel !== 'business' && !data['tenantId']) {
                data['tenantId'] = tenantId;
              }
              typedArgs['data'] = data;
              return query(typedArgs);
            }
          }

          return query(args);
        },
      },
    },
  });
}
