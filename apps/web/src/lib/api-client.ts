import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  ApiResponse,
  HealthCheckData,
  HealthCheckResponse,
  PaginatedResult,
  PlatformSettingDto,
  PlatformSettingItemDto,
  SaaSPlanDto,
  SuperAdminOverviewMetrics,
  SystemAuditLogDto,
  TenantDetail,
  TenantSummary,
  UpdateTenantStatusDto,
  CheckSlugResult,
  OnboardingPayload,
  OnboardingResponseData,
  PublicPlanDto,
  DashboardMetrics,
  DashboardChartsData,
  DashboardActivityItem,
  BusinessProfileData,
  BusinessSettingsData,
  UpdateBusinessSettingsPayload,
  UpdateReceiptSettingsPayload,
  TenantStoreSettingsDto,
  UpdateTenantStoreSettingsDto,
  ProductDto,
  CreateProductPayload,
  UpdateProductPayload,
  ProductLookupResult,
  CategoryDto,
  CreateCategoryPayload,
  BrandDto,
  CreateBrandPayload,
  UnitDto,
  CreateUnitPayload,
  BulkImportResult,
  CheckoutPayload,
  HeldCartDto,
  HoldCartPayload,
  SaleDto,
  ReceiptDocumentDto,
  StockLevelDto,
  StockMovementDto,
  StockAdjustmentDto,
  CreateStockAdjustmentDto,
  StockTransferDto,
  CreateStockTransferDto,
  InventoryTelemetryDto,
  StockFilterParams,
  MovementFilterParams,
  SupplierDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  PurchaseOrderDto,
  CreatePurchaseOrderDto,
  GoodsReceivedNoteDto,
  CreateGrnDto,
  CustomerDto,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerLedgerDto,
  RecordCustomerPaymentDto,
  CustomerPaymentDto,
  CustomerTelemetryDto,
  StaffUserDto,
  CreateStaffUserDto,
  UpdateStaffUserDto,
} from '@pixelcraft/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request Interceptor (Inject Auth / Tenant headers)
    this.instance.interceptors.request.use(
      (config) => {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('pixelcraft_access_token');
          if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          const tenantId = localStorage.getItem('pixelcraft_tenant_id');
          if (tenantId && !config.headers['x-tenant-id']) {
            config.headers['x-tenant-id'] = tenantId;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response Interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        // Normalize error response if available from backend
        if (error.response?.data) {
          return Promise.reject(error.response.data);
        }
        return Promise.reject({
          success: false,
          error: {
            code: error.code || 'NETWORK_ERROR',
            message: error.message || 'Network connection failed',
            statusCode: error.status || 500,
          },
          timestamp: new Date().toISOString(),
        });
      },
    );
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  public async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  public async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  public async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

export const healthApi = {
  checkHealth: async (): Promise<HealthCheckResponse> => {
    return apiClient.get<HealthCheckData>('/health');
  },
};

export const superAdminApi = {
  getOverview: async (): Promise<ApiResponse<SuperAdminOverviewMetrics>> => {
    return apiClient.get<SuperAdminOverviewMetrics>('/super-admin/overview');
  },
  getTenants: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<ApiResponse<PaginatedResult<TenantSummary>>> => {
    return apiClient.get<PaginatedResult<TenantSummary>>('/super-admin/tenants', { params });
  },
  getTenantDetail: async (id: string): Promise<ApiResponse<TenantDetail>> => {
    return apiClient.get<TenantDetail>(`/super-admin/tenants/${id}`);
  },
  updateTenantStatus: async (
    id: string,
    data: UpdateTenantStatusDto,
  ): Promise<ApiResponse<TenantSummary>> => {
    return apiClient.patch<TenantSummary>(`/super-admin/tenants/${id}/status`, data);
  },
  getPlans: async (): Promise<ApiResponse<SaaSPlanDto[]>> => {
    return apiClient.get<SaaSPlanDto[]>('/super-admin/plans');
  },
  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    action?: string;
  }): Promise<ApiResponse<PaginatedResult<SystemAuditLogDto>>> => {
    return apiClient.get<PaginatedResult<SystemAuditLogDto>>('/super-admin/audit-logs', { params });
  },
  getSettings: async (): Promise<ApiResponse<PlatformSettingItemDto[]>> => {
    return apiClient.get<PlatformSettingItemDto[]>('/super-admin/settings');
  },
  updateSetting: async (
    data: PlatformSettingDto,
  ): Promise<ApiResponse<PlatformSettingItemDto>> => {
    return apiClient.patch<PlatformSettingItemDto>('/super-admin/settings', data);
  },
};

