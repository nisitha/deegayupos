import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApiErrorPayload, ApiResponse, HealthCheckData } from '@pixelcraft/types';

export class ApiErrorDto implements ApiErrorPayload {
  @ApiProperty({ example: 'VALIDATION_ERROR', description: 'Application error code' })
  code!: string;

  @ApiProperty({
    example: 'Invalid request payload provided',
    description: 'Human-readable error description',
  })
  message!: string;

  @ApiProperty({ example: 400, description: 'HTTP Status Code' })
  statusCode!: number;

  @ApiPropertyOptional({ description: 'Detailed contextual error metadata' })
  details?: unknown;

  @ApiPropertyOptional({ example: '2026-11-08T15:30:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ example: '/api/v1/health' })
  path?: string;
}

export class ApiResponseDto<T> implements ApiResponse<T> {
  @ApiProperty({ example: true, description: 'Operation success flag' })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Payload returned on success' })
  data?: T;

  @ApiPropertyOptional({ type: () => ApiErrorDto, description: 'Error payload on failure' })
  error?: ApiErrorDto;

  @ApiProperty({
    example: '2026-11-08T15:30:00.000Z',
    description: 'ISO 8601 generation timestamp',
  })
  timestamp!: string;

  @ApiPropertyOptional({ example: '/api/v1/health', description: 'Originating request path' })
  path?: string;
}

export class MemoryUsageDto {
  @ApiProperty({ example: 64.5, description: 'Resident Set Size in MB' })
  rssMb!: number;

  @ApiProperty({ example: 32.1, description: 'Total allocated V8 heap in MB' })
  heapTotalMb!: number;

  @ApiProperty({ example: 21.4, description: 'Used V8 heap in MB' })
  heapUsedMb!: number;
}

export class HealthCheckDataDto implements HealthCheckData {
  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'degraded', 'error'],
    description: 'Overall operational status',
  })
  status!: 'ok' | 'degraded' | 'error';

  @ApiProperty({ example: 'PixelCraft POS API', description: 'Microservice or Gateway name' })
  service!: string;

  @ApiProperty({ example: '1.0.0', description: 'Application version' })
  version!: string;

  @ApiProperty({ example: 'development', description: 'Target runtime environment' })
  environment!: string;

  @ApiProperty({ example: 124.5, description: 'Uptime in continuous seconds' })
  uptime!: number;

  @ApiProperty({ example: '2026-11-08T15:30:00.000Z', description: 'Timestamp of the check' })
  timestamp!: string;

  @ApiProperty({ example: 'v24.19.0', description: 'Node.js runtime version' })
  nodeVersion!: string;

  @ApiPropertyOptional({ type: () => MemoryUsageDto, description: 'Memory consumption telemetry' })
  memoryUsage?: MemoryUsageDto;
}

export class HealthCheckResponseDto extends ApiResponseDto<HealthCheckDataDto> {
  @ApiProperty({ type: () => HealthCheckDataDto })
  declare data: HealthCheckDataDto;
}
