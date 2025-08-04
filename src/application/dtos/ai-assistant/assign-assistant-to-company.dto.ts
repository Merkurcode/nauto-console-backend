import { IsUUID, IsBoolean, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignAssistantFeatureDto {
  @ApiProperty({
    description: 'UUID of the AI assistant feature to assign',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'uuid',
  })
  @IsUUID()
  featureId: string;

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
    description: 'UUID of the company to assign the AI assistant to',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    description: 'UUID of the AI assistant to assign',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  @IsUUID()
  aiAssistantId: string;

  @ApiPropertyOptional({
    description: 'Whether the AI assistant should be enabled for the company',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  @ApiPropertyOptional({
    description: 'List of specific features to enable/disable for this assistant',
    type: [AssignAssistantFeatureDto],
    example: [
      {
        featureId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
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
