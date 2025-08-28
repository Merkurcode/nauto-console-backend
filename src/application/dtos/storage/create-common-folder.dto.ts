import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
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
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 255 })
  @IsNotEmpty()
  @IsValidStoragePath()
  @HasValidDirectoryDepth(100)
  path: string;
}
