import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { Trim } from '@shared/decorators/trim.decorator';

export class CreateMarketingCampaignDto {
  @ApiProperty({
    description: 'Campaign start date',
    example: '2025-01-01T00:00:00.000Z',
  })
  @Trim()
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Campaign end date',
    example: '2025-12-31T23:59:59.999Z',
  })
  @Trim()
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({
    description: 'Reference name for the campaign (max 255 chars)',
    example: 'Summer Sale 2025',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ max: 255 })
  referenceName: string;

  @ApiProperty({
    description: 'Campaign context/description (max 2000 chars)',
    example: 'Special summer promotion with 50% discount on selected items',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ max: 2000 })
  context: string;

  @ApiPropertyOptional({
    description: 'Meta/Facebook campaign ID',
    example: 'meta_campaign_123',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 255 })
  metaId?: string;

  @ApiPropertyOptional({
    description: 'Promotion picture file ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Trim()
  @IsOptional()
  @IsUUID()
  promotionPictureId?: string;

  @ApiProperty({
    description: 'Company ID for the campaign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Trim()
  @IsUUID()
  @IsNotEmpty()
  companyId: string;
}
