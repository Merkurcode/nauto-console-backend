import { IsString, IsNumber, IsOptional, MinLength, Min, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsValidStoragePath,
  IsValidFileName,
  HasValidDirectoryDepth,
} from '@shared/validators/storage-path.validator';

export class InitiateMultipartUploadDto {
  @ApiProperty({
    description: 'Virtual folder path for the file',
    example: 'documents/invoices',
  })
  @IsString()
  @IsOptional()
  @Length(0, 255)
  @IsValidStoragePath()
  @HasValidDirectoryDepth(100)
  path: string;

  @ApiProperty({
    description: 'File name with extension',
    example: 'invoice-2025-001.pdf',
  })
  @IsString()
  @MinLength(1)
  @IsValidFileName()
  filename: string;

  @ApiProperty({
    description: 'Original file name as uploaded by user',
    example: 'Invoice January 2025.pdf',
  })
  @IsString()
  @MinLength(1)
  @IsValidFileName()
  originalName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/, {
    message: 'Invalid MIME type format.',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  size: number;
}
