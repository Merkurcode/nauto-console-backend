import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { PaymentOption } from '@prisma/client';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class UpdateProductCatalogDto {
  @ApiProperty({
    description: 'Industry of the product',
    example: 'Technology',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ min: 1, max: 255 })
  industry?: string;

  @ApiProperty({
    description: 'Product or service name',
    example: 'Cloud Storage Service',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ min: 1, max: 255 })
  productService?: string;

  @ApiProperty({
    description: 'Type of product/service',
    example: 'Software',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ min: 1, max: 255 })
  type?: string;

  @ApiProperty({
    description: 'Subcategory of the product',
    example: 'Cloud Infrastructure',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ min: 1, max: 255 })
  subcategory?: string;

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
    example: [PaymentOption.CASH, PaymentOption.CREDIT],
    enum: PaymentOption,
    isArray: true,
    required: false,
  })
  @IsArray()
  @IsEnum(PaymentOption, { each: true })
  @IsOptional()
  paymentOptions?: PaymentOption[];

  @ApiProperty({
    description: 'Product description',
    example: 'High-performance cloud storage solution with 99.9% uptime',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ max: 1000 })
  description?: string;
}
