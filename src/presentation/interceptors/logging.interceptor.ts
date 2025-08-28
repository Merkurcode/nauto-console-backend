import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { SecurityLogger } from '@shared/utils/security-logger.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly sensitiveFields = [
    'password',
    'newPassword', 
    'currentPassword',
    'oldPassword',
    'confirmPassword',
    'passwordConfirmation',
    'token',
    'accessToken',
    'refreshToken',
    'sessionToken',
    'resetToken',
    'verificationToken',
    'captchaToken',
    'secret',
    'secretKey',
    'apiKey',
    'api_key',
    'privateKey',
    'publicKey',
    'key',
    'authorization'
  ];

  constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  private sanitizeObject(obj: any, depth = 0): any {
    if (depth > 10 || obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
          if (typeof value === 'string') {
            sanitized[key] = SecurityLogger.maskSensitiveData(value);
          } else {
            sanitized[key] = '[REDACTED]';
          }
        } else {
          sanitized[key] = this.sanitizeObject(value, depth + 1);
        }
      }
      return sanitized;
    }
    
    return obj;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, user } = req;
    const userId = user?.sub || 'anonymous';

    // Log the request with sanitized body
    const sanitizedBody = this.sanitizeObject(body);
    this.logger.log({
      message: 'Request received',
      userId,
      method,
      url,
      body: sanitizedBody,
      bodySize: body ? JSON.stringify(body).length : 0,
    });

    const now = performance.now();

    return next.handle().pipe(
      tap(data => {
        // Log the response
        this.logger.log({
          message: 'Request completed',
          userId,
          method,
          url,
          processingTime: `${performance.now() - now}ms`,
          responseType: typeof data === 'object' ? 'Object' : typeof data,
        });
      }),
    );
  }
}
