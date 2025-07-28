import { Session } from '@core/entities/session.entity';

export interface ISessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findBySessionToken(sessionToken: string): Promise<Session | null>;
  findByRefreshToken(refreshToken: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  update(session: Session): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteBySessionToken(sessionToken: string): Promise<void>;
  deleteByRefreshToken(refreshToken: string): Promise<void>;
}