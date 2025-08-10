import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserPermissionResponse {
  @ApiProperty({
    description: 'Permission unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Permission name in resource:action format',
    example: 'user:read',
  })
  name: string;

  @ApiProperty({
    description: 'Human-readable description of the permission',
    example: 'Can read user information',
  })
  description: string;

  @ApiProperty({
    description: 'The resource this permission applies to',
    example: 'user',
  })
  resource: string;

  @ApiProperty({
    description: 'The action this permission allows',
    example: 'read',
    enum: ['read', 'write', 'delete', 'manage', 'update'],
  })
  action: string;

  @ApiProperty({
    description: 'The role that granted this permission to the user',
    example: 'admin',
  })
  grantedByRole: string;
}
