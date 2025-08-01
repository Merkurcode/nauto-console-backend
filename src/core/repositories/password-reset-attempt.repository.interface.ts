import { PasswordResetAttempt } from '../entities/password-reset-attempt.entity';

/**
 * Password reset attempt repository interface
 */
export interface IPasswordResetAttemptRepository {
  findByEmail(email: string): Promise<PasswordResetAttempt[]>;
  findByEmailInLast24Hours(email: string): Promise<PasswordResetAttempt[]>;
  findByIpInLast24Hours(ipAddress: string): Promise<PasswordResetAttempt[]>;
  create(attempt: PasswordResetAttempt): Promise<PasswordResetAttempt>;
  countByEmailToday(email: string): Promise<number>;
  countByIpToday(ipAddress: string): Promise<number>;
}
