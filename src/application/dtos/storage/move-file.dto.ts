import { IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '@shared/decorators/trim.decorator';
import {
  IsValidStoragePath,
  HasValidDirectoryDepth,
} from '@shared/validators/storage-path.validator';

export class MoveFileDto {
  @ApiProperty({
    description: 'New virtual folder path for the file',
    example: 'documents/archive',
  })
  @Trim()
  @IsString()
  @IsOptional()
  @Length(0, 255)
  @IsValidStoragePath()
  @HasValidDirectoryDepth(100)
  newPath: string;
}
