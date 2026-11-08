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
    // Request Interceptor (Inject Auth / Tenant headers in subsequent phases)
    this.instance.interceptors.request.use(
      (config) => {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('pixelcraft_access_token');
          if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
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
