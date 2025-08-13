import { BotToken } from '@core/entities/bot-token.entity';
import { BotTokenId } from '@core/value-objects/bot-token-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * BOT Token Repository Interface
 * Defines operations for BOT token persistence
 *
 * Implementations:
 * - {@link BotToken} - Production Prisma/PostgreSQL implementation
 */
export interface IBotTokenRepository {
  /**
   * Save BOT token to database
   */
  save(botToken: BotToken): Promise<void>;

  /**
   * Find BOT token by ID
   */
  findById(id: BotTokenId): Promise<BotToken | null>;

  /**
   * Find BOT token by token ID
   */
  findByTokenId(tokenId: string): Promise<BotToken | null>;

  /**
   * Find BOT token by session token ID (jti)
   */
  findBySessionTokenId(sessionTokenId: string): Promise<BotToken | null>;

  /**
   * Find all active BOT tokens
   */
  findAllActive(): Promise<BotToken[]>;

  /**
   * Find all revoked BOT tokens
   */
  findAllRevoked(): Promise<BotToken[]>;

  /**
   * Find all BOT tokens for a specific company
   */
  findByCompanyId(companyId: CompanyId): Promise<BotToken[]>;

  /**
   * Find all BOT tokens issued by a specific user
   */
  findByIssuedBy(issuedBy: UserId): Promise<BotToken[]>;

  /**
   * Get all revoked token IDs for cache loading
   */
  getRevokedTokenIds(): Promise<string[]>;

  /**
   * Get all active tokens with metadata for cache loading
   */
  getActiveTokensForCache(): Promise<
    Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }>
  >;

  /**
   * Mark token as revoked
   */
  revoke(tokenId: string, revokedBy: UserId, revokedAt: Date): Promise<void>;

  /**
   * Delete old revoked tokens (cleanup)
   */
  deleteOldRevokedTokens(olderThan: Date): Promise<number>;
}
