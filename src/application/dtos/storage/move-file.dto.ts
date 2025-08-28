import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import {
  IsValidStoragePath,
  HasValidDirectoryDepth,
} from '@shared/validators/storage-path.validator';

export class MoveFileDto {
  @ApiProperty({
    description: 'New virtual folder path for the file',
    example: 'documents/archive',
  })
  @IsString()
  @TrimAndValidateLength({ min: 0, max: 255 })
  @IsOptional()
  @IsValidStoragePath()
  @HasValidDirectoryDepth(100)
  newPath: string;
}
