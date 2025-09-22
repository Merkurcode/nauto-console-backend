import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class SearchUsersRequestDto {
  @ApiPropertyOptional({
    description:
      'Search query to filter users. Searches in: firstName, lastName, secondLastName, and email',
    example: 'john',
    required: false,
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 500 })
  query?: string;

  @ApiProperty({
    description: 'Company ID (UUID) to filter users. Required for multi-tenant data isolation',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: true,
  })
  @IsNotEmpty({ message: 'Company ID is required' })
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  companyId: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results per page. Use with offset for pagination',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of results to skip. Use with limit for pagination',
    default: 0,
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Filter to include only active users. Set to false to include inactive users',
    default: true,
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }

    return value;
  })
  @IsBoolean()
  onlyActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'Filter to include only users with verified email addresses',
    default: false,
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }

    return value;
  })
  @IsBoolean()
  onlyEmailVerified?: boolean = false;
}
