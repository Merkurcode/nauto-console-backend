import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { IBotTokenRepository } from '@core/repositories/bot-token.repository.interface';
import { BotToken } from '@core/entities/bot-token.entity';
import { BotTokenId } from '@core/value-objects/bot-token-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { BotTokenMapper } from '@application/mappers/bot-token.mapper';

/**
 * BOT Token Repository Implementation
 * Uses Prisma for database operations
 */
@Injectable()
export class BotTokenRepository implements IBotTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(botToken: BotToken): Promise<void> {
    const persistenceData = BotTokenMapper.toPersistence(botToken);

    await this.prisma.botToken.upsert({
      where: { id: persistenceData.id },
      update: persistenceData,
      create: persistenceData,
    });
  }

  async findById(id: BotTokenId): Promise<BotToken | null> {
    const record = await this.prisma.botToken.findUnique({
      where: { id: id.getValue() },
    });

    return record ? BotTokenMapper.toDomain(record) : null;
  }

  async findByTokenId(tokenId: string): Promise<BotToken | null> {
    const record = await this.prisma.botToken.findFirst({
      where: { tokenId },
    });

    return record ? BotTokenMapper.toDomain(record) : null;
  }

  async findBySessionTokenId(sessionTokenId: string): Promise<BotToken | null> {
    const record = await this.prisma.botToken.findUnique({
      where: { sessionTokenId },
    });

    return record ? BotTokenMapper.toDomain(record) : null;
  }

  async findAllActive(): Promise<BotToken[]> {
    const records = await this.prisma.botToken.findMany({
      where: {
        isActive: true,
        revokedAt: null,
      },
      orderBy: { issuedAt: 'desc' },
    });

    return records.map(record => BotTokenMapper.toDomain(record));
  }

  async findAllRevoked(): Promise<BotToken[]> {
    const records = await this.prisma.botToken.findMany({
      where: {
        OR: [{ isActive: false }, { revokedAt: { not: null } }],
      },
      orderBy: { revokedAt: 'desc' },
    });

    return records.map(record => BotTokenMapper.toDomain(record));
  }

  async findByCompanyId(companyId: CompanyId): Promise<BotToken[]> {
    const records = await this.prisma.botToken.findMany({
      where: { companyId: companyId.getValue() },
      orderBy: { issuedAt: 'desc' },
    });

    return records.map(record => BotTokenMapper.toDomain(record));
  }

  async findByIssuedBy(issuedBy: UserId): Promise<BotToken[]> {
    const records = await this.prisma.botToken.findMany({
      where: { issuedBy: issuedBy.getValue() },
      orderBy: { issuedAt: 'desc' },
    });

    return records.map(record => BotTokenMapper.toDomain(record));
  }

  async getRevokedTokenIds(): Promise<string[]> {
    const records = await this.prisma.botToken.findMany({
      where: {
        OR: [{ isActive: false }, { revokedAt: { not: null } }],
      },
      select: { tokenId: true },
    });

    return records.map(record => record.tokenId);
  }

  async getActiveTokensForCache(): Promise<
    Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }>
  > {
    const records = await this.prisma.botToken.findMany({
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
  }

  async revoke(tokenId: string, revokedBy: UserId, revokedAt: Date): Promise<void> {
    await this.prisma.botToken.update({
      where: { tokenId },
      data: {
        isActive: false,
        revokedAt,
        revokedBy: revokedBy.getValue(),
      },
    });
  }

  async deleteOldRevokedTokens(olderThan: Date): Promise<number> {
    const result = await this.prisma.botToken.deleteMany({
      where: {
        isActive: false,
        revokedAt: { lt: olderThan },
      },
    });

    return result.count;
  }
}
