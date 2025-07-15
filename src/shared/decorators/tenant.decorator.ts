import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();

  return request.user?.tenantId;
});

export const RequireTenant = () => {
  return (target: object, propertyKey: string, _descriptor: PropertyDescriptor) => {
    // This decorator can be used to mark methods that require tenant context
    Reflect.defineMetadata('require-tenant', true, target, propertyKey);
  };
};
