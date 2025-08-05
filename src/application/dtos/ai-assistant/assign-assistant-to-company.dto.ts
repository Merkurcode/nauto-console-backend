import {
  IsUUID,
  IsBoolean,
  IsArray,
  IsOptional,
  ValidateNested,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignAssistantFeatureDto {
  @ApiProperty({
    description:
      'UUID of the AI assistant feature to assign (either featureId or featureKeyName must be provided)',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.featureKeyName)
  @IsUUID()
  featureId?: string;

  @ApiProperty({
    description:
      'Key name of the AI assistant feature to assign (either featureId or featureKeyName must be provided)',
    example: 'BRAND_EXPERT',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.featureId)
  @IsString()
  featureKeyName?: string;

  @ApiProperty({
    description: 'Whether the feature should be enabled',
    example: true,
    default: true,
  })
  @IsBoolean()
  enabled: boolean;
}

export class AssignAssistantToCompanyDto {
  @ApiProperty({
    description:
      'UUID of the company to assign the AI assistant to (either companyId or companyName must be provided)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.companyName)
  @IsUUID()
  companyId?: string;

  @ApiProperty({
    description:
      'Name of the company to assign the AI assistant to (either companyId or companyName must be provided)',
    example: 'Acme Corp',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.companyId)
  @IsString()
  companyName?: string;

  @ApiProperty({
    description:
      'UUID of the AI assistant to assign (either aiAssistantId or aiAssistantName must be provided)',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.aiAssistantName)
  @IsUUID()
  aiAssistantId?: string;

  @ApiProperty({
    description:
      'Name of the AI assistant to assign (either aiAssistantId or aiAssistantName must be provided)',
    example: 'Lily',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.aiAssistantId)
  @IsString()
  aiAssistantName?: string;

  @ApiPropertyOptional({
    description: 'Whether the AI assistant should be enabled for the company',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  @ApiPropertyOptional({
    description:
      'List of specific features to enable/disable for this assistant. You can specify features by either their ID or keyName.',
    type: [AssignAssistantFeatureDto],
    example: [
      {
        featureKeyName: 'BRAND_EXPERT',
        enabled: true,
      },
      {
        featureId: 'g58bd21c-69dd-5483-b678-1f13c3d4e580',
        enabled: false,
      },
    ],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AssignAssistantFeatureDto)
  features?: AssignAssistantFeatureDto[];
}
