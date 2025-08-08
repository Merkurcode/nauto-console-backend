import { Injectable, NestMiddleware, Inject, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, timingSafeEqual } from 'crypto';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/responses/user.response';

/**
 * Global Request Integrity Middleware
 * Verifies request signatures using Bearer token to determine if BOT or Server secret should be used
 */
@Injectable()
export class RequestIntegrityMiddleware implements NestMiddleware {
  private readonly botSecret: string;
  private readonly serverSecret: string;
  private readonly skipPaths: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(RequestIntegrityMiddleware.name);

    // Get secrets from environment
    this.botSecret = this.configService.get<string>('BOT_INTEGRITY_SECRET');
    this.serverSecret = this.configService.get<string>('SERVER_INTEGRITY_SECRET');

    // Paths that skip integrity verification (all public endpoints)
    this.skipPaths = [
      // Health endpoints (all public)
      '/api/health',
      '/api/health/database',
      '/api/health/ready',
      '/api/health/live',

      // Auth endpoints (public endpoints only)
      '/api/auth/login',
      '/api/auth/verify-otp',
      '/api/auth/refresh-token',
      '/api/auth/email/verify',
      '/api/auth/password/request-reset',
      '/api/auth/password/reset',

      // Company endpoints (public)
      '/api/companies/by-host',

      // Documentation and root
      '/docs', // Swagger docs
      '/', // Root
    ];

    this.validateConfiguration();
    
    // Log configuration status
    const isEnabled = this.configService.get<boolean>('security.requestIntegrityEnabled', false);
    this.logger.log({
      message: 'Request integrity middleware configured',
      enabled: isEnabled,
      skipPathsCount: this.skipPaths.length,
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Check if request integrity is enabled in configuration
    const requestIntegrityEnabled = this.configService.get<boolean>(
      'security.requestIntegrityEnabled',
      false,
    );
    if (!requestIntegrityEnabled) {
      return next(); // Skip integrity check if disabled
    }

    // Skip integrity check for certain paths
    if (this.shouldSkipIntegrityCheck(req.path)) {
      return next();
    }

    try {
      const signature = req.headers['x-signature'] as string;

      if (!signature) {
        this.logger.warn({
          message: 'API request missing integrity signature',
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        throw new UnauthorizedException('Request integrity signature required');
      }

      // Determine if request is from BOT based on Bearer token
      const isBotRequest = this.isBotRequest(req);
      const origin = isBotRequest ? 'bot' : 'server';
      const secret = isBotRequest ? this.botSecret : this.serverSecret;

      if (!secret) {
        this.logger.error({
          message: 'No secret configured for request origin',
          origin,
          method: req.method,
          path: req.path,
        });
        throw new UnauthorizedException('Request signature verification not available');
      }

      // Build payload (same logic for all requests)
      const payload = this.buildPayload(req);

      // Verify signature with appropriate secret
      const expectedSignature = this.generateSignature(payload, secret);
      const isValid = this.verifySignature(signature, expectedSignature);

      if (!isValid) {
        this.logger.warn({
          message: 'Request integrity verification failed',
          method: req.method,
          path: req.path,
          ip: req.ip,
          origin,
          signature: signature.substring(0, 16) + '***',
          expectedSignature: expectedSignature.substring(0, 16) + '***',
        });
        throw new UnauthorizedException('Invalid request signature');
      }

      this.logger.debug({
        message: 'Request integrity verification successful',
        method: req.method,
        path: req.path,
        origin,
      });

      // Store origin information in request for later use
      (req as any).signatureOrigin = origin;

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error({
        message: 'Error in request integrity middleware',
        method: req.method,
        path: req.path,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new UnauthorizedException('Request integrity verification failed');
    }
  }

  /**
   * Determine if request comes from BOT user based on Bearer token
   */
  private isBotRequest(req: Request): boolean {
    try {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false; // No bearer token = assume server request
      }

      const token = authHeader.substring(7);

      // Decode JWT without verification (we just need to check roles)
      const decoded = this.jwtService.decode(token) as IJwtPayload;
      if (!decoded || !decoded.roles) {
        return false;
      }

      // Check if user has BOT role
      const isBotUser = decoded.roles.some(role => role === RolesEnum.BOT);

      this.logger.debug({
        message: 'Detected request origin based on Bearer token',
        isBotUser,
        roles: decoded.roles,
      });

      return isBotUser;
    } catch (error) {
      // If we can't decode the token, assume it's a server request
      this.logger.debug({
        message: 'Could not decode Bearer token, assuming server request',
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Build payload for signature verification (same for all request types)
   */
  private buildPayload(req: Request): string {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const body = req.body ? this.stringifyBody(req.body) : '';
    const timestamp = Math.floor(Date.now() / (10 * 60 * 1000)); // 10 minute window

    const components = [req.method.toUpperCase(), fullUrl, body, timestamp.toString()];

    return components.join('|');
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(payload: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload, 'utf8');

    return hmac.digest('hex');
  }

  /**
   * Verify signature using timing-safe comparison
   */
  private verifySignature(provided: string, expected: string): boolean {
    if (provided.length !== expected.length) {
      return false;
    }

    try {
      const providedBuffer = Buffer.from(provided, 'hex');
      const expectedBuffer = Buffer.from(expected, 'hex');

      return timingSafeEqual(providedBuffer, expectedBuffer);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Convert request body to string for signature
   */
  private stringifyBody(body: any): string {
    if (!body) return '';

    try {
      if (typeof body === 'string') return body;
      if (Buffer.isBuffer(body)) return body.toString('base64');

      if (typeof body === 'object' && body !== null) {
        // Sort object keys recursively for consistent signature
        const normalized = this.sortObjectKeys(body);

        return JSON.stringify(normalized);
      }

      return JSON.stringify(body);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to stringify request body',
        error: error instanceof Error ? error.message : String(error),
      });

      return '';
    }
  }

  /**
   * Recursively sort object keys for consistent signatures
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted: Record<string, any> = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortObjectKeys(obj[key]);
      });

    return sorted;
  }

  /**
   * Check if path should skip integrity verification
   */
  private shouldSkipIntegrityCheck(path: string): boolean {
    return this.skipPaths.some(skipPath => {
      if (skipPath.endsWith('*')) {
        return path.startsWith(skipPath.slice(0, -1));
      }

      return path === skipPath || path.startsWith(skipPath + '/');
    });
  }

  /**
   * Validate middleware configuration
   */
  private validateConfiguration(): void {
    if (!this.botSecret && !this.serverSecret) {
      this.logger.error({
        message:
          'CRITICAL: At least one integrity secret must be configured (BOT_INTEGRITY_SECRET or SERVER_INTEGRITY_SECRET)',
        severity: 'CRITICAL',
      });
      throw new Error('At least one integrity secret must be configured');
    }

    if (this.botSecret && this.botSecret.length < 32) {
      throw new Error('BOT_INTEGRITY_SECRET must be at least 32 characters long');
    }

    if (this.serverSecret && this.serverSecret.length < 32) {
      throw new Error('SERVER_INTEGRITY_SECRET must be at least 32 characters long');
    }

    this.logger.log({
      message: 'Request integrity middleware configured successfully',
      hasBotSecret: !!this.botSecret,
      hasServerSecret: !!this.serverSecret,
      skipPathsCount: this.skipPaths.length,
    });
  }
}
