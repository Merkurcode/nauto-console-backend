import { BotToken } from '@core/entities/bot-token.entity';
import { BotTokenId } from '@core/value-objects/bot-token-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * BotToken Mapper
 * Handles conversion between database records and domain entities
 */
export class BotTokenMapper {
  /**
   * Convert database record to domain entity
   */
  static toDomain(record: {
    id: string;
    tokenId: string;
    sessionTokenId: string;
    botUserId: string;
    botEmail: string;
    companyId: string | null;
    issuedBy: string;
    issuedAt: Date;
    revokedAt: Date | null;
    revokedBy: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): BotToken {
    return new BotToken(
      BotTokenId.fromString(record.id),
      record.tokenId,
      record.sessionTokenId,
      UserId.fromString(record.botUserId),
      record.botEmail,
      UserId.fromString(record.issuedBy),
      record.issuedAt,
      record.companyId ? CompanyId.fromString(record.companyId) : undefined,
      record.revokedAt,
      record.revokedBy ? UserId.fromString(record.revokedBy) : undefined,
      record.isActive,
    );
  }

  /**
   * Convert domain entity to database record for create operations
   */
  static toPersistence(botToken: BotToken): {
    id: string;
    tokenId: string;
    sessionTokenId: string;
    botUserId: string;
    botEmail: string;
    companyId: string | null;
    issuedBy: string;
    issuedAt: Date;
    revokedAt: Date | null;
    revokedBy: string | null;
    isActive: boolean;
  } {
    return {
      id: botToken.id.getValue(),
      tokenId: botToken.tokenId,
      sessionTokenId: botToken.sessionTokenId,
      botUserId: botToken.botUserId.getValue(),
      botEmail: botToken.botEmail,
      companyId: botToken.companyId?.getValue() || null,
      issuedBy: botToken.issuedBy.getValue(),
      issuedAt: botToken.issuedAt,
      revokedAt: botToken.revokedAt || null,
      revokedBy: botToken.revokedBy?.getValue() || null,
      isActive: botToken.isActive,
    };
  }

  /**
   * Convert domain entity to cache format
   */
  static toCacheFormat(botToken: BotToken): {
    tokenId: string;
    botUserId: string;
    companyId?: string;
    createdAt: Date;
  } {
    return {
      tokenId: botToken.tokenId,
      botUserId: botToken.botUserId.getValue(),
      companyId: botToken.companyId?.getValue(),
      createdAt: botToken.issuedAt,
    };
  }

  /**
   * Convert domain entity to response format
   */
  static toResponse(botToken: BotToken): {
    id: string;
    tokenId: string;
    botUserId: string;
    botEmail: string;
    companyId?: string;
    issuedBy: string;
    issuedAt: Date;
    revokedAt?: Date;
    revokedBy?: string;
    isActive: boolean;
  } {
    return {
      id: botToken.id.getValue(),
      tokenId: botToken.tokenId,
      botUserId: botToken.botUserId.getValue(),
      botEmail: botToken.botEmail,
      companyId: botToken.companyId?.getValue(),
      issuedBy: botToken.issuedBy.getValue(),
      issuedAt: botToken.issuedAt,
      revokedAt: botToken.revokedAt,
      revokedBy: botToken.revokedBy?.getValue(),
      isActive: botToken.isActive,
    };
  }
}
