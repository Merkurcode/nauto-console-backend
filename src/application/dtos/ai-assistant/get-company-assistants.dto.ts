import { IsString, IsOptional, IsUUID } from 'class-validator';

export class GetCompanyAssistantsDto {
  @IsString()
  @IsOptional()
  lang?: string = 'en-US';

  @IsUUID()
  companyId: string;
}
