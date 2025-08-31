import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { Trim } from '@shared/decorators/trim.decorator';

export class UpdateMarketingCampaignDto {
  @ApiProperty({
    description: 'Reference name for the campaign (max 255 chars)',
    example: 'Summer Sale 2025 - Updated',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ max: 255 })
  referenceName: string;

  @ApiProperty({
    description: 'Campaign context/description (max 2000 chars)',
    example: 'Updated special summer promotion with 60% discount on selected items',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @TrimAndValidateLength({ max: 2000 })
  context: string;

  @ApiPropertyOptional({
    description: 'Meta/Facebook campaign ID',
    example: 'meta_campaign_456',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 255 })
  metaId?: string | null;

  @ApiPropertyOptional({
    description: 'Promotion picture file ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  @Trim()
  @IsOptional()
  @IsUUID()
  promotionPictureId?: string | null;
}
