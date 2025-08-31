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
import { PermissionExcludeService } from './permission-exclude.service';

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
    private readonly permissionExcludeService: PermissionExcludeService,
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

    // Security: Prevent modification of system roles
    if (role.isDefaultAppRole) {
      throw new ForbiddenActionException('Cannot modify system roles (isDefaultAppRole)');
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
    const updatedRole = await this.roleRepository.update(role);

    // Return the updated role with complete data including permissions
    const completeRole = await this.roleRepository.findById(updatedRole.id.getValue());
    if (!completeRole) {
      throw new EntityNotFoundException('Role not found after update');
    }

    return completeRole;
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new EntityNotFoundException('Role', roleId);
    }

    // Security: Prevent modification of system roles
    if (role.isDefaultAppRole) {
      throw new ForbiddenActionException(
        'Cannot modify permissions of system roles (isDefaultAppRole)',
      );
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

  async assignPermissionToRoleWithValidation(roleId: string, permissionId: string): Promise<Role> {
    // Get role to validate exclude rules
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new EntityNotFoundException('Role', roleId);
    }

    // Security: Prevent modification of system roles
    if (role.isDefaultAppRole) {
      throw new ForbiddenActionException(
        'Cannot modify permissions of system roles (isDefaultAppRole)',
      );
    }

    // Get permission
    let permission = await this.permissionRepository.findById(permissionId);
    if (!permission) {
      permission = await this.permissionRepository.findByName(permissionId);
      if (!permission) {
        throw new EntityNotFoundException('Permission', permissionId);
      }
    }

    // Validate permission exclude rules
    await this.permissionExcludeService.validateRolePermissionAssignment(
      role.name,
      permission.getStringName(),
    );

    // Assign the permission to the role
    return await this.assignPermissionToRole(roleId, permissionId);
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
    let role = await this.roleRepository.findById(roleId);
    if (!role) {
      role = await this.roleRepository.findByName(roleId);
      if (!role) {
        throw new EntityNotFoundException('Role', roleId);
      }
    }

    // Security: Prevent modification of system roles
    if (role.isDefaultAppRole) {
      throw new ForbiddenActionException(
        'Cannot modify permissions of system roles (isDefaultAppRole)',
      );
    }

    role.removePermission(PermissionId.fromString(permissionId));

    const updatedRole = await this.roleRepository.update(role);

    // Return the updated role with complete data including permissions
    const completeRole = await this.roleRepository.findById(updatedRole.id.getValue());
    if (!completeRole) {
      throw new EntityNotFoundException('Role not found after update');
    }

    return completeRole;
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

  async createRoleWithPermissions(
    name: string,
    description: string,
    hierarchyLevel: number,
    isDefault: boolean = false,
    permissionIds?: string[],
    isDefaultAppRole: boolean = false,
    creatorUserId?: string,
  ): Promise<Role> {
    // Create the role first
    const role = await this.createRole(
      name,
      description,
      hierarchyLevel,
      isDefault,
      isDefaultAppRole,
      creatorUserId,
    );

    // If permission IDs are provided, assign them to the role
    if (permissionIds && permissionIds.length > 0) {
      for (const permissionId of permissionIds) {
        await this.assignPermissionToRole(role.id.getValue(), permissionId);
      }
    }

    // Get the updated role with permissions
    const updatedRole = await this.roleRepository.findById(role.id.getValue());

    if (!updatedRole) {
      throw new EntityNotFoundException('Role not found after creation', role.id.getValue());
    }

    return updatedRole;
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

  async getRoleById(id: string): Promise<Role | null> {
    return await this.roleRepository.findById(id);
  }

  async getAllRoles(): Promise<Role[]> {
    return await this.roleRepository.findAll();
  }
}
