import { Injectable, Inject, Optional } from '@nestjs/common';
import { EmailVerification } from '@core/entities/email-verification.entity';
import { IEmailVerificationRepository } from '@core/repositories/email-verification.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { Email } from '@core/value-objects/email.vo';
import { VerificationCode } from '@core/value-objects/verification-code.vo';
import { EmailVerification as PrismaEmailVerification } from '@prisma/client';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class EmailVerificationRepository
  extends BaseRepository<EmailVerification>
  implements IEmailVerificationRepository
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

  async findById(id: string): Promise<EmailVerification | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const record = await this.client.emailVerification.findUnique({
        where: { id },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async findByEmail(email: string): Promise<EmailVerification | null> {
    return this.executeWithErrorHandling('findByEmail', async () => {
      const record = await this.client.emailVerification.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async findByEmailAndCode(email: string, code: string): Promise<EmailVerification | null> {
    return this.executeWithErrorHandling('findByEmailAndCode', async () => {
      const record = await this.client.emailVerification.findFirst({
        where: {
          email,
          code,
        },
        orderBy: { createdAt: 'desc' },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async create(emailVerification: EmailVerification): Promise<EmailVerification> {
    return this.executeWithErrorHandling('create', async () => {
      await this.client.emailVerification.create({
        data: {
          id: emailVerification.id,
          email: emailVerification.email.getValue(),
          code: emailVerification.code.getValue(),
          expiresAt: emailVerification.expiresAt,
          verifiedAt: emailVerification.verifiedAt,
          createdAt: emailVerification.createdAt,
        },
      });

      return emailVerification;
    });
  }

  async update(emailVerification: EmailVerification): Promise<EmailVerification> {
    return this.executeWithErrorHandling('update', async () => {
      await this.client.emailVerification.update({
        where: { id: emailVerification.id },
        data: {
          email: emailVerification.email.getValue(),
          code: emailVerification.code.getValue(),
          expiresAt: emailVerification.expiresAt,
          verifiedAt: emailVerification.verifiedAt,
        },
      });

      return emailVerification;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        await this.client.emailVerification.delete({
          where: { id },
        });

        return true;
      },
      false,
    );
  }

  async deleteByEmail(email: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'deleteByEmail',
      async () => {
        await this.client.emailVerification.deleteMany({
          where: { email },
        });

        return true;
      },
      false,
    );
  }

  private mapToModel(record: PrismaEmailVerification): EmailVerification {
    // Create value objects from primitive values
    const emailVO = new Email(record.email);
    const codeVO = new VerificationCode(record.code);

    const verification = new EmailVerification(
      emailVO,
      codeVO,
      0, // We don't need to specify expiration here as we're loading from DB
    );

    verification.id = record.id;
    verification.expiresAt = record.expiresAt;
    verification.verifiedAt = record.verifiedAt;
    verification.createdAt = record.createdAt;

    return verification;
  }
}
