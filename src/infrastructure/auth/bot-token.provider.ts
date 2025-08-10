import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ILogger } from '@core/interfaces/logger.interface';
import { IBotTokenProvider } from '@core/interfaces/bot-token-provider.interface';
import { IBotTokenRepository } from '@core/repositories/bot-token.repository.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { RolesEnum } from '@shared/constants/enums';
import { BOT_SPECIAL_PERMISSIONS } from '@shared/constants/bot-permissions';
import { BotTokenCacheService } from '@infrastructure/cache/bot-token-cache.service';
import { BotToken } from '@core/entities/bot-token.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { BotTokenMapper } from '@application/mappers/bot-token.mapper';

/**
 * Infrastructure implementation of BOT Token Provider
 * Optimized for HIGH CONCURRENCY and performance
 *
 * Key optimizations:
 * - In-memory cache for O(1) token validation
 * - No database calls during validation
 * - Minimal logging in hot paths
 * - Pre-loaded blacklist on startup
 */
@Injectable()
export class BotTokenProvider implements IBotTokenProvider, OnModuleInit {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly tokenCache: BotTokenCacheService,
    private readonly botTokenRepository: IBotTokenRepository,
  ) {
    this.logger.setContext(BotTokenProvider.name);
  }

  async onModuleInit() {
    // Load revoked and active tokens from database on startup
    // This prevents database calls during runtime validation
    try {
      const [revokedTokenIds, activeTokens] = await Promise.all([
        this.botTokenRepository.getRevokedTokenIds(),
        this.botTokenRepository.getActiveTokensForCache(),
      ]);

      await this.tokenCache.loadFromDatabase(revokedTokenIds, activeTokens);

      this.logger.debug({
        message: 'BOT token cache initialized from database',
        revokedCount: revokedTokenIds.length,
        activeCount: activeTokens.length,
      });
    } catch (error) {
      this.logger.error('Failed to initialize BOT token cache from database', error);
      // Initialize with empty cache as fallback
      await this.tokenCache.loadFromDatabase([], []);
    }
  }

  /**
   * Generate a BOT token (technical implementation)
   * Business validation must be done before calling this method
   */
  async generateToken(params: {
    botUserId: string;
    botEmail: string;
    tokenId: string;
    companyId?: string;
    issuedBy: string;
  }): Promise<{
    accessToken: string;
    expiresIn: string;
    tokenId: string;
  }> {
    const { botUserId, botEmail, tokenId, companyId, issuedBy } = params;

    // Generar session token (jti) para el BOT
    const sessionTokenId = randomUUID();

    // Create domain entity for persistence
    const botTokenEntity = BotToken.create(
      tokenId,
      sessionTokenId,
      UserId.fromString(botUserId),
      botEmail,
      UserId.fromString(issuedBy),
      companyId ? CompanyId.fromString(companyId) : undefined,
    );

    // Save to database
    await this.botTokenRepository.save(botTokenEntity);

    // Construir payload del token BOT con permisos especiales OCULTOS
    const botPayload = {
      sub: botUserId,
      email: botEmail,
      isBanned: false, // BOT tokens are never banned
      bannedUntil: null,
      banReason: null,
      emailVerified: true,
      isActive: true,
      roles: [RolesEnum.BOT, RolesEnum.ROOT], // BOT + ROOT roles
      permissions: [BOT_SPECIAL_PERMISSIONS.ALL_ACCESS], // Permiso oculto y no asignable
      tenantId: companyId || null,
      companyId: companyId || null,
      tokenType: 'bot',
      tokenId,
      isBotToken: true, // Flag to identify BOT tokens
      jti: sessionTokenId, // Session token para validación de sesión activa
      iat: Math.floor(Date.now() / 1000),
    };

    // Generar token SIN expiración (infinito)
    const accessToken = this.jwtService.sign(botPayload, {
      secret: this.configService.get('jwt.secret'),
      algorithm: this.configService.get('JWT_ALGORITHM', 'HS512'),
      // Sin expiresIn = token infinito
    });

    // Add to active tokens cache (security check included)
    const cacheAdded = this.tokenCache.addActiveToken(tokenId, botUserId, companyId);
    if (!cacheAdded) {
      // This should never happen with proper UUID generation,
      // but provides security against token ID collision with revoked tokens
      this.logger.error({
        message: 'Failed to add BOT token to cache - token may be revoked',
        tokenId,
      });
    }

    // Minimal logging - avoid in hot path if possible
    if (this.configService.get('logging.verbose', false)) {
      this.logger.debug({
        message: 'BOT token generated',
        tokenId,
        companyId,
        expiresIn: 'never',
      });
    }

    return {
      accessToken,
      expiresIn: 'never', // Token sin expiración
      tokenId,
    };
  }

  /**
   * Validate a BOT token - OPTIMIZED for high concurrency
   * This is the HOT PATH - called on every BOT request
   */
  async validateToken(token: string): Promise<any | null> {
    try {
      // SECURITY FIX: Verify JWT signature FIRST before trusting any claims
      const verified = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
        ignoreExpiration: true, // BOT tokens don't expire
      });

      // Now we can trust the verified claims
      if (!verified || verified.tokenType !== 'bot' || !verified.tokenId) {
        return null;
      }

      // Check if token is revoked (now using verified tokenId)
      if (this.tokenCache.isTokenRevoked(verified.tokenId)) {
        return null; // Token is blacklisted
      }

      // Final validation
      if (
        !verified.roles?.includes(RolesEnum.BOT) ||
        !verified.permissions?.includes(BOT_SPECIAL_PERMISSIONS.ALL_ACCESS)
      ) {
        return null;
      }

      // NO LOGGING in hot path - this kills performance at scale
      // If needed, use sampling (e.g., log 1 in 1000 requests)

      return verified;
    } catch (error) {
      // Only log errors, not successful validations
      if (this.configService.get('logging.logTokenErrors', false)) {
        this.logger.error({
          message: 'BOT token validation failed',
          error: error.message,
        });
      }

      return null;
    }
  }

  /**
   * Revoke a BOT token (technical implementation)
   */
  async revokeToken(tokenId: string, revokedBy?: string): Promise<boolean> {
    try {
      // Find the token first
      const botToken = await this.botTokenRepository.findByTokenId(tokenId);
      if (!botToken || !botToken.isValid()) {
        return false; // Token not found or already revoked
      }

      // Revoke in database
      const revokedByUserId = revokedBy ? UserId.fromString(revokedBy) : botToken.issuedBy;
      await this.botTokenRepository.revoke(tokenId, revokedByUserId, new Date());

      // Update cache immediately for high-performance validation
      this.tokenCache.forceRevokeToken(tokenId);

      this.logger.debug({
        message: 'BOT token revoked successfully',
        tokenId,
        revokedBy: revokedByUserId.getValue(),
      });

      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to revoke BOT token',
        tokenId,
        error: error.message,
      });

      return false;
    }
  }

  /**
   * List active BOT tokens (technical implementation)
   */
  async listActiveTokens(): Promise<
    Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }>
  > {
    try {
      // Get from database for accurate data
      const activeTokens = await this.botTokenRepository.findAllActive();

      return activeTokens.map(token => BotTokenMapper.toCacheFormat(token));
    } catch (error) {
      this.logger.error({
        message: 'Failed to list active BOT tokens',
        error: error.message,
      });

      return [];
    }
  }

  /**
   * Refresh cache from database
   * Called by ROOT users to update cache manually
   */
  async refreshTokenCache(): Promise<{
    previousCounts: { revoked: number; active: number };
    newCounts: { revoked: number; active: number };
    refreshedAt: Date;
  }> {
    return this.tokenCache.refreshCacheFromDatabase(async () => {
      const [revokedTokenIds, activeTokens] = await Promise.all([
        this.botTokenRepository.getRevokedTokenIds(),
        this.botTokenRepository.getActiveTokensForCache(),
      ]);

      return { revokedTokenIds, activeTokens };
    });
  }

  /**
   * Get cache stats for monitoring
   */
  getCacheStats() {
    return this.tokenCache.getCacheStats();
  }

  /**
   * Manual cleanup of old revoked tokens from database and cache
   * Only ROOT users should be able to call this
   * Keeps active tokens indefinitely - only cleans old revoked tokens
   */
  async cleanupOldRevokedTokens(): Promise<{
    deletedFromDb: number;
    removedFromCache: number;
    remainingRevoked: number;
    remainingActive: number;
  }> {
    return this.tokenCache.manualCleanup(async (olderThan: Date) => {
      // Delete old revoked tokens from database
      const deletedFromDb = await this.botTokenRepository.deleteOldRevokedTokens(olderThan);

      // Get remaining revoked tokens that should be kept in cache
      const revokedTokensToKeep = await this.botTokenRepository.getRevokedTokenIds();

      return {
        deletedFromDb,
        revokedTokensToKeep,
      };
    });
  }
}
