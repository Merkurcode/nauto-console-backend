import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, user } = req;
    const userId = user?.sub || 'anonymous';

    // Log the request
    this.logger.log({
      message: 'Request received',
      userId,
      method,
      url,
      body,
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
