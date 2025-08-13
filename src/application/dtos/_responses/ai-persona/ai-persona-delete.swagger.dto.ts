import { ApiProperty } from '@nestjs/swagger';

export class AIPersonaDeleteSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the deleted AI persona',
  })
  id: string;

  @ApiProperty({
    example: 'AI persona deleted successfully',
    description: 'Confirmation message',
  })
  message: string;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Timestamp when the deletion occurred',
  })
  deletedAt: Date;
}
