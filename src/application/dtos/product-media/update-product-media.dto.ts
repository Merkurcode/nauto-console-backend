import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class UpdateProductMediaDto {
  @ApiProperty({
    description: 'New name for the media file (extension will be preserved from original file)',
    example: 'Updated Product Image',
    minLength: 1,
    maxLength: 255,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  @TrimAndValidateLength({ min: 1, max: 255 })
  fileName?: string;

  @ApiProperty({
    description: 'Mark as favorite media for the product (only one per product allowed)',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  fav?: boolean;

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
