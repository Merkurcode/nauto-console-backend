import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetAvailableAssistantsDto {
  @ApiPropertyOptional({
    description: 'Language code for localized assistant descriptions',
    example: 'en-US',
    default: 'en-US',
  })
  @IsString()
  @IsOptional()
  lang?: string = 'en-US';
}
