import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { RoleDetailResponse } from '@application/dtos/_responses/role/role.response';
import { RoleMapper } from '@application/mappers/role.mapper';

export class AssignPermissionCommand {
  constructor(
    public readonly roleId: string,
    public readonly permissionId: string,
  ) {}
}

@CommandHandler(AssignPermissionCommand)
export class AssignPermissionCommandHandler
  implements ICommandHandler<AssignPermissionCommand, RoleDetailResponse>
{
  constructor(private readonly roleService: RoleService) {}

  async execute(command: AssignPermissionCommand): Promise<RoleDetailResponse> {
    const { roleId, permissionId } = command;

    // Use domain service with validation
    const updatedRole = await this.roleService.assignPermissionToRoleWithValidation(
      roleId,
      permissionId,
    );

    // Use the mapper to convert to response DTO
    return RoleMapper.toDetailResponse(updatedRole);
  }
}
