import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsObject,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BulkProcessingEventType } from '@shared/constants/bulk-processing-type.enum';

/**
 * Media processing configuration
 */
export class MediaProcessingOptionsDto {
  @ApiProperty({
    description: 'Skip downloading and processing media files',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipMediaDownload?: boolean;

  @ApiProperty({
    description: 'Continue processing even if media download fails',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  continueOnMediaError?: boolean;

  @ApiProperty({
    description: 'Maximum concurrent media downloads per row',
    required: false,
    minimum: 1,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxMediaConcurrency?: number;

  @ApiProperty({
    description: 'Media download timeout in milliseconds',
    required: false,
    minimum: 5000,
    maximum: 300000,
    default: 30000,
  })
  @IsOptional()
  @IsNumber()
  @Min(5000)
  @Max(300000)
  mediaDownloadTimeout?: number;

  @ApiProperty({
    description: 'Validate media file extensions before download',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  validateMediaExtensions?: boolean;
}

/**
 * Validation and error handling configuration
 */
export class ValidationOptionsDto {
  @ApiProperty({
    description: 'Skip all validation checks (use with caution)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipValidation?: boolean;

  @ApiProperty({
    description: 'Continue processing even when validation errors occur',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  continueOnValidationError?: boolean;

  @ApiProperty({
    description: 'Treat warnings as errors',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  treatWarningsAsErrors?: boolean;

  @ApiProperty({
    description: 'Maximum number of errors to store per request',
    required: false,
    minimum: 10,
    maximum: 10000,
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  maxStoredErrors?: number;

  @ApiProperty({
    description: 'Maximum number of warnings to store per request',
    required: false,
    minimum: 10,
    maximum: 10000,
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  maxStoredWarnings?: number;
}

/**
 * Excel/CSV parsing configuration
 */
export class ParsingOptionsDto {
  @ApiProperty({
    description: 'Starting row number (0-based index)',
    required: false,
    minimum: 0,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  startRow?: number;

  @ApiProperty({
    description: 'Skip empty rows during processing',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipEmptyRows?: boolean;

  @ApiProperty({
    description: 'Trim whitespace from cell values',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  trimValues?: boolean;

  @ApiProperty({
    description: 'Sheet name or index to process (for Excel files)',
    required: false,
    example: 'Sheet1',
  })
  @IsOptional()
  sheetName?: string | number;
}

/**
 * Processing behavior configuration
 */
export class ProcessingBehaviorDto {
  @ApiProperty({
    description: 'Stop processing on first error',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  stopOnFirstError?: boolean;

  @ApiProperty({
    description: 'Enable dry run mode (validate without persisting)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

/**
 * Comprehensive bulk processing options
 */
export class BulkProcessingOptionsDto {
  @ApiProperty({
    description: 'Media processing configuration',
    required: false,
    type: MediaProcessingOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MediaProcessingOptionsDto)
  mediaProcessing?: MediaProcessingOptionsDto;

  @ApiProperty({
    description: 'Validation configuration',
    required: false,
    type: ValidationOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ValidationOptionsDto)
  validation?: ValidationOptionsDto;

  @ApiProperty({
    description: 'Parsing configuration',
    required: false,
    type: ParsingOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ParsingOptionsDto)
  parsing?: ParsingOptionsDto;

  @ApiProperty({
    description: 'Processing behavior configuration',
    required: false,
    type: ProcessingBehaviorDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProcessingBehaviorDto)
  processing?: ProcessingBehaviorDto;

  @ApiProperty({
    description: 'Custom metadata for tracking',
    required: false,
    example: { source: 'manual-upload', department: 'sales' },
  })
  @IsOptional()
  @IsObject()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export class StartBulkProcessingDto {
  @ApiProperty({
    description: 'Event type for bulk processing',
    enum: BulkProcessingEventType,
    required: true,
    example: BulkProcessingEventType.PRODUCT_CATALOG_BULK_IMPORT,
  })
  @IsEnum(BulkProcessingEventType)
  eventType: BulkProcessingEventType;

  @ApiProperty({
    description: 'Comprehensive processing options',
    required: false,
    type: BulkProcessingOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkProcessingOptionsDto)
  options?: BulkProcessingOptionsDto;

  @ApiProperty({
    description: 'Job priority (1-100, higher number = higher priority)',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  priority?: number;
}
