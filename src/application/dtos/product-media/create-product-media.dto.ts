import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class CreateProductMediaDto {
  @ApiProperty({
    description: 'File ID reference',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 1, max: 100 })
  fileId: string;

  @ApiProperty({
    description: 'Mark as favorite media for the product (only one per product allowed)',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  fav?: boolean;

  @ApiProperty({
    description: 'Product catalog ID this media belongs to',
    example: 'PROD-001',
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ min: 1, max: 100 })
  productId: string;

  @ApiProperty({
    description: 'Optional description for the media file',
    example: 'Product main image showing front view',
    required: false,
  })
  @IsString()
  @IsOptional()
  @TrimAndValidateLength({ max: 500 })
  description?: string;

  @ApiProperty({
    description: 'Optional tags for file categorization (space-separated, each starting with #)',
    example: '#ficha_tecnica #foto_producto #principal',
    pattern: '^(#[a-zA-Z0-9_]+)(\\s+#[a-zA-Z0-9_]+)*$',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^(#[a-zA-Z0-9_]+)(\s+#[a-zA-Z0-9_]+)*$/, {
    message: 'Tags must be space-separated and each must start with # followed by alphanumeric characters or underscores',
  })
  @TrimAndValidateLength({ max: 200 })
  tags?: string;
}
