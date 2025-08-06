import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionService } from '@core/services/session.service';
import { IS_PUBLIC_KEY } from '@shared/decorators/public.decorator';
import { ILogger } from '@core/interfaces/logger.interface';
import { JwtService } from '@nestjs/jwt';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly reflector: Reflector,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    private readonly jwtService: JwtService,
  ) {
    this.logger.setContext(SessionGuard.name);
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
    const authorization = request.headers.authorization;

    // If no authorization header, let other guards handle authentication
    if (!authorization) {
      return true;
    }

    try {
      // Extract the token from the Authorization header
      const token = authorization.replace('Bearer ', '');

      // Decode the JWT to get the session token (jti claim)
      const decoded = this.jwtService.decode(token) as { jti?: string; [key: string]: unknown };
      if (!decoded || !decoded.jti) {
        this.logger.warn({ message: 'JWT token missing jti claim' });

        return true; // Let JWT guard handle this
      }

      // Validate that the session exists and is active
      await this.sessionService.validateSessionToken(decoded.jti);

      // Update session activity
      await this.sessionService.updateSessionActivity(decoded.jti);

      return true;
    } catch (error) {
      this.logger.warn({
        message: 'Session validation failed',
        error: error.message,
      });

      // The InvalidSessionException will be thrown and handled by the exception filter
      throw error;
    }
  }
}
