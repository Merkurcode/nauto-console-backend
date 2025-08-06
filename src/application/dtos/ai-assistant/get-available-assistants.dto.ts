import { IsString, IsOptional } from 'class-validator';

export class GetAvailableAssistantsDto {
  @IsString()
  @IsOptional()
  lang?: string = 'en-US';
}
