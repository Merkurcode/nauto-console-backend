import { Otp } from '../entities/otp.entity';

/**
 * OTP (One-Time Password) repository interface
 *
 * Implementations:
 * - {@link Otp} - Production Prisma/PostgreSQL implementation
 */
export interface IOtpRepository {
  findById(id: string): Promise<Otp | null>;
  findByUserId(userId: string): Promise<Otp | null>;
  create(otp: Otp): Promise<Otp>;
  update(otp: Otp): Promise<Otp>;
  delete(id: string): Promise<boolean>;
}
