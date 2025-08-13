import { EmailVerification } from '../entities/email-verification.entity';

/**
 * Email verification repository interface
 *
 * Implementations:
 * - {@link EmailVerification} - Production Prisma/PostgreSQL implementation
 */
export interface IEmailVerificationRepository {
  findById(id: string): Promise<EmailVerification | null>;
  findByEmail(email: string): Promise<EmailVerification | null>;
  findByEmailAndCode(email: string, code: string): Promise<EmailVerification | null>;
  create(emailVerification: EmailVerification): Promise<EmailVerification>;
  update(emailVerification: EmailVerification): Promise<EmailVerification>;
  delete(id: string): Promise<boolean>;
  deleteByEmail(email: string): Promise<boolean>;
}
