import { User } from '../entities/user.entity';

/**
 * User repository interface
 *
 * Implementations:
 * - {@link UserRepository} - Production Prisma/PostgreSQL implementation
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByAgentPhoneAndCompany(agentPhone: string, companyId: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findAllByCompanyId(companyId: string): Promise<User[]>;
  findUsersByRoleId(roleId: string): Promise<User[]>;
  getUserPhoneCountryCode(userId: string): Promise<string | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<boolean>;
}
