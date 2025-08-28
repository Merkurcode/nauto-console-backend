import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class AssignAIPersonaDto {
  @ApiProperty({
    description: 'ID of the AI persona to assign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @TrimString()
  @IsNotEmpty()
  @IsUUID()
  aiPersonaId: string;
}
