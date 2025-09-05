import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  IsInt,
  IsUrl,
  Matches,
} from 'class-validator';
import { PaymentOption } from '@prisma/client';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class CreateProductCatalogDto {
  @ApiProperty({
    description: 'Unique identifier for the product (can be UUID, SKU, etc.)',
    example: 'PROD-001',
    maxLength: 100,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @TrimAndValidateLength({ max: 100 })
  id?: string;

  @ApiProperty({
    description: 'Industry of the product',
    example: 'Technology',
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 1, max: 255 })
  industry: string;

  @ApiProperty({
    description: 'Product or service name',
    example: 'Cloud Storage Service',
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 1, max: 255 })
  productService: string;

  @ApiProperty({
    description: 'Type of product/service',
    example: 'Software',
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 1, max: 255 })
  type: string;

  @ApiProperty({
    description: 'Subcategory of the product',
    example: 'Cloud Infrastructure',
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 1, max: 255 })
  subcategory: string;

  @ApiProperty({
    description: 'List price of the product',
    example: 99.99,
    minimum: 0,
    maximum: 9999999999.99,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  listPrice?: number | null;

  @ApiProperty({
    description: 'Available payment options',
    example: [PaymentOption.CASH, PaymentOption.CREDIT, PaymentOption.FINANCING],
    enum: PaymentOption,
    isArray: true,
  })
  @IsArray()
  @IsEnum(PaymentOption, { each: true })
  @IsNotEmpty()
  paymentOptions: PaymentOption[];

  @ApiProperty({
    description: 'Product description',
    example: 'High-performance cloud storage solution with 99.9% uptime',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ max: 1000 })
  description?: string;

  @ApiProperty({
    description: 'Optional product link/URL',
    example: 'https://example.com/product/cloud-storage',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsUrl()
  @TrimAndValidateLength({ max: 500 })
  link?: string;

  @ApiProperty({
    description: 'Source file name (for bulk import tracking)',
    example: 'products_import_2024.xlsx',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ max: 255 })
  sourceFileName?: string;

  @ApiProperty({
    description: 'Source row number in file (for bulk import tracking)',
    example: 25,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceRowNumber?: number;

  @ApiProperty({
    description: 'Language code (ISO/BCP47 format)',
    example: 'es-MX',
    pattern: '^[a-z]{2,3}(-[A-Z]{2})?$',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, {
    message: 'Language code must follow ISO/BCP47 format (e.g., "es-MX", "en-US", "pt-BR")',
  })
  @TrimAndValidateLength({ max: 10 })
  langCode?: string;
}
