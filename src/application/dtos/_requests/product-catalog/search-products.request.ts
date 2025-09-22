import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentOption } from '@prisma/client';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class SearchProductsRequestDto {
  @ApiPropertyOptional({
    description:
      'Search query text - searches across id, industry, productService, type, subcategory, description, link, sourceFileName',
    example: 'smartphone electronics',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 500 })
  query?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of results to skip for pagination',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Only return visible products',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }

    return value;
  })
  @IsBoolean()
  onlyVisible?: boolean = true;

  @ApiPropertyOptional({
    description: 'Minimum price filter',
    example: 100.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum price filter',
    example: 999.99,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Filter by product type (supports ILIKE patterns with %)',
    example: 'Smart%',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 255 })
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by subcategory (supports ILIKE patterns with %)',
    example: 'Rugged%',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 255 })
  subcategory?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment options (array intersection)',
    enum: PaymentOption,
    isArray: true,
    example: ['CASH', 'CREDIT'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim());
    }
    if (Array.isArray(value)) {
      return value;
    }

    return [];
  })
  @IsArray()
  @IsEnum(PaymentOption, { each: true })
  paymentOptions?: PaymentOption[];
}