export const onboardingApi = {
  getPlans: async (): Promise<ApiResponse<PublicPlanDto[]>> => {
    return apiClient.get<PublicPlanDto[]>('/onboarding/plans');
  },
  checkSlug: async (slug: string): Promise<ApiResponse<CheckSlugResult>> => {
    return apiClient.post<CheckSlugResult>('/onboarding/check-slug', { slug });
  },
  register: async (
    payload: OnboardingPayload,
  ): Promise<ApiResponse<OnboardingResponseData>> => {
    return apiClient.post<OnboardingResponseData>('/onboarding/register', payload);
  },
};

export const dashboardApi = {
  getMetrics: async (branchId?: string): Promise<ApiResponse<DashboardMetrics>> => {
    return apiClient.get<DashboardMetrics>('/dashboard/metrics', {
      params: branchId ? { branchId } : undefined,
    });
  },
  getCharts: async (
    days = 7,
    branchId?: string,
  ): Promise<ApiResponse<DashboardChartsData>> => {
    return apiClient.get<DashboardChartsData>('/dashboard/charts', {
      params: { days, ...(branchId ? { branchId } : {}) },
    });
  },
  getActivity: async (
    limit = 10,
    branchId?: string,
  ): Promise<ApiResponse<DashboardActivityItem[]>> => {
    return apiClient.get<DashboardActivityItem[]>('/dashboard/activity', {
      params: { limit, ...(branchId ? { branchId } : {}) },
    });
  },
};

export const businessApi = {
  getProfile: async (): Promise<ApiResponse<BusinessProfileData>> => {
    return apiClient.get<BusinessProfileData>('/business/profile');
  },
  updateSettings: async (
    data: UpdateBusinessSettingsPayload,
  ): Promise<ApiResponse<BusinessSettingsData>> => {
    return apiClient.patch<BusinessSettingsData>('/business/settings', data);
  },
  updateReceiptSettings: async (
    data: UpdateReceiptSettingsPayload,
  ): Promise<ApiResponse<BusinessSettingsData>> => {
    return apiClient.patch<BusinessSettingsData>('/business/receipt-settings', data);
  },
};

