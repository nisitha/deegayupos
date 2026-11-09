/**
 * Standard API error payload structure for all PixelCraft POS responses.
 */
export interface ApiErrorPayload {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  timestamp?: string;
  path?: string;
}

/**
 * Standard unified API Response Envelope.
 * Guaranteed format for all HTTP responses emitted by PixelCraft POS services.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  timestamp: string;
  path?: string;
}

/**
 * Generic paginated result wrapper.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Standard API Error Response Envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  timestamp: string;
  path: string;
}

/**
 * Health check telemetry data structure.
 */
export interface HealthCheckData {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  environment: string;
  uptime: number; // in seconds
  timestamp: string;
  nodeVersion: string;
  database?: {
    status: 'connected' | 'disconnected';
    latencyMs?: number;
  };
  memoryUsage?: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
}

/**
 * Health check response envelope type.
 */
export type HealthCheckResponse = ApiResponse<HealthCheckData>;

/**
 * Pagination metadata envelope.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated API data wrapper.
 */
export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;
