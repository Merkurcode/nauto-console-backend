import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarketingCampaignSwaggerDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: 'mc_1234567890_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Campaign start date',
    example: '2025-01-01T00:00:00.000Z',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Campaign end date',
    example: '2025-12-31T23:59:59.999Z',
  })
  endDate: Date;

  @ApiProperty({
    description: 'UTM name (MD5 hash of reference name letters)',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  utmName: string;

  @ApiProperty({
    description: 'Reference name for the campaign',
    example: 'Summer Sale 2025',
  })
  referenceName: string;

  @ApiProperty({
    description: 'Campaign context/description',
    example: 'Special summer promotion with 50% discount on selected items',
  })
  context: string;

  @ApiProperty({
    description: 'Whether the campaign is enabled',
    example: true,
  })
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Meta/Facebook campaign ID',
    example: 'meta_campaign_123',
    nullable: true,
  })
  metaId: string | null;

  @ApiPropertyOptional({
    description: 'Promotion picture file ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  promotionPictureId: string | null;

  @ApiProperty({
    description: 'Company ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  companyId: string;

  @ApiProperty({
    description: 'User ID who created the campaign',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  createdBy: string;

  @ApiProperty({
    description: 'User ID who last updated the campaign',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  updatedBy: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Whether the campaign is currently active (enabled and within date range)',
    example: true,
  })
  isActive: boolean;
}
