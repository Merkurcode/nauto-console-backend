import { IsUUID, IsBoolean } from 'class-validator';

export class ToggleFeatureStatusDto {
  @IsUUID()
  assignmentId: string;

  @IsUUID()
  featureId: string;

  @IsBoolean()
  enabled: boolean;
}
