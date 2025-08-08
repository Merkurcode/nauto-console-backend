import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RolesEnum } from '@shared/constants/enums';

export class GetAssignablePermissionsDto {
  @ApiPropertyOptional({
    description: 'Target role name to get assignable permissions for',
    example: RolesEnum.ADMIN,
    enum: RolesEnum,
    enumName: 'RolesEnum',
  })
  @IsEnum(RolesEnum)
  @IsOptional()
  targetRoleName?: RolesEnum;
}
