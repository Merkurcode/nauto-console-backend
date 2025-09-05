import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
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
}
