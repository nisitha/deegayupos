import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthTenant } from '@pixelcraft/types';

export const CurrentTenant = createParamDecorator(
  (data: keyof AuthTenant | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant as AuthTenant | undefined;

    return data && tenant ? tenant[data] : tenant;
  },
);

