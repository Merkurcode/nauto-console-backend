import { IsUUID, IsBoolean, IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleAssistantStatusDto {
  @ApiProperty({
    description: 'UUID of the company (either companyId or companyName must be provided)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.companyName)
  @IsUUID()
  companyId?: string;

  @ApiProperty({
    description: 'Name of the company (either companyId or companyName must be provided)',
    example: 'Acme Corp',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.companyId)
  @IsString()
  companyName?: string;

  @ApiProperty({
    description:
      'UUID of the AI assistant (either aiAssistantId or aiAssistantName must be provided)',
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
      'Name of the AI assistant (either aiAssistantId or aiAssistantName must be provided)',
    example: 'Lily',
    required: false,
  })
  @IsOptional()
  @ValidateIf(o => !o.aiAssistantId)
  @IsString()
  aiAssistantName?: string;

  @ApiProperty({
    description: 'Whether to enable or disable the AI assistant for the company',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;
}
