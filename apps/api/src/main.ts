import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('PixelCraft-Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const rawCorsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const allowedOrigins = rawCorsOrigin.split(',').map((origin) => origin.trim());

  // Global API Routing Prefix
  app.setGlobalPrefix('api/v1');

  // Security & CORS Configuration
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or in dev
      if (!origin || nodeEnv === 'development' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global Interceptors, Filters, and Validation Pipes
  app.useGlobalPipes(new GlobalValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // Swagger / OpenAPI Specification Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PixelCraft POS - Core API')
    .setDescription(
      'Enterprise-grade multi-tenant SaaS POS backend API services (pos.pixelcraftlk.com)',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Operational health and system diagnostics')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT tenant bearer token',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'PixelCraft POS API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  await app.listen(port);

  logger.log(`🚀 PixelCraft POS API Gateway running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 OpenAPI / Swagger Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🩺 Healthcheck Endpoint: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((error) => {
  console.error('Fatal bootstrapping error:', error);
  process.exit(1);
});
