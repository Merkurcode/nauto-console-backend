import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateCompanyAIPersonaStatusDto {
  @ApiProperty({
    description: 'The AI persona ID to assign or update',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID(4, { message: 'AI Persona ID must be a valid UUID' })
  aiPersonaId: string;

  @ApiProperty({
    description: 'Whether the company AI persona assignment should be active or inactive',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}
