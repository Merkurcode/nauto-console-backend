import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BOT_ACCESS_KEY } from '@shared/decorators/bot-access.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Guard that optimizes performance for BOT users
 * - Allows high-volume access without throttling
 * - Maintains security for other roles
 * - Audits BOT access for monitoring
 */
@Injectable()
export class BotOptimizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(BotOptimizationGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;

    // Si no hay usuario, continuar con validaciones normales
    if (!user) {
      return true;
    }

    // Verificar si es un usuario BOT
    const isBotUser = user.roles?.some(role => role === RolesEnum.BOT);

    if (isBotUser) {
      // Verificar si el endpoint está marcado para acceso BOT
      const isBotAccessible = this.reflector.get<boolean>(BOT_ACCESS_KEY, context.getHandler());

      if (isBotAccessible) {
        // Mark request as BOT for other guards and services
        request.isBotRequest = true;
        request.skipThrottling = true;

        // Proper logging for audit (no sensitive information)
        this.logger.debug({
          message: 'BOT access to endpoint',
          method: request.method,
          path: request.url,
        });
      }
    }

    return true;
  }
}
