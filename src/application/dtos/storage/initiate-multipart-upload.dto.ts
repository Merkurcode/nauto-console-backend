import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  Min,
  Max,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '@shared/decorators/trim.decorator';
import {
  IsValidStoragePath,
  HasValidDirectoryDepth,
} from '@shared/validators/storage-path.validator';
import { IsSafeFilename } from '@shared/validators/safe-filename.validator';

export class InitiateMultipartUploadDto {
  @ApiProperty({
    description: 'Virtual folder path for the file',
    example: 'documents/invoices',
  })
  @Trim()
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
  @Trim()
  @IsString()
  @MinLength(1)
  @IsSafeFilename({
    message:
      "Filename contains invalid characters. Use only alphanumeric, spaces, and !-_.*'() characters",
  })
  filename: string;

  @ApiProperty({
    description: 'Original file name as uploaded by user',
    example: 'Invoice January 2025.pdf',
  })
  @Trim()
  @IsString()
  @MinLength(1)
  @IsSafeFilename({
    message:
      "Original filename contains invalid characters. Use only alphanumeric, spaces, and !-_.*'() characters",
  })
  originalName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  @Trim()
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
    maximum: 5497558138880, // 5TB in bytes
  })
  @IsNumber()
  @Min(1)
  @Max(5497558138880, { message: 'File size cannot exceed 5TB (5497558138880 bytes)' })
  size: number;

  @ApiProperty({
    description: 'Allow overwriting existing UPLOADED files at the same path',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  upsert?: boolean = false;

  @ApiProperty({
    description: 'Auto-rename file if there is a naming conflict (like Dropbox behavior)',
    example: true,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoRename?: boolean = false;
}
