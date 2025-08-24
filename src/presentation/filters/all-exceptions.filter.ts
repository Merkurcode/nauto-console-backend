import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { DomainException } from '@core/exceptions/domain-exceptions';
import { PrismaErrorMapper } from './prisma-error-mapper';

interface IHttpExceptionResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: Error | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle DomainExceptions directly here since NestJS filter precedence is complex
    if (exception instanceof DomainException) {
      // Map domain exception codes to HTTP status codes (same logic as DomainExceptionFilter)
      const domainStatusMap = new Map([
        // Entity exceptions
        ['ENTITY_NOT_FOUND', 404],
        ['ENTITY_ALREADY_EXISTS', 409],

        // Input validation exceptions
        ['INVALID_INPUT', 400],
        ['INVALID_VALUE_OBJECT', 400],

        // Authentication exceptions
        ['AUTHENTICATION_FAILED', 401],
        ['INVALID_CREDENTIALS', 401],
        ['ACCOUNT_LOCKED', 403],
        ['TWO_FACTOR_REQUIRED', 401],
        ['INVALID_SESSION', 401],

        // Authorization exceptions
        ['FORBIDDEN_ACTION', 403],
        ['INSUFFICIENT_PERMISSIONS', 403],

        // Rate limiting exceptions
        ['THROTTLING_VIOLATION', 429],
        ['RATE_LIMIT_EXCEEDED', 429],

        // Business rule violations
        ['BUSINESS_RULE_VIOLATION', 400],

        // AI Persona domain exceptions
        ['AI_PERSONA_NOT_FOUND', 404],
        ['AI_PERSONA_KEY_NAME_ALREADY_EXISTS', 409],
        ['INVALID_AI_PERSONA_NAME', 400],
        ['INVALID_AI_PERSONA_KEY_NAME', 400],
        ['INVALID_AI_PERSONA_TONE', 400],
        ['INVALID_AI_PERSONA_PERSONALITY', 400],
        ['INVALID_AI_PERSONA_OBJECTIVE', 400],
        ['INVALID_AI_PERSONA_SHORT_DETAILS', 400],
        ['UNAUTHORIZED_AI_PERSONA_MODIFICATION', 403],
        ['COMPANY_ALREADY_HAS_ACTIVE_AI_PERSONA', 409],
        ['CANNOT_MODIFY_DEFAULT_AI_PERSONA', 403],
        ['CANNOT_DELETE_DEFAULT_AI_PERSONA', 403],
        ['AI_PERSONA_COMPANY_ASSIGNMENT_REMOVAL_FAILED', 500],

        // Storage domain exceptions
        ['INVALID_OBJECT_KEY', 400],
        ['INVALID_HIERARCHICAL_PATH', 400],
        ['CONCURRENCY_LIMIT_EXCEEDED', 429],
        ['STORAGE_QUOTA_EXCEEDED', 413], // Payload Too Large
        ['FILE_TYPE_NOT_ALLOWED', 415], // Unsupported Media Type
        ['UPLOAD_NOT_FOUND', 404],
        ['UPLOAD_ALREADY_COMPLETED', 409],
        ['UPLOAD_FAILED', 422], // Unprocessable Entity
        ['INVALID_FILE_STATE', 409],
        ['INVALID_PART_NUMBER', 400],
        ['STORAGE_OPERATION_FAILED', 422], // Unprocessable Entity (operation couldn't be completed)
        ['INVALID_PATH', 400],
        ['FOLDER_NOT_EMPTY', 409],
        ['STORAGE_TIER_NOT_FOUND', 404],
        ['STORAGE_TIER_NOT_ACTIVE', 403],
        ['USER_STORAGE_CONFIG_NOT_FOUND', 404],

        // File domain exceptions
        ['INVALID_FILE_OPERATION', 409], // Conflict - file state doesn't allow operation
        ['FILE_ACCESS_DENIED', 403], // Forbidden - user doesn't have access to file
        ['FILE_NOT_OWNED_BY_USER', 403], // Forbidden - user doesn't own the file
      ]);

      const status = domainStatusMap.get(exception.code) || 500;

      // Get appropriate error name based on status
      const getErrorName = (statusCode: number): string => {
        switch (statusCode) {
          case 400:
            return 'Bad Request';
          case 401:
            return 'Unauthorized';
          case 403:
            return 'Forbidden';
          case 404:
            return 'Not Found';
          case 409:
            return 'Conflict';
          case 413:
            return 'Payload Too Large';
          case 415:
            return 'Unsupported Media Type';
          case 422:
            return 'Unprocessable Entity';
          case 429:
            return 'Too Many Requests';
          case 500:
            return 'Internal Server Error';
          default:
            return 'Error';
        }
      };

      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        error: getErrorName(status),
        message: exception.message,
        code: exception.code,
        ...(exception.context && { details: exception.context }),
      };

      response.status(status).json(errorResponse);

      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const typedResponse = exceptionResponse as IHttpExceptionResponse;
        message = typedResponse.message || exception.message;
        error = typedResponse.error || 'Error';
      } else {
        message = (exceptionResponse as string) || exception.message;
      }
    } else if (exception instanceof Error) {
      // SECURITY: Handle Prisma database errors with user-friendly messages
      if (PrismaErrorMapper.isPrismaError(exception.message)) {
        const mappedError = PrismaErrorMapper.mapError(exception.message);
        message = mappedError.message;
        status = mappedError.status;
        error = mappedError.error;
      } else {
        message = exception.message;
      }
    }

    // Log the error with structured data
    this.logger.error(
      {
        message: 'Request error',
        method: request.method,
        url: request.url,
        status,
        error,
        errorMessage: message,
        userId: (request.user && request.user['sub']) || 'anonymous',
      },
      exception.stack,
    );

    // SECURITY: Don't expose internal errors in production
    const isProduction = this.configService.get<string>('env') === 'production';
    const safeMessage =
      isProduction && status === 500 ? 'An error occurred processing your request' : message;

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
      error: isProduction && status === 500 ? 'Internal Server Error' : error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
