import { Injectable, Inject } from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { IRoleRepository } from '../repositories/role.repository.interface';
import { IPermissionRepository } from '../repositories/permission.repository.interface';
import { IUserRepository } from '../repositories/user.repository.interface';
import {
  EntityNotFoundException,
  EntityAlreadyExistsException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { PermissionId } from '@core/value-objects/permission-id.vo';
import { ROLE_REPOSITORY, PERMISSION_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';
import { RolesEnum } from '@shared/constants/enums';
import { UserAuthorizationService } from './user-authorization.service';

@Injectable()
export class RoleService {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async createRole(
    name: string,
    description: string,
    hierarchyLevel: number,
    isDefault: boolean = false,
    isDefaultAppRole: boolean = false,
    creatorUserId?: string,
  ): Promise<Role> {
    // Check if a role already exists
    const existingRole = await this.roleRepository.findByName(name);
    if (existingRole) {
      throw new EntityAlreadyExistsException('Role', 'name');
    }

    // Validate hierarchy level restrictions if creator is specified
    if (creatorUserId) {
      await this.validateHierarchyLevelForCreation(creatorUserId, hierarchyLevel);
    }

    // Validate that hierarchy level is not root level for new roles
    const rootLevel = this.userAuthorizationService.getRoleHierarchyLevelByEnum(RolesEnum.ROOT);
    if (hierarchyLevel === rootLevel) {
      throw new ForbiddenActionException('Cannot create roles with root hierarchy level');
    }

    // If this is a default role, unset any existing default role
    if (isDefault) {
      const currentDefaultRole = await this.roleRepository.findDefaultRole();
      if (currentDefaultRole) {
        currentDefaultRole.removeAsDefault();
        await this.roleRepository.update(currentDefaultRole);
      }
    }

    const role = Role.create(name, description, hierarchyLevel, isDefault, isDefaultAppRole);

    return this.roleRepository.create(role);
  }

  async updateRole(
    id: string,
    name?: string,
    description?: string,
    isDefault?: boolean,
  ): Promise<Role> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new EntityNotFoundException('Role', id);
    }

    if (name) {
      const existingRole = await this.roleRepository.findByName(name);
      if (existingRole && existingRole.id.getValue() !== id) {
        throw new EntityAlreadyExistsException('Role', 'name');
      }
    }

    role.updateDetails(name, description);

    if (isDefault !== undefined) {
      // If making this role default, unset any existing default role
      if (isDefault && !role.isDefault) {
        const currentDefaultRole = await this.roleRepository.findDefaultRole();
        if (currentDefaultRole && currentDefaultRole.id.getValue() !== id) {
          currentDefaultRole.removeAsDefault();
          await this.roleRepository.update(currentDefaultRole);
        }
      }
      if (isDefault) {
        role.setAsDefault();
      } else {
        role.removeAsDefault();
      }
    }

    // The entity will handle updating the updatedAt timestamp

    return this.roleRepository.update(role);
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new EntityNotFoundException('Role', roleId);
    }

    let permission = await this.permissionRepository.findById(permissionId);
    if (!permission) {
      permission = await this.permissionRepository.findByName(permissionId);
      if (!permission) {
        throw new EntityNotFoundException('Permission', permissionId);
      }
    }

    role.addPermission(permission);

    return this.roleRepository.update(role);
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
    let role = await this.roleRepository.findById(roleId);
    if (!role) {
      role = await this.roleRepository.findByName(roleId);
      if (!role) {
        throw new EntityNotFoundException('Role', roleId);
      }
    }

    role.removePermission(PermissionId.fromString(permissionId));

    return this.roleRepository.update(role);
  }

  async deleteRole(id: string): Promise<boolean> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new EntityNotFoundException('Role', id);
    }

    if (role.isDefault) {
      throw new ForbiddenActionException('Cannot delete the default role');
    }

    if (role.isDefaultAppRole) {
      throw new ForbiddenActionException('Cannot delete system roles');
    }

    return this.roleRepository.delete(id);
  }

  private async validateHierarchyLevelForCreation(
    creatorUserId: string,
    targetHierarchyLevel: number,
  ): Promise<void> {
    const creator = await this.userRepository.findById(creatorUserId);
    if (!creator) {
      throw new EntityNotFoundException('User', creatorUserId);
    }

    // Get creator's highest role (lowest hierarchy level number)
    const creatorRoles = creator.roles;
    if (!creatorRoles || creatorRoles.length === 0) {
      throw new ForbiddenActionException('User has no roles assigned');
    }

    const creatorHighestRole = creatorRoles.reduce((highest, current) =>
      current.hierarchyLevel < highest.hierarchyLevel ? current : highest,
    );

    // Validate that creator can create roles with the target hierarchy level
    if (!creatorHighestRole.canCreateRoleWithLevel(targetHierarchyLevel)) {
      throw new ForbiddenActionException(
        `Cannot create role with hierarchy level ${targetHierarchyLevel}. ` +
          `Your highest role (${creatorHighestRole.name}) can only create roles with hierarchy level ${creatorHighestRole.hierarchyLevel} or higher.`,
      );
    }
  }

  async getUserHighestRole(userId: string): Promise<Role> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    const userRoles = user.roles;
    if (!userRoles || userRoles.length === 0) {
      throw new EntityNotFoundException('User has no roles assigned');
    }

    // Return role with lowest hierarchy level (highest privilege)
    return userRoles.reduce((highest, current) =>
      current.hierarchyLevel < highest.hierarchyLevel ? current : highest,
    );
  }
}
