/* eslint-disable prettier/prettier */
import { Controller, Get, HttpCode, HttpStatus, UseGuards, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';

// Guards & Decorators
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
//import { RequiresSensitive } from '@shared/decorators/sensitive.decorator'; // 2FA
import { RequiresResourceAction } from '@shared/decorators/resource-action.decorator';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';

// Audit Logs
import { AuditLogQueryDto } from '@application/dtos/requests/audit-log-query.dto';
import { GetAuditLogsQuery } from '@application/queries/audit-log/get-audit-logs.query';
import { IAuditLogQuery } from '@core/repositories/audit-log.repository.interface';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';

@ApiTags('root')
@Controller('root')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@NoBots()
@Roles(RolesEnum.ROOT)
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(AuditLogQueryDto)
export class RootController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('system-info')
  @HttpCode(HttpStatus.OK)
  @RequiresResourceAction('system', 'read')
  @ApiOperation({
    summary: 'Get system information',
    description: 'Get basic system information and status\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fef9e7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">system:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns system information' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'User does not have required permissions' })
  async getSystemInfo() {
    return {
      message: 'Sensitive system information',
      system: {
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
      },
    };
  }

  @Get('audit-logs')
  @HttpCode(HttpStatus.OK)
  @RequiresResourceAction('audit', 'read')
  @ApiOperation({
    summary: '📊 Get comprehensive audit logs',
    description: `
## 🔒 Security Audit Logs Access

**Retrieve comprehensive system audit logs with advanced filtering capabilities for security monitoring and compliance.**

### 📋 Access Requirements
- **Permission:** <code style="color: #f39c12; background: #fef9e7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">audit:read</code>
- **Role:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>

### 🎯 Features
- **Real-time monitoring** of system events
- **Advanced filtering** by date range, level, type, user, IP, etc.
- **Full-text search** across log messages and metadata
- **Pagination** support for large datasets
- **Comprehensive metadata** including request details, IP addresses, user agents
- **Performance tracking** with operation duration metrics

### 📊 Log Categories
- **Authentication:** Login/logout events, 2FA, password changes
- **Security:** Failed authentication, permission violations, suspicious activity  
- **User Management:** User creation, role changes, permission updates
- **System:** Application events, errors, performance metrics
- **API:** HTTP requests, responses, errors with full context
- **Database:** Transaction logs, query performance, errors

### 🔍 Query Examples
- Get all errors from last 24h: \`?level=error&fromDate=2025-01-01T00:00:00Z\`
- Authentication events for user: \`?type=auth&userId=uuid\`
- Search for failed logins: \`?search=login failed&level=error\`
- Monitor IP activity: \`?ipAddress=192.168.1.100\`

### ⏱️ Data Retention
Audit logs are automatically retained for **7 days** and cleaned up via scheduled tasks for optimal performance.
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '✅ Audit logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Array of audit log entries',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique identifier for the audit log entry',
                example: '550e8400-e29b-41d4-a716-446655440000',
              },
              level: {
                type: 'string',
                enum: ['info', 'warn', 'error', 'debug', 'critical'],
                description: 'Log severity level',
                example: 'error',
              },
              type: {
                type: 'string',
                enum: [
                  'auth', 'user', 'role', 'permission', 'company',
                  'system', 'api', 'database', 'security', 'exception', 'transaction',
                ],
                description: 'Category of the logged event',
                example: 'auth',
              },
              action: {
                type: 'string',
                description: 'Action performed (create, read, update, delete, login, etc.)',
                example: 'login',
              },
              message: {
                type: 'string',
                description: 'Human-readable description of the event',
                example: 'User logged in successfully',
              },
              userId: {
                type: 'string',
                format: 'uuid',
                nullable: true,
                description: 'ID of the user who performed the action (null for system events)',
                example: '550e8400-e29b-41d4-a716-446655440000',
              },
              metadata: {
                type: 'object',
                description: 'Additional context data including request details, IP, user agent, duration, etc.',
                additionalProperties: true,
                example: {
                  ipAddress: '192.168.1.100',
                  userAgent: 'Mozilla/5.0 Chrome/96.0',
                  duration: 152,
                  httpMethod: 'POST',
                  endpoint: '/api/auth/login',
                  statusCode: 200,
                },
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'When the event occurred (ISO 8601 format)',
                example: '2025-01-01T12:00:00.000Z',
              },
              context: {
                type: 'string',
                description: 'Context or module where the event originated',
                example: 'AuthService',
              },
            },
          },
        },
        pagination: {
          type: 'object',
          description: 'Pagination information',
          properties: {
            total: {
              type: 'number',
              description: 'Total number of audit log entries matching the filter',
              example: 1250,
            },
            page: {
              type: 'number',
              description: 'Current page number (1-based)',
              example: 1,
            },
            limit: {
              type: 'number',
              description: 'Number of items per page',
              example: 50,
            },
            totalPages: {
              type: 'number',
              description: 'Total number of pages available',
              example: 25,
            },
            hasNext: {
              type: 'boolean',
              description: 'Whether there are more pages available',
              example: true,
            },
            hasPrevious: {
              type: 'boolean',
              description: 'Whether there are previous pages available',
              example: false,
            },
          },
        },
      },
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            level: 'error',
            type: 'auth',
            action: 'login',
            message: 'Failed login attempt - invalid credentials',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            metadata: {
              ipAddress: '192.168.1.100',
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              duration: 1250,
              httpMethod: 'POST',
              endpoint: '/api/auth/login',
              statusCode: 401,
              errorCode: 'INVALID_CREDENTIALS',
            },
            timestamp: '2025-01-01T12:00:00.000Z',
            context: 'AuthService',
          },
        ],
        pagination: {
          total: 1250,
          page: 1,
          limit: 50,
          totalPages: 25,
          hasNext: true,
          hasPrevious: false,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '🚫 Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '❌ Forbidden - Insufficient permissions (ROOT role and audit:read permission required)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '⚠️ Bad Request - Invalid query parameters (e.g., invalid date format, page < 1, limit > 1000)',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    description: '🎯 **Filter by log severity levels** (comma-separated)\n\n**Available levels:** `info`, `warn`, `error`, `debug`, `critical`\n\n**Examples:**\n- `?level=error` - Only error logs\n- `?level=error,warn` - Error and warning logs',
    example: 'error,warn',
    type: 'string',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: '📂 **Filter by event categories** (comma-separated)\n\n**Available types:** `auth`, `user`, `role`, `permission`, `company`, `system`, `api`, `database`, `security`, `exception`, `transaction`\n\n**Examples:**\n- `?type=auth` - Only authentication events\n- `?type=auth,security` - Auth and security events',
    example: 'auth,security',
    type: 'string',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: '👤 **Filter by specific user ID**\n\nShow only events performed by this user. System events (userId=null) will be excluded.\n\n**Example:** `?userId=550e8400-e29b-41d4-a716-446655440000`',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'context',
    required: false,
    description: '🏷️ **Filter by context/module** (comma-separated)\n\nFilter events by the service or module that generated them.\n\n**Examples:**\n- `?context=AuthService` - Events from authentication service\n- `?context=UserService,RoleService` - Events from user and role services',
    example: 'AuthService,UserService',
    type: 'string',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: '📅 **Start date for filtering** (ISO 8601 format)\n\nInclude only events that occurred on or after this date.\n\n**Format:** `YYYY-MM-DDTHH:mm:ss.sssZ`\n\n**Examples:**\n- `?fromDate=2025-01-01T00:00:00.000Z` - From start of 2025\n- `?fromDate=2025-01-15T12:30:00.000Z` - From specific datetime',
    example: '2025-01-01T00:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: '📅 **End date for filtering** (ISO 8601 format)\n\nInclude only events that occurred on or before this date.\n\n**Format:** `YYYY-MM-DDTHH:mm:ss.sssZ`\n\n**Examples:**\n- `?toDate=2025-12-31T23:59:59.999Z` - Until end of 2025\n- `?toDate=2025-01-15T12:30:00.000Z` - Until specific datetime',
    example: '2025-12-31T23:59:59.999Z',
    type: 'string',
    format: 'date-time',
  })
  @ApiQuery({
    name: 'ipAddress',
    required: false,
    description: '🌐 **Filter by IP address**\n\nShow events from a specific IP address. Useful for tracking activity from particular locations or investigating suspicious access.\n\n**Examples:**\n- `?ipAddress=192.168.1.100` - Internal network IP\n- `?ipAddress=203.0.113.1` - External IP address',
    example: '192.168.1.100',
    type: 'string',
  })
  @ApiQuery({
    name: 'userAgent',
    required: false,
    description: '🖥️ **Filter by user agent** (partial match)\n\nFilter by browser or client application. Supports partial matching.\n\n**Examples:**\n- `?userAgent=Chrome` - All Chrome browsers\n- `?userAgent=Mobile` - Mobile devices\n- `?userAgent=Postman` - API client requests',
    example: 'Chrome',
    type: 'string',
  })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    description: '🔐 **Filter by session ID**\n\nShow all events from a specific user session. Useful for tracking complete user journeys.\n\n**Example:** `?sessionId=550e8400-e29b-41d4-a716-446655440000`',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'resource',
    required: false,
    description: '📋 **Filter by resource type**\n\nFilter events related to specific resources or entities.\n\n**Examples:**\n- `?resource=user` - User-related events\n- `?resource=company` - Company-related events\n- `?resource=file` - File operations',
    example: 'user',
    type: 'string',
  })
  @ApiQuery({
    name: 'errorCode',
    required: false,
    description: '❌ **Filter by error code**\n\nShow only events with specific error codes. Useful for tracking particular types of failures.\n\n**Examples:**\n- `?errorCode=INVALID_CREDENTIALS` - Authentication failures\n- `?errorCode=ENTITY_NOT_FOUND` - Resource not found errors\n- `?errorCode=INSUFFICIENT_PERMISSIONS` - Authorization failures',
    example: 'INVALID_CREDENTIALS',
    type: 'string',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '🔍 **Full-text search**\n\nSearch across log messages and metadata. Case-insensitive partial matching.\n\n**Examples:**\n- `?search=login failed` - Failed login attempts\n- `?search=permission denied` - Permission violations\n- `?search=user created` - User creation events',
    example: 'login failed',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '📄 **Page number** (starting from 1)\n\nSpecify which page of results to return.\n\n**Default:** `1`\n**Minimum:** `1`',
    example: 1,
    type: 'number',
    minimum: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '📊 **Items per page**\n\nNumber of audit log entries to return per page.\n\n**Default:** `50`\n**Range:** `1-1000`\n**Recommended:** `50-100` for optimal performance',
    example: 50,
    type: 'number',
    minimum: 1,
    maximum: 1000,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: '📈 **Sort field**\n\nField to sort results by.\n\n**Available fields:** `timestamp`, `level`, `type`, `context`\n**Default:** `timestamp`',
    example: 'timestamp',
    enum: ['timestamp', 'level', 'type', 'context'],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: '🔄 **Sort direction**\n\nDirection to sort results.\n\n**Values:** `asc` (ascending), `desc` (descending)\n**Default:** `desc` (newest first)',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  async getAuditLogs(@Query() queryDto: AuditLogQueryDto) {
    // Convert DTO to domain query
    const query: IAuditLogQuery = {
      filters: {
        level: queryDto.level,
        type: queryDto.type,
        userId: queryDto.userId,
        context: queryDto.context,
        fromDate: queryDto.fromDate ? new Date(queryDto.fromDate) : undefined,
        toDate: queryDto.toDate ? new Date(queryDto.toDate) : undefined,
        ipAddress: queryDto.ipAddress,
        userAgent: queryDto.userAgent,
        sessionId: queryDto.sessionId,
        resource: queryDto.resource,
        errorCode: queryDto.errorCode,
        search: queryDto.search,
      },
      page: queryDto.page || 1,
      limit: queryDto.limit || 50,
      sortBy: queryDto.sortBy || 'timestamp',
      sortOrder: queryDto.sortOrder || 'desc',
    };

    return this.queryBus.execute(new GetAuditLogsQuery(query));
  }
}
