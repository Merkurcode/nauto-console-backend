import { Injectable } from '@nestjs/common';
import { Role } from '@core/entities/role.entity';
import { Permission } from '@core/entities/permission.entity';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import {
  Role as PrismaRole,
  RolePermission as PrismaRolePermission,
  Permission as PrismaPermission,
} from '@prisma/client';
import { ResourceAction } from '@core/value-objects/resource-action.vo';
import { ActionType } from '@shared/constants/enums';
import { BaseRepository } from './base.repository';

// Define a type for Role with its related permissions
type RoleWithPermissions = PrismaRole & {
  permissions?: (PrismaRolePermission & {
    permission: PrismaPermission;
  })[];
};

@Injectable()
export class RoleRepository extends BaseRepository<Role> implements IRoleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super();
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<Role | null> {
    const roleRecord = await this.client.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!roleRecord) {
      return null;
    }

    return this.mapToModel(roleRecord as RoleWithPermissions);
  }

  async findByName(name: string): Promise<Role | null> {
    const roleRecord = await this.client.role.findUnique({
      where: { name },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!roleRecord) {
      return null;
    }

    return this.mapToModel(roleRecord as RoleWithPermissions);
  }

  async findAll(): Promise<Role[]> {
    const roleRecords = await this.client.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return roleRecords.map(record => this.mapToModel(record as RoleWithPermissions));
  }

  async findDefaultRole(): Promise<Role | null> {
    const roleRecord = await this.client.role.findFirst({
      where: { isDefault: true },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!roleRecord) {
      return null;
    }

    return this.mapToModel(roleRecord as RoleWithPermissions);
  }

  async create(role: Role): Promise<Role> {
    const createdRole = await this.client.role.create({
      data: {
        id: role.id.getValue(),
        name: role.name,
        description: role.description,
        hierarchyLevel: role.hierarchyLevel,
        isDefault: role.isDefault,
        isDefaultAppRole: role.isDefaultAppRole,
        permissions: {
          create:
            role.permissions?.map(permission => ({
              permission: {
                connect: { id: permission.id.getValue() },
              },
            })) || [],
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return this.mapToModel(createdRole as RoleWithPermissions);
  }

  async update(role: Role): Promise<Role> {
    // First delete all permission associations to recreate them
    await this.client.rolePermission.deleteMany({
      where: {
        roleId: role.id.getValue(),
      },
    });

    // Update the role with new permission associations
    const updatedRole = await this.client.role.update({
      where: { id: role.id.getValue() },
      data: {
        name: role.name,
        description: role.description,
        hierarchyLevel: role.hierarchyLevel,
        isDefault: role.isDefault,
        isDefaultAppRole: role.isDefaultAppRole,
        permissions: {
          create:
            role.permissions?.map(permission => ({
              permission: {
                connect: { id: permission.id.getValue() },
              },
            })) || [],
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return this.mapToModel(updatedRole as RoleWithPermissions);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.role.delete({
        where: { id },
      });

      return true;
    } catch {
      return false;
    }
  }

  private mapToModel(record: RoleWithPermissions): Role {
    // Map permissions first
    const permissions =
      record.permissions?.map(permissionRelation => {
        const permissionRecord = permissionRelation.permission;

        // Create ResourceAction value object
        const resourceAction = new ResourceAction(
          permissionRecord.resource,
          permissionRecord.action as ActionType,
        );

        return Permission.fromData({
          id: permissionRecord.id,
          resourceAction,
          description: permissionRecord.description,
          createdAt: permissionRecord.createdAt,
          updatedAt: permissionRecord.updatedAt,
        });
      }) || [];

    return Role.fromData({
      id: record.id,
      name: record.name,
      description: record.description,
      hierarchyLevel: record.hierarchyLevel,
      isDefault: record.isDefault,
      isDefaultAppRole: record.isDefaultAppRole,
      permissions,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
