import { Injectable, Inject, Optional } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
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
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
    @Optional() requestCache?: RequestCacheService,
  ) {
    super(logger, requestCache);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findAllByCompanyId(companyId: string): Promise<User[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const userRecords = await this.client.user.findMany({
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
          company: true,
        },
      });

      return userRecords.map(record => this.mapToModel(record as UserWithRelations));
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
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
      },
      undefined,
      { id },
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findByEmail',
      async () => {
        const userRecord = await this.client.user.findUnique({
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
            company: true,
          },
        });

        if (!userRecord) {
          return null;
        }

        return this.mapToModel(userRecord as UserWithRelations);
      },
      undefined,
      { email },
    );
  }

  async findByAlias(alias: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findByAlias',
      async () => {
        const userRecord = await this.client.user.findUnique({
          where: { alias },
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
            company: true,
          },
        });

        if (!userRecord) {
          return null;
        }

        return this.mapToModel(userRecord as UserWithRelations);
      },
      undefined,
      { alias },
    );
  }

  async findByAgentPhoneAndCompany(agentPhone: string, companyId: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findByAgentPhoneAndCompany',
      async () => {
        const userRecord = await this.client.user.findFirst({
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
            company: true,
          },
        });

        if (!userRecord) {
          return null;
        }

        return this.mapToModel(userRecord as UserWithRelations);
      },
      undefined,
      { agentPhone, companyId },
    );
  }

  async findAll(): Promise<User[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const userRecords = await this.client.user.findMany({
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
          company: true,
        },
      });

      return userRecords.map(record => this.mapToModel(record as UserWithRelations));
    });
  }

  async findUsersByRoleId(roleId: string): Promise<User[]> {
    return this.executeWithErrorHandling('findUsersByRoleId', async () => {
      const userRecords = await this.client.user.findMany({
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
          company: true,
        },
      });

      return userRecords.map(record => this.mapToModel(record as UserWithRelations));
    });
  }

  async getUserPhoneCountryCode(userId: string): Promise<string | null> {
    return this.executeWithErrorHandling(
      'getUserPhoneCountryCode',
      async () => {
        const userWithProfile = await this.client.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
          },
        });

        if (!userWithProfile?.profile?.phoneCountryCode) {
          return null;
        }

        // Return phone country code directly (without + sign for SMS API)
        return userWithProfile.profile.phoneCountryCode.replace('+', '');
      },
      undefined,
      { userId },
    );
  }

  async create(user: User): Promise<User> {
    return this.executeWithErrorHandling('create', async () => {
      const createdUser = await this.client.user.create({
        data: {
          id: user.id.getValue(),
          email: user.email.getValue(),
          passwordHash: user.passwordHash,
          firstName: user.firstName.getValue(),
          lastName: user.lastName.getValue(),
          secondLastName: user.secondLastName?.getValue(),
          alias: user.alias,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          otpEnabled: user.otpEnabled,
          otpSecret: user.otpSecret,
          lastLoginAt: user.lastLoginAt,
          bannedUntil: user.bannedUntil,
          banReason: user.banReason,
          agentPhone: user.agentPhone?.getValue(),
          agentPhoneCountryCode: user.agentPhone?.getCountryCode(),
          companyId: user.companyId?.getValue() || null,
          smsStatus: user.smsStatus,
          emailStatus: user.emailStatus,
          lastSmsError: user.lastSmsError || null,
          lastEmailError: user.lastEmailError || null,
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
                  id: user.address.id.getValue(),
                  countryId: user.address.countryId?.getValue(),
                  stateId: user.address.stateId?.getValue(),
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
          company: true,
        },
      });

      return this.mapToModel(createdUser as UserWithRelations);
    });
  }

  async update(user: User): Promise<User> {
    return this.executeWithErrorHandling('update', async () => {
      // First, delete all role associations to recreate them
      await this.client.userRole.deleteMany({
        where: {
          userId: user.id.getValue(),
        },
      });

      // Update the user with all fields including missing ones
      await this.client.user.update({
        where: { id: user.id.getValue() },
        data: {
          email: user.email.getValue(),
          passwordHash: user.passwordHash,
          firstName: user.firstName.getValue(),
          lastName: user.lastName.getValue(),
          secondLastName: user.secondLastName?.getValue() || null,
          alias: user.alias || null,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          otpEnabled: user.otpEnabled,
          otpSecret: user.otpSecret,
          lastLoginAt: user.lastLoginAt,
          companyId: user.companyId?.getValue() || null,
          bannedUntil: user.bannedUntil || null,
          banReason: user.banReason || null,
          agentPhone: user.agentPhone?.getValue() || null,
          agentPhoneCountryCode: user.agentPhone?.getCountryCode() || null,
          smsStatus: user.smsStatus,
          emailStatus: user.emailStatus,
          lastSmsError: user.lastSmsError || null,
          lastEmailError: user.lastEmailError || null,
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
          company: true,
        },
      });

      // Handle profile update/upsert
      if (user.profile) {
        await this.client.userProfile.upsert({
          where: { userId: user.id.getValue() },
          update: {
            phone: user.profile.phone || null,
            phoneCountryCode: user.profile.phoneCountryCode || null,
            avatarUrl: user.profile.avatarUrl || null,
            bio: user.profile.bio || null,
            birthdate: user.profile.birthDate || null,
          },
          create: {
            userId: user.id.getValue(),
            phone: user.profile.phone || null,
            phoneCountryCode: user.profile.phoneCountryCode || null,
            avatarUrl: user.profile.avatarUrl || null,
            bio: user.profile.bio || null,
            birthdate: user.profile.birthDate || null,
          },
        });
      }

      // Handle address update/upsert
      if (user.address) {
        await this.client.userAddress.upsert({
          where: { userId: user.id.getValue() },
          update: {
            countryId: user.address.countryId?.getValue() || null,
            stateId: user.address.stateId?.getValue() || null,
            city: user.address.city || null,
            street: user.address.street || null,
            exteriorNumber: user.address.exteriorNumber || null,
            interiorNumber: user.address.interiorNumber || null,
            postalCode: user.address.postalCode || null,
          },
          create: {
            id: user.address.id.getValue(),
            userId: user.id.getValue(),
            countryId: user.address.countryId?.getValue() || null,
            stateId: user.address.stateId?.getValue() || null,
            city: user.address.city || null,
            street: user.address.street || null,
            exteriorNumber: user.address.exteriorNumber || null,
            interiorNumber: user.address.interiorNumber || null,
            postalCode: user.address.postalCode || null,
          },
        });
      }

      // Fetch the complete updated user with all relations
      const finalUser = await this.client.user.findUnique({
        where: { id: user.id.getValue() },
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
          company: true,
        },
      });

      return this.mapToModel(finalUser as UserWithRelations);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        await this.client.user.delete({
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
        hierarchyLevel: roleRecord.hierarchyLevel,
        isDefault: roleRecord.isDefault,
        isDefaultAppRole: roleRecord.isDefaultAppRole,
        permissions,
        createdAt: roleRecord.createdAt,
        updatedAt: roleRecord.updatedAt,
      });
    });

    // UserAddress entity is handled in the User.fromData method

    const user = User.fromData({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      firstName: record.firstName,
      lastName: record.lastName,
      secondLastName: record.secondLastName || undefined,
      alias: record.alias || undefined,
      isActive: record.isActive,
      emailVerified: record.emailVerified,
      otpEnabled: record.otpEnabled,
      otpSecret: record.otpSecret || undefined,
      roles,
      lastLoginAt: record.lastLoginAt || undefined,
      bannedUntil: record.bannedUntil || undefined,
      banReason: record.banReason || undefined,
      agentPhone: record.agentPhone || undefined,
      agentPhoneCountryCode: record.agentPhoneCountryCode || undefined,
      profile: record.profile
        ? {
            phone: record.profile.phone || undefined,
            phoneCountryCode: record.profile.phoneCountryCode || undefined,
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
      smsStatus: record.smsStatus,
      emailStatus: record.emailStatus,
      lastSmsError: record.lastSmsError || undefined,
      lastEmailError: record.lastEmailError || undefined,
    });

    return user;
  }
}
