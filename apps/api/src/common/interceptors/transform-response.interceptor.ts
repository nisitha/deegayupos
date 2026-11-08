import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import type { ApiResponse } from '@pixelcraft/types';

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const timestamp = new Date().toISOString();

    return next.handle().pipe(
      map((data) => {
        // If data is already in standard response shape, return directly
        if (data && typeof data === 'object' && 'success' in data && 'timestamp' in data) {
          return data as ApiResponse<T>;
        }

        return {
          success: true,
          data,
          timestamp,
          path: request.url,
        };
      }),
    );
  }
}
