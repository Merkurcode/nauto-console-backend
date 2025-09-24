import { User } from '../entities/user.entity';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';

export interface ISearchUsersParams {
  query?: string;
  companyId: string; // Required for multi-tenant isolation
  limit: number;
  offset: number;
  onlyActive: boolean;
  onlyEmailVerified: boolean;
}

export interface ISearchUsersResult {
  users: IUserDetailResponse[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * User repository interface
 *
 * Implementations:
 * - {@link User} - Production Prisma/PostgreSQL implementation
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByAlias(alias: string): Promise<User | null>;
  findByAgentPhoneAndCompany(agentPhone: string, companyId: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findAllByCompanyId(companyId: string): Promise<User[]>;
  findUsersByRoleId(roleId: string): Promise<User[]>;
  getUserPhoneCountryCode(userId: string): Promise<string | null>;
  searchUsers(params: ISearchUsersParams): Promise<ISearchUsersResult>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<boolean>;
  countByCompanyExcludingRoles(companyId: string, excludedRoles: string[]): Promise<number>;
}
