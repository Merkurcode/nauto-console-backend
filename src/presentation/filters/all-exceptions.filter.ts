import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { DomainException } from '@core/exceptions/domain-exceptions';

interface IHttpExceptionResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {
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
        ['THROTTLING_VIOLATION', 429],
        ['RATE_LIMIT_EXCEEDED', 429],
        ['ENTITY_NOT_FOUND', 404],
        ['AUTHENTICATION_FAILED', 401],
        ['FORBIDDEN_ACTION', 403],
        ['INVALID_INPUT', 400],
        // Add more mappings as needed
      ]);

      const status = domainStatusMap.get(exception.code) || 500;
      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        error: status === 429 ? 'Too Many Requests' : 'Error',
        message: exception.message,
        code: exception.code,
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
      message = exception.message;
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
    const isProduction = process.env.NODE_ENV === 'production';
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
