import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { IsSafeFilename } from '@shared/validators/safe-filename.validator';

export class RenameFileDto {
  @ApiProperty({
    description: "New filename (only alphanumeric and !-_.*'() characters allowed)",
    example: 'updated-document.pdf',
  })
  @IsString()
  @TrimAndValidateLength({ min: 1 })
  @IsSafeFilename({
    message:
      "Filename contains invalid characters. Use only alphanumeric, spaces, and !-_.*'() characters",
  })
  newFilename: string;

  // This is front end decision
  /*@ApiPropertyOptional({
    description: 'If true, overwrites the destination file if it already exists',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;*/
}
