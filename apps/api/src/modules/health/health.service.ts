import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthCheckData } from '@pixelcraft/types';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getHealthStatus(): HealthCheckData {
    const memory = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    return {
      status: 'ok',
      service: 'PixelCraft POS API',
      version: '1.0.0',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      uptime: Math.round(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      memoryUsage: {
        rssMb: toMb(memory.rss),
        heapTotalMb: toMb(memory.heapTotal),
        heapUsedMb: toMb(memory.heapUsed),
      },
    };
  }
}
