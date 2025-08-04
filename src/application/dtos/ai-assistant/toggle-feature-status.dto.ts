import { IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleFeatureStatusDto {
  @ApiProperty({
    description: 'UUID of the company-AI assistant assignment',
    example: 'c3d4e5f6-g7h8-9012-cdef-g34567890123',
    format: 'uuid',
  })
  @IsUUID()
  assignmentId: string;

  @ApiProperty({
    description: 'UUID of the specific feature to toggle',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'uuid',
  })
  @IsUUID()
  featureId: string;

  @ApiProperty({
    description: 'Whether to enable or disable the specific feature',
    example: false,
  })
  @IsBoolean()
  enabled: boolean;
}
