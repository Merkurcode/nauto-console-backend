import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';
import { TargetAppsEnum } from '@shared/constants/target-apps.enum';

export class UpdateFileTargetAppsDto {
  @ApiProperty({
    description: 'Target applications with specific file size restrictions',
    example: ['WhatsApp'],
    isArray: true,
    enum: TargetAppsEnum,
  })
  @IsArray()
  @IsEnum(TargetAppsEnum, { each: true })
  targetApps: TargetAppsEnum[];
}
