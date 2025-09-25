import { Session } from '@core/entities/session.entity';

/**
 * Session repository interface
 *
 * Implementations:
 * - {@link Sessions} - Production Prisma/PostgreSQL implementation
 */
export interface ISessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findBySessionToken(sessionToken: string): Promise<Session | null>;
  findByRefreshToken(refreshToken: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  update(session: Session): Promise<Session>;
  delete(id: string): Promise<number>;
  deleteByUserId(userId: string): Promise<number>;
  deleteByUserIdExcept(userId: string, excludeSessionToken: string): Promise<number>;
  deleteBySessionToken(sessionToken: string): Promise<number>;
  deleteByRefreshToken(refreshToken: string): Promise<number>;
}
