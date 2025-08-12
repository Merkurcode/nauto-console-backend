import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { IRoleDetailResponse } from '@application/dtos/_responses/role/role.response';
import { RoleMapper } from '@application/mappers/role.mapper';

export class UpdateRoleCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly isDefault?: boolean,
  ) {}
}

@CommandHandler(UpdateRoleCommand)
export class UpdateRoleCommandHandler
  implements ICommandHandler<UpdateRoleCommand, IRoleDetailResponse>
{
  constructor(private readonly roleService: RoleService) {}

  async execute(command: UpdateRoleCommand): Promise<IRoleDetailResponse> {
    const { id, name, description, isDefault } = command;

    // Update the role and get updated role
    const updatedRole = await this.roleService.updateRole(id, name, description, isDefault);

    // Use the mapper to convert to response DTO
    return RoleMapper.toDetailResponse(updatedRole);
  }
}
