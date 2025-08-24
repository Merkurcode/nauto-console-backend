import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Interceptor that adds security headers to all responses
 * Helps prevent common web vulnerabilities
 */
@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();

        // Only add headers if response exists and headers aren't sent yet
        if (response && !response.headersSent) {
          // Prevent MIME type sniffing
          response.setHeader('X-Content-Type-Options', 'nosniff');

          // Prevent clickjacking attacks
          response.setHeader('X-Frame-Options', 'DENY');

          // Enable XSS filtering in browsers
          response.setHeader('X-XSS-Protection', '1; mode=block');

          // Prevent referrer information leakage
          response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

          // Content Security Policy for file operations
          response.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'self'",
          );

          // Prevent browsers from inferring file types
          response.setHeader('X-Download-Options', 'noopen');

          // Prevent Adobe Flash and PDF files from including files from other domains
          response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

          // Remove server information
          response.removeHeader('X-Powered-By');
        }
      }),
    );
  }
}
