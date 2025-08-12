import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { IRoleDetailResponse } from '@application/dtos/_responses/role/role.response';
import { RoleMapper } from '@application/mappers/role.mapper';

export class CreateRoleCommand {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly hierarchyLevel: number,
    public readonly isDefault?: boolean,
    public readonly permissionIds?: string[],
    public readonly isDefaultAppRole?: boolean,
    public readonly creatorUserId?: string,
  ) {}
}

@CommandHandler(CreateRoleCommand)
export class CreateRoleCommandHandler
  implements ICommandHandler<CreateRoleCommand, IRoleDetailResponse>
{
  constructor(private readonly roleService: RoleService) {}

  async execute(command: CreateRoleCommand): Promise<IRoleDetailResponse> {
    const {
      name,
      description,
      hierarchyLevel,
      isDefault,
      permissionIds,
      isDefaultAppRole,
      creatorUserId,
    } = command;

    // Use domain service to create role with permissions
    const role = await this.roleService.createRoleWithPermissions(
      name,
      description,
      hierarchyLevel,
      isDefault,
      permissionIds,
      isDefaultAppRole,
      creatorUserId,
    );

    // Use the mapper to convert to response DTO
    return RoleMapper.toDetailResponse(role);
  }
}
