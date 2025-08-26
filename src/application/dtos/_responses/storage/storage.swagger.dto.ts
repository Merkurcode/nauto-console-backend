import { ApiProperty } from '@nestjs/swagger';

export class InitiateMultipartUploadResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the created file record',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  fileId: string;

  @ApiProperty({
    description: 'Multipart upload ID from storage service',
    example: 'upload_abc123def456',
  })
  uploadId: string;

  @ApiProperty({
    description: 'Full object key in storage (path + filename)',
    example: 'documents/invoices/invoice-2025-001.pdf',
  })
  objectKey: string;
}

export class GeneratePartUrlResponseDto {
  @ApiProperty({
    description: 'Presigned URL for uploading the part',
    example: 'https://storage.example.com/bucket/object?partNumber=1&uploadId=abc123&signature=...',
  })
  url: string;

  @ApiProperty({
    description: 'Part number for this URL',
    example: 1,
  })
  partNumber: number;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expirationSeconds: number;
}

export class FileResponseDto {
  @ApiProperty({
    description: 'File unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'File name',
    example: 'document.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'Original file name as uploaded',
    example: 'My Important Document.pdf',
  })
  originalName: string;

  @ApiProperty({
    description: 'Virtual folder path',
    example: 'documents/contracts',
  })
  path: string;

  @ApiProperty({
    description: 'Full object key in storage',
    example: 'documents/contracts/document.pdf',
  })
  objectKey: string;

  @ApiProperty({
    description: 'MIME type',
    example: 'application/pdf',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
  })
  size: number;

  @ApiProperty({
    description: 'Storage bucket name',
    example: 'user-files',
  })
  bucket: string;

  @ApiProperty({
    description: 'User ID who owns the file',
    example: '456e7890-e89b-12d3-a456-426614174001',
    nullable: true,
  })
  userId: string | null;

  @ApiProperty({
    description: 'Whether file is publicly accessible',
    example: false,
  })
  isPublic: boolean;

  @ApiProperty({
    description: 'Current file status',
    example: 'uploaded',
    enum: ['pending', 'uploading', 'uploaded', 'failed', 'canceled', 'deleted'],
  })
  status: string;

  @ApiProperty({
    description: 'Upload ID (only present during multipart upload)',
    example: 'upload_abc123def456',
    nullable: true,
  })
  uploadId: string | null;

  @ApiProperty({
    description: 'ETag of the completed object',
    example: '"9bb58f26192e4ba00f01e2e7b136bbd8"',
    nullable: true,
  })
  etag: string | null;

  @ApiProperty({
    description: 'File creation timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'File last update timestamp',
    example: '2025-01-15T10:35:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Target applications with specific size restrictions',
    example: ['None'],
    type: [String],
  })
  targetApps: string[];

  @ApiProperty({
    description: 'Storage driver used for this file',
    example: 'minio',
    enum: ['minio', 'aws'],
  })
  storageDriver: string;
}

export class GetFileSignedUrlResponseDto {
  @ApiProperty({
    description: 'Presigned URL for accessing the file',
    example: 'https://storage.example.com/bucket/object?signature=...',
  })
  url: string;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expirationSeconds: number;

  @ApiProperty({
    description: 'Whether the file is publicly accessible',
    example: false,
  })
  isPublic: boolean;
}

