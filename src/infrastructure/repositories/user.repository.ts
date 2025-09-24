import { Injectable, Inject, Optional } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import {
  IUserRepository,
  ISearchUsersParams,
  ISearchUsersResult,
} from '@core/repositories/user.repository.interface';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
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
  Country as PrismaCountry,
  State as PrismaState,
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
  address?:
    | (PrismaUserAddress & {
        country?: PrismaCountry | null;
        state?: PrismaState | null;
      })
    | null;
};

@Injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
    @Optional() requestCache?: RequestCacheService,
  ) {
    logger?.setContext(UserRepository.name);
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
        orderBy: {
          createdAt: 'desc',
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
          address: {
            include: {
              country: true,
              state: true,
            },
          },
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
            address: {
              include: {
                country: true,
                state: true,
              },
            },
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
            address: {
              include: {
                country: true,
                state: true,
              },
            },
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
            address: {
              include: {
                country: true,
                state: true,
              },
            },
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
            address: {
              include: {
                country: true,
                state: true,
              },
            },
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
          address: {
            include: {
              country: true,
              state: true,
            },
          },
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
          address: {
            include: {
              country: true,
              state: true,
            },
          },
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
          address: {
            include: {
              country: true,
              state: true,
            },
          },
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
          address: {
            include: {
              country: true,
              state: true,
            },
          },
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
          address: {
            include: {
              country: true,
              state: true,
            },
          },
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
            countryName: record.address.country?.name || undefined,
            stateId: record.address.stateId || undefined,
            stateName: record.address.state?.name || undefined,
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

  async searchUsers(params: ISearchUsersParams): Promise<ISearchUsersResult> {
    return this.executeWithErrorHandling('searchUsers', async () => {
      // Validate and sanitize parameters
      const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
      const offset = Math.max(params.offset ?? 0, 0);

      // Build where conditions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereConditions: any = {
        // Company filter is required for multi-tenant isolation
        companyId: params.companyId,
      };

      // Active filter
      if (params.onlyActive) {
        whereConditions.isActive = true;
      }

      // Email verified filter
      if (params.onlyEmailVerified) {
        whereConditions.emailVerified = true;
      }

      // Search query filter
      if (params.query && params.query.trim()) {
        //const searchTerm = `%${params.query.trim()}%`;
        whereConditions.OR = [
          { firstName: { contains: params.query.trim(), mode: 'insensitive' } },
          { lastName: { contains: params.query.trim(), mode: 'insensitive' } },
          { secondLastName: { contains: params.query.trim(), mode: 'insensitive' } },
          { email: { contains: params.query.trim(), mode: 'insensitive' } },
          {
            company: {
              name: { contains: params.query.trim(), mode: 'insensitive' },
            },
          },
        ];
      }

      // Execute query with pagination - include all necessary relations for IUserDetailResponse
      const [users, totalCount] = await Promise.all([
        this.client.user.findMany({
          where: whereConditions,
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            company: {
              select: {
                name: true,
              },
            },
            profile: true,
            address: {
              include: {
                country: true,
                state: true,
              },
            },
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { createdAt: 'desc' }],
          take: limit,
          skip: offset,
        }),
        this.client.user.count({
          where: whereConditions,
        }),
      ]);

      // Map to IUserDetailResponse format
      const searchResults: IUserDetailResponse[] = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName || undefined,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        otpEnabled: user.otpEnabled,
        lastLoginAt: user.lastLoginAt || undefined,
        bannedUntil: user.bannedUntil || undefined,
        banReason: user.banReason || undefined,
        roles: user.roles.map(userRole => ({
          id: userRole.role.id,
          name: userRole.role.name,
        })),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        tenantId: user.companyId || undefined, // Using companyId as tenantId for multi-tenancy
        companyId: user.companyId || undefined,
        smsStatus: user.smsStatus || 'NOT_SENT',
        emailStatus: user.emailStatus || 'NOT_SENT',
        lastSmsError: user.lastSmsError || undefined,
        lastEmailError: user.lastEmailError || undefined,
        agentPhone: user.agentPhone || undefined,
        agentPhoneCountryCode: user.agentPhoneCountryCode || undefined,
        profile: user.profile
          ? {
              phone: user.profile.phone || undefined,
              phoneCountryCode: user.profile.phoneCountryCode || undefined,
              avatarUrl: user.profile.avatarUrl || undefined,
              bio: user.profile.bio || undefined,
              birthDate: user.profile.birthdate || undefined,
            }
          : undefined,
        address: user.address
          ? {
              countryId: user.address.countryId || undefined,
              countryName: user.address.country?.name || undefined,
              stateId: user.address.stateId || undefined,
              stateName: user.address.state?.name || undefined,
              city: user.address.city || undefined,
              street: user.address.street || undefined,
              exteriorNumber: user.address.exteriorNumber || undefined,
              interiorNumber: user.address.interiorNumber || undefined,
              postalCode: user.address.postalCode || undefined,
            }
          : undefined,
        // invitationStatus is calculated separately when needed
      }));

      const hasMore = offset + users.length < totalCount;

      return {
        users: searchResults,
        totalCount,
        hasMore,
      };
    });
  }

  async countByCompanyExcludingRoles(companyId: string, excludedRoles: string[]): Promise<number> {
    return this.executeWithErrorHandling('countByCompanyExcludingRoles', async () => {
      const count = await this.client.user.count({
        where: {
          companyId,
          isActive: true,
          roles: {
            none: {
              role: {
                name: {
                  in: excludedRoles,
                },
              },
            },
          },
        },
      });

      return count;
    });
  }
}
