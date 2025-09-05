import { ApiProperty } from '@nestjs/swagger';
import { FileType } from '@prisma/client';

export interface IProductMediaResponse {
  id: string;
  fileId: string;
  fileType: FileType;
  fav: boolean;
  productId: string;
  companyId: string;
  createdBy: string;
  description?: string;
  tags?: string;
  createdAt: Date;
  updatedAt: Date;
  // File information from storage
  file: {
    id: string;
    filename: string;
    originalName: string;
    path: string;
    objectKey: string;
    mimeType: string;
    size: number;
    bucket: string;
    userId: string | null;
    isPublic: boolean;
    status: string;
    uploadId: string | null;
    etag: string | null;
    createdAt: Date;
    updatedAt: Date;
    signedUrl?: string;
    signedUrlExpiresAt?: Date;
  };
}

export class ProductMediaResponse implements IProductMediaResponse {
  @ApiProperty({
    description: 'Product media unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'File ID reference',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  fileId: string;

  @ApiProperty({
    description: 'Type of media file',
    enum: FileType,
    example: FileType.IMAGE,
  })
  fileType: FileType;

  @ApiProperty({
    description: 'Whether this media is marked as favorite for the product',
    example: false,
  })
  fav: boolean;

  @ApiProperty({
    description: 'Product catalog ID this media belongs to',
    example: 'PROD-001',
  })
  productId: string;

  @ApiProperty({
    description: 'Company ID (tenant isolation)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  companyId: string;

  @ApiProperty({
    description: 'User ID who created this media',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Optional description for the media file',
    example: 'Product main image showing front view',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Optional tags for file categorization',
    example: '#ficha_tecnica #foto_producto #principal',
    required: false,
  })
  tags?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'File information from storage',
    type: 'object',
    properties: {
      id: { type: 'string', description: 'File unique identifier' },
      filename: { type: 'string', description: 'Current filename' },
      originalName: { type: 'string', description: 'Original filename when uploaded' },
      path: { type: 'string', description: 'File path in storage' },
      objectKey: { type: 'string', description: 'Storage object key' },
      mimeType: { type: 'string', description: 'File MIME type' },
      size: { type: 'number', description: 'File size in bytes' },
      bucket: { type: 'string', description: 'Storage bucket name' },
      userId: { type: 'string', nullable: true, description: 'User who uploaded the file' },
      isPublic: { type: 'boolean', description: 'Whether file is publicly accessible' },
      status: { type: 'string', description: 'File upload status' },
      uploadId: { type: 'string', nullable: true, description: 'Upload session ID' },
      etag: { type: 'string', nullable: true, description: 'File ETag' },
      createdAt: { type: 'string', format: 'date-time', description: 'File creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'File last update timestamp' },
      signedUrl: { type: 'string', nullable: true, description: 'Presigned URL for file access' },
      signedUrlExpiresAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Signed URL expiration',
      },
    },
  })
  file: {
    id: string;
    filename: string;
    originalName: string;
    path: string;
    objectKey: string;
    mimeType: string;
    size: number;
    bucket: string;
    userId: string | null;
    isPublic: boolean;
    status: string;
    uploadId: string | null;
    etag: string | null;
    createdAt: Date;
    updatedAt: Date;
    signedUrl?: string;
    signedUrlExpiresAt?: Date;
  };
}
