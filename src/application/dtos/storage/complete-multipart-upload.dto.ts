import { IsArray, IsString, IsNumber, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CompletedPartDto {
  @ApiProperty({
    description: 'ETag returned by the upload part operation',
    example: '"9bb58f26192e4ba00f01e2e7b136bbd8"',
  })
  @IsString()
  ETag: string;

  @ApiProperty({
    description: 'Part number (1-10000)',
    example: 1,
    minimum: 1,
    maximum: 10000,
  })
  @IsNumber()
  @Min(1)
  PartNumber: number;
}

export class CompleteMultipartUploadDto {
  @ApiProperty({
    description: 'Array of completed parts with their ETags and part numbers',
    type: [CompletedPartDto],
    example: [
      { ETag: '"9bb58f26192e4ba00f01e2e7b136bbd8"', PartNumber: 1 },
      { ETag: '"7bb58f26192e4ba00f01e2e7b136bbd9"', PartNumber: 2 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts: CompletedPartDto[];
}
