import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolesEnum } from '@shared/constants/enums';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: RolesEnum.ROOT,
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Role description',
    example: 'Root role with full access',
  })
  @IsString()
  @IsNotEmpty()
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
  @IsArray()
  @IsOptional()
  permissionIds?: string[];
}
