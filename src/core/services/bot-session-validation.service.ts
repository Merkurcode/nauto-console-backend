import { Injectable, Inject } from '@nestjs/common';
import { IBotTokenRepository } from '@core/repositories/bot-token.repository.interface';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, BOT_TOKEN_REPOSITORY } from '@shared/constants/tokens';
import {
  EntityNotFoundException,
  InvalidSessionException,
} from '@core/exceptions/domain-exceptions';

/**
 * BOT Session Validation Service
 * Manages BOT token lifecycle and session validation
 */
@Injectable()
export class BotSessionValidationService {
  constructor(
    @Inject(BOT_TOKEN_REPOSITORY)
    private readonly botTokenRepository: IBotTokenRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(BotSessionValidationService.name);
  }

  /**
   * Validates BOT session token (jti) to ensure token is still active
   * Unlike regular user sessions, BOT sessions are validated against token status
   */
  async validateBotSession(sessionTokenId: string, tokenId: string): Promise<void> {
    try {
      // Find BOT token by session token ID
      const botToken = await this.botTokenRepository.findBySessionTokenId(sessionTokenId);

      if (!botToken) {
        this.logger.warn({
          message: 'BOT session validation failed - session token not found',
          sessionTokenId: sessionTokenId.substring(0, 8) + '***',
          tokenId: tokenId.substring(0, 8) + '***',
        });
        throw new EntityNotFoundException('BOT Session', sessionTokenId);
      }

      // Verify token is still active
      if (!botToken.isValid()) {
        this.logger.warn({
          message: 'BOT session validation failed - token revoked or inactive',
          sessionTokenId: sessionTokenId.substring(0, 8) + '***',
          tokenId: tokenId.substring(0, 8) + '***',
          isActive: botToken.isActive,
          revokedAt: botToken.revokedAt,
        });
        throw new InvalidSessionException('BOT token has been revoked or is inactive');
      }

      // Verify session token matches the current token
      if (botToken.tokenId !== tokenId) {
        this.logger.warn({
          message: 'BOT session validation failed - token mismatch',
          sessionTokenId: sessionTokenId.substring(0, 8) + '***',
          providedTokenId: tokenId.substring(0, 8) + '***',
          actualTokenId: botToken.tokenId.substring(0, 8) + '***',
        });
        throw new InvalidSessionException('BOT session token mismatch');
      }

      // Optional: Update last activity (for analytics)
      await this.updateBotTokenActivity(botToken.id.getValue());

      this.logger.debug({
        message: 'BOT session validated successfully',
        sessionTokenId: sessionTokenId.substring(0, 8) + '***',
        tokenId: tokenId.substring(0, 8) + '***',
        botUserId: botToken.botUserId.getValue(),
        companyId: botToken.companyId?.getValue(),
      });
    } catch (error) {
      this.logger.error({
        message: 'BOT session validation error',
        sessionTokenId: sessionTokenId.substring(0, 8) + '***',
        tokenId: tokenId.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Updates BOT token last activity timestamp for analytics
   * This is optional and doesn't affect security
   */
  private async updateBotTokenActivity(botTokenId: string): Promise<void> {
    try {
      // This could update a lastActivity field if needed for analytics
      // For now, we just log the activity
      this.logger.debug({
        message: 'BOT token activity recorded',
        botTokenId: botTokenId.substring(0, 8) + '***',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Non-critical error - don't fail the validation
      this.logger.warn({
        message: 'Failed to update BOT token activity',
        botTokenId: botTokenId.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validates if a BOT token exists and is active
   * Used for quick token status checks
   */
  async isBotTokenActive(tokenId: string): Promise<boolean> {
    try {
      const botToken = await this.botTokenRepository.findByTokenId(tokenId);

      return botToken ? botToken.isValid() : false;
    } catch (error) {
      this.logger.warn({
        message: 'Error checking BOT token status',
        tokenId: tokenId.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }
}
