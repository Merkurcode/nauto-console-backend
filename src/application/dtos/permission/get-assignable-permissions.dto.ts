import { IsString, IsOptional } from 'class-validator';

export class GetAssignablePermissionsDto {
  @IsString()
  @IsOptional()
  targetRoleName?: string;
}
