import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * High-performance in-memory cache for BOT tokens
 * Optimized for high concurrency with minimal overhead
 *
 * Features:
 * - O(1) lookup for token validation
 * - No database calls for revoked tokens check
 * - Manual memory management via clearCache() or refreshCacheFromDatabase()
 * - Thread-safe operations
 */
@Injectable()
export class BotTokenCacheService implements OnModuleDestroy {
  // Revoked tokens cache - Set for O(1) lookup
  private readonly revokedTokens = new Set<string>();

  // Active tokens cache - Map for quick access
  private readonly activeTokens = new Map<
    string,
    {
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }
  >();

  constructor() {
    // No automatic cleanup - BOT tokens are permanent until manually revoked
    // Use clearCache() or refreshCacheFromDatabase() for manual memory management
  }

  onModuleDestroy() {
    // No cleanup interval to clear
  }

  /**
   * Check if token is revoked - O(1) operation
   * This is the most frequent operation, must be ultra-fast
   */
  isTokenRevoked(tokenId: string): boolean {
    return this.revokedTokens.has(tokenId);
  }

  /**
   * Add token to revoked list
   * Called when token is revoked
   */
  addRevokedToken(tokenId: string): void {
    this.revokedTokens.add(tokenId);
    // Also remove from active tokens
    this.activeTokens.delete(tokenId);
  }

  /**
   * Add active token to cache
   * Called when new token is generated
   * Prevents adding revoked tokens back to active list
   */
  addActiveToken(tokenId: string, botUserId: string, companyId?: string): boolean {
    // Security check: cannot add revoked token back to active
    if (this.revokedTokens.has(tokenId)) {
      return false; // Token is revoked, cannot be activated
    }

    this.activeTokens.set(tokenId, {
      botUserId,
      companyId,
      createdAt: new Date(),
    });

    return true;
  }

  /**
   * Get active tokens list (for admin UI only)
   * Should NOT be called in high-frequency paths
   */
  getActiveTokens(): Array<{
    tokenId: string;
    botUserId: string;
    companyId?: string;
    createdAt: Date;
  }> {
    const tokens: Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }> = [];

    this.activeTokens.forEach((value, tokenId) => {
      tokens.push({
        tokenId,
        ...value,
      });
    });

    return tokens;
  }

  /**
   * Load initial data from database (called on startup)
   * This prevents database hits during normal operation
   */
  async loadFromDatabase(
    revokedTokenIds: string[],
    activeTokens: Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }>,
  ): Promise<void> {
    // Clear existing data
    this.clearCache();

    // Load revoked tokens first (using existing method)
    revokedTokenIds.forEach(tokenId => {
      this.addRevokedToken(tokenId);
    });

    // Load active tokens (using existing method with security checks)
    activeTokens.forEach(token => {
      this.addActiveToken(token.tokenId, token.botUserId, token.companyId);
    });
  }

  /**
   * Get cache stats (for monitoring)
   */
  getCacheStats() {
    return {
      revokedCount: this.revokedTokens.size,
      activeCount: this.activeTokens.size,
    };
  }

  /**
   * Clear all cache (use with caution)
   */
  clearCache(): void {
    this.revokedTokens.clear();
    this.activeTokens.clear();
  }

  /**
   * Refresh cache from database
   * Thread-safe operation that reloads token lists
   * Should be called by ROOT users when cache needs updating
   */
  async refreshCacheFromDatabase(
    dataProvider: () => Promise<{
      revokedTokenIds: string[];
      activeTokens: Array<{
        tokenId: string;
        botUserId: string;
        companyId?: string;
        createdAt: Date;
      }>;
    }>,
  ): Promise<{
    previousCounts: {
      revoked: number;
      active: number;
    };
    newCounts: {
      revoked: number;
      active: number;
    };
    refreshedAt: Date;
  }> {
    // Capture current state for comparison
    const previousCounts = {
      revoked: this.revokedTokens.size,
      active: this.activeTokens.size,
    };

    // Fetch fresh data from database
    const { revokedTokenIds, activeTokens } = await dataProvider();

    // Atomic replacement of cache data
    // This ensures thread-safety during refresh
    await this.loadFromDatabase(revokedTokenIds, activeTokens);

    const newCounts = {
      revoked: this.revokedTokens.size,
      active: this.activeTokens.size,
    };

    return {
      previousCounts,
      newCounts,
      refreshedAt: new Date(),
    };
  }

  /**
   * Refresh only revoked tokens list
   * Useful when a token is revoked and needs immediate cache update
   */
  async refreshRevokedTokens(revokedTokenProvider: () => Promise<string[]>): Promise<void> {
    const revokedTokenIds = await revokedTokenProvider();

    // Clear existing revoked tokens
    this.revokedTokens.clear();

    // Add each revoked token using existing method (includes removing from active)
    revokedTokenIds.forEach(tokenId => {
      this.addRevokedToken(tokenId);
    });
  }

  /**
   * Force immediate revocation of a token
   * Updates cache immediately without database call
   * Useful for emergency token revocation
   */
  forceRevokeToken(tokenId: string): void {
    this.addRevokedToken(tokenId);
  }

  /**
   * Manual cleanup of old revoked tokens
   * Should be used with repository's deleteOldRevokedTokens method
   * Only removes revoked tokens - active tokens are kept indefinitely
   */
  async manualCleanup(
    cleanupProvider: (olderThan: Date) => Promise<{
      deletedFromDb: number;
      revokedTokensToKeep: string[];
    }>,
  ): Promise<{
    deletedFromDb: number;
    removedFromCache: number;
    remainingRevoked: number;
    remainingActive: number;
  }> {
    // Define cutoff date (e.g., 1 year ago)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Clean database and get remaining revoked tokens
    const { deletedFromDb, revokedTokensToKeep } = await cleanupProvider(oneYearAgo);

    // Count how many we're removing from cache
    const originalRevokedCount = this.revokedTokens.size;

    // Update cache to only keep recent revoked tokens
    this.revokedTokens.clear();
    revokedTokensToKeep.forEach(tokenId => {
      this.revokedTokens.add(tokenId);
    });

    const removedFromCache = originalRevokedCount - this.revokedTokens.size;

    return {
      deletedFromDb,
      removedFromCache,
      remainingRevoked: this.revokedTokens.size,
      remainingActive: this.activeTokens.size,
    };
  }
}
