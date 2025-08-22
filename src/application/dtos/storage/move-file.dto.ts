import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveFileDto {
  @ApiProperty({
    description: 'New virtual folder path for the file',
    example: 'documents/archive',
  })
  @IsString()
  @MinLength(0)
  newPath: string;
}
