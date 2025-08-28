import { Controller, Get, Query, UseGuards, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { CanRead } from '@shared/decorators/resource-permissions.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { GetUserActivityLogsDto } from '@application/dtos/user-activity-log/get-user-activity-logs.dto';
import { GetUserActivityLogsQuery } from '@application/queries/user-activity-log/get-user-activity-logs.query';
import { UserActivityLogAccessType } from '@shared/constants/user-activity-log-access-type.enum';
import { IUserActivityLogPaginatedResponse } from '@application/dtos/_responses/user-activity-log/user-activity-log.response.interface';
import { UserActivityType } from '@shared/constants/user-activity-type.enum';
import { UserActivityImpact } from '@shared/constants/user-activity-impact.enum';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';

@ApiTags('user-activity-logs')
@Controller('user-activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@NoBots()
@ApiBearerAuth('JWT-auth')
export class UserActivityLogController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('me')
  @CanRead('user_activity_log')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user activity logs',
    description:
      'Retrieve activity logs for the authenticated user. Returns a paginated list of all activities performed by the current user.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user_activity_log:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '✅ **Access:** Users can always view their own activity logs',
  })
  @ApiQuery({
    name: 'activityType',
    enum: UserActivityType,
    required: false,
    description: 'Filter by activity type',
  })
  @ApiQuery({
    name: 'impact',
    enum: UserActivityImpact,
    required: false,
    description: 'Filter by impact level',
  })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action keyword' })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User activity logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
              activityType: {
                type: 'string',
                enum: Object.values(UserActivityType),
                example: UserActivityType.AUTHENTICATION,
              },
              action: { type: 'string', example: 'login' },
              description: { type: 'string', example: 'User logged in successfully' },
              impact: {
                type: 'string',
                enum: Object.values(UserActivityImpact),
                example: UserActivityImpact.LOW,
              },
              ipAddress: { type: 'string', nullable: true, example: '192.168.1.1' },
              userAgent: { type: 'string', nullable: true, example: 'Mozilla/5.0...' },
              metadata: {
                type: 'object',
                nullable: true,
                example: { browser: 'Chrome', os: 'Windows' },
              },
              timestamp: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00Z' },
            },
          },
        },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission to read activity logs',
  })
  async getMyActivityLogs(
    @Query() filters: GetUserActivityLogsDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IUserActivityLogPaginatedResponse> {
    return this.queryBus.execute(
      new GetUserActivityLogsQuery(
        currentUser.sub,
        currentUser.sub,
        UserActivityLogAccessType.OWN_LOGS,
        filters,
      ),
    );
  }

  @Get('user/:userId')
  @CanRead('user_activity_log')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user activity logs by user ID (Root/Root-Readonly/Own)',
    description:
      'Retrieve activity logs for a specific user. Access control is enforced based on user roles.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user_activity_log:read</code>\n\n' +
      '👥 **Roles with Full Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can view any user\'s logs\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Can view any user\'s logs\n\n' +
      '✅ **Limited Access:** Other users can only view their own logs when userId matches their ID',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to retrieve activity logs for',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiQuery({
    name: 'activityType',
    enum: UserActivityType,
    required: false,
    description: 'Filter by activity type',
  })
  @ApiQuery({
    name: 'impact',
    enum: UserActivityImpact,
    required: false,
    description: 'Filter by impact level',
  })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action keyword' })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User activity logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
              activityType: {
                type: 'string',
                enum: Object.values(UserActivityType),
                example: UserActivityType.PROFILE_MANAGEMENT,
              },
              action: { type: 'string', example: 'update-profile' },
              description: { type: 'string', example: 'User profile updated' },
              impact: {
                type: 'string',
                enum: Object.values(UserActivityImpact),
                example: UserActivityImpact.MEDIUM,
              },
              ipAddress: { type: 'string', nullable: true, example: '192.168.1.1' },
              userAgent: { type: 'string', nullable: true, example: 'Mozilla/5.0...' },
              metadata: {
                type: 'object',
                nullable: true,
                example: { fields_updated: ['firstName', 'lastName'] },
              },
              timestamp: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00Z' },
            },
          },
        },
        total: { type: 'number', example: 50 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Access denied. You can only access your own activity logs unless you have root privileges.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getUserActivityLogs(
    @Param('userId', TrimStringPipe) targetUserId: string,
    @Query() filters: GetUserActivityLogsDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IUserActivityLogPaginatedResponse> {
    return this.queryBus.execute(
      new GetUserActivityLogsQuery(
        currentUser.sub,
        targetUserId,
        UserActivityLogAccessType.SPECIFIC_USER,
        filters,
      ),
    );
  }

  @Get('all')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @CanRead('user_activity_log')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all users activity logs (Root/Root-Readonly only)',
    description:
      'Retrieve activity logs for all users in the system. This endpoint provides a comprehensive view of all user activities.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">user_activity_log:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Full access to all logs\n' +
      '- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code> - Read-only access to all logs\n\n' +
      '⚠️ **Restrictions:** Only root-level users can access this endpoint',
  })
  @ApiQuery({
    name: 'activityType',
    enum: UserActivityType,
    required: false,
    description: 'Filter by activity type',
  })
  @ApiQuery({
    name: 'impact',
    enum: UserActivityImpact,
    required: false,
    description: 'Filter by impact level',
  })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action keyword' })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Start date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'End date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All users activity logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
              activityType: {
                type: 'string',
                enum: Object.values(UserActivityType),
                example: UserActivityType.SECURITY_SETTINGS,
              },
              action: { type: 'string', example: 'enable-2fa' },
              description: { type: 'string', example: 'Two-factor authentication enabled' },
              impact: {
                type: 'string',
                enum: Object.values(UserActivityImpact),
                example: UserActivityImpact.HIGH,
              },
              ipAddress: { type: 'string', nullable: true, example: '192.168.1.1' },
              userAgent: { type: 'string', nullable: true, example: 'Mozilla/5.0...' },
              metadata: { type: 'object', nullable: true, example: { method: 'TOTP' } },
              timestamp: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00Z' },
            },
          },
        },
        total: { type: 'number', example: 500 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 25 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied. Only root users can access all users activity logs.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getAllActivityLogs(
    @Query() filters: GetUserActivityLogsDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IUserActivityLogPaginatedResponse> {
    return this.queryBus.execute(
      new GetUserActivityLogsQuery(
        currentUser.sub,
        currentUser.sub, // Not used for ALL_USERS access type
        UserActivityLogAccessType.ALL_USERS,
        filters,
      ),
    );
  }
}
