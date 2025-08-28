import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class AssignRoleDto {
  @ApiProperty({
    description: 'Role ID to assign to user',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  @TrimString()
  roleId!: string;
}
