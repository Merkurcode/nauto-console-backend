import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { IRoleDetailResponse } from '@application/dtos/_responses/role/role.response';
import { RoleMapper } from '@application/mappers/role.mapper';

export class RemovePermissionCommand {
  constructor(
    public readonly roleId: string,
    public readonly permissionId: string,
  ) {}
}

@CommandHandler(RemovePermissionCommand)
export class RemovePermissionCommandHandler
  implements ICommandHandler<RemovePermissionCommand, IRoleDetailResponse>
{
  constructor(private readonly roleService: RoleService) {}

  async execute(command: RemovePermissionCommand): Promise<IRoleDetailResponse> {
    const { roleId, permissionId } = command;

    // Remove the permission from the role and get updated role
    const updatedRole = await this.roleService.removePermissionFromRole(roleId, permissionId);

    // Use the mapper to convert to response DTO
    return RoleMapper.toDetailResponse(updatedRole);
  }
}
