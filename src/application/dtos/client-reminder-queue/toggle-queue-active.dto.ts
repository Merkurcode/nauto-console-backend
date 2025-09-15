import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleQueueActiveDto {
  @ApiProperty({
    description: 'Whether the queue should be active',
    example: true,
  })
  @IsBoolean()
  active: boolean;
}
