import { IsUUID, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class AssignAssistantFeatureDto {
  @IsUUID()
  featureId: string;

  @IsBoolean()
  enabled: boolean;
}

export class AssignAssistantToCompanyDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  aiAssistantId: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  @IsArray()
  @IsOptional()
  features?: AssignAssistantFeatureDto[];
}
