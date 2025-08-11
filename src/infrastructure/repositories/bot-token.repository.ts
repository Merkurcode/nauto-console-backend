import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { IBotTokenRepository } from '@core/repositories/bot-token.repository.interface';
import { BotToken } from '@core/entities/bot-token.entity';
import { BotTokenId } from '@core/value-objects/bot-token-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { BotTokenMapper } from '@application/mappers/bot-token.mapper';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

/**
 * BOT Token Repository Implementation
 */
@Injectable()
export class BotTokenRepository extends BaseRepository<BotToken> implements IBotTokenRepository {
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

  async save(botToken: BotToken): Promise<void> {
    return this.executeWithErrorHandling('save', async () => {
      const persistenceData = BotTokenMapper.toPersistence(botToken);

      await this.client.botToken.upsert({
        where: { id: persistenceData.id },
        update: persistenceData,
        create: persistenceData,
      });
    });
  }

  async findById(id: BotTokenId): Promise<BotToken | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const record = await this.client.botToken.findUnique({
        where: { id: id.getValue() },
      });

      return record ? BotTokenMapper.toDomain(record) : null;
    });
  }

  async findByTokenId(tokenId: string): Promise<BotToken | null> {
    return this.executeWithErrorHandling('findByTokenId', async () => {
      const record = await this.client.botToken.findFirst({
        where: { tokenId },
      });

      return record ? BotTokenMapper.toDomain(record) : null;
    });
  }

  async findBySessionTokenId(sessionTokenId: string): Promise<BotToken | null> {
    return this.executeWithErrorHandling('findBySessionTokenId', async () => {
      const record = await this.client.botToken.findUnique({
        where: { sessionTokenId },
      });

      return record ? BotTokenMapper.toDomain(record) : null;
    });
  }

  async findAllActive(): Promise<BotToken[]> {
    return this.executeWithErrorHandling('findAllActive', async () => {
      const records = await this.client.botToken.findMany({
        where: {
          isActive: true,
          revokedAt: null,
        },
        orderBy: { issuedAt: 'desc' },
      });

      return records.map(record => BotTokenMapper.toDomain(record));
    });
  }

  async findAllRevoked(): Promise<BotToken[]> {
    return this.executeWithErrorHandling('findAllRevoked', async () => {
      const records = await this.client.botToken.findMany({
        where: {
          OR: [{ isActive: false }, { revokedAt: { not: null } }],
        },
        orderBy: { revokedAt: 'desc' },
      });

      return records.map(record => BotTokenMapper.toDomain(record));
    });
  }

  async findByCompanyId(companyId: CompanyId): Promise<BotToken[]> {
    return this.executeWithErrorHandling('findByCompanyId', async () => {
      const records = await this.client.botToken.findMany({
        where: { companyId: companyId.getValue() },
        orderBy: { issuedAt: 'desc' },
      });

      return records.map(record => BotTokenMapper.toDomain(record));
    });
  }

  async findByIssuedBy(issuedBy: UserId): Promise<BotToken[]> {
    return this.executeWithErrorHandling('findByIssuedBy', async () => {
      const records = await this.client.botToken.findMany({
        where: { issuedBy: issuedBy.getValue() },
        orderBy: { issuedAt: 'desc' },
      });

      return records.map(record => BotTokenMapper.toDomain(record));
    });
  }

  async getRevokedTokenIds(): Promise<string[]> {
    return this.executeWithErrorHandling('getRevokedTokenIds', async () => {
      const records = await this.client.botToken.findMany({
        where: {
          OR: [{ isActive: false }, { revokedAt: { not: null } }],
        },
        select: { tokenId: true },
      });

      return records.map(record => record.tokenId);
    });
  }

  async getActiveTokensForCache(): Promise<
    Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }>
  > {
    return this.executeWithErrorHandling('getActiveTokensForCache', async () => {
      const records = await this.client.botToken.findMany({
        where: {
          isActive: true,
          revokedAt: null,
        },
        select: {
          tokenId: true,
          botUserId: true,
          companyId: true,
          issuedAt: true,
        },
      });

      return records.map(record => ({
        tokenId: record.tokenId,
        botUserId: record.botUserId,
        companyId: record.companyId || undefined,
        createdAt: record.issuedAt,
      }));
    });
  }

  async revoke(tokenId: string, revokedBy: UserId, revokedAt: Date): Promise<void> {
    return this.executeWithErrorHandling('revoke', async () => {
      await this.client.botToken.update({
        where: { tokenId },
        data: {
          isActive: false,
          revokedAt,
          revokedBy: revokedBy.getValue(),
        },
      });
    });
  }

  async deleteOldRevokedTokens(olderThan: Date): Promise<number> {
    return this.executeWithErrorHandling('deleteOldRevokedTokens', async () => {
      const result = await this.client.botToken.deleteMany({
        where: {
          isActive: false,
          revokedAt: { lt: olderThan },
        },
      });

      return result.count;
    });
  }
}
