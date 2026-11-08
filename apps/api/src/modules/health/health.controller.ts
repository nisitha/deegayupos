import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckResponseDto } from '../../common/dto/response.dto';
import type { HealthCheckData } from '@pixelcraft/types';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'System Health & Telemetry Status',
    description:
      'Returns real-time operational status, system uptime, runtime info, and timestamps for PixelCraft POS API.',
  })
  @ApiOkResponse({
    description: 'System is healthy and responsive.',
    type: HealthCheckResponseDto,
  })
  async getHealth(): Promise<HealthCheckData> {
    return this.healthService.getHealthStatus();
  }
}
