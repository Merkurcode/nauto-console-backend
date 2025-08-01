import { ApiProperty } from '@nestjs/swagger';

// Basic Permission Response dto
export class PermissionResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'user:read' })
  name!: string;

  @ApiProperty({ example: 'Can read user information' })
  description!: string;

  @ApiProperty({ example: 'user' })
  resource!: string;

  @ApiProperty({ example: 'read' })
  action!: string;
}

// Basic Role Response dto
export class RoleBaseResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'root' })
  name!: string;

  @ApiProperty({ example: 'Root role with full access' })
  description!: string;

  @ApiProperty({ example: false })
  isDefault!: boolean;

  @ApiProperty({ example: true })
  isDefaultAppRole!: boolean;
}

// Detailed Role Response with permissions
export class RoleDetailResponse extends RoleBaseResponse {
  @ApiProperty({ type: [PermissionResponse] })
  permissions!: PermissionResponse[];

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}
