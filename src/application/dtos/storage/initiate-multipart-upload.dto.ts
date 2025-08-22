import { IsString, IsNumber, IsOptional, MinLength, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateMultipartUploadDto {
  @ApiProperty({
    description: 'Virtual folder path for the file (e.g., "documents/invoices")',
    example: 'documents/invoices',
  })
  @IsString()
  @MinLength(0)
  @Matches(/^[a-zA-Z0-9\-_\/.]*$/, {
    message:
      'Path contains invalid characters. Only alphanumeric, hyphens, underscores, forward slashes, and dots are allowed.',
  })
  path: string;

  @ApiProperty({
    description: 'File name with extension',
    example: 'invoice-2025-001.pdf',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^[a-zA-Z0-9\-_\. ]+\.[a-zA-Z0-9]+$/, {
    message: 'Filename must contain only safe characters and have a valid extension.',
  })
  filename: string;

  @ApiProperty({
    description: 'Original file name as uploaded by user',
    example: 'Invoice January 2025.pdf',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^[^<>:"|?*\x00-\x1f\x7f]*$/, {
    message: 'Original filename contains forbidden characters.',
  })
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

  @ApiPropertyOptional({
    description: 'Target bucket name (uses default if not specified)',
    example: 'user-files',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/, {
    message: 'Bucket name must contain only lowercase letters, numbers, and hyphens.',
  })
  bucket?: string;
}
