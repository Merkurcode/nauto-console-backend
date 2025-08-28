import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolesEnum } from '@shared/constants/enums';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: RolesEnum.ADMIN,
    enum: RolesEnum,
    enumName: 'RolesEnum',
  })
  @IsEnum(RolesEnum)
  @IsNotEmpty()
  name!: RolesEnum;

  @ApiProperty({
    description: 'Role description',
    example: 'Root role with full access',
  })
  @IsString()
  @IsNotEmpty()
  @TrimString()
  description!: string;

  @ApiProperty({
    description:
      'Role hierarchy level (2-5). 1=root (restricted), 2=admin, 3=manager, 4=sales_agent/host, 5=guest',
    example: 5,
    minimum: 2,
    maximum: 5,
  })
  @IsInt()
  @Min(2)
  @Max(5)
  hierarchyLevel!: number;

  @ApiPropertyOptional({
    description: 'Whether this role is the default for new users',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is a system role (cannot be deleted) - Internal use only',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefaultAppRole?: boolean;

  @ApiPropertyOptional({
    description: 'List of permission IDs to assign to the role',
    example: ['550e8400-e29b-41d4-a716-446655440000', 'role:read'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @TrimString()
  permissionIds?: string[];
}
