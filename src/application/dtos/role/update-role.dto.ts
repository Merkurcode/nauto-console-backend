import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: 'Role name',
    example: 'moderator',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Moderator role with limited access',
  })
  @IsOptional()
  @IsString()
  @TrimString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this role is the default for new users',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
