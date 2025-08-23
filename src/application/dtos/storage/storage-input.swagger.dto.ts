import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  MinLength,
  Min,
  Matches,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HasValidDirectoryDepth } from '@shared/validators/storage-path.validator';

export class InitiateUploadDtoSwagger {
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
  @HasValidDirectoryDepth(100)
  path: string;

  @ApiProperty({
    description: 'File name with extension',
    example: 'invoice-2025-001.pdf',
  })
  @IsString()
  @MinLength(1)
  filename: string;

  @ApiProperty({
    description: 'Original file name as uploaded by user',
    example: 'Invoice January 2025.pdf',
  })
  @IsString()
  @MinLength(1)
  originalName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  @IsString()
  @MinLength(1)
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

export class InitiateUploadResponseDtoSwagger {
  @ApiProperty({
    description: 'Unique identifier for the file',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  fileId: string;

  @ApiProperty({
    description: 'Upload ID for multipart upload',
    example: '2~nYt-B1Z5Kz2Yl6fJz7QqlJe4J8VqHW8Wl',
  })
  uploadId: string;

  @ApiProperty({
    description: 'Object key in storage',
    example: 'nauto-console-dev/company-123/users/user-456/documents/file.pdf',
  })
  objectKey: string;
}

export class PartInfo {
  @ApiProperty({
    description: 'Part number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  PartNumber: number;

  @ApiProperty({
    description: 'ETag returned from upload part',
    example: '"e1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6"',
  })
  @IsString()
  @MinLength(1)
  ETag: string;
}

export class CompleteUploadDtoSwagger {
  @ApiProperty({
    description: 'Array of completed parts',
    type: [PartInfo],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartInfo)
  parts: PartInfo[];
}

export class CreateFolderDtoSwagger {
  @ApiProperty({
    description: 'Folder path to create',
    example: 'documents/invoices/2025',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^[a-zA-Z0-9\-_\/.]*$/, {
    message:
      'Path contains invalid characters. Only alphanumeric, hyphens, underscores, forward slashes, and dots are allowed.',
  })
  @HasValidDirectoryDepth(100)
  path: string;
}

export class FolderCreatedResponseDtoSwagger {
  @ApiProperty({
    description: 'Created folder path',
    example: 'documents/invoices/2025',
  })
  path: string;
}

export class PresignedUrlResponseDtoSwagger {
  @ApiProperty({
    description: 'Presigned URL for upload',
    example: 'https://storage.example.com/bucket/path?signature=...',
  })
  url: string;

  @ApiProperty({
    description: 'Part number for multipart upload',
    example: 1,
    minimum: 1,
  })
  partNumber: number;

  @ApiProperty({
    description: 'URL expiration in seconds',
    example: 3600,
  })
  expirationSeconds: number;
}

export class FileItemResponse {
  @ApiProperty({
    description: 'File unique identifier',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'File name',
    example: 'document.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'My Document.pdf',
  })
  originalName: string;

  @ApiProperty({
    description: 'File path',
    example: 'documents/invoices',
  })
  path: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
  })
  size: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'application/pdf',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File status',
    example: 'UPLOADED',
  })
  status: string;

  @ApiProperty({
    description: 'Whether file is publicly accessible',
    example: false,
  })
  isPublic: boolean;

  @ApiProperty({
    description: 'Creation date',
    example: '2025-01-20T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2025-01-20T10:35:00Z',
  })
  updatedAt: Date;
}

export class FileListResponseDtoSwagger {
  @ApiProperty({
    description: 'List of files',
    type: [FileItemResponse],
  })
  files: FileItemResponse[];

  @ApiProperty({
    description: 'Total number of files',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
  })
  limit: number;
}

export class FileDetailsResponseDtoSwagger extends FileItemResponse {
  @ApiProperty({
    description: 'Object key in storage',
    example: 'nauto-console-dev/company-123/users/user-456/documents/file.pdf',
  })
  objectKey: string;
}
