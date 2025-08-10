import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

// Decorators
import { Public } from '@shared/decorators/public.decorator';

// Queries
import { GetHealthQuery } from '@application/queries/health/get-health.query';
import { GetDatabaseHealthQuery } from '@application/queries/health/get-database-health.query';
import { GetReadinessQuery } from '@application/queries/health/get-readiness.query';
import { GetLivenessQuery } from '@application/queries/health/get-liveness.query';

// Response interfaces
import {
  IHealthResponse,
  IDatabaseHealthResponse,
  IReadinessResponse,
  ILivenessResponse,
} from '@application/dtos/_responses/health/health.response';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check endpoint',
    description:
      'Basic health check for the application\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 12345.67 },
        environment: { type: 'string', example: 'development' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  async getHealth(): Promise<IHealthResponse> {
    return this.queryBus.execute(new GetHealthQuery());
  }

  @Public()
  @Get('database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Database health check',
    description:
      'Detailed health check including database connectivity\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Database is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        database: { type: 'string', example: 'connected' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Database is unhealthy',
  })
  async getDatabaseHealth(): Promise<IDatabaseHealthResponse> {
    return this.queryBus.execute(new GetDatabaseHealthQuery());
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe for Kubernetes',
    description:
      'Kubernetes readiness probe endpoint\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is ready',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ready' },
        timestamp: { type: 'string', format: 'date-time' },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'ok' },
            config: { type: 'string', example: 'ok' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Service is not ready',
  })
  async getReadiness(): Promise<IReadinessResponse> {
    return this.queryBus.execute(new GetReadinessQuery());
  }

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe for Kubernetes',
    description:
      'Kubernetes liveness probe endpoint\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'alive' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 12345.67 },
      },
    },
  })
  async getLiveness(): Promise<ILivenessResponse> {
    return this.queryBus.execute(new GetLivenessQuery());
  }
}
