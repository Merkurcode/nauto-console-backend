import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

interface IFileAuditEvent {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class FileAuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(FileAuditInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: IJwtPayload }).user;
    const action = this.getAction(request);
    const resource = this.getResource(request);
    const resourceId = request.params.fileId || request.body?.fileId;

    const baseEvent: Partial<IFileAuditEvent> = {
      timestamp: new Date().toISOString(),
      userId: user?.sub || 'anonymous',
      action,
      resource,
      resourceId,
      ipAddress: this.getClientIp(request),
      userAgent: request.get('User-Agent') || 'unknown',
      metadata: this.extractMetadata(request),
    };

    return next.handle().pipe(
      tap(() => {
        const successEvent: IFileAuditEvent = {
          ...baseEvent,
          success: true,
        } as IFileAuditEvent;

        this.logger.log({
          message: `File operation: ${action}`,
          audit: successEvent,
        });
      }),
      catchError(error => {
        const failureEvent: IFileAuditEvent = {
          ...baseEvent,
          success: false,
          errorMessage: error.message,
        } as IFileAuditEvent;

        this.logger.warn({
          message: `File operation failed: ${action}`,
          audit: failureEvent,
        });
        throw error;
      }),
    );
  }

  private getAction(request: Request): string {
    const method = request.method;
    const path = request.route?.path || request.path;

    if (path.includes('multipart/initiate')) return 'UPLOAD_START';
    if (path.includes('multipart/complete')) return 'UPLOAD_COMPLETE';
    if (path.includes('multipart/abort')) return 'UPLOAD_ABORT';
    if (path.includes('/url')) return 'GET_URL';
    if (path.includes('/move')) return 'MOVE';
    if (path.includes('/rename')) return 'RENAME';
    if (path.includes('/visibility')) return 'FILE_VISIBILITY_CHANGE';

    switch (method) {
      case 'GET':
        return 'READ';
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return method;
    }
  }

  private getResource(request: Request): string {
    const path = request.route?.path || request.path;

    if (path.includes('multipart')) return 'multipart_upload';
    if (path.includes('files')) return 'file';
    if (path.includes('quota')) return 'storage_quota';
    if (path.includes('concurrency')) return 'concurrency_control';

    return 'storage';
  }

  private extractMetadata(request: Request): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Include basic file metadata
    if (request.body) {
      const { filename, originalName, mimeType, size, path } = request.body;
      if (filename) metadata.filename = filename;
      if (originalName) metadata.originalName = originalName;
      if (mimeType) metadata.mimeType = mimeType;
      if (size) metadata.size = size;
      if (path) metadata.path = path;
    }

    // Include query parameters
    if (request.query) {
      const { expirationSeconds } = request.query;
      if (expirationSeconds) metadata.expirationSeconds = expirationSeconds;
    }

    // Include part number for multipart uploads
    if (request.params.partNumber) {
      metadata.partNumber = request.params.partNumber;
    }

    return metadata;
  }

  private getClientIp(request: Request): string {
    return (
      request.get('X-Forwarded-For')?.split(',')[0] ||
      request.get('X-Real-IP') ||
      request.connection.remoteAddress ||
      'unknown'
    );
  }
}
