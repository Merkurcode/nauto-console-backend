import { IsOptional, IsString, IsInt, Min, Max, IsDate, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class BotAuditQueryDto {
  @ApiProperty({
    description: 'Filter by BOT user alias',
    required: false,
    example: 'chatbot-external-001',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  botAlias?: string;

  @ApiProperty({
    description: 'Filter by company ID',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  @TrimString()
  companyId?: string;

  @ApiProperty({
    description: 'Filter by BOT token ID',
    required: false,
    example: 'bot_1691424000_abc123def456',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  tokenId?: string;

  @ApiProperty({
    description: 'Filter by HTTP method',
    required: false,
    example: 'GET',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  method?: string;

  @ApiProperty({
    description: 'Filter by endpoint path',
    required: false,
    example: '/users',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  path?: string;

  @ApiProperty({
    description: 'Filter by HTTP status code',
    required: false,
    example: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @ApiProperty({
    description: 'Start date for filtering (ISO 8601)',
    required: false,
    example: '2025-08-07T00:00:00Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  fromDate?: Date;

  @ApiProperty({
    description: 'End date for filtering (ISO 8601)',
    required: false,
    example: '2025-08-07T23:59:59Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  toDate?: Date;

  @ApiProperty({
    description: 'Maximum number of records to return',
    required: false,
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}
