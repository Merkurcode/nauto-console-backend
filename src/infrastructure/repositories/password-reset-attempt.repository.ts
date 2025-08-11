import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IPasswordResetAttemptRepository } from '@core/repositories/password-reset-attempt.repository.interface';
import { PasswordResetAttempt } from '@core/entities/password-reset-attempt.entity';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class PasswordResetAttemptRepository
  extends BaseRepository<PasswordResetAttempt>
  implements IPasswordResetAttemptRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    super(logger);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findByEmail(email: string): Promise<PasswordResetAttempt[]> {
    return this.executeWithErrorHandling(
      'findByEmail',
      async () => {
        const attempts = await this.client.passwordResetAttempt.findMany({
          where: { email },
          orderBy: { createdAt: 'desc' },
        });

        return attempts.map(
          attempt =>
            new PasswordResetAttempt(
              attempt.email,
              attempt.ipAddress || undefined,
              attempt.userAgent || undefined,
              attempt.id,
              attempt.createdAt,
            ),
        );
      },
      [],
      email,
    ) as Promise<PasswordResetAttempt[]>;
  }

  async findByEmailInLast24Hours(email: string): Promise<PasswordResetAttempt[]> {
    return this.executeWithErrorHandling(
      'findByEmailInLast24Hours',
      async () => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const attempts = await this.client.passwordResetAttempt.findMany({
          where: {
            email,
            createdAt: {
              gte: twentyFourHoursAgo,
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return attempts.map(
          attempt =>
            new PasswordResetAttempt(
              attempt.email,
              attempt.ipAddress || undefined,
              attempt.userAgent || undefined,
              attempt.id,
              attempt.createdAt,
            ),
        );
      },
      [],
      email,
    ) as Promise<PasswordResetAttempt[]>;
  }

  async findByIpInLast24Hours(ipAddress: string): Promise<PasswordResetAttempt[]> {
    return this.executeWithErrorHandling(
      'findByIpInLast24Hours',
      async () => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const attempts = await this.client.passwordResetAttempt.findMany({
          where: {
            ipAddress,
            createdAt: {
              gte: twentyFourHoursAgo,
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return attempts.map(
          attempt =>
            new PasswordResetAttempt(
              attempt.email,
              attempt.ipAddress || undefined,
              attempt.userAgent || undefined,
              attempt.id,
              attempt.createdAt,
            ),
        );
      },
      [],
      ipAddress,
    ) as Promise<PasswordResetAttempt[]>;
  }

  async create(attempt: PasswordResetAttempt): Promise<PasswordResetAttempt> {
    return this.executeWithErrorHandling(
      'create',
      async () => {
        const createdAttempt = await this.client.passwordResetAttempt.create({
          data: {
            id: attempt.id,
            email: attempt.email,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            createdAt: attempt.createdAt,
          },
        });

        return new PasswordResetAttempt(
          createdAttempt.email,
          createdAttempt.ipAddress || undefined,
          createdAttempt.userAgent || undefined,
          createdAttempt.id,
          createdAttempt.createdAt,
        );
      },
      undefined,
      attempt.id,
    ) as Promise<PasswordResetAttempt>;
  }

  async countByEmailToday(email: string): Promise<number> {
    return this.executeWithErrorHandling(
      'countByEmailToday',
      async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        return await this.client.passwordResetAttempt.count({
          where: {
            email,
            createdAt: {
              gte: startOfDay,
            },
          },
        });
      },
      0,
      email,
    ) as Promise<number>;
  }

  async countByIpToday(ipAddress: string): Promise<number> {
    return this.executeWithErrorHandling(
      'countByIpToday',
      async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        return await this.client.passwordResetAttempt.count({
          where: {
            ipAddress,
            createdAt: {
              gte: startOfDay,
            },
          },
        });
      },
      0,
      ipAddress,
    ) as Promise<number>;
  }
}
