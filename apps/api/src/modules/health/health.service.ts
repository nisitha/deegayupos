import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthCheckData } from '@pixelcraft/types';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getHealthStatus(): Promise<HealthCheckData> {
    const memory = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    let dbStatus: 'connected' | 'disconnected';
    let dbLatencyMs: number | undefined;

    try {
      const start = performance.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Math.round((performance.now() - start) * 10) / 10;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      service: 'PixelCraft POS API',
      version: '1.0.0',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      uptime: Math.round(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      memoryUsage: {
        rssMb: toMb(memory.rss),
        heapTotalMb: toMb(memory.heapTotal),
        heapUsedMb: toMb(memory.heapUsed),
      },
    };
  }
}
