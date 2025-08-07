import {
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditLogLevel, AuditLogType } from '@core/entities/audit-log.entity';

export class AuditLogQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by audit log levels',
    enum: ['info', 'warn', 'error', 'debug', 'critical'],
    isArray: true,
    example: ['error', 'warn'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['info', 'warn', 'error', 'debug', 'critical'], { each: true })
  level?: AuditLogLevel[];

  @ApiPropertyOptional({
    description: 'Filter by audit log types',
    enum: [
      'auth',
      'user',
      'role',
      'permission',
      'company',
      'system',
      'api',
      'database',
      'security',
      'exception',
      'transaction',
    ],
    isArray: true,
    example: ['auth', 'security'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(
    [
      'auth',
      'user',
      'role',
      'permission',
      'company',
      'system',
      'api',
      'database',
      'security',
      'exception',
      'transaction',
    ],
    { each: true },
  )
  type?: AuditLogType[];

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by context',
    isArray: true,
    example: ['auth', 'security', 'api'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  context?: string[];

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601 format)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601 format)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by IP address',
    example: '192.168.1.100',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Filter by user agent (partial match)',
    example: 'Chrome',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Filter by session ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by resource',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({
    description: 'Filter by error code',
    example: 'ENTITY_NOT_FOUND',
  })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({
    description: 'General text search in message and metadata',
    example: 'login failed',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (starting from 1)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 1000,
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['timestamp', 'level', 'type', 'context'],
    default: 'timestamp',
    example: 'timestamp',
  })
  @IsOptional()
  @IsString()
  @IsIn(['timestamp', 'level', 'type', 'context'])
  sortBy?: 'timestamp' | 'level' | 'type' | 'context' = 'timestamp';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
