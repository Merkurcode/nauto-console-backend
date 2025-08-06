import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '@core/services/role.service';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';
import { RoleDetailResponse } from '@application/dtos/responses/role.response';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { IPermissionRepository } from '@core/repositories/permission.repository.interface';
import { Inject } from '@nestjs/common';
import { RoleMapper } from '@application/mappers/role.mapper';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

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
  constructor(
    private readonly roleService: RoleService,
    private readonly permissionExcludeService: PermissionExcludeService,
    @Inject(REPOSITORY_TOKENS.ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(REPOSITORY_TOKENS.PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
  ) {}

  async execute(command: AssignPermissionCommand): Promise<RoleDetailResponse> {
    const { roleId, permissionId } = command;

    // Get role to validate exclude rules - using Prisma directly for simplicity
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    // Get permission name from repository
    const permission = await this.permissionRepository.findById(permissionId);
    if (!permission) {
      throw new Error('Permission not found');
    }

    // Validate permission exclude rules
    await this.permissionExcludeService.validateRolePermissionAssignment(
      role.name,
      permission.getStringName(),
    );

    // Assign the permission to the role
    const updatedRoleEntity = await this.roleService.assignPermissionToRole(roleId, permissionId);

    // Fetch the updated role with permissions
    const updatedRole = await this.roleRepository.findById(updatedRoleEntity.id.getValue());

    if (!updatedRole) {
      throw new Error('Role not found after update');
    }

    // Use the mapper to convert to response DTO
    return RoleMapper.toDetailResponse(updatedRole);
  }
}
