import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateAIPersonaStatusDto {
  @ApiProperty({
    description: 'Whether the AI persona should be active or inactive',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isActive: boolean;
}
