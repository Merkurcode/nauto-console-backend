import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '@shared/decorators/trim.decorator';
import {
  IsValidStoragePath,
  HasValidDirectoryDepth,
} from '@shared/validators/storage-path.validator';

export class CreateCommonFolderDto {
  @ApiProperty({
    description: 'Folder path within the common area',
    example: 'catalogs/2025',
    maxLength: 255,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @IsValidStoragePath()
  @HasValidDirectoryDepth(100)
  path: string;
}
