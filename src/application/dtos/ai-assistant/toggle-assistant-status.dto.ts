import { IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleAssistantStatusDto {
  @ApiProperty({
    description: 'UUID of the company',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiProperty({
    description: 'UUID of the AI assistant',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    format: 'uuid',
  })
  @IsUUID()
  aiAssistantId: string;

  @ApiProperty({
    description: 'Whether to enable or disable the AI assistant for the company',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;
}
