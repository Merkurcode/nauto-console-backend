import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class GetAvailableAssistantsDto {
  @ApiPropertyOptional({
    description: 'Language code for localized assistant descriptions',
    example: 'en-US',
    default: 'en-US',
  })
  @TrimString()
  @IsString()
  @IsOptional()
  lang?: string = 'en-US';
}
