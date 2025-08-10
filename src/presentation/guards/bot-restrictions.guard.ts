import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BOT_ONLY_KEY, NO_BOTS_KEY } from '@shared/decorators/bot-restrictions.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Guard that enforces BOT access restrictions on endpoints
 * - @BotOnly(): Only BOT users can access
 * - @NoBots(): BOT users are forbidden
 */
@Injectable()
export class BotRestrictionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(BotRestrictionsGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;

    // If no user (public endpoint), allow access (other guards will handle auth)
    if (!user) {
      return true;
    }

    // Check for BOT restrictions
    const botOnly =
      this.reflector.get<boolean>(BOT_ONLY_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(BOT_ONLY_KEY, context.getClass());

    const noBots =
      this.reflector.get<boolean>(NO_BOTS_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(NO_BOTS_KEY, context.getClass());

    // If both decorators are present, log warning and deny access
    if (botOnly && noBots) {
      this.logger.warn({
        message: 'Conflicting BOT decorators on endpoint',
        method: request.method,
        path: request.url,
        botOnly,
        noBots,
      });
      throw new ForbiddenException('Conflicting BOT access configuration');
    }

    // Check if user is BOT
    const isBotUser = user.roles?.some(role => role === RolesEnum.BOT);

    // Handle @BotOnly() - only BOT users allowed
    if (botOnly) {
      if (!isBotUser) {
        this.logger.warn({
          message: 'Non-BOT user attempted to access BOT-only endpoint',
          userId: user.sub,
          email: user.email,
          roles: user.roles,
          method: request.method,
          path: request.url,
        });
        throw new ForbiddenException('This endpoint is restricted to BOT users only');
      }

      this.logger.debug({
        message: 'BOT user accessed BOT-only endpoint',
        userId: user.sub,
        method: request.method,
        path: request.url,
      });

      return true;
    }

    // Handle @NoBots() - BOT users forbidden
    if (noBots) {
      if (isBotUser) {
        this.logger.warn({
          message: 'BOT user attempted to access forbidden endpoint',
          userId: user.sub,
          email: user.email,
          roles: user.roles,
          method: request.method,
          path: request.url,
        });
        throw new ForbiddenException('BOT users cannot access this endpoint');
      }

      this.logger.debug({
        message: 'Non-BOT user accessed endpoint with BOT restrictions',
        userId: user.sub,
        method: request.method,
        path: request.url,
      });

      return true;
    }

    // No BOT restrictions, allow access
    return true;
  }
}
