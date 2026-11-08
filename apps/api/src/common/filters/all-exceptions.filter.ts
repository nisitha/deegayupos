import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorPayload, ApiErrorResponse } from '@pixelcraft/types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal server error occurred';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;
        message = (resObj['message'] as string) || exception.message;
        errorCode = (resObj['error'] as string) || exception.name || errorCode;
        details =
          resObj['details'] ?? (Array.isArray(resObj['message']) ? resObj['message'] : undefined);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = exception.name || 'INTERNAL_SERVER_ERROR';
    }

    // Format error code to uppercase snake case if needed
    errorCode = errorCode.toUpperCase().replace(/\s+/g, '_');

    const errorPayload: ApiErrorPayload = {
      code: errorCode,
      message,
      statusCode: status,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const envelope: ApiErrorResponse = {
      success: false,
      error: errorPayload,
      timestamp: errorPayload.timestamp || new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status} - Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${status} - Error: ${message}`,
      );
    }

    response.status(status).json(envelope);
  }
}
