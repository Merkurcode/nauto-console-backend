import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserBanService } from '@core/services/user-ban.service';
import { IS_PUBLIC_KEY } from '@shared/decorators/public.decorator';
import { LoggerService } from '@infrastructure/logger/logger.service';

@Injectable()
export class UserBanGuard implements CanActivate {
  constructor(
    private readonly userBanService: UserBanService,
    private readonly reflector: Reflector,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(UserBanGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user in request, let other guards handle authentication
    if (!user) {
      return true;
    }

    // Validate that the user is not banned
    try {
      await this.userBanService.validateUserNotBannedById(user.sub);

      return true;
    } catch (error) {
      this.logger.warn({
        message: 'Access denied due to user ban',
        userId: user.sub,
        error: error.message,
      });

      // The UserBannedException will be thrown and handled by the exception filter
      throw error;
    }
  }
}
