import { IsUUID, IsBoolean } from 'class-validator';

export class ToggleAssistantStatusDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  aiAssistantId: string;

  @IsBoolean()
  enabled: boolean;
}
