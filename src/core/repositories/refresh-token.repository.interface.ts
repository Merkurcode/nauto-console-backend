import { RefreshToken } from '../entities/refresh-token.entity';

/**
 * Refresh token repository interface
 *
 * Implementations:
 * - {@link RefreshToken} - Production Prisma/PostgreSQL implementation
 */
export interface IRefreshTokenRepository {
  findById(id: string): Promise<RefreshToken | null>;
  findByToken(token: string): Promise<RefreshToken | null>;
  findByUserId(userId: string): Promise<RefreshToken[]>;
  create(token: RefreshToken): Promise<RefreshToken>;
  update(token: RefreshToken): Promise<RefreshToken>;
  deleteByUserId(userId: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}
