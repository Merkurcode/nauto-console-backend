import { PasswordReset } from '../entities/password-reset.entity';

/**
 * Password reset repository interface
 *
 * Implementations:
 * - {@link PasswordReset} - Production Prisma/PostgreSQL implementation
 */
export interface IPasswordResetRepository {
  findById(id: string): Promise<PasswordReset | null>;
  findByUserId(userId: string): Promise<PasswordReset | null>;
  findByToken(token: string): Promise<PasswordReset | null>;
  findByEmail(email: string): Promise<PasswordReset | null>;
  create(passwordReset: PasswordReset): Promise<PasswordReset>;
  update(passwordReset: PasswordReset): Promise<PasswordReset>;
  delete(id: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<boolean>;
  deleteByEmail(email: string): Promise<boolean>;
}
