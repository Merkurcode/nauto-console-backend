import { Injectable, Inject, Optional } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { BaseRepository } from './base.repository';
import { Role } from '@core/entities/role.entity';
import { Permission } from '@core/entities/permission.entity';
import {
  User as PrismaUser,
  UserRole as PrismaUserRole,
  RolePermission as PrismaRolePermission,
  Role as PrismaRole,
  Permission as PrismaPermission,
  UserProfile as PrismaUserProfile,
  UserAddress as PrismaUserAddress,
} from '@prisma/client';
import { ResourceAction } from '@core/value-objects/resource-action.vo';
import { ActionType } from '@shared/constants/enums';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

// Define a type for User with its relations (roles with nested permissions)
type UserWithRelations = PrismaUser & {
  roles: (PrismaUserRole & {
    role: PrismaRole & {
      permissions: (PrismaRolePermission & {
        permission: PrismaPermission;
      })[];
    };
  })[];
  profile?: PrismaUserProfile | null;
  address?: PrismaUserAddress | null;
};

/**
 * Simplified UserRepository for authentication purposes only
 * NOTE: Does not use transactions for authentication queries (performance/simplicity)
 * Used specifically for JwtStrategy and auth flows
 */
@Injectable()
export class UserAuthRepository extends BaseRepository<User> implements IUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    super(logger);
  }

  // Authentication queries don't use transactions for performance
  private get client() {
    return this.prisma;
  }

  async findById(id: string): Promise<User | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const userRecord = await this.client.user.findUnique({
        where: { id },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          profile: true,
          address: true,
        },
      });

      if (!userRecord) {
        return null;
      }

      return this.mapToModel(userRecord as UserWithRelations);
    });
  }

  // Other methods throw NotImplemented error as they're not needed for JWT auth
  async findByEmail(_email: string): Promise<User | null> {
    return this.executeWithErrorHandling('findByEmail', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async findAll(): Promise<User[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async findAllByCompanyId(_companyId: string): Promise<User[]> {
    return this.executeWithErrorHandling('findAllByCompanyId', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async findByAlias(_alias: string): Promise<User | null> {
    return this.executeWithErrorHandling('findByAlias', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async findByAgentPhoneAndCompany(_agentPhone: string, _companyId: string): Promise<User | null> {
    return this.executeWithErrorHandling('findByAgentPhoneAndCompany', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async findUsersByRoleId(_roleId: string): Promise<User[]> {
    return this.executeWithErrorHandling('findUsersByRoleId', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async getUserPhoneCountryCode(_userId: string): Promise<string | null> {
    return this.executeWithErrorHandling('getUserPhoneCountryCode', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async create(_user: User): Promise<User> {
    return this.executeWithErrorHandling('create', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async update(_user: User): Promise<User> {
    return this.executeWithErrorHandling('update', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  async delete(_id: string): Promise<boolean> {
    return this.executeWithErrorHandling('delete', async () => {
      throw new Error('Not implemented in UserAuthRepository');
    });
  }

  private mapToModel(record: UserWithRelations): User {
    // Map roles first
    const roles = record.roles.map(roleRelation => {
      const roleRecord = roleRelation.role;

      // Map permissions
      const permissions =
        roleRecord.permissions?.map(permissionRelation => {
          const permissionRecord = permissionRelation.permission;

          // Create the ResourceAction value object
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
        id: roleRecord.id,
        name: roleRecord.name,
        description: roleRecord.description,
        hierarchyLevel: roleRecord.hierarchyLevel,
        isDefault: roleRecord.isDefault,
        isDefaultAppRole: roleRecord.isDefaultAppRole,
        permissions,
        createdAt: roleRecord.createdAt,
        updatedAt: roleRecord.updatedAt,
      });
    });

    return User.fromData({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      firstName: record.firstName,
      lastName: record.lastName,
      secondLastName: record.secondLastName || undefined,
      isActive: record.isActive,
      emailVerified: record.emailVerified,
      otpEnabled: record.otpEnabled,
      otpSecret: record.otpSecret || undefined,
      roles,
      lastLoginAt: record.lastLoginAt || undefined,
      bannedUntil: record.bannedUntil || undefined,
      banReason: record.banReason || undefined,
      agentPhone: record.agentPhone || undefined,
      profile: record.profile
        ? {
            phone: record.profile.phone || undefined,
            avatarUrl: record.profile.avatarUrl || undefined,
            bio: record.profile.bio || undefined,
            birthDate: record.profile.birthdate || undefined,
          }
        : undefined,
      address: record.address
        ? {
            id: record.address.id,
            countryId: record.address.countryId || undefined,
            stateId: record.address.stateId || undefined,
            city: record.address.city || undefined,
            street: record.address.street || undefined,
            exteriorNumber: record.address.exteriorNumber || undefined,
            interiorNumber: record.address.interiorNumber || undefined,
            postalCode: record.address.postalCode || undefined,
            createdAt: record.address.createdAt,
            updatedAt: record.address.updatedAt,
          }
        : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      companyId: record.companyId || undefined,
    });
  }
}
