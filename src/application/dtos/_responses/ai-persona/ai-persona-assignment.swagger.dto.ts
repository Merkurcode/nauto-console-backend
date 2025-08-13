import { ApiProperty } from '@nestjs/swagger';

export class AIPersonaAssignmentSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Assignment unique identifier',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company ID that received the assignment',
  })
  companyId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'AI Persona ID that was assigned',
  })
  aiPersonaId: string;

  @ApiProperty({
    example: true,
    description: 'Whether the assignment is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'When the assignment was made',
  })
  assignedAt: Date;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of user who made the assignment',
  })
  assignedBy: string | null;
}