export const tenantSettingsApi = {
  getSettings: async (slug?: string): Promise<ApiResponse<TenantStoreSettingsDto>> => {
    try {
      const q = slug ? `?slug=${encodeURIComponent(slug)}` : '';
      const localRes = await fetch(`/api/tenant/settings${q}`, {
        cache: 'no-store',
      });
      if (localRes.ok) {
        return (await localRes.json()) as ApiResponse<TenantStoreSettingsDto>;
      }
    } catch {
      // Fallback to apiClient
    }
    return apiClient.get<TenantStoreSettingsDto>('/tenant/settings', {
      params: slug ? { slug } : undefined,
    });
  },
  updateSettings: async (
    data: UpdateTenantStoreSettingsDto,
    slug?: string,
  ): Promise<ApiResponse<TenantStoreSettingsDto>> => {
    try {
      const q = slug ? `?slug=${encodeURIComponent(slug)}` : '';
      const localRes = await fetch(`/api/tenant/settings${q}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (localRes.ok) {
        return (await localRes.json()) as ApiResponse<TenantStoreSettingsDto>;
      }
    } catch {
      // Fallback to apiClient
    }
    return apiClient.patch<TenantStoreSettingsDto>('/tenant/settings', data, {
      params: slug ? { slug } : undefined,
    });
  },
};

export const productsApi = {
  getAll: async (params?: Record<string, unknown>): Promise<ApiResponse<PaginatedResult<ProductDto>>> => {
    return apiClient.get<PaginatedResult<ProductDto>>('/products', { params });
  },
  getById: async (id: string): Promise<ApiResponse<ProductDto>> => {
    return apiClient.get<ProductDto>(`/products/${id}`);
  },
  lookupBarcode: async (params: {
    barcode?: string;
    sku?: string;
  }): Promise<ApiResponse<ProductLookupResult>> => {
    return apiClient.get<ProductLookupResult>('/products/lookup', { params });
  },
  create: async (data: CreateProductPayload): Promise<ApiResponse<ProductDto>> => {
    return apiClient.post<ProductDto>('/products', data);
  },
  update: async (id: string, data: UpdateProductPayload): Promise<ApiResponse<ProductDto>> => {
    return apiClient.patch<ProductDto>(`/products/${id}`, data);
  },
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<{ success: boolean }>(`/products/${id}`);
  },
  getCategories: async (): Promise<ApiResponse<CategoryDto[]>> => {
    return apiClient.get<CategoryDto[]>('/products/categories');
  },
  createCategory: async (data: CreateCategoryPayload): Promise<ApiResponse<CategoryDto>> => {
    return apiClient.post<CategoryDto>('/products/categories', data);
  },
  getBrands: async (): Promise<ApiResponse<BrandDto[]>> => {
    return apiClient.get<BrandDto[]>('/products/brands');
  },
  createBrand: async (data: CreateBrandPayload): Promise<ApiResponse<BrandDto>> => {
    return apiClient.post<BrandDto>('/products/brands', data);
  },
  getUnits: async (): Promise<ApiResponse<UnitDto[]>> => {
    return apiClient.get<UnitDto[]>('/products/units');
  },
  createUnit: async (data: CreateUnitPayload): Promise<ApiResponse<UnitDto>> => {
    return apiClient.post<UnitDto>('/products/units', data);
  },
  bulkImport: async (products: CreateProductPayload[]): Promise<ApiResponse<BulkImportResult>> => {
    return apiClient.post<BulkImportResult>('/products/bulk-import', { products });
  },
  export: async (): Promise<ApiResponse<ProductDto[]>> => {
    return apiClient.get<ProductDto[]>('/products/export');
  },
};

export const posApi = {
  checkout: async (data: CheckoutPayload): Promise<ApiResponse<SaleDto>> => {
    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return (await res.json()) as ApiResponse<SaleDto>;
      }
    } catch {
      // Fallback to apiClient
    }
    return apiClient.post<SaleDto>('/pos/checkout', data);
  },
  holdCart: async (data: HoldCartPayload): Promise<ApiResponse<HeldCartDto>> => {
    return apiClient.post<HeldCartDto>('/pos/cart/hold', data);
  },
  getHeldCarts: async (branchId?: string): Promise<ApiResponse<HeldCartDto[]>> => {
    return apiClient.get<HeldCartDto[]>('/pos/cart/held', { params: { branchId } });
  },
  resumeCart: async (id: string): Promise<ApiResponse<HeldCartDto>> => {
    return apiClient.post<HeldCartDto>(`/pos/cart/resume/${id}`);
  },
  voidSale: async (id: string, reason: string): Promise<ApiResponse<SaleDto>> => {
    try {
      const res = await fetch(`/api/sales/${encodeURIComponent(id)}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        return (await res.json()) as ApiResponse<SaleDto>;
      }
    } catch {
      // Fallback to apiClient
    }
    return apiClient.post<SaleDto>(`/pos/void/${id}`, { reason });
  },
  getSaleById: async (id: string): Promise<ApiResponse<SaleDto>> => {
    try {
      const res = await fetch(`/api/sales/${encodeURIComponent(id)}`);
      if (res.ok) {
        return (await res.json()) as ApiResponse<SaleDto>;
      }
    } catch {
      // Fallback
    }
    return apiClient.get<SaleDto>(`/pos/sales/${id}`);
  },
  getReceiptDocument: async (id: string): Promise<ApiResponse<ReceiptDocumentDto>> => {
    try {
      const res = await fetch(`/api/pos/sales/${encodeURIComponent(id)}/receipt`);
      if (res.ok) {
        return (await res.json()) as ApiResponse<ReceiptDocumentDto>;
      }
    } catch {
      // Fallback
    }
    return apiClient.get<ReceiptDocumentDto>(`/pos/sales/${id}/receipt`);
  },
  downloadPdf: async (id: string, invoiceNumber: string): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_access_token') : null;
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('pixelcraft_tenant_id') : null;

    const response = await fetch(`${API_BASE_URL}/pos/sales/${id}/pdf`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF document');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceNumber.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  getSales: async (params?: Record<string, unknown>): Promise<ApiResponse<PaginatedResult<SaleDto>>> => {
    try {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
        });
      }
      const q = sp.toString() ? `?${sp.toString()}` : '';
      const res = await fetch(`/api/sales${q}`, { cache: 'no-store' });
      if (res.ok) {
        return (await res.json()) as ApiResponse<PaginatedResult<SaleDto>>;
      }
    } catch {
      // Fallback
    }
    return apiClient.get<PaginatedResult<SaleDto>>('/pos/sales', { params });
  },
  getAnalytics: async <T = Record<string, unknown>>(
    params?: Record<string, unknown>,
  ): Promise<ApiResponse<T>> => {
    const sp = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
      });
    }
    const q = sp.toString() ? `?${sp.toString()}` : '';
    const res = await fetch(`/api/sales/analytics${q}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to load sales analytics');
    }
    return (await res.json()) as ApiResponse<T>;
  },
};

export const inventoryApi = {
  getTelemetry: async (): Promise<ApiResponse<InventoryTelemetryDto>> => {
    return apiClient.get<InventoryTelemetryDto>('/inventory/telemetry');
  },
  getStockLevels: async (params?: StockFilterParams): Promise<ApiResponse<PaginatedResult<StockLevelDto>>> => {
    return apiClient.get<PaginatedResult<StockLevelDto>>('/inventory/stock-levels', { params });
  },
  createAdjustment: async (payload: CreateStockAdjustmentDto): Promise<ApiResponse<StockAdjustmentDto>> => {
    return apiClient.post<StockAdjustmentDto>('/inventory/adjustments', payload);
  },
  createTransfer: async (payload: CreateStockTransferDto): Promise<ApiResponse<StockTransferDto>> => {
    return apiClient.post<StockTransferDto>('/inventory/transfers', payload);
  },
  dispatchTransfer: async (id: string): Promise<ApiResponse<StockTransferDto>> => {
    return apiClient.patch<StockTransferDto>(`/inventory/transfers/${id}/dispatch`);
  },
  receiveTransfer: async (id: string): Promise<ApiResponse<StockTransferDto>> => {
    return apiClient.patch<StockTransferDto>(`/inventory/transfers/${id}/receive`);
  },
  getMovements: async (params?: MovementFilterParams): Promise<ApiResponse<PaginatedResult<StockMovementDto>>> => {
    return apiClient.get<PaginatedResult<StockMovementDto>>('/inventory/movements', { params });
  },
};

export const suppliersApi = {
  getSuppliers: async (params?: Record<string, unknown>): Promise<ApiResponse<PaginatedResult<SupplierDto>>> => {
    return apiClient.get<PaginatedResult<SupplierDto>>('/suppliers', { params });
  },
  getSupplierById: async (id: string): Promise<ApiResponse<SupplierDto>> => {
    return apiClient.get<SupplierDto>(`/suppliers/${id}`);
  },
  createSupplier: async (payload: CreateSupplierDto): Promise<ApiResponse<SupplierDto>> => {
    return apiClient.post<SupplierDto>('/suppliers', payload);
  },
  updateSupplier: async (id: string, payload: UpdateSupplierDto): Promise<ApiResponse<SupplierDto>> => {
    return apiClient.patch<SupplierDto>(`/suppliers/${id}`, payload);
  },
  deleteSupplier: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<{ success: boolean }>(`/suppliers/${id}`);
  },
};

export const procurementApi = {
  getPurchaseOrders: async (params?: Record<string, unknown>): Promise<ApiResponse<PaginatedResult<PurchaseOrderDto>>> => {
    return apiClient.get<PaginatedResult<PurchaseOrderDto>>('/procurement/purchase-orders', { params });
  },
  getPurchaseOrderById: async (id: string): Promise<ApiResponse<PurchaseOrderDto>> => {
    return apiClient.get<PurchaseOrderDto>(`/procurement/purchase-orders/${id}`);
  },
  createPurchaseOrder: async (payload: CreatePurchaseOrderDto): Promise<ApiResponse<PurchaseOrderDto>> => {
    return apiClient.post<PurchaseOrderDto>('/procurement/purchase-orders', payload);
  },
  getGoodsReceivedNotes: async (params?: Record<string, unknown>): Promise<ApiResponse<PaginatedResult<GoodsReceivedNoteDto>>> => {
    return apiClient.get<PaginatedResult<GoodsReceivedNoteDto>>('/procurement/grn', { params });
  },
  getGrnById: async (id: string): Promise<ApiResponse<GoodsReceivedNoteDto>> => {
    return apiClient.get<GoodsReceivedNoteDto>(`/procurement/grn/${id}`);
  },
  createGrn: async (payload: CreateGrnDto): Promise<ApiResponse<GoodsReceivedNoteDto>> => {
    return apiClient.post<GoodsReceivedNoteDto>('/procurement/grn', payload);
  },
};

export const customersApi = {
  getCustomers: async (params?: Record<string, unknown>): Promise<ApiResponse<PaginatedResult<CustomerDto>>> => {
    return apiClient.get<PaginatedResult<CustomerDto>>('/customers', { params });
  },
  getTelemetry: async (): Promise<ApiResponse<CustomerTelemetryDto>> => {
    return apiClient.get<CustomerTelemetryDto>('/customers/telemetry');
  },
  getCustomerById: async (id: string): Promise<ApiResponse<CustomerDto>> => {
    return apiClient.get<CustomerDto>(`/customers/${id}`);
  },
  getCustomerLedger: async (id: string): Promise<ApiResponse<{ customer: CustomerDto; ledger: CustomerLedgerDto[] }>> => {
    return apiClient.get<{ customer: CustomerDto; ledger: CustomerLedgerDto[] }>(`/customers/${id}/ledger`);
  },
  createCustomer: async (payload: CreateCustomerDto): Promise<ApiResponse<CustomerDto>> => {
    return apiClient.post<CustomerDto>('/customers', payload);
  },
  updateCustomer: async (id: string, payload: UpdateCustomerDto): Promise<ApiResponse<CustomerDto>> => {
    return apiClient.patch<CustomerDto>(`/customers/${id}`, payload);
  },
  recordDebtSettlement: async (id: string, payload: RecordCustomerPaymentDto): Promise<ApiResponse<{ customer: CustomerDto; payment: CustomerPaymentDto; ledgerEntry: CustomerLedgerDto }>> => {
    return apiClient.post<{ customer: CustomerDto; payment: CustomerPaymentDto; ledgerEntry: CustomerLedgerDto }>(`/customers/${id}/payments`, payload);
  },
};

export const staffApi = {
  list: async (): Promise<ApiResponse<StaffUserDto[]>> => {
    return apiClient.get<StaffUserDto[]>('/staff');
  },
  getById: async (id: string): Promise<ApiResponse<StaffUserDto>> => {
    return apiClient.get<StaffUserDto>(`/staff/${id}`);
  },
  create: async (payload: CreateStaffUserDto): Promise<ApiResponse<StaffUserDto>> => {
    return apiClient.post<StaffUserDto>('/staff', payload);
  },
  update: async (id: string, payload: UpdateStaffUserDto): Promise<ApiResponse<StaffUserDto>> => {
    return apiClient.patch<StaffUserDto>(`/staff/${id}`, payload);
  },
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<{ success: boolean }>(`/staff/${id}`);
  },
  verifyPin: async (pinCode: string): Promise<ApiResponse<StaffUserDto | null>> => {
    return apiClient.post<StaffUserDto | null>('/staff/verify-pin', { pinCode });
  },
};





