import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameFileDto {
  @ApiProperty({
    description: 'New filename (cannot contain path separators)',
    example: 'updated-document.pdf',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^[^\/\\]+$/, {
    message: 'Filename cannot contain path separators (/ or \\)',
  })
  newFilename: string;
}
