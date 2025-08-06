import { Injectable } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
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
import { ResourceAction, ActionType } from '@core/value-objects/resource-action.vo';
import { BaseRepository } from './base.repository';

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

@Injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAllByCompanyId(companyId: string): Promise<User[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const userRecords = await this.prisma.user.findMany({
        where: {
          companyId: companyId,
        },
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

      return userRecords.map(record => this.mapToModel(record as UserWithRelations));
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const userRecord = await this.prisma.user.findUnique({
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

  async findByEmail(email: string): Promise<User | null> {
    return this.executeWithErrorHandling('findByEmail', async () => {
      const userRecord = await this.prisma.user.findUnique({
        where: { email },
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

  async findByAgentPhoneAndCompany(agentPhone: string, companyId: string): Promise<User | null> {
    return this.executeWithErrorHandling('findByAgentPhoneAndCompany', async () => {
      const userRecord = await this.prisma.user.findFirst({
        where: {
          agentPhone,
          companyId,
        },
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

  async findAll(): Promise<User[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const userRecords = await this.prisma.user.findMany({
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

      return userRecords.map(record => this.mapToModel(record as UserWithRelations));
    });
  }

  async findUsersByRoleId(roleId: string): Promise<User[]> {
    return this.executeWithErrorHandling('findUsersByRoleId', async () => {
      const userRecords = await this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              roleId,
            },
          },
        },
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

      return userRecords.map(record => this.mapToModel(record as UserWithRelations));
    });
  }

  async getUserCountryPhoneCode(userId: string): Promise<string | null> {
    return this.executeWithErrorHandling('getUserCountryPhoneCode', async () => {
      const userWithAddress = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          address: {
            include: {
              country: true,
            },
          },
        },
      });

      if (!userWithAddress?.address?.country) {
        return null;
      }

      // Return phone code without the + sign for SMS API
      return userWithAddress.address.country.phoneCode.replace('+', '');
    });
  }

  async create(user: User): Promise<User> {
    return this.executeWithErrorHandling('create', async () => {
      const createdUser = await this.prisma.user.create({
        data: {
          id: user.id.getValue(),
          email: user.email.getValue(),
          passwordHash: user.passwordHash,
          firstName: user.firstName.getValue(),
          lastName: user.lastName.getValue(),
          secondLastName: user.secondLastName?.getValue(),
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          otpEnabled: user.otpEnabled,
          otpSecret: user.otpSecret,
          lastLoginAt: user.lastLoginAt,
          bannedUntil: user.bannedUntil,
          banReason: user.banReason,
          agentPhone: user.agentPhone?.getValue(),
          companyId: user.companyId?.getValue(),
          roles: {
            create: user.roles.map(role => ({
              role: {
                connect: { id: role.id.getValue() },
              },
            })),
          },
          profile: user.profile
            ? {
                create: {
                  phone: user.profile.phone,
                  avatarUrl: user.profile.avatarUrl,
                  bio: user.profile.bio,
                  birthdate: user.profile.birthDate,
                },
              }
            : undefined,
          address: user.address
            ? {
                create: {
                  city: user.address.city,
                  street: user.address.street,
                  exteriorNumber: user.address.exteriorNumber,
                  interiorNumber: user.address.interiorNumber,
                  postalCode: user.address.postalCode,
                },
              }
            : undefined,
        },
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

      return this.mapToModel(createdUser as UserWithRelations);
    });
  }

  async update(user: User): Promise<User> {
    return this.executeWithErrorHandling('update', async () => {
      // First, delete all role associations to recreate them
      await this.prisma.userRole.deleteMany({
        where: {
          userId: user.id.getValue(),
        },
      });

      // Update the user with new role associations
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id.getValue() },
        data: {
          email: user.email.getValue(),
          passwordHash: user.passwordHash,
          firstName: user.firstName.getValue(),
          lastName: user.lastName.getValue(),
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          otpEnabled: user.otpEnabled,
          otpSecret: user.otpSecret,
          lastLoginAt: user.lastLoginAt,
          companyId: user.companyId?.getValue(),
          roles: {
            create: user.roles.map(role => ({
              role: {
                connect: { id: role.id.getValue() },
              },
            })),
          },
        },
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

      return this.mapToModel(updatedUser as UserWithRelations);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        await this.prisma.user.delete({
          where: { id },
        });

        return true;
      },
      false,
    );
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
            country: 'México', // Default since we're not storing country/state properly yet
            state: 'Unknown',
            city: record.address.city || '',
            street: record.address.street || '',
            exteriorNumber: record.address.exteriorNumber || '',
            interiorNumber: record.address.interiorNumber || undefined,
            postalCode: record.address.postalCode || '',
          }
        : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      companyId: record.companyId || undefined,
    });
  }
}
