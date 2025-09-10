/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, IsOptional, IsObject } from 'class-validator';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class CreateBulkProcessingRequestDto {
  @ApiProperty({
    description: 'Type of bulk processing to perform',
    enum: BulkProcessingType,
    example: BulkProcessingType.PRODUCT_CATALOG,
  })
  @IsEnum(BulkProcessingType)
  type: BulkProcessingType;

  @ApiProperty({
    description: 'ID of the uploaded file to process',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsString()
  @TrimAndValidateLength()
  fileId: string;

  @ApiProperty({
    description: 'Additional processing options',
    required: false,
    example: { validateOnly: false, skipEmptyRows: true },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;

  @ApiProperty({
    description: 'Additional metadata for the request',
    required: false,
    example: { source: 'bulk-import', importedBy: 'user@example.com' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
