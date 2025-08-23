import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsValidStoragePath,
  HasValidDirectoryDepth,
} from '@shared/validators/storage-path.validator';

export class CreateFolderDto {
  @ApiProperty({
    description: "Folder path relative to the user's directory",
    example: 'documents/projects',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  @IsValidStoragePath()
  @HasValidDirectoryDepth(100)
  path: string;
}
