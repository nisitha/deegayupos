import {
  BadRequestException,
  ValidationError,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';

export class GlobalValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const formatErrors = (errs: ValidationError[]): Record<string, string[]> => {
          const result: Record<string, string[]> = {};
          for (const err of errs) {
            if (err.constraints) {
              result[err.property] = Object.values(err.constraints);
            }
            if (err.children && err.children.length > 0) {
              const childResults = formatErrors(err.children);
              for (const [key, val] of Object.entries(childResults)) {
                result[`${err.property}.${key}`] = val;
              }
            }
          }
          return result;
        };

        const details = formatErrors(errors);
        return new BadRequestException({
          error: 'VALIDATION_FAILED',
          message: 'Request payload validation failed',
          details,
        });
      },
    });
  }
}