export class GetUploadStatusResponseDto {
  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Upload in progress (3/5 parts completed)',
    nullable: true,
  })
  message: string | null;

  @ApiProperty({
    description: 'File unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  fileId: string;

  @ApiProperty({
    description: 'Current upload status',
    example: 'UPLOADING',
    enum: ['PENDING', 'UPLOADING', 'UPLOADED', 'COPYING'],
  })
  status: string;

  @ApiProperty({
    description: 'Upload ID (null if not uploading)',
    example: 'upload_abc123def456',
    nullable: true,
  })
  uploadId: string | null;

  @ApiProperty({
    description: 'Upload progress percentage (0-100)',
    example: 60,
    minimum: 0,
    maximum: 100,
  })
  progress: number;

  @ApiProperty({
    description: 'Number of completed parts with ETag present',
    example: 3,
    minimum: 0,
  })
  completedPartsCount: number;

  @ApiProperty({
    description: 'Total number of parts detected in storage',
    example: 5,
    nullable: true,
  })
  totalPartsCount: number;

  @ApiProperty({
    description: 'Total bytes uploaded so far',
    example: 15728640,
    nullable: true,
  })
  uploadedBytes: number;

  @ApiProperty({
    description: 'Suggested next part number to upload (first gap or last+1)',
    example: 4,
    nullable: true,
  })
  nextPartNumber: number;

  @ApiProperty({
    description: 'Maximum allowed bytes for this upload',
    example: 52428800,
    nullable: true,
  })
  maxBytes: number;

  @ApiProperty({
    description: 'Remaining bytes that can be uploaded',
    example: 36700160,
    nullable: true,
  })
  remainingBytes: number;

  @ApiProperty({
    description: 'Whether the upload can be completed (total <= maxBytes)',
    example: true,
    nullable: true,
  })
  canComplete: boolean;

  @ApiProperty({
    description: 'List of uploaded parts with details',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        partNumber: {
          type: 'number',
          description: 'Part number',
          example: 1,
        },
        size: {
          type: 'number',
          description: 'Part size in bytes',
          example: 5242880,
        },
        etag: {
          type: 'string',
          description: 'Part ETag',
          example: 'd41d8cd98f00b204e9800998ecf8427e',
        },
      },
    },
  })
  parts: Array<{ partNumber: number; size: number; etag: string }>;
}

export class PaginationInfoDto {
  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  limit: number;

  @ApiProperty({
    description: 'Number of items to skip',
    example: 0,
    minimum: 0,
  })
  offset: number;

  @ApiProperty({
    description: 'Whether there are more items available',
    example: true,
  })
  hasMore: boolean;
}

export class GetUserFilesResponseDto {
  @ApiProperty({
    description: 'Array of user files',
    type: [FileResponseDto],
  })
  files: FileResponseDto[];

  @ApiProperty({
    description: 'Total number of files',
    example: 25,
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

  @ApiProperty({
    description: 'Whether there are more pages',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there are previous pages',
    example: false,
  })
  hasPrev: boolean;
}

export class GetUserStorageQuotaResponseDto {
  @ApiProperty({
    description: 'Maximum storage allowed in bytes (as string to handle BigInt)',
    example: '5368709120',
  })
  maxStorageBytes: string;

  @ApiProperty({
    description: 'Currently used storage in bytes',
    example: 1073741824,
  })
  usedStorageBytes: number;

  @ApiProperty({
    description: 'Available storage in bytes (as string to handle BigInt)',
    example: '4294967296',
  })
  availableStorageBytes: string;

  @ApiProperty({
    description: 'Maximum simultaneous uploads allowed',
    example: 5,
  })
  maxSimultaneousFiles: number;

  @ApiProperty({
    description: 'Current number of active uploads',
    example: 2,
  })
  currentActiveUploads: number;

  @ApiProperty({
    description: 'Allowed file extensions',
    example: ['pdf', 'jpg', 'png', 'docx'],
    type: [String],
  })
  allowedFileTypes: string[];

  @ApiProperty({
    description: 'Storage tier name',
    example: 'Premium',
  })
  tierName: string;

  @ApiProperty({
    description: 'Storage tier level',
    example: '2',
  })
  tierLevel: string;

  @ApiProperty({
    description: 'Storage usage percentage',
    example: 20,
  })
  usagePercentage: number;
}

export class CreateFolderResponseDto {
  @ApiProperty({
    description: 'Created folder path',
    example: 'documents/projects',
  })
  path: string;
}
