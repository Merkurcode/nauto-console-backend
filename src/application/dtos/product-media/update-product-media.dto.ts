import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
