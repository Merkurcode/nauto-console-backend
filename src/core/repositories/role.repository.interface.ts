import { Role } from '../entities/role.entity';

/**
 * Role repository interface
 *
 * Implementations:
 * - {@link Role} - Production Prisma/PostgreSQL implementation
 */
export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  findDefaultRole(): Promise<Role | null>;
  create(role: Role): Promise<Role>;
  update(role: Role): Promise<Role>;
  delete(id: string): Promise<boolean>;
}
