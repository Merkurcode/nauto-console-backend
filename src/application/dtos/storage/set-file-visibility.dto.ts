import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetFileVisibilityDto {
  @ApiProperty({
    description: 'Whether the file should be publicly accessible',
    example: true,
  })
  @IsBoolean()
  isPublic: boolean;
}
